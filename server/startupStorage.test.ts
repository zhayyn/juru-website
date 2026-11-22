import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import { createAuditStore } from './auditStore.ts';
import { buildMeasuredReport } from './report.ts';
import { missingPageSpeed } from './pageSpeed.ts';

const root = path.resolve(import.meta.dirname, '..');
test('production entry reopens private SQLite and exposes reports only when local reading is enabled', { timeout: 15_000 }, async () => {
  const scratchRoot = path.join(homedir(), '.hermes/cache/scratch');
  mkdirSync(scratchRoot, { recursive: true, mode: 0o700 });
  const directory = mkdtempSync(path.join(scratchRoot, 'juru-startup-storage-'));
  const databasePath = path.join(directory, 'private/audits.sqlite');
  const report = buildMeasuredReport({ url: 'https://example.com/', category: 'umum', strategy: 'MOBILE',
    pageSpeed: missingPageSpeed('Synthetic startup fixture, not a real measurement.'),
    technicalSignals: { statusCode: 200, httpsValid: true, title: 'Synthetic startup only', hasViewportMeta: false,
      securityHeaders: { csp: false, hsts: false, xFrameOptions: false, xContentTypeOptions: false }, responseTimeMs: 1 } });
  const store = createAuditStore(databasePath);
  assert.equal(store.save(report).status, 'saved');
  const expected = store.get(report.id); store.close();
  const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>(resolve => reservation.close(() => resolve()));
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH, HOME: homedir(), TMPDIR: path.join(homedir(), '.hermes/cache/scratch'),
      NODE_ENV: 'production', DOTENV_CONFIG_PATH: '/dev/null', HOST: '127.0.0.1', PORT: String(port),
      ALLOWED_HOSTS: `127.0.0.1:${port}`, AUDIT_STORAGE_ENABLED: 'true', AUDIT_DB_PATH: databasePath,
      AI_PROVIDER: 'none', RANKING_PUBLISH_ENABLED: 'false' } });
  const exited = once(child, 'exit');
  let log = ''; child.stdout.on('data', chunk => { log += String(chunk); }); child.stderr.on('data', chunk => { log += String(chunk); });
  try {
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let n = 0; n < 100; n++) {
      if (child.exitCode !== null) throw new Error('Entry exited before readiness: ' + log);
      try { if ((await fetch(base + '/api/health', { signal: AbortSignal.timeout(200) })).ok) { ready = true; break; } } catch { /* startup */ }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(ready, true, 'production API is ready');
    const response = await fetch(base + '/api/audit/reports/' + report.id);
    assert.equal(response.status, 200, 'saved report can be reopened by the loopback operator');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), expected);
    assert.equal((await fetch(base + '/api/audit/reports/not-an-id')).status, 400);
  } finally {
    child.kill('SIGTERM');
    const timeout = setTimeout(() => child.kill('SIGKILL'), 2000);
    await exited; clearTimeout(timeout);
  }
  assert.equal(readFileSync(databasePath).subarray(0, 16).toString(), 'SQLite format 3\0');
  const reopened = createAuditStore(databasePath);
  try { assert.deepEqual(reopened.get(report.id), expected); } finally { reopened.close(); }
});
