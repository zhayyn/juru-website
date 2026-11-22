import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import App, * as app from './App.tsx';
import { readFileSync } from 'node:fs';
import { AuditForm } from './components/AuditForm.tsx';
import type { AuditReport } from './types/audit.ts';

test('audit request sends only URL/category/strategy and preserves server-owned report', async () => {
  const originalFetch = globalThis.fetch;
  const serverReport = { id: 'server-only', cloudSynced: true, totalScore: null, methodology: 'technical-v1' } as AuditReport;
  const calls: unknown[] = [];
  globalThis.fetch = (async (url, init) => {
    calls.push([url, init]);
    return { ok: true, json: async () => serverReport } as Response;
  }) as typeof fetch;
  try {
    assert.equal(await app.requestTechnicalAudit('https://example.com/', 'umum', 'MOBILE'), serverReport);
    assert.equal(calls.length, 1);
    const [url, init] = calls[0] as [string, RequestInit];
    assert.equal(url, '/api/audit/analyze');
    assert.equal(init.method, 'POST');
    assert.deepEqual(JSON.parse(String(init.body)), { url: 'https://example.com/', category: 'umum', strategy: 'MOBILE' });
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /googleapis\.com|\/api\/pagespeed|recordWebsiteAudit|\.rpc\(/);
  } finally { globalThis.fetch = originalFetch; }
});

test('audit progress describes technical server measurement without AI search promises', () => {
  const html = renderToStaticMarkup(<AuditForm url="" category="umum" strategy="MOBILE" isAuditing currentStep="pagespeed" errorMessage={null}
    onUrlChange={() => {}} onCategoryChange={() => {}} onStrategyChange={() => {}} onSubmit={() => {}} />);
  assert.match(html, /Lighthouse/);
  assert.doesNotMatch(html, /Menelusuri Informasi|di pencarian|Gemini|Google Search/);
});

test('eligible unsynced measured audits are session-only, deduplicated by domain and category', () => {
  const report = { id: 'synthetic', url: 'https://example.com/', domain: 'example.com', siteName: 'Synthetic', category: 'umum', strategy: 'MOBILE',
    auditedAt: '2026-11-17T00:00:00Z', totalScore: 75, grade: 'B', executiveSummary: 'Technical', pillarScores: [], cloudSynced: false,
    methodology: 'technical-v1', rankingEligible: true,
    technicalSignals: { httpsValid: true, statusCode: 200, title: 'Synthetic', hasViewportMeta: true,
      securityHeaders: { hsts: false, xFrameOptions: false, xContentTypeOptions: false, csp: false }, responseTimeMs: 100 },
    findings: [], groundingSources: [],
    pageSpeed: { source: 'pagespeed', performanceScore: 60, accessibilityScore: 80, bestPracticesScore: 80, seoScore: 80,
      lcp: '-', fcp: '-', cls: '-', tbt: '-', speedIndex: '-', lcpMs: null, fcpMs: null, clsNum: null, tbtMs: null } } satisfies AuditReport;
  const empty = { rankings: [], historyMap: {} };
  const first = app.addLocalAudit(empty, report);
  const second = app.addLocalAudit(first, { ...report, id: 'second', totalScore: 80 });
  assert.equal(second.rankings.length, 1);
  assert.equal(second.rankings[0].audit_count, 2);
  assert.equal(second.rankings[0].score_delta, 5);
  assert.equal(second.historyMap['example.com:umum'].length, 2);
  assert.equal(app.addLocalAudit(second, { ...report, id: 'second' }), second);
  assert.equal(second.rankings[0].domain, report.domain);
  for (const field of ['performanceScore', 'accessibilityScore', 'bestPracticesScore', 'seoScore'] as const) {
    for (const value of [null, NaN, Infinity, -1, 101]) {
      assert.equal(app.addLocalAudit(second, { ...report, pageSpeed: { ...report.pageSpeed, [field]: value } }), second);
    }
  }
  assert.equal(app.addLocalAudit(second, { ...report, pageSpeed: { ...report.pageSpeed, source: 'server_probe' } }), second);
  assert.equal(app.addLocalAudit(second, { ...report, category: 'peradilan_agama' }).rankings.length, 2);
  for (const change of [{ totalScore: null }, { rankingEligible: false }, { cloudSynced: true }, { strategy: 'DESKTOP' }, { methodology: 'legacy' }]) {
    assert.equal(app.addLocalAudit(second, { ...report, ...change } as AuditReport), second);
  }
});

test('App wiring waits for realtime status and passes history category without fabricating history', () => {
  const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /setIsRealtimeActive\(true\)|id: `local-/);
  assert.match(source, /fetchAuditHistory\(ranking.domain, ranking.category\)/);
  assert.match(source, /setIsSupabaseConnected\(true\)/);
});

test('homepage separates technical ranking formula from unscored checklists without official claims', () => {
  const html = renderToStaticMarkup(<App />);
  const guide = html.split('id="standar-penilaian"')[1]?.split('</section>')[0] ?? '';
  assert.match(guide, /technical-v1/);
  assert.match(guide, /25%/);
  assert.match(guide, /Checklist manual.*tidak masuk skor/);
  assert.doesNotMatch(guide, /40%|35%|30%|20%/);
  assert.doesNotMatch(html, /Platform Audit Kualitas &amp; Kepatuhan Website|Mendukung Standar Peradilan Agama/);
});

test('homepage keeps secondary panels collapsed and supplemental copy only in a tooltip', () => {
  const html = renderToStaticMarkup(<App />);
  assert.match(html, /<details class="secondary-panel"/);
  assert.match(html, /<summary>Metode &amp; standar/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.doesNotMatch(html, /Mode pratinjau lokal:/);
});

test('initial homepage preserves audit design but has no fabricated scoreboard or history', () => {
  const html = renderToStaticMarkup(<App />);
  const scoreboard = html.split('id="papan-peringkat"')[1]?.split('</section>')[0] ?? '';
  assert.ok(scoreboard);
  assert.doesNotMatch(scoreboard, /#1|Audit ulang |Lihat riwayat /);
  assert.match(html, /audit-panel-heading/);
  assert.match(html, /standar-penilaian/);
});
