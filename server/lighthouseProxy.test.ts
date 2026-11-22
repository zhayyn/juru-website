import assert from 'node:assert/strict';
import { once } from 'node:events';
import net from 'node:net';
import { test } from 'node:test';

class TestUpstream extends net.Socket {
  writes: Buffer[] = [];
  override _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.writes.push(Buffer.from(chunk));
    callback();
  }
}

async function tick() { await new Promise((resolve) => setTimeout(resolve, 15)); }

async function within<T>(work: Promise<T>, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), 250);
    })]);
  } finally { clearTimeout(timer); }
}

async function request(port: number, raw: string): Promise<string> {
  const socket = net.connect(port, '127.0.0.1');
  socket.setTimeout(1000, () => socket.destroy(new Error('Test request timed out')));
  const chunks: Buffer[] = [];
  socket.on('data', (chunk) => chunks.push(chunk));
  await once(socket, 'connect');
  socket.write(raw);
  await once(socket, 'close');
  return Buffer.concat(chunks).toString();
}

function connectRequest(authority: string): string {
  return `CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`;
}

async function proxyModule() {
  const module = await import('./lighthouseProxy').catch(() => null);
  assert.ok(module?.startLighthouseProxy, 'proxy start API must exist');
  return module;
}

test('binds exclusively to IPv4 loopback on an ephemeral port and closes idempotently', async () => {
  const { startLighthouseProxy } = await proxyModule();
  const listen = net.Server.prototype.listen;
  const bindings: unknown[][] = [];
  net.Server.prototype.listen = function (this: net.Server, ...args: unknown[]) {
    bindings.push(args);
    return Reflect.apply(listen, this, args);
  } as typeof listen;
  let proxy: Awaited<ReturnType<typeof startLighthouseProxy>>;
  try { proxy = await startLighthouseProxy(); }
  finally { net.Server.prototype.listen = listen; }
  try {
    assert.ok(proxy.port > 0);
    assert.ok(bindings.some(([options]) => typeof options === 'object' && options !== null
      && (options as { host: string }).host === '127.0.0.1'
      && (options as { port: number }).port === 0));
    const socket = net.connect(proxy.port, '127.0.0.1');
    await once(socket, 'connect');
    socket.destroy();
  } finally { await proxy.close(); }
  await proxy.close();
  const refused = net.connect(proxy.port, '127.0.0.1');
  await assert.rejects(once(refused, 'connect'));
  refused.destroy();
});

test('rejects malformed, non-443, literal, reserved CONNECT authorities', async () => {
  const { startLighthouseProxy } = await proxyModule();
  const proxy = await startLighthouseProxy();
  try {
    for (const authority of [
      'example.com:80', 'example.com', 'example.com:0443', 'example.com:443/',
      'https://example.com:443', 'user:password@example.com:443',
      '127.0.0.1:443', '[::1]:443', '2130706433:443', '0x7f000001:443',
      'localhost:443', 'service.local:443', 'service.internal:443',
      'example.com:443?secret', 'example.com:443#secret', 'example%2ecom:443',
      'example.com.:443', 'example..com:443',
    ]) {
      const response = await request(proxy.port, connectRequest(authority));
      assert.match(response, /^HTTP\/1\.1 403 /, authority);
      assert.ok(!response.includes(authority));
    }
  } finally { await proxy.close(); }
});

test('validates DNS once, pins the numeric address, waits for connect, and forwards both ways', async () => {
  const { startLighthouseProxy } = await proxyModule();
  const upstream = new TestUpstream();
  let lookups = 0;
  let connection: unknown;
  const proxy = await startLighthouseProxy({
    resolver: async (hostname) => {
      assert.equal(hostname, 'example.com');
      lookups++;
      return [{ address: '93.184.216.34', family: 4 }];
    },
    connector: (options) => { connection = options; return upstream; },
  });
  const client = net.connect(proxy.port, '127.0.0.1');
  const chunks: Buffer[] = [];
  client.on('data', (chunk) => chunks.push(chunk));
  try {
    await once(client, 'connect');
    client.write(connectRequest('example.com:443') + 'early bytes');
    await tick();
    assert.equal(lookups, 1);
    assert.deepEqual(connection, { host: '93.184.216.34', port: 443, family: 4 });
    assert.equal(chunks.length, 0, 'no successful CONNECT before upstream connection');
    upstream.emit('connect');
    await tick();
    assert.match(Buffer.concat(chunks).toString(), /^HTTP\/1\.1 200 Connection Established\r\n\r\n/);
    assert.equal(Buffer.concat(upstream.writes).toString(), 'early bytes');
    upstream.push(Buffer.from('server bytes'));
    client.write('later bytes');
    await tick();
    assert.match(Buffer.concat(chunks).toString(), /server bytes$/);
    assert.equal(Buffer.concat(upstream.writes).toString(), 'early byteslater bytes');
  } finally { client.destroy(); await proxy.close(); upstream.destroy(); }
});

test('rejects any private or reserved DNS answer for each new subresource/redirect tunnel', async () => {
  const { startLighthouseProxy } = await proxyModule();
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.0.2.1', '::1', 'fc00::1', '2001:db8::1']) {
    let connections = 0;
    const proxy = await startLighthouseProxy({
      resolver: async () => [{ address: '93.184.216.34', family: 4 }, { address, family: net.isIP(address) }],
      connector: () => { connections++; throw new Error('must not connect'); },
    });
    try {
      for (const host of ['example.com', 'cdn.example.com', 'redirect.example.com']) {
        assert.match(await request(proxy.port, connectRequest(`${host}:443`)), /^HTTP\/1\.1 403 /);
      }
      assert.equal(connections, 0);
    } finally { await proxy.close(); }
  }
});

test('bounds the combined DNS and connection phase and never connects after DNS timeout', async () => {
  const { startLighthouseProxy } = await proxyModule();
  let connections = 0;
  let finishDns!: (value: Array<{ address: string; family: number }>) => void;
  const proxy = await startLighthouseProxy({
    connectTimeoutMs: 30,
    resolver: () => new Promise((resolve) => { finishDns = resolve; }),
    connector: () => { connections++; return new TestUpstream(); },
  });
  try {
    const response = await request(proxy.port, connectRequest('example.com:443'));
    assert.match(response, /^HTTP\/1\.1 403 /);
    finishDns([{ address: '93.184.216.34', family: 4 }]);
    await tick();
    assert.equal(connections, 0);
  } finally { await proxy.close(); }
  const upstream = new TestUpstream();
  const connecting = await startLighthouseProxy({
    connectTimeoutMs: 30,
    resolver: async () => [{ address: '93.184.216.34', family: 4 }],
    connector: () => upstream,
  });
  try {
    assert.match(await request(connecting.port, connectRequest('example.com:443')), /^HTTP\/1\.1 403 /);
    assert.equal(upstream.destroyed, true);
  } finally { await connecting.close(); }
});

test('limits active clients including incomplete requests and expires idle tunnels', async () => {
  const { startLighthouseProxy } = await proxyModule();
  const upstream = new TestUpstream();
  const proxy = await startLighthouseProxy({
    maxConnections: 1, idleTimeoutMs: 50,
    resolver: async () => [{ address: '93.184.216.34', family: 4 }],
    connector: () => upstream,
  });
  const client = net.connect(proxy.port, '127.0.0.1');
  client.on('data', () => {});
  try {
    await once(client, 'connect');
    const overflow = net.connect(proxy.port, '127.0.0.1');
    overflow.on('error', () => {});
    await within(once(overflow, 'close'), 'limit not enforced');
    client.write(connectRequest('example.com:443'));
    await tick();
    upstream.emit('connect');
    await within(once(client, 'close'), 'idle not enforced');
    assert.equal(upstream.destroyed, true);
  } finally { client.destroy(); await proxy.close(); upstream.destroy(); }
});

test('close destroys established, pending and incomplete sockets without later connecting', async () => {
  const { startLighthouseProxy } = await proxyModule();
  const upstream = new TestUpstream();
  let finishDns!: (value: Array<{ address: string; family: number }>) => void;
  let connections = 0;
  const proxy = await startLighthouseProxy({
    resolver: (host) => host === 'pending.example.com'
      ? new Promise((resolve) => { finishDns = resolve; })
      : Promise.resolve([{ address: '93.184.216.34', family: 4 }]),
    connector: () => { connections++; return upstream; },
  });
  const clients = [0, 1, 2].map(() => net.connect(proxy.port, '127.0.0.1'));
  clients.forEach((socket) => socket.on('data', () => {}));
  try {
    await Promise.all(clients.map((socket) => once(socket, 'connect')));
    clients[0].write(connectRequest('example.com:443'));
    clients[1].write(connectRequest('pending.example.com:443'));
    clients[2].write('CON');
    await tick();
    upstream.emit('connect');
    const closed = clients.map((socket) => once(socket, 'close'));
    await proxy.close();
    await Promise.all(closed);
    assert.equal(upstream.destroyed, true);
    finishDns([{ address: '93.184.216.34', family: 4 }]);
    await tick();
    assert.equal(connections, 1);
  } finally { clients.forEach((socket) => socket.destroy()); await proxy.close(); upstream.destroy(); }
});

test('close cancels DNS deadline timers even when the resolver never settles', async () => {
  const { startLighthouseProxy } = await proxyModule();
  const timersBefore = process.getActiveResourcesInfo().filter((type) => type === 'Timeout').length;
  const proxy = await startLighthouseProxy({ resolver: () => new Promise(() => {}) });
  const client = net.connect(proxy.port, '127.0.0.1');
  try {
    await once(client, 'connect');
    client.write(connectRequest('example.com:443'));
    await tick();
    await proxy.close();
    await tick();
    assert.equal(process.getActiveResourcesInfo().filter((type) => type === 'Timeout').length, timersBefore);
  } finally { client.destroy(); await proxy.close(); }
});

test('returns only generic failure before connect and destroys failed upstreams', async () => {
  const { startLighthouseProxy } = await proxyModule();
  for (const phase of ['dns', 'connector', 'socket']) {
    const upstream = new TestUpstream();
    const proxy = await startLighthouseProxy({
      resolver: async () => {
        if (phase === 'dns') throw new Error('sensitive DNS failure');
        return [{ address: '2606:4700:4700::1111', family: 6 }];
      },
      connector: (options) => {
        assert.deepEqual(options, { host: '2606:4700:4700::1111', port: 443, family: 6 });
        if (phase === 'connector') throw new Error('sensitive connect failure');
        process.nextTick(() => upstream.emit('error', new Error('sensitive socket failure')));
        return upstream;
      },
    });
    try {
      const response = await request(proxy.port, connectRequest('example.com:443'));
      assert.match(response, /^HTTP\/1\.1 403 /);
      assert.ok(!response.includes('sensitive'));
      assert.ok(!response.includes('200 Connection'));
      if (phase === 'socket') assert.equal(upstream.destroyed, true);
    } finally { await proxy.close(); upstream.destroy(); }
  }
});

test('never injects HTTP failure text into an established TLS tunnel', async () => {
  const { startLighthouseProxy } = await proxyModule();
  const upstream = new TestUpstream();
  const proxy = await startLighthouseProxy({
    resolver: async () => [{ address: '93.184.216.34', family: 4 }], connector: () => upstream,
  });
  const client = net.connect(proxy.port, '127.0.0.1');
  const chunks: Buffer[] = [];
  client.on('data', (chunk) => chunks.push(chunk));
  try {
    await once(client, 'connect');
    client.write(connectRequest('example.com:443'));
    await tick();
    upstream.emit('connect');
    await tick();
    const closed = once(client, 'close');
    upstream.emit('error', new Error('sensitive TLS socket failure'));
    await closed;
    assert.equal(Buffer.concat(chunks).toString(), 'HTTP/1.1 200 Connection Established\r\n\r\n');
    assert.equal(upstream.destroyed, true);
  } finally { client.destroy(); await proxy.close(); upstream.destroy(); }
});

test('rejects HTTP forwarding without touching a destination', async () => {
  const { startLighthouseProxy } = await proxyModule();
  const proxy = await startLighthouseProxy();
  try {
    const response = await request(proxy.port, 'GET http://127.0.0.1/ HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n');
    assert.match(response, /^HTTP\/1\.1 403 /);
    assert.match(response, /Proxy request denied\./);
  } finally { await proxy.close(); }
});
