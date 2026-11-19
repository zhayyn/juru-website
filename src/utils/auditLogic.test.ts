import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCsvExport,
  calculateGrade,
  computeTechnicalPillarScore,
  computeWeightedTotalScore,
  extractJsonFromGeminiText,
  formatRelativeTimeId,
  inspectModernWebSignals,
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
  assert.ok(csv.includes(',91.5,3.2,A (Unggul),4,'));
});

test('buildCsvExport mempertahankan delta positif negatif dan nol sebagai angka', () => {
  for (const delta of [3.2, -2, 0]) {
    const csv = buildCsvExport([{
      domain: 'example.com', site_name: 'Fixture Sintetis', category: 'umum', total_score: 80,
      score_delta: delta, grade: 'B (Baik)', audit_count: 1,
      last_audited_at: '2026-11-18T08:00:00.000Z', pillar_scores: {}, findings_summary: 'Pengukuran sintetis',
    }]);
    const cells = csv.split('\r\n')[1].split(',');
    assert.equal(cells[5], String(delta), `delta numerik ${delta} tidak boleh mendapat apostrof atau tanda plus`);
    assert.equal(Number(cells[5]), delta);
  }
});

test('buildCsvExport menetralkan formula dari judul dan ringkasan situs tidak tepercaya', () => {
  for (const payload of ['=1+1', '+1+1', '-1+1', '@SUM(1)', '  =1+1', '\t=1+1', '\r=1+1', '\n=1+1']) {
    const csv = buildCsvExport([{
      domain: 'example.com', site_name: payload, category: 'umum', total_score: 80,
      score_delta: 0, grade: 'B (Baik)', audit_count: 1,
      last_audited_at: '2026-11-18T08:00:00.000Z', pillar_scores: {}, findings_summary: payload,
    }]);
    // Quoting a CSV cell alone does not stop spreadsheet formula interpretation.
    const safe = `'${payload}`;
    const escaped = /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    assert.ok(csv.includes(`1,${escaped},example.com,`), `unsafe site title: ${JSON.stringify(payload)}`);
    assert.ok(csv.endsWith(`,${escaped}`), `unsafe summary: ${JSON.stringify(payload)}`);
  }
});

test('formatRelativeTimeId memformat selisih waktu dengan alami', () => {
  const now = new Date('2026-11-17T10:00:00.000Z');
  assert.equal(formatRelativeTimeId('2026-11-17T09:59:30.000Z', now), 'Baru saja');
  assert.equal(formatRelativeTimeId('2026-11-17T09:45:00.000Z', now), '15 menit lalu');
  assert.equal(formatRelativeTimeId('2026-11-17T07:00:00.000Z', now), '3 jam lalu');
});

test('inspectModernWebSignals mendeteksi sinyal HTML modern, SRI CDN, dan mask CSS', () => {
  const modernHtml = `<!doctype html><html lang="id"><head>
    <meta name="color-scheme" content="light dark">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">
    <link rel="stylesheet" href="https://cdn.example.org/app.css" integrity="sha384-abc123" crossorigin="anonymous">
    <script src="https://pa-semarang.go.id/app.js"></script>
    <style>.card::before{-webkit-mask:linear-gradient(#fff 0 0);mask:linear-gradient(#fff 0 0);}</style>
  </head><body><main>Konten</main></body></html>`;
  assert.deepEqual(inspectModernWebSignals(modernHtml, 'https://pa-semarang.go.id/'), {
    hasLangAttribute: true,
    hasMainLandmark: true,
    hasColorSchemeMeta: true,
    unverifiedExternalAssets: 0,
    prefixedMaskWithoutStandard: false,
  });

  const legacyHtml = `<!doctype html><html><head>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <script src="https://cdn.example.net/widget.js"></script>
    <style>.badge::before{-webkit-mask:linear-gradient(#fff 0 0);-webkit-mask-composite:xor;}</style>
  </head><body><div>Isi</div></body></html>`;
  assert.deepEqual(inspectModernWebSignals(legacyHtml, 'https://contoh.go.id/'), {
    hasLangAttribute: false,
    hasMainLandmark: false,
    hasColorSchemeMeta: false,
    unverifiedExternalAssets: 2,
    prefixedMaskWithoutStandard: true,
  });
});
