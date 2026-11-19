import test from 'node:test';
import assert from 'node:assert/strict';
import * as reports from './report.ts';
import type { PageSpeedMetrics, TechnicalSignals } from '../src/types/audit.ts';

export const metrics: PageSpeedMetrics = { performanceScore: 40, accessibilityScore: 80, bestPracticesScore: 90, seoScore: 70,
  lcp: '4 s', fcp: '2 s', cls: '0.1', tbt: '300 ms', speedIndex: '5 s', lcpMs: 4000, fcpMs: 2000, clsNum: 0.1, tbtMs: 300, source: 'pagespeed',
  requestedUrl: 'https://example.com/', finalUrl: 'https://example.com/' };
export const signals: TechnicalSignals = { statusCode: 200, title: 'Situs Pengujian Sintetis', httpsValid: true, hasViewportMeta: true,
  securityHeaders: { hsts: true, csp: false, xFrameOptions: false, xContentTypeOptions: true }, responseTimeMs: 100 };

test('metrik kosong tidak menjadi nilai 0/50/100 dan tidak masuk ranking', () => {
  const report = reports.buildMeasuredReport({ url: 'https://example.com/', category: 'umum', strategy: 'MOBILE', pageSpeed: { ...metrics, performanceScore: null }, technicalSignals: signals });
  assert.equal(report.totalScore, null);
  assert.equal(report.rankingEligible, false);
  assert.equal(report.measurementCoverage, 75);
});

test('ranking hanya homepage mobile dan respons sukses; halaman lain tetap mendapat laporan', () => {
  for (const change of [{ url: 'https://example.com/profil' }, { strategy: 'DESKTOP' as const }, { technicalSignals: { ...signals, statusCode: 404 } }, { pageSpeed: { ...metrics, source: 'server_probe' as const } }]) {
    const report = reports.buildMeasuredReport({ url: 'https://example.com/', category: 'umum', strategy: 'MOBILE', pageSpeed: metrics, technicalSignals: signals, ...change });
    assert.equal(report.rankingEligible, false);
    assert.ok(report.rankingReason!.length > 15);
  }
});

test('laporan menolak ranking dan skor total bila identitas PageSpeed hilang atau berbeda', () => {
  for (const change of [
    { requestedUrl: undefined }, { finalUrl: undefined },
    { requestedUrl: 'https://other.example/' }, { finalUrl: 'https://example.com/profil' },
  ]) {
    const report = reports.buildMeasuredReport({ url: 'https://example.com/', category: 'umum', strategy: 'MOBILE', pageSpeed: { ...metrics, ...change }, technicalSignals: signals });
    assert.equal(report.rankingEligible, false);
    assert.equal(report.totalScore, null);
    assert.equal(report.pageSpeed.performanceScore, null);
    assert.equal(report.measurementCoverage, 0);
  }
});

test('technical-v1 hanya menilai pengukuran, bukan skor AI atau dugaan kelengkapan konten', () => {
  const report = reports.buildMeasuredReport({ url: 'https://example.com/', category: 'peradilan_agama', strategy: 'MOBILE', pageSpeed: metrics, technicalSignals: signals });
  assert.equal(report.methodology, 'technical-v1');
  assert.equal(report.totalScore, 70);
  assert.equal(report.rankingEligible, true);
  const content = report.pillarScores.find((p) => p.id === 'pilar_1_konten')!;
  assert.equal(content.score, null);
  assert.ok(content.indicators.every((i) => i.status === 'Belum Diverifikasi' && i.score === null));
  assert.match(report.executiveSummary, /bukan.*kepatuhan/i);
});
