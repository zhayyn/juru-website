import type {
  AuditCategory,
  PageSpeedMetrics,
  PillarScore,
  TechnicalSignals,
  WebsiteRanking,
} from '../types/audit';

/**
 * Menormalisasi input URL menjadi alamat HTTPS lengkap yang valid.
 * Melempar error berbahasa Indonesia apabila format tidak valid.
 */
export function normalizeUrl(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Masukkan alamat website yang ingin diaudit.');
  }

  if (/\s/.test(trimmed)) {
    throw new Error('Alamat website tidak boleh mengandung spasi.');
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:')
  ) {
    throw new Error('Protokol URL tidak didukung. Gunakan http:// atau https://.');
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error('Format alamat website tidak valid. Contoh: pa-semarang.go.id');
  }

  if (!parsed.hostname || !parsed.hostname.includes('.')) {
    throw new Error('Nama domain tidak lengkap. Pastikan menyertakan ekstensi domain (misal .go.id atau .com).');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Protokol URL harus HTTP atau HTTPS.');
  }

  return parsed.toString();
}

/**
 * Mengekstrak root domain bersih untuk kunci unik papan peringkat.
 * Contoh: "https://www.pa-semarang.go.id/profil?id=1" -> "pa-semarang.go.id"
 */
export function normalizeDomain(rawInput: string): string {
  const fullUrl = normalizeUrl(rawInput);
  const parsed = new URL(fullUrl);
  return parsed.hostname.replace(/^www\./i, '').toLowerCase();
}

/**
 * Menentukan predikat mutu objektif berdasarkan total skor (0 - 100).
 */
export function calculateGrade(totalScore: number): string {
  const score = clampScore(totalScore);
  if (score >= 90) return 'A (Unggul)';
  if (score >= 80) return 'B (Baik)';
  if (score >= 70) return 'C (Cukup)';
  if (score >= 55) return 'D (Kurang)';
  return 'E (Perlu Perbaikan)';
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

/**
 * Menghitung skor objektif infrastruktur & teknis berdasarkan metrik Lighthouse
 * (Performance, SEO, Best Practices) serta header keamanan HTTP/HTTPS.
 */
export function computeTechnicalPillarScore(
  pageSpeed: PageSpeedMetrics,
  signals: TechnicalSignals,
): number {
  const hasLighthouse =
    pageSpeed.performanceScore !== null ||
    pageSpeed.seoScore !== null ||
    pageSpeed.bestPracticesScore !== null;

  const headerPoints =
    (signals.httpsValid ? 40 : 0) +
    (signals.hasViewportMeta ? 20 : 0) +
    (signals.securityHeaders.hsts ? 10 : 0) +
    (signals.securityHeaders.xFrameOptions ? 10 : 0) +
    (signals.securityHeaders.xContentTypeOptions ? 10 : 0) +
    (signals.securityHeaders.csp ? 10 : 0);

  if (!hasLighthouse) {
    const responseBonus =
      signals.responseTimeMs !== null
        ? signals.responseTimeMs < 800
          ? 85
          : signals.responseTimeMs < 1800
            ? 70
            : 50
        : 55;
    return clampScore(headerPoints * 0.65 + responseBonus * 0.35);
  }

  const perf = pageSpeed.performanceScore ?? 50;
  const seo = pageSpeed.seoScore ?? 50;
  const bp = pageSpeed.bestPracticesScore ?? 50;

  // Gabungan metrik Lighthouse nyata (75%) + keamanan HTTP/SSL (25%)
  const lighthouseAvg = perf * 0.45 + bp * 0.3 + seo * 0.25;
  return clampScore(lighthouseAvg * 0.75 + headerPoints * 0.25);
}

/**
 * Menghitung skor total terbobot dari daftar pilar.
 * Mendukung normalisasi otomatis apabila jumlah bobot tidak tepat 1.0.
 */
export function computeWeightedTotalScore(
  pillars: Array<{ weight: number; score: number }>,
): number {
  if (pillars.length === 0) return 0;
  const totalWeight = pillars.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight <= 0) return 0;

  const weightedSum = pillars.reduce(
    (sum, p) => sum + clampScore(p.score) * p.weight,
    0,
  );
  return clampScore(weightedSum / totalWeight);
}

export function buildPillarSummaryMap(
  pillars: PillarScore[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const pillar of pillars) {
    map[pillar.id] = clampScore(pillar.score);
  }
  return map;
}

/**
 * Mengekstrak objek JSON dari respons teks Gemini (termasuk bila dibungkus markdown code fence).
 */
export function extractJsonFromGeminiText(rawText: string): Record<string, unknown> {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('Respons AI kosong.');
  }

  // Coba langsung parse jika sudah berupa JSON murni
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Lanjut ekstraksi block
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Lanjut pencarian kurung kurawal
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const slice = trimmed.slice(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(slice);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }

  throw new Error('Gagal mengurai struktur JSON dari hasil analisis AI.');
}

export function formatCategoryLabel(category: AuditCategory): string {
  return category === 'peradilan_agama'
    ? 'Peradilan Agama'
    : 'Website Umum';
}

export function formatDateTimeId(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatRelativeTimeId(
  isoDate: string,
  now: Date = new Date(),
): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '-';

  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSeconds < 60) return 'Baru saja';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} hari lalu`;
  return formatDateTimeId(isoDate);
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Menghasilkan file CSV berstandar RFC 4180 dengan UTF-8 BOM untuk laporan evaluasi.
 */
export function buildCsvExport(rankings: WebsiteRanking[]): string {
  const headers = [
    'Peringkat',
    'Nama Website',
    'Domain',
    'Kategori',
    'Skor Terbaru',
    'Perubahan Skor',
    'Predikat Mutu',
    'Jumlah Audit',
    'Waktu Audit Terakhir',
    'Ringkasan Temuan',
  ];

  const rows = rankings.map((item, idx) => [
    idx + 1,
    item.site_name,
    item.domain,
    formatCategoryLabel(item.category),
    item.total_score.toFixed(1),
    item.score_delta >= 0 ? `+${item.score_delta.toFixed(1)}` : item.score_delta.toFixed(1),
    item.grade,
    item.audit_count,
    formatDateTimeId(item.last_audited_at),
    item.findings_summary,
  ]);

  const csvLines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];

  return `\uFEFF${csvLines.join('\r\n')}`;
}
