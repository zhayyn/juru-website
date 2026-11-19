import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import * as api from './api.ts';
import { assertPublicTarget } from './publicTarget.ts';
import type { TechnicalSignals } from '../src/types/audit.ts';

const signals: TechnicalSignals = { statusCode: 200, httpsValid: true, title: 'Fixture Sintetis', hasViewportMeta: false,
  securityHeaders: { csp: false, hsts: false, xContentTypeOptions: false, xFrameOptions: false }, responseTimeMs: 30 };
const measured = { performanceScore: 80, accessibilityScore: 70, bestPracticesScore: 90, seoScore: 100,
  lcp: '2s', fcp: '1s', cls: '.1', tbt: '100ms', speedIndex: '2s', lcpMs: 2000, fcpMs: 1000, clsNum: .1, tbtMs: 100, source: 'pagespeed' as const, requestedUrl: 'https://example.com/', finalUrl: 'https://example.com/' };

async function harness(run: (base: string, count: { probe: number; measure: number }) => Promise<void>, options: Parameters<typeof api.createAuditApi>[1] = { maxPerWindow: 30 }, overrides: Partial<Parameters<typeof api.createAuditApi>[0]> = {}) {
  const count = { probe: 0, measure: 0 };
  const app = api.createAuditApi({
    validate: async (url: string) => { if (new URL(url).hostname !== 'example.com') throw new Error('Target ditolak'); },
    probe: async () => { count.probe++; return { url: 'https://example.com/', technicalSignals: signals }; },
    measure: async () => { count.measure++; return measured; },
    analyze: async () => null,
    publish: async () => ({ cloudSynced: false }),
    ...overrides,
  }, options);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.on('listening', resolve));
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, count); }
  finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

test('saran AI opsional tidak pernah mengubah skor terukur dan kegagalannya tidak membatalkan laporan', async () => {
  for (const failed of [false, true]) {
    await harness(async (base) => {
      const response = await fetch(base + '/api/audit/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com', category: 'umum', strategy: 'MOBILE' }) });
      assert.equal(response.status, 200);
      const report = await response.json();
      assert.equal(report.totalScore, 85);
      assert.equal(report.findings.length, failed ? 0 : 1);
      assert.match(report.aiStatus, failed ? /tidak tersedia/i : /openrouter/);
    }, undefined, { analyze: async () => { if (failed) throw new Error('secret upstream detail'); return { provider: 'openrouter', model: 'openrouter/free', parsed: { totalScore: 100, site_name: 'FAKE', findings: [{ area: 'UI', severity: 'Tinggi', issue: 'Perlu diuji manual', recommendation: 'Uji menu' }] } }; } });
  }
});

test('permintaan identik bersamaan memakai satu probe dan satu pengukuran', async () => {
  let measurements = 0;
  await harness(async (base, count) => {
    const responses = await Promise.all(Array.from({ length: 3 }, () => fetch(base + '/api/audit/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com/', category: 'umum', strategy: 'MOBILE' }) })));
    assert.ok(responses.every((r) => r.status === 200));
    assert.equal(count.probe, 1);
    assert.equal(measurements, 1);
  }, undefined, { measure: async () => { measurements++; await new Promise((resolve) => setTimeout(resolve, 20)); return measured; } });
});

test('API memblokir cross-origin sebelum ada trafik target', async () => {
  await harness(async (base, count) => {
    const response = await fetch(base + '/api/audit/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.invalid' }, body: JSON.stringify({ url: 'https://example.com', category: 'umum', strategy: 'MOBILE' }) });
    assert.equal(response.status, 403);
    assert.equal(count.probe, 0);
  });
});

test('API membatasi permintaan per-IP meski X-Forwarded-For dipalsukan', async () => {
  await harness(async (base) => {
    for (let i = 0; i < 2; i++) {
      const response = await fetch(base + '/api/audit/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `1.2.3.${i}` }, body: JSON.stringify({ url: 'https://example.com', category: 'umum', strategy: 'MOBILE' }) });
      assert.equal(response.status, i === 0 ? 200 : 429);
    }
  }, { maxPerWindow: 1 });
});

test('API membatasi pekerjaan global dan kuota harian sambil tetap melayani cache', async () => {
  let release!: () => void;
  let entered!: () => void;
  let measurements = 0;
  const started = new Promise<void>(resolve => { entered = resolve; });
  await harness(async (base, count) => {
    const request = (category: string, strategy = 'MOBILE') => fetch(base + '/api/audit/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/', category, strategy }),
    });
    const first = request('umum');
    await started;
    try {
      const blocked = await request('peradilan_agama');
      assert.equal(blocked.status, 503);
      assert.equal(count.probe, 1);
    } finally { release(); }
    assert.equal((await first).status, 200);
    assert.equal((await request('umum')).status, 200, 'cache tidak menghabiskan kuota harian');
    assert.equal((await request('peradilan_agama')).status, 429);
    assert.equal(count.probe, 1);
  }, { maxPerWindow: 30, maxConcurrent: 1, maxDailyAudits: 1 }, {
    measure: async () => { if (++measurements === 1) { entered(); await new Promise<void>(resolve => { release = resolve; }); } return measured; },
  });
});

test('timeout DNS awal melepas slot API dan DNS terlambat tidak melanjutkan probe', async () => {
  let releaseDns!: (value: Array<{ address: string; family: number }>) => void;
  let validations = 0;
  await harness(async (base, count) => {
    const request = () => fetch(base + '/api/audit/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/', category: 'umum', strategy: 'MOBILE' }),
      signal: AbortSignal.timeout(1000),
    });
    const failed = await request();
    assert.equal(failed.status, 400);
    assert.equal(count.probe, 0);
    assert.equal(count.measure, 0);
    assert.doesNotMatch(await failed.text(), /DNS|internal-fixture/);
    releaseDns([{ address: '93.184.215.14', family: 4 }]);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(count.probe, 0, 'DNS terlambat tidak boleh melanjutkan pekerjaan gagal');
    assert.equal((await request()).status, 200, 'slot inFlight gagal harus dilepas');
    assert.equal(count.probe, 1);
    assert.equal(count.measure, 1);
  }, { maxPerWindow: 30, maxConcurrent: 1 }, {
    validate: async url => {
      if (++validations !== 1) return;
      await assertPublicTarget(url, () => new Promise(resolve => { releaseDns = resolve; }), 10);
    },
  });
});

test('API mengukur sendiri, bekerja tanpa AI dan memakai cache tanpa audit ulang', async () => {
  await harness(async (base, count) => {
    for (let i = 0; i < 2; i++) {
      const response = await fetch(base + '/api/audit/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com', category: 'umum', strategy: 'MOBILE' }) });
      assert.equal(response.status, 200);
      const report = await response.json();
      assert.equal(report.totalScore, 85);
      assert.equal(report.methodology, 'technical-v1');
      assert.equal(report.cloudSynced, false);
      assert.equal(report.findings.length, 0);
      assert.ok(report.improvementPlan.some((a: { id: string }) => a.id === 'technical-viewport'));
    }
    assert.equal(count.probe, 1);
    assert.equal(count.measure, 1);
  });
});

test('API menolak skor dari browser sebelum probe atau provider dipanggil', async () => {
  await harness(async (base, count) => {
    const response = await fetch(base + '/api/audit/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com', category: 'umum', strategy: 'MOBILE', pageSpeed: measured, totalScore: 100 }) });
    assert.equal(response.status, 400);
    assert.equal(count.probe, 0);
    assert.equal(count.measure, 0);
  });
});
