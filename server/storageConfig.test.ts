import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStorageConfig } from './storageConfig.ts';

test('loopback defaults to a private home database and explicit off wins', () => {
  const config = resolveStorageConfig({}, '/synthetic-home');
  assert.deepEqual(config, { enabled: true, path: '/synthetic-home/.local/share/juru-website/audits.sqlite', savedReportsEnabled: true });
  assert.equal(resolveStorageConfig({ AUDIT_STORAGE_ENABLED: 'false' }, '/synthetic-home').enabled, false);
});

test('hosted storage requires explicit enable and an absolute persistent-volume path; no read API by default', () => {
  assert.equal(resolveStorageConfig({ HOST: '0.0.0.0' }, '/synthetic-home').enabled, false);
  assert.throws(() => resolveStorageConfig({ HOST: '0.0.0.0', AUDIT_STORAGE_ENABLED: 'true' }, '/synthetic-home'), /path|jalur/i);
  assert.throws(() => resolveStorageConfig({ AUDIT_DB_PATH: './public/audits.sqlite' }, '/synthetic-home'), /absolut/i);
  assert.deepEqual(resolveStorageConfig({ HOST: '0.0.0.0', AUDIT_STORAGE_ENABLED: 'true', AUDIT_DB_PATH: '/private-volume/audits.sqlite' }, '/synthetic-home'), { enabled: true, path: '/private-volume/audits.sqlite', savedReportsEnabled: false });
});
