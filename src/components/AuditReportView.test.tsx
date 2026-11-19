import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuditReportView } from './AuditReportView.tsx';
import type { AuditReport } from '../types/audit.ts';

const report: AuditReport = {
  id: 'synthetic-test-only', url: 'https://example.com/', domain: 'example.com', siteName: 'Situs Uji Sintetis',
  category: 'umum', strategy: 'MOBILE', auditedAt: '2026-11-17T00:00:00Z', totalScore: 50,
  grade: 'Sementara', pillarScores: [], findings: [], executiveSummary: 'Fixture tes, bukan audit situs nyata.',
  groundingSources: [], cloudSynced: false,
  pageSpeed: { performanceScore: null, accessibilityScore: null, bestPracticesScore: null, seoScore: null,
    lcp: '—', fcp: '—', cls: '—', tbt: '—', speedIndex: '—', lcpMs: null, fcpMs: null, clsNum: null, tbtMs: null, source: 'server_probe' },
  technicalSignals: { httpsValid: true, statusCode: 200, title: 'Sintetis', hasViewportMeta: false,
    securityHeaders: { hsts: true, xFrameOptions: true, xContentTypeOptions: true, csp: true }, responseTimeMs: 100 },
};

test('laporan menampilkan saran deterministik meskipun AI tidak mengembalikan findings', () => {
  const html = renderToStaticMarkup(<AuditReportView report={report} onOpenSupabaseModal={() => {}} />);
  assert.match(html, /Cara Verifikasi/);
  assert.match(html, /name=&quot;viewport&quot;/);
  assert.match(html, /Pengukuran/);
});

test('report links allow only http(s) sources and preserve valid evidence', () => {
  const unsafe: AuditReport = { ...report, url: 'javascript:alert(1)', groundingSources: [
    { title: 'Bad', uri: 'javascript:alert(1)' }, { title: 'Data', uri: 'data:text/html,test' },
    { title: 'Evidence', uri: 'https://example.com/evidence' },
  ] };
  const html = renderToStaticMarkup(<AuditReportView report={unsafe} onOpenSupabaseModal={() => {}} />);
  assert.doesNotMatch(html, /href="(?:javascript|data):/);
  assert.match(html, /href="https:\/\/example.com\/evidence"/);
});

test('unknown scores and unverified checklist render dashes without security success claims', () => {
  const unknown: AuditReport = { ...report, totalScore: null, grade: 'Belum diukur',
    methodology: 'technical-v1', rankingEligible: false, rankingReason: 'Pengukuran belum lengkap',
    technicalSignals: { ...report.technicalSignals, statusCode: null },
    pillarScores: [{ id: 'manual', name: 'Checklist Konten', summary: 'Perlu verifikasi manual',
      weight: 0.4, score: null, weightedContribution: null,
      indicators: [{ id: 'dokumen', name: 'Dokumen Publik', status: 'Belum Diverifikasi', note: 'Periksa manual', score: null, maxScore: 100 }] }] };
  const html = renderToStaticMarkup(<AuditReportView report={unknown} onOpenSupabaseModal={() => {}} />);
  assert.match(html, /Belum Diverifikasi/);
  assert.match(html, /— \/ 100/);
  assert.doesNotMatch(html, />Aman<|>Aktif<|Belum Tersedia/);
  assert.match(html, /Skor teknis/);
  assert.match(html, /25%/);
  assert.match(html, /bukan.*Core Web Vitals/);
  assert.match(html, /tidak.*skor/i);
});
