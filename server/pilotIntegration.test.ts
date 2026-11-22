import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const token = 'synthetic-integration-invite-token-24';
const auth = `Basic ${Buffer.from(`prakom:${token}`).toString('base64')}`;
async function freePort() {
  const server = createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as import('node:net').AddressInfo).port;
  await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  return port;
}
async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await once(child, 'exit');
}
const baseEnv = {
  ...process.env, NODE_ENV: 'production', AI_PROVIDER: 'none', RANKING_PUBLISH_ENABLED: 'false',
  HOST: '127.0.0.1', PILOT_ACCESS_TOKEN: '', PILOT_ALLOWED_TARGETS: '',
  // Do not let existing user cloud configuration make these HTTP-only checks contact it.
  SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', OPENROUTER_API_KEY: '', GEMINI_API_KEY: '',
};

test('production entry wires invite before HTML, assets, unknown paths and API, and rejects off-pilot targets', async t => {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: root, env: { ...baseEnv, PORT: String(port), ALLOWED_HOSTS: `127.0.0.1:${port}`,
      PILOT_ACCESS_TOKEN: token, PILOT_ALLOWED_TARGETS: 'example.com' }, stdio: 'pipe',
  });
  t.after(() => stop(child));
  let log = '';
  child.stdout?.on('data', b => { log += String(b); });
  child.stderr?.on('data', b => { log += String(b); });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('Pilot entry exited before readiness');
    try { if ((await fetch(base + '/api/health')).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 30));
  }
  assert.ok(ready);
  const health = await fetch(base + '/api/health');
  assert.deepEqual(await health.json(), { status: 'ok', methodology: 'technical-v1' });
  for (const route of ['/', '/assets/not-real.js', '/not-real', '/api/not-real']) {
    const r = await fetch(base + route);
    assert.equal(r.status, 401, route);
    assert.equal(r.headers.get('www-authenticate'), 'Basic realm="Juru Website Pilot", charset="UTF-8"');
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
  }
  assert.equal((await fetch(base + '/api/audit/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 401);
  const allowed = await fetch(base + '/', { headers: { authorization: auth } });
  assert.equal(allowed.status, 200);
  assert.match(await allowed.text(), /<html/);
  const target = await fetch(base + '/api/audit/analyze', { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://not-in-pilot.example.org/', category: 'umum', strategy: 'MOBILE' }) });
  assert.equal(target.status, 400);
  assert.match((await target.json()).error, /Target tidak valid/);
  assert.ok(!log.includes(token), 'invite never logged');
});

test('production entry refuses unsafe non-loopback configuration before listening', async () => {
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: root, env: { ...baseEnv, HOST: '0.0.0.0', PORT: String(await freePort()), ALLOWED_HOSTS: '' }, stdio: 'pipe',
  });
  let log = '';
  child.stdout?.on('data', b => { log += String(b); });
  child.stderr?.on('data', b => { log += String(b); });
  const exited = once(child, 'exit');
  const timer = setTimeout(() => child.kill('SIGTERM'), 3000);
  try {
    const [code] = await exited;
    assert.equal(code, 1, 'unsafe external binding must exit before opening a listener');
    assert.doesNotMatch(log, /Juru Website: http/);
  } finally { clearTimeout(timer); await stop(child); }
});
