import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { request, type Server } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';

const guard = await import('./pilotGuard.ts').catch(() => {
  assert.fail('Pilot guard configuration module is not implemented');
});

test('default local listener needs no invite and has no target restrictions', () => {
  const env: NodeJS.ProcessEnv = {};
  assert.deepEqual(guard.parsePilotConfig(env), { accessToken: null, allowedTargets: [] });
  assert.deepEqual(env, {});
});

const token = 'test-only-invite-token-24-characters';
const external: NodeJS.ProcessEnv = {
  HOST: '0.0.0.0', ALLOWED_HOSTS: 'pilot.example.org:3000',
  PILOT_ACCESS_TOKEN: token, PILOT_ALLOWED_TARGETS: 'Example.org, www.example.org,example.org',
};

test('external bind requires all three explicit controls without mutating env', () => {
  assert.deepEqual(guard.parsePilotConfig(Object.freeze({ ...external })), {
    accessToken: token, allowedTargets: ['example.org', 'www.example.org'],
  });
  for (const key of ['PILOT_ACCESS_TOKEN', 'ALLOWED_HOSTS', 'PILOT_ALLOWED_TARGETS']) {
    for (const value of [undefined, '', ' , ']) {
      assert.throws(() => guard.parsePilotConfig({ ...external, [key]: value }), Error);
    }
  }
  for (const HOST of ['::', '192.168.1.2', '0.0.0.0']) {
    assert.throws(() => guard.parsePilotConfig({ HOST }), Error);
  }
  for (const HOST of ['127.0.0.1', 'localhost', '::1']) {
    assert.deepEqual(guard.parsePilotConfig({ HOST }), { accessToken: null, allowedTargets: [] });
  }
});

test('configured tokens enforce minimum length and reject delimiters without leaking values', () => {
  assert.equal(guard.parsePilotConfig({ PILOT_ACCESS_TOKEN: 'x'.repeat(24) }).accessToken, 'x'.repeat(24));
  for (const invalid of ['x'.repeat(23), `${token}:bad`, `${token}\n`, `${token}\r`, `${token}\0`]) {
    assert.throws(() => guard.parsePilotConfig({ PILOT_ACCESS_TOKEN: invalid }), error => {
      assert(error instanceof Error);
      assert(!error.message.includes(invalid));
      return true;
    });
  }
});

function localRequest(server: Server, path: string, method = 'GET', authorization?: string) {
  return new Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: (server.address() as AddressInfo).port, path, method,
      headers: authorization === undefined ? {} : { authorization } }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

const basic = (username: string, password: string) => `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

test('invite protects HTML assets and API while only exact GET health bypasses it', async t => {
  assert.equal(typeof guard.createPilotGate, 'function', 'Pilot HTTP gate is not implemented');
  const app = express();
  app.use(guard.createPilotGate({ accessToken: token, allowedTargets: [] }));
  app.all('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use((_req, res) => res.status(200).send('protected resource'));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  await once(server, 'listening');
  for (const [path, method] of [
    ['/', 'GET'], ['/assets/main.js', 'GET'], ['/api/audits', 'POST'],
    ['/api/health', 'HEAD'], ['/api/health', 'POST'], ['/api/health/', 'GET'], ['/API/health', 'GET'],
  ]) {
    const response = await localRequest(server, path, method);
    assert.equal(response.status, 401, `${method} ${path}`);
    assert.equal(response.headers['www-authenticate'], 'Basic realm="Juru Website Pilot", charset="UTF-8"');
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers['referrer-policy'], 'no-referrer');
    assert.equal(response.headers['permissions-policy'], 'camera=(), microphone=(), geolocation=()');
    assert.equal(response.headers['x-frame-options'], 'DENY');
    assert(!response.body.includes(token));
    assert.equal(response.headers['set-cookie'], undefined);
  }
  const health = await localRequest(server, '/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(JSON.parse(health.body), { status: 'ok' });
  assert.equal(health.headers['x-frame-options'], 'DENY');
  const accepted = await localRequest(server, '/assets/main.js', 'GET', basic('prakom', token));
  assert.equal(accepted.status, 200);
  assert.equal(accepted.headers['referrer-policy'], 'no-referrer');
  for (const authorization of [basic('other', token), basic('prakom', 'x'), basic('prakom', token + 'extra'),
    'Bearer test', 'Basic ???', 'Basic ' + Buffer.from(`prakom:${token}\n`).toString('base64'),
    basic('prakom', token) + 'junk', basic('prakom', token) + ', Basic bad']) {
    const rejected = await localRequest(server, '/', 'GET', authorization);
    assert.equal(rejected.status, 401);
    assert.equal(rejected.body, 'Authentication required.');
  }
});

test('default local gate passes through without storing authentication', async t => {
  assert.equal(typeof guard.createPilotGate, 'function');
  const app = express();
  app.use(guard.createPilotGate(guard.parsePilotConfig({})));
  app.use((_req, res) => res.send('local'));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  await once(server, 'listening');
  const response = await localRequest(server, '/');
  assert.equal(response.status, 200);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['set-cookie'], undefined);
});

test('target enforcement matches exact hostname for initial and final redirect URLs', () => {
  assert.equal(typeof guard.assertPilotTarget, 'function', 'Pilot target assertion is not implemented');
  const config = guard.parsePilotConfig({ PILOT_ALLOWED_TARGETS: 'example.org' });
  for (const url of ['https://example.org/path', 'https://EXAMPLE.ORG:443/path?x=1']) {
    assert.doesNotThrow(() => guard.assertPilotTarget(url, config));
  }
  for (const url of ['https://www.example.org', 'https://example.org.evil.org',
    'https://example.org@evil.org', 'https://example.org.', 'not a URL']) {
    assert.throws(() => guard.assertPilotTarget(url, config), error => {
      assert(error instanceof Error);
      assert(!error.message.includes(url));
      return true;
    });
  }
  const unrestricted = guard.parsePilotConfig({});
  assert.doesNotThrow(() => guard.assertPilotTarget('https://another-public.org', unrestricted));
  assert.deepEqual(Object.keys(guard).sort(), ['assertPilotTarget', 'createPilotGate', 'parsePilotConfig']);
});

test('target CSV accepts only bare public-domain hostname syntax', () => {
  for (const invalid of [
    '*.example.org', 'https://example.org', 'user@example.org', 'example.org/path',
    'example.org?query=1', 'example.org#fragment', 'example.org:443', '127.0.0.1',
    '[::1]', '0x7f000001', 'localhost', 'printer.local', 'api.internal',
    'example.org.', 'a..example.org', '-bad.example.org', 'good.example.org,,other.example.org',
    'example.org\n.evil.org', 'name.invalid', '192.168.0.1', 'example.org\n',
    'router.localdomain', 'company.corp', 'service.svc', 'server.private', 'service.alt',
    '\u212A.example.org',
  ]) {
    assert.throws(() => guard.parsePilotConfig({ PILOT_ALLOWED_TARGETS: invalid }), Error);
  }
});
