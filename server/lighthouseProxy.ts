import { lookup } from 'node:dns/promises';
import http from 'node:http';
import net from 'node:net';
import { assertPublicTarget, type PublicTargetResolver } from './publicTarget';

export type LighthouseProxyOptions = {
  resolver?: PublicTargetResolver;
  /** Test seams may lower, never raise, production resource limits. */
  connectTimeoutMs?: number;
  idleTimeoutMs?: number;
  maxConnections?: number;
  connector?: (options: { host: string; port: number; family: number }) => net.Socket;
};

function lowerLimit(value: number | undefined, maximum: number): number {
  if (value === undefined) return maximum;
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid proxy limits.');
  return Math.min(value, maximum);
}

const denied = 'Proxy request denied.';
const denialResponse = `HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: ${Buffer.byteLength(denied)}\r\n\r\n${denied}`;

export async function startLighthouseProxy(
  options: LighthouseProxyOptions = {},
): Promise<{ port: number; close(): Promise<void> }> {
  const connectTimeoutMs = lowerLimit(options.connectTimeoutMs, 10_000);
  const idleTimeoutMs = lowerLimit(options.idleTimeoutMs, 30_000);
  const maxConnections = lowerLimit(options.maxConnections, 128);
  const pending = new Set<() => void>();
  const server = http.createServer((_request, response) => {
    response.writeHead(403, { Connection: 'close', 'Content-Type': 'text/plain' });
    response.end(denied);
  });
  const sockets = new Set<net.Socket>();
  const track = (socket: net.Socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  };
  let activeClients = 0;
  server.on('connection', (socket) => {
    socket.on('error', () => {});
    if (activeClients >= maxConnections) { socket.destroy(); return; }
    activeClients++;
    socket.once('close', () => { activeClients--; });
    track(socket);
    socket.setTimeout(idleTimeoutMs, () => socket.destroy());
  });
  server.on('clientError', (_error, socket) => { socket.end(denialResponse); });
  server.on('connect', async (request, client, head) => {
    let upstream: net.Socket | undefined;
    let stopped = false;
    let established = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelDns: (() => void) | undefined;
    const clearDeadline = () => { clearTimeout(timer); pending.delete(cancel); };
    const cancel = () => {
      stopped = true;
      clearDeadline();
      cancelDns?.();
      upstream?.destroy();
    };
    const fail = () => {
      if (stopped) return;
      cancel();
      if (established) client.destroy();
      else if (!client.destroyed) client.end(denialResponse);
    };
    client.once('close', cancel);
    client.on('error', fail);
    pending.add(cancel);
    timer = setTimeout(fail, connectTimeoutMs);
    try {
      // No URL parser normalization: CONNECT must be exactly an ASCII DNS name:443.
      const match = /^([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?):443$/i.exec(request.url ?? '');
      if (!match) { fail(); return; }
      // Settle the validation wrapper on close so assertPublicTarget clears its own
      // DNS timer too. Native DNS may finish later but can never open a socket.
      const resolver: PublicTargetResolver = (hostname) => new Promise((resolve, reject) => {
        cancelDns = () => reject(new Error(denied));
        const work = options.resolver
          ? options.resolver(hostname)
          : lookup(hostname, { all: true, verbatim: true });
        work.then(resolve, reject);
      });
      const { addresses } = await assertPublicTarget(`https://${match[1]}/`, resolver, connectTimeoutMs);
      cancelDns = undefined;
      if (stopped || client.destroyed) return;
      const address = addresses[0];
      upstream = (options.connector ?? net.connect)({ host: address.address, port: 443, family: address.family });
      track(upstream);
      upstream.once('error', fail);
      upstream.once('close', () => client.destroy());
      upstream.once('connect', () => {
        if (stopped || client.destroyed) { upstream?.destroy(); return; }
        established = true;
        clearDeadline();
        (client as net.Socket).setTimeout(idleTimeoutMs);
        upstream!.setTimeout(idleTimeoutMs, fail);
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) upstream!.write(head);
        client.pipe(upstream!);
        upstream!.pipe(client);
      });
    } catch { fail(); }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0 }, resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Proxy unavailable.');
  let closing: Promise<void> | undefined;
  return {
    port: address.port,
    close: () => closing ??= new Promise<void>((resolve) => {
      server.close(() => resolve());
      for (const cancel of pending) cancel();
      for (const socket of sockets) socket.destroy();
    }),
  };
}
