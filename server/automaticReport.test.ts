import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMeasuredReport } from './report.ts';
const signals = { httpsValid: false, statusCode: null, title: null, hasViewportMeta: false, securityHeaders: { hsts: false, xFrameOptions: false, xContentTypeOptions: false, csp: false }, responseTimeMs: null };
const metrics = { performanceScore: null, accessibilityScore: null, bestPracticesScore: null, seoScore: null, lcp: '—', fcp: '—', cls: '—', tbt: '—', speedIndex: '—', lcpMs: null, fcpMs: null, clsNum: null, tbtMs: null, source: 'server_probe' as const }; 


test('measured report includes deterministic checklist evidence but never the source HTML', () => {
  const html = '<html><body data-marker="RAW_HTML_PRIVATE_MARKER"><a href="/dokumen/lhkpn.pdf">LHKPN 2026</a></body></html>';
  const report = buildMeasuredReport({ url: 'https://court.example/', category: 'peradilan_agama', strategy: 'MOBILE', html,
    technicalSignals: { ...signals, statusCode: 200, httpsValid: true }, pageSpeed: metrics });
  assert.equal(report.checklistVersion, 'automatic-checklist-v1');
  assert.equal(report.pillarScores.flatMap(p => p.indicators).find(i => i.id === 'lhkpn_lhkasn')?.status, 'Sebagian');
  assert.equal(report.checklistSummary?.total, 17);
  assert.equal(report.totalScore, null);
  assert.equal(report.rankingEligible, false);
  assert.equal('html' in report, false);
  assert.doesNotMatch(JSON.stringify(report), /RAW_HTML_PRIVATE_MARKER/);
});
