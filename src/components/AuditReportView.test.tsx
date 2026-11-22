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

test('local Lighthouse source, version and measurement time are visible and not claimed as Google PageSpeed', () => {
  const local: AuditReport = { ...report, methodology: 'technical-local-v1', pageSpeed: { ...report.pageSpeed, source: 'lighthouse_local', lighthouseVersion: '13.6.0', measuredAt: '2026-11-21T02:00:00Z' } };
  const html = renderToStaticMarkup(<AuditReportView report={local} onOpenSupabaseModal={() => {}} />);
  assert.match(html, /Lighthouse lokal/);
  assert.match(html, /13.6.0/);
  assert.match(html, /bukan hasil PageSpeed Google/);
  assert.match(html, /technical-local-v1/);
  assert.doesNotMatch(html, /Skor teknis technical-v1/);
});


test('saved and failed database states remain visible independently of online ranking', () => {
  for (const [status, text] of [['saved', 'Tersimpan di database server'], ['failed', 'Belum tersimpan di database'], ['disabled', 'Penyimpanan database nonaktif']] as const) {
    const html = renderToStaticMarkup(<AuditReportView report={{ ...report, storage: { status, backend: 'sqlite' } }} onOpenSupabaseModal={() => {}} />);
    assert.match(html, new RegExp(text));
    assert.match(html, /data-storage-status=/);
  }
});

test('automatic checklist shows version, limited coverage and inspectable safe evidence without claiming absence', () => {
  const measured: AuditReport = { ...report, checklistVersion: 'automatic-checklist-v1', checklistSummary: {
    total: 2, automatic: 1, partial: 1, manual: 0, withEvidence: 2, coveragePercent: 100,
    statusCounts: { Terpenuhi: 0, Sebagian: 1, 'Tidak Ditemukan': 1, 'Belum Diverifikasi': 0 } },
    pillarScores: [{ id: 'proof', name: 'Bukti terbatas', summary: 'Satu halaman', weight: 1, score: null, weightedContribution: null,
      indicators: [{ id: 'https_ssl', name: 'HTTPS', note: 'HTTP teramati, bukan HTTPS', status: 'Tidak Ditemukan', score: 0, maxScore: 100, checkMode: 'automatic',
        evidence: [{ source: 'headers', url: 'http://example.com/', detail: 'HTTP 200' }] },
      { id: 'lhkpn_lhkasn', name: 'LHKPN', note: 'Kandidat, bukan validasi isi', status: 'Sebagian', score: null, maxScore: 100, checkMode: 'partial', evidence: [
        { source: 'html', url: 'https://example.com/lhkpn.pdf', detail: 'Dokumen kandidat 2026' },
        { source: 'html', url: 'javascript:alert(1)', detail: 'Unsafe test' },
        { source: 'html', url: 'https://user:password@example.com/private', detail: 'Credential test' },
      ] }] }] };
  const html = renderToStaticMarkup(<AuditReportView report={measured} onOpenSupabaseModal={() => {}} />);
  assert.match(html, /Checklist otomatis &amp; verifikasi/);
  assert.match(html, /automatic-checklist-v1/);
  assert.match(html, /2 \/ 2 indikator memiliki bukti terbatas/);
  assert.match(html, /cakupan bukti, bukan persentase kepatuhan/);
  assert.match(html, /href="https:\/\/example.com\/lhkpn.pdf"/);
  assert.match(html, /Dokumen kandidat 2026/);
  assert.match(html, /<details[^>]*class="checklist-evidence/);
  assert.match(html, /Tidak teramati pada halaman ini/);
  assert.doesNotMatch(html, /Belum Tersedia|href="javascript:|href="https:\/\/user:password/);
});

test('report uses compact priority disclosures with voluntary contextual help and persistent essential limits', () => {
  const html = renderToStaticMarkup(<AuditReportView report={report} onOpenSupabaseModal={() => {}} />);
  assert.match(html, /class="priority-list"/);
  assert.match(html, /wa.me\/6281317361689/);
  assert.match(html, /data-priority="sedang"/);
  assert.match(html, /bukan audit kepatuhan resmi/);
  assert.doesNotMatch(html, /<table/);
  assert.match(html, /Ringkasan audit/);
});

test('report presents provenance, priority actions before manual checklist, and decoded title as safe text', () => {
  const updated = { ...report, siteName: 'Situs &#8211; Aman &amp; Terbuka &#x3c;script&#x3e;', pageSpeed: { ...report.pageSpeed, source: 'lighthouse_local' as const } };
  const html = renderToStaticMarkup(<AuditReportView report={updated} onOpenSupabaseModal={() => {}} />);
  assert.match(html, /Situs – Aman &amp; Terbuka &lt;script&gt;/);
  assert.match(html, /aria-label="Sumber pengukuran"/);
  assert.match(html, /Prioritas berikutnya/);
  assert.match(html, /id="audit-actions"/);
  assert.ok(html.indexOf('id="audit-actions"') < html.indexOf('Checklist pemeriksaan manual'));
});

test('methodology provenance note is visible on screen and security headers avoid overclaiming protection', () => {
  const limited: AuditReport = {
    ...report,
    methodology: 'technical-v1',
    rankingEligible: false,
    rankingReason: 'Pengukuran PageSpeed tidak tersedia',
  };
  const html = renderToStaticMarkup(<AuditReportView report={limited} onOpenSupabaseModal={() => {}} />);
  assert.match(html, /class="methodology-note [^"]*"/);
  assert.doesNotMatch(html, /<p class="hidden print:block[^"]*">Skor teknis/);
  assert.match(html, /Kelayakan peringkat: Pengukuran PageSpeed tidak tersedia/);
  assert.match(html, /bukan data lapangan Core Web Vitals/);
  assert.match(html, /Kehadiran header keamanan HTTP yang teramati pada satu halaman/);
  assert.match(html, /tetap perlu diverifikasi manual/);
  assert.doesNotMatch(html, /Memastikan pengunjung selalu diarahkan|Mencegah halaman situs Anda disisipkan|Mencegah browser salah membaca|Membatasi skrip luar yang boleh berjalan/);
});

