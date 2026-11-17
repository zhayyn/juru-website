import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCsvExport,
  calculateGrade,
  computeTechnicalPillarScore,
  computeWeightedTotalScore,
  extractJsonFromGeminiText,
  formatRelativeTimeId,
  normalizeDomain,
  normalizeUrl,
} from './auditLogic';

test('normalizeUrl menambahkan https dan memvalidasi input tidak sah', () => {
  assert.equal(normalizeUrl('pa-semarang.go.id'), 'https://pa-semarang.go.id/');
  assert.equal(
    normalizeUrl('https://www.pa-semarang.go.id/profil'),
    'https://www.pa-semarang.go.id/profil',
  );
  assert.throws(() => normalizeUrl(''), /Masukkan alamat website/);
  assert.throws(() => normalizeUrl('javascript:alert(1)'), /Protokol URL tidak didukung/);
  assert.throws(() => normalizeUrl('localhost'), /Nama domain tidak lengkap/);
});

test('normalizeDomain mengekstrak root domain bersih tanpa www dan path', () => {
  assert.equal(
    normalizeDomain('https://www.pa-semarang.go.id/'),
    'pa-semarang.go.id',
  );
  assert.equal(
    normalizeDomain('http://WWW.PA-JAKARTASELATAN.GO.ID/layanan/sipp?x=1'),
    'pa-jakartaselatan.go.id',
  );
  assert.equal(normalizeDomain('kompas.com'), 'kompas.com');
});

test('calculateGrade memetakan rentang skor ke predikat mutu yang benar', () => {
  assert.equal(calculateGrade(95), 'A (Unggul)');
  assert.equal(calculateGrade(85), 'B (Baik)');
  assert.equal(calculateGrade(72.5), 'C (Cukup)');
  assert.equal(calculateGrade(60), 'D (Kurang)');
  assert.equal(calculateGrade(40), 'E (Perlu Perbaikan)');
});

test('computeWeightedTotalScore menghitung jumlah terbobot secara akurat', () => {
  const score = computeWeightedTotalScore([
    { weight: 0.4, score: 90 },
    { weight: 0.3, score: 80 },
    { weight: 0.3, score: 70 },
  ]);
  assert.equal(score, 81);

  const general = computeWeightedTotalScore([
    { weight: 0.35, score: 80 },
    { weight: 0.25, score: 84 },
    { weight: 0.2, score: 90 },
    { weight: 0.2, score: 75 },
  ]);
  assert.equal(general, 82);
});

test('computeTechnicalPillarScore menggabungkan skor Lighthouse dan sinyal keamanan', () => {
  const score = computeTechnicalPillarScore(
    {
      performanceScore: 80,
      accessibilityScore: 90,
      bestPracticesScore: 90,
      seoScore: 100,
      lcp: '1.8 s',
      fcp: '0.9 s',
      cls: '0.02',
      tbt: '120 ms',
      speedIndex: '2.1 s',
      lcpMs: 1800,
      fcpMs: 900,
      clsNum: 0.02,
      tbtMs: 120,
      source: 'pagespeed',
    },
    {
      httpsValid: true,
      statusCode: 200,
      title: 'PA Semarang',
      hasViewportMeta: true,
      securityHeaders: {
        hsts: true,
        xFrameOptions: true,
        xContentTypeOptions: true,
        csp: false,
      },
      responseTimeMs: 420,
    },
  );
  // Lighthouse avg = 80*0.45 + 90*0.30 + 100*0.25 = 36 + 27 + 25 = 88
  // Headers = 40 + 20 + 10 + 10 + 10 = 90
  // Combined = 88*0.75 + 90*0.25 = 66 + 22.5 = 88.5
  assert.equal(score, 88.5);
});

test('extractJsonFromGeminiText mengurai JSON di dalam blok markdown', () => {
  const raw = 'Berikut hasil analisis:\n```json\n{"site_name": "Pengadilan Agama Semarang", "total": 88}\n```';
  const parsed = extractJsonFromGeminiText(raw);
  assert.equal(parsed.site_name, 'Pengadilan Agama Semarang');
  assert.equal(parsed.total, 88);
});

test('buildCsvExport menghasilkan CSV dengan BOM dan escaping tanda kutip', () => {
  const csv = buildCsvExport([
    {
      domain: 'pa-semarang.go.id',
      site_name: 'PA Semarang, Kelas I-A',
      category: 'peradilan_agama',
      total_score: 91.5,
      score_delta: 3.2,
      grade: 'A (Unggul)',
      audit_count: 4,
      last_audited_at: '2026-11-17T08:00:00.000Z',
      pillar_scores: {},
      findings_summary: 'Lengkap dan responsif',
    },
  ]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"PA Semarang, Kelas I-A"'));
  assert.ok(csv.includes('pa-semarang.go.id'));
  assert.ok(csv.includes('+3.2'));
});

test('formatRelativeTimeId memformat selisih waktu dengan alami', () => {
  const now = new Date('2026-11-17T10:00:00.000Z');
  assert.equal(formatRelativeTimeId('2026-11-17T09:59:30.000Z', now), 'Baru saja');
  assert.equal(formatRelativeTimeId('2026-11-17T09:45:00.000Z', now), '15 menit lalu');
  assert.equal(formatRelativeTimeId('2026-11-17T07:00:00.000Z', now), '3 jam lalu');
});
