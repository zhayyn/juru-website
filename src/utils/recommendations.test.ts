import test from 'node:test';
import assert from 'node:assert/strict';
import * as recommendations from './recommendations.ts';
import type { PageSpeedMetrics, TechnicalSignals } from '../types/audit.ts';

const metrics: PageSpeedMetrics = {
  performanceScore: null, accessibilityScore: null, bestPracticesScore: null, seoScore: null,
  lcp: 'Tidak tersedia', fcp: 'Tidak tersedia', cls: 'Tidak tersedia', tbt: 'Tidak tersedia',
  speedIndex: 'Tidak tersedia', lcpMs: null, fcpMs: null, clsNum: null, tbtMs: null,
  source: 'server_probe',
};
const signals: TechnicalSignals = {
  httpsValid: true, statusCode: 200, title: 'Situs pengujian', hasViewportMeta: false,
  securityHeaders: { hsts: true, xFrameOptions: true, xContentTypeOptions: true, csp: true },
  responseTimeMs: 450,
};

test('saran viewport yang hilang mencantumkan bukti, aksi dan cara verifikasi', () => {
  const result = recommendations.buildImprovementPlan({ pageSpeed: metrics, technicalSignals: signals, pillarScores: [], findings: [] });
  const action = result.find((item) => item.id === 'technical-viewport');
  assert.ok(action, 'Viewport tanpa meta harus menghasilkan saran walaupun AI kosong');
  assert.equal(action.source, 'Pengukuran');
  assert.match(action.issue, /viewport/i);
  assert.match(action.recommendation, /name="viewport"/);
  assert.match(action.verification, /ponsel|390/i);
});

test('nilai LCP, CLS, TBT yang buruk dan header kosong menjadi saran spesifik berurutan prioritas', () => {
  const result = recommendations.buildImprovementPlan({
    pageSpeed: { ...metrics, lcpMs: 4200, clsNum: 0.3, tbtMs: 700 },
    technicalSignals: { ...signals, securityHeaders: { hsts: false, xFrameOptions: false, xContentTypeOptions: false, csp: false } },
    pillarScores: [], findings: [],
  });
  for (const id of ['technical-lcp', 'technical-cls', 'technical-tbt', 'header-csp', 'header-hsts']) {
    const action = result.find((item) => item.id === id);
    assert.ok(action, id);
    assert.ok(action!.verification.length > 15, 'Setiap saran harus bisa diverifikasi');
  }
  assert.equal(result[0].severity, 'Tinggi');
});

test('indikator yang belum terverifikasi mendapat tugas verifikasi, AI diberi label dan tidak terduplikasi', () => {
  const pillar = { id: 'pilar_1_konten', name: 'Informasi', weight: 1, score: 0, weightedContribution: 0, summary: '', indicators: [
    { id: 'lhkpn_lhkasn', name: 'LHKPN', status: 'Belum Diverifikasi' as const, score: 0, maxScore: 100, note: 'Belum diperiksa' },
  ] };
  const finding = { area: 'Konten', severity: 'Tinggi' as const, issue: 'Dokumen perlu dicek', recommendation: 'Cek berkas terbaru' };
  const result = recommendations.buildImprovementPlan({ pageSpeed: metrics, technicalSignals: signals, pillarScores: [pillar], findings: [finding, finding] });
  const action = result.find((item) => item.id === 'indicator-lhkpn_lhkasn')!;
  assert.ok(action);
  assert.match(action.issue, /belum.*verifikasi/i);
  assert.match(action.recommendation, /periode|tahun/i);
  assert.match(action.verification, /URL|berkas/i);
  assert.equal(result.filter((item) => item.source === 'AI — perlu konfirmasi').length, 1);
  assert.ok(!action.issue.includes('tidak ada'), 'Tidak ditemukan bukan bukti tidak ada');
});

test('PageSpeed yang tidak tersedia menjadi tugas ukur ulang, bukan skor gagal atau sukses', () => {
  const result = recommendations.buildImprovementPlan({ pageSpeed: metrics, technicalSignals: { ...signals, hasViewportMeta: true }, pillarScores: [], findings: [] });
  assert.ok(result.some((item) => item.id === 'measurement-pagespeed'));
  assert.ok(!result.some((item) => item.id === 'technical-lcp'));
  assert.match(result.find((item) => item.id === 'measurement-pagespeed')!.issue, /belum tersedia|tidak tersedia/i);
});

test('sinyal web modern yang belum terpenuhi menghasilkan saran deterministik yang dapat diverifikasi', () => {
  const result = recommendations.buildImprovementPlan({
    pageSpeed: { ...metrics, performanceScore: 85, accessibilityScore: 90, bestPracticesScore: 90, seoScore: 90 },
    technicalSignals: {
      ...signals,
      hasViewportMeta: true,
      modernWeb: {
        hasLangAttribute: false,
        hasMainLandmark: false,
        hasColorSchemeMeta: false,
        unverifiedExternalAssets: 2,
        prefixedMaskWithoutStandard: true,
      },
    },
    pillarScores: [],
    findings: [],
  });
  for (const id of ['modern-sri', 'modern-lang', 'modern-main', 'modern-css-mask']) {
    const action = result.find((item) => item.id === id);
    assert.ok(action, id);
    assert.equal(action!.source, 'Pengukuran');
    assert.ok(action!.verification.length > 15);
  }
  assert.equal(result.find((item) => item.id === 'modern-sri')!.severity, 'Sedang');
});
