import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import http, { type IncomingMessage } from 'node:http';
import https, { type RequestOptions as HttpsRequestOptions } from 'node:https';
type RequestOptions = HttpsRequestOptions & { autoSelectFamily?: boolean };
import { PassThrough } from 'node:stream';
import test, { type TestContext } from 'node:test';
import * as publicTarget from './publicTarget.ts';
const { assertPublicTarget } = publicTarget;

const publicDns = async () => [{ address: '93.184.215.14', family: 4 }];

// Tidak membuka socket: semua jawaban DNS pada uji ini disuntikkan.
const unsafeAddresses: Array<[string, number]> = [
  ['10.23.45.67', 4], ['127.0.0.1', 4], ['0.0.0.0', 4], ['0.1.2.3', 4],
  ['100.64.0.1', 4], ['100.127.255.254', 4], ['169.254.169.254', 4],
  ['172.16.0.1', 4], ['172.31.255.254', 4], ['192.168.1.1', 4],
  ['192.0.0.9', 4], ['192.0.2.1', 4], ['192.88.99.1', 4],
  ['192.31.196.1', 4], ['192.52.193.1', 4], ['192.175.48.1', 4],
  ['::ffff:7f00:1', 6], ['::ffff:5db8:d70e', 6], ['2620:4f:8000::1', 6],
  ['198.18.0.1', 4], ['198.19.255.254', 4], ['198.51.100.1', 4],
  ['203.0.113.1', 4], ['224.0.0.1', 4], ['239.255.255.255', 4],
  ['240.0.0.1', 4], ['255.255.255.255', 4],
  ['::', 6], ['::1', 6], ['::ffff:127.0.0.1', 6],
  ['::ffff:93.184.215.14', 6], ['::ffff:0:10.0.0.1', 6],
  ['fc00::1', 6], ['fd00::1', 6], ['fe80::1', 6], ['ff02::1', 6],
  ['fec0::1', 6], ['2001:db8::1', 6], ['2001::1', 6], ['2001:20::1', 6],
  ['2002:7f00:1::', 6], ['64:ff9b::7f00:1', 6], ['64:ff9b:1::a00:1', 6],
  ['100::1', 6], ['3ffe::1', 6], ['3fff::1', 6], ['4000::1', 6],
];
for (const [address, family] of unsafeAddresses) {
  test(`menolak DNS nonpublik ${address}`, async () => {
    await assert.rejects(
      assertPublicTarget('https://public-site.com/', async () => [{ address, family }]),
      /alamat IP publik/i,
    );
  });
}

test('menolak DNS campuran publik dan privat pada urutan apa pun', async () => {
  for (const addresses of [
    [{ address: '93.184.215.14', family: 4 }, { address: '10.0.0.1', family: 4 }],
    [{ address: '::1', family: 6 }, { address: '2606:4700:4700::1111', family: 6 }],
  ]) {
    await assert.rejects(assertPublicTarget('https://public-site.com/', async () => addresses), /alamat IP publik/i);
  }
});

test('menolak DNS kosong atau jawaban tidak valid termasuk array berlubang', async () => {
  const invalid: unknown[] = [[], null, undefined, Array(1),
    [{ address: '10.0.0.1', family: 6 }],
    [{ address: '93.184.215.14', family: 6 }],
    [{ address: '2606:4700:4700::1111', family: 4 }],
    [{ address: 'not-an-ip', family: 4 }],
    [{ address: '2606:4700:4700::1111%eth0', family: 6 }],
  ];
  for (const addresses of invalid) {
    await assert.rejects(assertPublicTarget('https://public-site.com/', async () => addresses as never), /alamat IP publik/i);
  }
});

test('DNS gagal tidak membocorkan detail resolver', async () => {
  await assert.rejects(assertPublicTarget('https://public-site.com/', async () => {
    throw new Error('detail-internal-fixture');
  }), (error: Error) => error.message === 'Resolusi DNS hostname gagal.');
});

test('menerima hostname publik dan seluruh alamat publik IPv4/IPv6', async () => {
  const addresses = [
    { address: '93.184.215.14', family: 4 },
    { address: '8.8.8.8', family: 4 },
    { address: '2606:4700:4700::1111', family: 6 },
    { address: '2001:4860:4860::8888', family: 6 },
  ];
  const calls: string[] = [];
  const target = await assertPublicTarget('https://WWW.Public-Site.COM.:443/path', async (hostname) => {
    calls.push(hostname);
    return addresses;
  });
  assert.equal(target.url.href, 'https://www.public-site.com/path');
  assert.deepEqual(target.addresses, addresses);
  assert.deepEqual(calls, ['www.public-site.com']);
  addresses[0].address = '127.0.0.1';
  assert.equal(target.addresses[0].address, '93.184.215.14', 'salin snapshot jawaban DNS');
});

const unsafeUrls = [
  'http://localhost/', 'http://LOCALHOST./', 'http://a.localhost/',
  'http://printer.local/', 'http://router.lan/', 'http://backend.internal/',
  'http://intranet/', 'http://metadata.google.internal/', 'http://metadata/',
  'http://home.arpa/', 'http://a.home.arpa/', 'http://service.test/',
  'http://site.invalid/', 'http://site.example/', 'http://localhost.localdomain/',
  'http://foo.localdomain/', 'http://foo.onion/', 'http://foo.in-addr.arpa/',
  'http://127.0.0.1/', 'http://2130706433/', 'http://0177.0.0.1/',
  'http://0x7f000001/', 'http://127.1/', 'http://[::1]/',
  'https://93.184.215.14/', 'https://[2606:4700:4700::1111]/',
  'http://[::ffff:127.0.0.1]/', 'http://%31%32%37.0.0.1/',
  'http://user@public-site.com/', 'http://user:pass@public-site.com/',
  'http://@public-site.com/', 'http://localhost@public-site.com/',
  'http://public-site.com:8080/', 'https://public-site.com:8443/',
  'https://public-site.com:80/', 'http://public-site.com:443/',
  'https://public-site.com/?token=fixture', 'https://public-site.com/?',
  'https://public-site.com/#fixture', 'https://public-site.com/#',
  'ftp://public-site.com/', 'file:///etc/hosts', '//public-site.com/',
  'https://public-site.com\\@localhost/', ' https://public-site.com/',
  'https://public-site.com/\n', 'http://foo..com/', 'http://-foo.com/',
  'http://foo-.com/', 'http://foo_bar.com/', 'http://foo.com../',
  'https:///@public-site.com/', 'https:////public-site.com/',
  'https:///public-site.com/', 'https://public-site.com:/',
  'http://service.svc/', 'http://app.cluster/', 'http://server.private/',
  'http://router.home/', 'http://company.corp/', 'http://service.alt/',
  'http://%6cocalhost/', 'http://localhost。/', 'http://foo.internal./',
];
for (const raw of unsafeUrls) {
  test(`menolak URL tidak aman ${JSON.stringify(raw)}`, async () => {
    let dnsCalls = 0;
    await assert.rejects(assertPublicTarget(raw, async () => {
      dnsCalls++;
      return publicDns();
    }), /URL|host|port|kueri|fragmen|kredensial|protokol|alamat IP/i);
    assert.equal(dnsCalls, 0, 'target tidak aman ditolak sebelum DNS');
  });
}

type Fixture = {
  status?: number;
  headers?: Record<string, string>;
  chunks?: Array<string | Buffer>;
  delayMs?: number;
  hang?: boolean;
  error?: Error;
  incomplete?: boolean;
  bodyHang?: boolean;
  syncThrow?: boolean;
};
type CapturedRequest = {
  url: URL;
  options: RequestOptions;
  request: EventEmitter & { destroyed: boolean; end(): void; destroy(error?: Error): void };
  response?: PassThrough & { statusCode: number; headers: Record<string, string>; complete: boolean };
};

/** Seams hanya untuk transport Node; tidak bind server, tidak socket, tidak DNS nyata. */
function fixtureTransport(t: TestContext, fixtures: Fixture[]) {
  const calls: CapturedRequest[] = [];
  function request(url: URL, options: RequestOptions, callback: (res: IncomingMessage) => void) {
    const fixture = fixtures[calls.length];
    assert.ok(fixture, 'request transport tak terduga');
    if (fixture.syncThrow) throw new Error('detail-internal-fixture');
    const req = Object.assign(new EventEmitter(), {
      destroyed: false,
      end() {
        const deliver = () => {
          if (req.destroyed) return;
          if (fixture.error) { req.emit('error', fixture.error); return; }
          if (fixture.hang) return;
          const response = Object.assign(new PassThrough(), {
            statusCode: fixture.status ?? 200,
            headers: fixture.headers ?? { 'content-type': 'text/html; charset=utf-8' },
            complete: !fixture.incomplete,
          });
          call.response = response;
          callback(response as unknown as IncomingMessage);
          queueMicrotask(() => {
            if (response.destroyed) return;
            for (const chunk of fixture.chunks ?? ['<html>publik</html>']) {
              if (response.destroyed) break;
              response.write(chunk);
            }
            if (fixture.incomplete) response.destroy();
            else if (!fixture.bodyHang) response.end();
          });
        };
        if (fixture.delayMs) {
          const timer = setTimeout(deliver, fixture.delayMs);
          t.after(() => clearTimeout(timer));
        } else queueMicrotask(deliver);
      },
      destroy(error?: Error) {
        if (req.destroyed) return;
        req.destroyed = true;
        call.response?.destroy();
        if (error) queueMicrotask(() => req.emit('error', error));
      },
    });
    const call: CapturedRequest = { url, options, request: req };
    calls.push(call);
    return req;
  }
  t.mock.method(http, 'request', request);
  t.mock.method(https, 'request', request);
  return calls;
}

test('fetchPublicHtml mengembalikan HTML dari hostname publik tanpa socket', async (t) => {
  const calls = fixtureTransport(t, [{}]);
  assert.equal(typeof publicTarget.fetchPublicHtml, 'function', 'ekspor fetchPublicHtml wajib ada');
  const result = await publicTarget.fetchPublicHtml('https://public-site.com/path', { resolver: publicDns });
  assert.equal(result.url, 'https://public-site.com/path');
  assert.equal(result.status, 200);
  assert.deepEqual(result.headers, { 'content-type': 'text/html; charset=utf-8' });
  assert.equal(result.html, '<html>publik</html>');
  assert.ok(result.responseTimeMs >= 0 && result.responseTimeMs < 10_000);
  assert.equal(calls.length, 1);
});

async function lookupResult(call: CapturedRequest, all = false, hostname = call.url.hostname) {
  assert.equal(typeof call.options.lookup, 'function', 'wajib memakai custom lookup');
  return new Promise<{ address: unknown; family?: number }>((resolve, reject) => {
    call.options.lookup!(hostname, { all } as never, (error, address, family) => {
      if (error) reject(error);
      else resolve({ address, family });
    });
  });
}

test('pin lookup memakai snapshot publik, SNI/Host asli, TLS tetap ketat dan tanpa pool', async (t) => {
  const calls = fixtureTransport(t, [{}]);
  let dnsCalls = 0;
  await publicTarget.fetchPublicHtml('https://public-site.com/path', {
    resolver: async () => {
      dnsCalls++;
      return dnsCalls === 1 ? publicDns() : [{ address: '127.0.0.1', family: 4 }];
    },
  });
  assert.deepEqual(await lookupResult(calls[0]), { address: '93.184.215.14', family: 4 });
  assert.deepEqual(await lookupResult(calls[0], true), { address: [{ address: '93.184.215.14', family: 4 }], family: undefined });
  assert.equal(dnsCalls, 1, 'custom lookup tidak melakukan resolusi DNS kedua');
  assert.equal(calls[0].url.hostname, 'public-site.com', 'URL tetap hostname untuk Host header');
  assert.equal(calls[0].options.servername, 'public-site.com');
  assert.equal(calls[0].options.rejectUnauthorized, true);
  assert.equal(calls[0].options.agent, false);
  assert.equal(calls[0].options.autoSelectFamily, false);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.family, 4);
  await assert.rejects(lookupResult(calls[0], false, 'other-site.com'), /host/i);
});

test('pin IPv6 publik didukung tanpa fallback jaringan', async (t) => {
  const calls = fixtureTransport(t, [{}]);
  await publicTarget.fetchPublicHtml('http://public-site.com/', {
    resolver: async () => [{ address: '2606:4700:4700::1111', family: 6 }],
  });
  assert.deepEqual(await lookupResult(calls[0]), { address: '2606:4700:4700::1111', family: 6 });
  assert.equal(calls[0].options.family, 6);
});

for (const contentType of [undefined, 'application/json', 'text/plain', 'text/htmlx', 'application/xhtml+xmlx']) {
  test(`fetch menolak tipe konten non-HTML ${contentType ?? '(kosong)'}`, async (t) => {
    const calls = fixtureTransport(t, [{ headers: contentType ? { 'content-type': contentType } : {} }]);
    await assert.rejects(publicTarget.fetchPublicHtml('https://public-site.com/', { resolver: publicDns }), /HTML/i);
    assert.equal(calls[0].response?.destroyed, true);
  });
}

test('fetch menerima XHTML dengan header case-insensitive dan tidak meminta kompresi', async (t) => {
  const calls = fixtureTransport(t, [{ headers: { 'content-type': 'Application/XHTML+XML; charset=UTF-8' } }]);
  const result = await publicTarget.fetchPublicHtml('https://public-site.com/', { resolver: publicDns });
  assert.equal(result.html, '<html>publik</html>');
  assert.equal((calls[0].options.headers as Record<string, string>)['Accept-Encoding'], 'identity');
});

for (const encoding of ['gzip', 'br', 'deflate']) {
  test(`fetch menolak body terkompresi ${encoding} agar batas ukuran tidak ambigu`, async (t) => {
    fixtureTransport(t, [{ headers: { 'content-type': 'text/html', 'content-encoding': encoding } }]);
    await assert.rejects(publicTarget.fetchPublicHtml('https://public-site.com/', { resolver: publicDns }), /kompresi/i);
  });
}

for (const status of [301, 302, 303, 307, 308]) {
  test(`redirect ${status} relatif divalidasi ulang per hop`, async (t) => {
    const calls = fixtureTransport(t, [
      { status, headers: { location: '/next' } },
      { chunks: ['<html>akhir</html>'] },
    ]);
    let dnsCalls = 0;
    const result = await publicTarget.fetchPublicHtml('https://public-site.com/start', {
      resolver: async () => {
        dnsCalls++;
        return [{ address: dnsCalls === 1 ? '93.184.215.14' : '8.8.8.8', family: 4 }];
      },
    });
    assert.equal(result.url, 'https://public-site.com/next');
    assert.equal(result.html, '<html>akhir</html>');
    assert.equal(dnsCalls, 2);
    assert.equal(calls[0].response?.destroyed, true, 'body redirect tidak diunduh');
    assert.deepEqual(await lookupResult(calls[1]), { address: '8.8.8.8', family: 4 });
  });
}

for (const location of [
  'http://public-site.com/', 'https://127.0.0.1/', 'https://[::1]/',
  'https://localhost/', 'https://printer.local/', 'https://user@public-site.com/',
  'https://public-site.com:8443/', 'https://public-site.com/?fixture=1',
  '?', '#', '/next#', '/next?', 'ftp://public-site.com/',
  'https://public-site.com\\@localhost/',
]) {
  test(`redirect menolak lokasi tidak aman ${JSON.stringify(location)}`, async (t) => {
    const calls = fixtureTransport(t, [{ status: 302, headers: { location } }]);
    await assert.rejects(publicTarget.fetchPublicHtml('https://public-site.com/start', { resolver: publicDns }),
      /URL|HTTPS|host|alamat IP|kueri|fragmen|port|protokol|kredensial/i);
    assert.equal(calls.length, 1);
  });
}

test('redirect ke DNS privat ditolak sebelum request kedua', async (t) => {
  const calls = fixtureTransport(t, [{ status: 302, headers: { location: 'https://other-site.com/' } }]);
  const resolved: string[] = [];
  await assert.rejects(publicTarget.fetchPublicHtml('https://public-site.com/', {
    resolver: async (hostname) => {
      resolved.push(hostname);
      return [{ address: hostname === 'public-site.com' ? '93.184.215.14' : '169.254.169.254', family: 4 }];
    },
  }), /alamat IP publik/i);
  assert.deepEqual(resolved, ['public-site.com', 'other-site.com']);
  assert.equal(calls.length, 1);
});

test('allowlist pilot divalidasi pada setiap hop sebelum koneksi redirect', async (t) => {
  const calls = fixtureTransport(t, [{ status: 302, headers: { location: 'https://outside-site.com/' } }]);
  const checked: string[] = [];
  await assert.rejects(publicTarget.fetchPublicHtml('https://public-site.com/', {
    resolver: publicDns,
    validateTarget: url => { checked.push(url); if (new URL(url).hostname !== 'public-site.com') throw new Error('Target di luar pilot.'); },
  }), /pilot/);
  assert.deepEqual(checked, ['https://public-site.com/', 'https://outside-site.com/']);
  assert.equal(calls.length, 1, 'target di luar allowlist tidak boleh dikunjungi');
});

test('redirect hostname sama dengan DNS rebind privat ditolak pada hop berikutnya', async (t) => {
  const calls = fixtureTransport(t, [{ status: 302, headers: { location: '/next' } }]);
  let dnsCalls = 0;
  await assert.rejects(publicTarget.fetchPublicHtml('https://public-site.com/', {
    resolver: async () => [{ address: ++dnsCalls === 1 ? '93.184.215.14' : '10.0.0.1', family: 4 }],
  }), /alamat IP publik/i);
  assert.equal(calls.length, 1);
});

test('redirect HTTP ke HTTPS publik diperbolehkan', async (t) => {
  const calls = fixtureTransport(t, [{ status: 302, headers: { location: 'https://other-site.com/' } }, {}]);
  const result = await publicTarget.fetchPublicHtml('http://public-site.com/', { resolver: publicDns });
  assert.equal(result.url, 'https://other-site.com/');
  assert.equal(calls.length, 2);
});

test('maksimal tiga redirect dan satu request akhir', async (t) => {
  const calls = fixtureTransport(t, [
    { status: 302, headers: { location: '/one' } },
    { status: 307, headers: { location: '/two' } },
    { status: 308, headers: { location: '/three' } }, {},
  ]);
  const result = await publicTarget.fetchPublicHtml('https://public-site.com/', { resolver: publicDns });
  assert.equal(result.url, 'https://public-site.com/three');
  assert.equal(calls.length, 4);
});

for (const maxRedirects of [undefined, 30]) {
  test(`redirect keempat ditolak termasuk saat override ${maxRedirects}`, async (t) => {
    const calls = fixtureTransport(t, Array.from({ length: 4 }, (_, i) => ({ status: 302, headers: { location: `/hop-${i}` } })));
    await assert.rejects(publicTarget.fetchPublicHtml('https://public-site.com/', { resolver: publicDns, maxRedirects }), /redirect/i);
    assert.equal(calls.length, 4);
  });
}

test('opsi maxRedirects nol menolak redirect pertama', async (t) => {
  const calls = fixtureTransport(t, [{ status: 302, headers: { location: '/next' } }]);
  await assert.rejects(publicTarget.fetchPublicHtml('https://public-site.com/', { resolver: publicDns, maxRedirects: 0 }), /redirect/i);
  assert.equal(calls.length, 1);
});

test('respons 302 tanpa Location ditolak', async (t) => {
  fixtureTransport(t, [{ status: 302, headers: {} }]);
  await assert.rejects(publicTarget.fetchPublicHtml('https://public-site.com/', { resolver: publicDns }), /redirect/i);
});

for (const status of [300, 304, 305, 306]) {
  test(`kode ${status} bukan redirect yang diikuti`, async (t) => {
    const calls = fixtureTransport(t, [{ status, headers: { location: '/next', 'content-type': 'text/html' } }]);
    await assert.rejects(publicTarget.fetchPublicHtml('https://public-site.com/', { resolver: publicDns }), /redirect/i);
    assert.equal(calls.length, 1);
  });
}

for (const maxBytes of [undefined, 2 * 1024 * 1024]) {
  test(`body streaming melebihi 1 MiB ditolak walau override ${maxBytes}`, async (t) => {
    const calls = fixtureTransport(t, [{ chunks: [Buffer.alloc(1024 * 1024, 65), 'x'] }]);
    await assert.rejects(publicTarget.fetchPublicHtml('https://public-site.com/', { resolver: publicDns, maxBytes }), /ukuran/i);
    assert.equal(calls[0].response?.destroyed, true);
    assert.equal(calls[0].request.destroyed, true);
  });
}

test('body tepat 1 MiB diterima', async (t) => {
  fixtureTransport(t, [{ chunks: [Buffer.alloc(1024 * 1024, 65)] }]);
  const result = await publicTarget.fetchPublicHtml('https://public-site.com/', { resolver: publicDns });
  assert.equal(Buffer.byteLength(result.html), 1024 * 1024);
});

test('maxBytes lebih kecil dihormati berdasarkan byte UTF-8, bukan karakter', async (t) => {
  const calls = fixtureTransport(t, [{ chunks: ['é', 'é', 'é'] }]);
  await assert.rejects(publicTarget.fetchPublicHtml('https://public-site.com/', { resolver: publicDns, maxBytes: 5 }), /ukuran/i);
  assert.equal(calls[0].response?.destroyed, true);
});

test('Content-Length melebihi batas ditolak sebelum body', async (t) => {
  const calls = fixtureTransport(t, [{ headers: { 'content-type': 'text/html', 'content-length': '1048577' }, chunks: [] }]);
  await assert.rejects(publicTarget.fetchPublicHtml('https://public-site.com/', { resolver: publicDns }), /ukuran/i);
  assert.equal(calls[0].response?.destroyed, true);
});

// Guard membuat implementasi tanpa deadline tetap gagal deterministik, bukan menggantung.
const realSetTimeout = globalThis.setTimeout;
async function guarded<T>(work: Promise<T>, ms = 150): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => { timer = realSetTimeout(() => reject(new Error('test guard: deadline missing')), ms); }),
    ]);
  } finally { clearTimeout(timer!); }
}

test('validasi DNS awal punya tenggat meskipun resolver tidak selesai', async () => {
  let resolveDns!: (value: Array<{ address: string; family: number }>) => void;
  const pending = assertPublicTarget('https://public-site.com/', () => new Promise(resolve => { resolveDns = resolve; }), 10);
  try {
    await assert.rejects(guarded(pending), /waktu.*DNS/i);
  } finally {
    resolveDns(await publicDns());
  }
});

test('deadline mencakup DNS lambat dan tidak mengirim request setelah timeout', async (t) => {
  const calls = fixtureTransport(t, [{}]);
  let resolveDns!: (value: Array<{ address: string; family: number }>) => void;
  const work = publicTarget.fetchPublicHtml('https://public-site.com/', {
    timeoutMs: 10,
    resolver: () => new Promise((resolve) => { resolveDns = resolve; }),
  });
  await assert.rejects(guarded(work), /waktu/i);
  resolveDns(await publicDns());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 0, 'DNS terlambat tidak boleh memulai request');
});

test('deadline memutus request yang menggantung', async (t) => {
  const calls = fixtureTransport(t, [{ hang: true }]);
  await assert.rejects(guarded(publicTarget.fetchPublicHtml('https://public-site.com/', {
    timeoutMs: 10, resolver: publicDns,
  })), /waktu/i);
  assert.equal(calls[0].request.destroyed, true);
});

for (const timeoutMs of [undefined, 20_000]) {
  test(`deadline maksimum 10 detik walau override ${timeoutMs}`, async (t) => {
    const calls = fixtureTransport(t, [{ hang: true }]);
    const realTimeout = setTimeout;
    const durations: number[] = [];
    t.mock.method(globalThis, 'setTimeout', (callback: () => void, delay: number) => {
      durations.push(delay);
      return realTimeout(callback, 1);
    });
    await assert.rejects(guarded(publicTarget.fetchPublicHtml('https://public-site.com/', { timeoutMs, resolver: publicDns })), /waktu/i);
    assert.ok(durations.length > 0);
    assert.ok(durations.every((duration) => duration <= 10_000 && duration > 0));
    assert.equal(calls[0].request.destroyed, true);
  });
}

test('deadline absolut mencakup DNS di seluruh redirect, bukan direset per hop', async (t) => {
  const calls = fixtureTransport(t, [{ status: 302, headers: { location: '/next' } }, {}]);
  let now = 0;
  t.mock.method(performance, 'now', () => now);
  await assert.rejects(guarded(publicTarget.fetchPublicHtml('https://public-site.com/', {
    timeoutMs: 10,
    resolver: async () => { now += 6; return publicDns(); },
  })), /waktu/i);
  assert.equal(calls.length, 1, 'hop kedua dilarang setelah budget habis');
});

test('body terpotong ditolak segera, bukan menunggu deadline', async (t) => {
  const calls = fixtureTransport(t, [{ incomplete: true }]);
  await assert.rejects(guarded(publicTarget.fetchPublicHtml('https://public-site.com/', { resolver: publicDns })), /terputus/i);
  assert.equal(calls[0].request.destroyed, true);
});

test('deadline berlaku saat body mengalir tetapi tidak berakhir', async (t) => {
  const calls = fixtureTransport(t, [{ bodyHang: true, chunks: ['<html>parsial'] }]);
  await assert.rejects(guarded(publicTarget.fetchPublicHtml('https://public-site.com/', { resolver: publicDns, timeoutMs: 10 })), /waktu/i);
  assert.equal(calls[0].request.destroyed, true);
  assert.equal(calls[0].response?.destroyed, true);
});

for (const fixture of [{ error: new Error('detail-internal-fixture') }, { syncThrow: true }]) {
  test(`error transport ${fixture.syncThrow ? 'sinkron' : 'asinkron'} disanitasi`, async (t) => {
    fixtureTransport(t, [fixture]);
    await assert.rejects(publicTarget.fetchPublicHtml('https://public-site.com/', { resolver: publicDns }),
      (error: Error) => error.message === 'Permintaan website gagal.');
  });
}

for (const [option, value] of [
  ['maxBytes', 0], ['maxBytes', -1], ['maxBytes', NaN], ['maxBytes', Infinity], ['maxBytes', 1.5],
  ['timeoutMs', 0], ['timeoutMs', -1], ['timeoutMs', NaN], ['timeoutMs', Infinity], ['timeoutMs', 1.5],
  ['maxRedirects', -1], ['maxRedirects', NaN], ['maxRedirects', Infinity], ['maxRedirects', 1.5],
] as const) {
  test(`opsi ${option}=${value} tidak valid ditolak sebelum DNS`, async (t) => {
    const calls = fixtureTransport(t, [{}]);
    let dnsCalls = 0;
    await assert.rejects(publicTarget.fetchPublicHtml('https://public-site.com/', {
      [option]: value, resolver: async () => { dnsCalls++; return publicDns(); },
    }), /opsi/i);
    assert.equal(dnsCalls, 0);
    assert.equal(calls.length, 0);
  });
}

