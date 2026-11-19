import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP, type LookupFunction } from 'node:net';
import http from 'node:http';
import https from 'node:https';

export type TargetAddress = { address: string; family: number };
/** Resolver harus mengembalikan seluruh jawaban A/AAAA, bukan hanya satu. */
export type PublicTargetResolver = (hostname: string) => Promise<TargetAddress[]>;

const defaultResolver: PublicTargetResolver = (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true });

function ipv4Number(address: string): number {
  return address.split('.').reduce((value, octet) => value * 256 + Number(octet), 0);
}

const blockedV4: Array<[number, number]> = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
  ['192.0.2.0', 24], ['192.31.196.0', 24], ['192.52.193.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['192.175.48.0', 24],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
].map(([network, prefix]) => [ipv4Number(String(network)), Number(prefix)]);

function ipv6Number(address: string): bigint {
  const [left, right = ''] = address.split('::');
  const start = left ? left.split(':') : [];
  const end = right ? right.split(':') : [];
  const words = address.includes('::')
    ? [...start, ...Array(8 - start.length - end.length).fill('0'), ...end]
    : start;
  return words.reduce((value, word) => (value << 16n) | BigInt(`0x${word}`), 0n);
}

function isPublicAddress(record: TargetAddress): boolean {
  if (!record || typeof record.address !== 'string' || record.address.includes('%')) return false;
  const family = isIP(record.address);
  if (!family || family !== record.family) return false;
  if (family === 4) {
    const address = ipv4Number(record.address);
    return !blockedV4.some(([network, prefix]) =>
      Math.floor(address / 2 ** (32 - prefix)) === Math.floor(network / 2 ** (32 - prefix)));
  }
  // Allowlist global-unicast /3; konservatif: tolak mapped/translated/tunnel IPv6.
  if (record.address.includes('.')) return false;
  const address = ipv6Number(record.address);
  const inRange = (network: string, prefix: number) =>
    address >> BigInt(128 - prefix) === ipv6Number(network) >> BigInt(128 - prefix);
  return inRange('2000::', 3)
    && !inRange('2001::', 23)
    && !inRange('2001:db8::', 32)
    && !inRange('2002::', 16)
    && !inRange('2620:4f:8000::', 48)
    && !inRange('3ffe::', 16)
    && !inRange('3fff::', 20);
}

function parsePublicUrl(rawUrl: string): URL {
  if (typeof rawUrl !== 'string' || /[\u0000-\u0020\u007f\\]/.test(rawUrl)) {
    throw new Error('URL tidak valid.');
  }
  if (rawUrl.includes('?') || rawUrl.includes('#')) {
    throw new Error('URL dengan kueri atau fragmen tidak diizinkan.');
  }
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('URL tidak valid.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || !/^https?:\/\//i.test(rawUrl)) {
    throw new Error('Protokol URL harus HTTP atau HTTPS.');
  }
  const authority = rawUrl.match(/^https?:\/\/([^/?#]*)/i)?.[1] ?? '';
  if (!authority || authority.endsWith(':')) throw new Error('Authority URL tidak valid.');
  if (url.username || url.password || authority.includes('@')) {
    throw new Error('URL dengan kredensial tidak diizinkan.');
  }
  if (url.port) throw new Error('Port URL harus port standar HTTP/HTTPS.');
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (isIP(hostname.replace(/^\[|\]$/g, ''))) {
    throw new Error('URL alamat IP literal tidak diizinkan; gunakan hostname publik.');
  }
  const labels = hostname.split('.');
  const reserved = ['localhost', 'local', 'lan', 'internal', 'intranet', 'home', 'corp',
    'test', 'invalid', 'example', 'localdomain', 'onion', 'arpa', 'alt', 'svc', 'cluster', 'private'];
  if (labels.length < 2 || labels.some((label) =>
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
    || hostname.length > 253
    || reserved.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`))) {
    throw new Error('Hostname lokal, internal, reserved, atau tidak valid tidak diizinkan.');
  }
  url.hostname = hostname;
  return url;
}

export async function assertPublicTarget(
  rawUrl: string,
  resolver: PublicTargetResolver = defaultResolver,
  timeoutMs = 10_000,
): Promise<{ url: URL; addresses: TargetAddress[] }> {
  const url = parsePublicUrl(rawUrl);
  const timeout = boundedOption(timeoutMs, 10_000, 1);
  const timeoutError = new Error('Batas waktu DNS terlampaui.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let addresses: TargetAddress[];
  try {
    addresses = await Promise.race([
      resolver(url.hostname),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(timeoutError), timeout); }),
    ]);
  } catch (error) {
    throw error === timeoutError ? timeoutError : new Error('Resolusi DNS hostname gagal.');
  } finally {
    clearTimeout(timer);
  }
  // Array.from mengubah slot kosong menjadi undefined: fail closed, bukan dilewati every().
  if (!Array.isArray(addresses) || addresses.length === 0
    || !Array.from(addresses).every(isPublicAddress)) {
    throw new Error('DNS harus hanya berisi alamat IP publik.');
  }
  // Kembalikan snapshot terpisah agar resolver tidak dapat mengubah hasil sesudah validasi.
  return { url, addresses: addresses.map(({ address, family }) => ({ address, family })) };
}

export type PublicHtmlOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  resolver?: PublicTargetResolver;
  validateTarget?: (url: string) => void;
};
export type PublicHtmlResult = {
  url: string;
  status: number;
  headers: Record<string, string>;
  html: string;
  responseTimeMs: number;
};

function pinnedLookup(hostname: string, address: TargetAddress): LookupFunction {
  return (requestedHost, options, callback) => {
    if (requestedHost !== hostname) {
      callback(new Error('Hostname transport tidak cocok.'), '', 0);
      return;
    }
    if (typeof options === 'object' && options.all) {
      callback(null, [{ ...address }]);
    } else callback(null, address.address, address.family);
  };
}

type HopResult = { location: string } | { status: number; headers: Record<string, string>; html: string };

function requestHop(url: URL, address: TargetAddress, maxBytes: number, signal: AbortSignal): Promise<HopResult> {
  return new Promise((resolve, reject) => {
    let request: http.ClientRequest | undefined;
    let response: http.IncomingMessage | undefined;
    let settled = false;
    const finish = (error?: Error, value?: HopResult) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      if (error || (value && 'location' in value)) {
        response?.destroy();
        request?.destroy();
      }
      if (error) reject(error);
      else resolve(value!);
    };
    const onAbort = () => finish(new Error('Batas waktu probe terlampaui.'));
    if (signal.aborted) { onAbort(); return; }
    signal.addEventListener('abort', onAbort, { once: true });
    const requestOptions: https.RequestOptions & { autoSelectFamily: boolean } = {
      method: 'GET',
      headers: { Accept: 'text/html, application/xhtml+xml', 'Accept-Encoding': 'identity' },
      lookup: pinnedLookup(url.hostname, address),
      family: address.family,
      autoSelectFamily: false,
      agent: false,
      servername: url.hostname,
      rejectUnauthorized: true,
    };
    try {
      request = (url.protocol === 'https:' ? https : http).request(url, requestOptions, (incoming) => {
        response = incoming;
        incoming.once('error', () => finish(new Error('Permintaan website gagal.')));
        incoming.once('aborted', () => finish(new Error('Respons website terputus.')));
        incoming.once('close', () => {
          if (!settled && !incoming.complete) finish(new Error('Respons website terputus.'));
        });
        const status = incoming.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          if (![301, 302, 303, 307, 308].includes(status) || !incoming.headers.location) {
            finish(new Error('Respons redirect tidak valid.'));
          } else finish(undefined, { location: incoming.headers.location });
          return;
        }
        const contentType = incoming.headers['content-type']?.split(';', 1)[0].trim().toLowerCase();
        if (contentType !== 'text/html' && contentType !== 'application/xhtml+xml') {
          finish(new Error('Respons harus berupa HTML.'));
          return;
        }
        const encoding = incoming.headers['content-encoding']?.trim().toLowerCase();
        if (encoding && encoding !== 'identity') {
          finish(new Error('Respons kompresi tidak didukung.'));
          return;
        }
        const declaredLength = Number(incoming.headers['content-length']);
        if (declaredLength > maxBytes) {
          finish(new Error('Batas ukuran respons terlampaui.'));
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        incoming.on('data', (chunk) => {
          if (settled) return;
          const buffer = Buffer.from(chunk);
          bytes += buffer.length;
          if (bytes > maxBytes) finish(new Error('Batas ukuran respons terlampaui.'));
          else chunks.push(buffer);
        });
        incoming.once('end', () => {
          const headers: Record<string, string> = {};
          for (const [name, value] of Object.entries(incoming.headers)) {
            if (value !== undefined) headers[name] = Array.isArray(value) ? value.join(', ') : value;
          }
          finish(undefined, { status, headers, html: Buffer.concat(chunks).toString('utf8') });
        });
      });
      request.once('error', () => finish(new Error('Permintaan website gagal.')));
      request.end();
    } catch {
      finish(new Error('Permintaan website gagal.'));
    }
  });
}

function redirectUrl(location: string, previous: URL): URL {
  if (/[\u0000-\u0020\u007f\\]/.test(location) || location.includes('?') || location.includes('#')) {
    throw new Error('URL redirect tidak valid; kueri atau fragmen tidak diizinkan.');
  }
  const authority = location.match(/^(?:https?:)?\/\/([^/?#]*)/i)?.[1] ?? '';
  if (authority.includes('@')) throw new Error('URL redirect dengan kredensial tidak diizinkan.');
  let next: URL;
  try {
    next = new URL(location, previous);
  } catch {
    throw new Error('URL redirect tidak valid.');
  }
  next = parsePublicUrl(next.href);
  if (previous.protocol === 'https:' && next.protocol !== 'https:') {
    throw new Error('Redirect HTTPS ke HTTP tidak diizinkan.');
  }
  return next;
}

function boundedOption(value: number | undefined, fallback: number, minimum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error('Opsi batas tidak valid.');
  return Math.min(value, fallback);
}

function untilAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new Error('Batas waktu probe terlampaui.'));
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

export async function fetchPublicHtml(
  rawUrl: string,
  options: PublicHtmlOptions = {},
): Promise<PublicHtmlResult> {
  const started = performance.now();
  const timeoutMs = boundedOption(options.timeoutMs, 10_000, 1);
  const maxBytes = boundedOption(options.maxBytes, 1024 * 1024, 1);
  const maxRedirects = boundedOption(options.maxRedirects, 3, 0);
  const deadline = started + timeoutMs;
  const controller = new AbortController();
  // Satu timer absolut, termasuk DNS, TLS, header, body, dan seluruh redirect.
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const checkDeadline = () => {
    if (controller.signal.aborted || performance.now() >= deadline) {
      controller.abort();
      throw new Error('Batas waktu probe terlampaui.');
    }
  };
  try {
    let target = rawUrl;
    for (let redirects = 0; ; redirects++) {
      checkDeadline();
      options.validateTarget?.(parsePublicUrl(target).href);
      const { url, addresses } = await untilAbort(assertPublicTarget(target, options.resolver), controller.signal);
      checkDeadline();
      const result = await requestHop(url, addresses[0], maxBytes, controller.signal);
      checkDeadline();
      if (!('location' in result)) {
        return { url: url.href, ...result, responseTimeMs: performance.now() - started };
      }
      if (redirects >= maxRedirects) throw new Error('Batas redirect terlampaui.');
      target = redirectUrl(result.location, url).href;
    }
  } finally { clearTimeout(timer); }
}
