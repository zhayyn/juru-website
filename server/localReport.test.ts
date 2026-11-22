import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMeasuredReport } from './report.ts';
import type { PageSpeedMetrics, TechnicalSignals } from '../src/types/audit.ts';
const pageSpeed: PageSpeedMetrics = { performanceScore: 40, accessibilityScore: 80, bestPracticesScore: 90, seoScore: 70, lcp: '4 s', fcp: '2 s', cls: '0.1', tbt: '300 ms', speedIndex: '5 s', lcpMs: 4000, fcpMs: 2000, clsNum: .1, tbtMs: 300, source: 'lighthouse_local', requestedUrl: 'https://example.com/', finalUrl: 'https://example.com/' };
const technicalSignals: TechnicalSignals = { httpsValid: true, statusCode: 200, title: 'Synthetic test', hasViewportMeta: true, securityHeaders: { hsts: false, xFrameOptions: false, xContentTypeOptions: false, csp: false }, responseTimeMs: 10 };
test('local lab report scores are real but in a distinct methodology, never public ranking', () => {
  const report = buildMeasuredReport({ url: 'https://example.com/', category: 'umum', strategy: 'MOBILE', pageSpeed, technicalSignals });
  assert.equal(report.totalScore, 70);
  assert.equal(report.methodology, 'technical-local-v1');
  assert.equal(report.rankingEligible, false);
  assert.match(report.rankingReason!, /lokal/i);
});
test('local lab identity missing or wrong invalidates all scores at report boundary', () => {
  for (const change of [{ requestedUrl: undefined }, { finalUrl: 'https://other.example/' }]) {
    const report = buildMeasuredReport({ url: 'https://example.com/', category: 'umum', strategy: 'MOBILE', pageSpeed: { ...pageSpeed, ...change }, technicalSignals });
    assert.equal(report.totalScore, null);
    assert.equal(report.pageSpeed.performanceScore, null);
  }
});
