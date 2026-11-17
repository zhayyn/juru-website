import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { AUDIT_STANDARDS } from './src/data/standards.ts';
import type {
  AuditCategory,
  AuditFinding,
  AuditStrategy,
  GroundingSource,
  IndicatorStatus,
  PageSpeedMetrics,
  PillarScore,
  SubIndicatorResult,
  TechnicalSignals,
} from './src/types/audit.ts';
import {
  calculateGrade,
  clampScore,
  computeTechnicalPillarScore,
  computeWeightedTotalScore,
  extractJsonFromGeminiText,
  normalizeDomain,
  normalizeUrl,
} from './src/utils/auditLogic.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY belum tersedia di lingkungan server. Silakan periksa Settings > Secrets.',
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function probeTargetWebsite(targetUrl: string): Promise<TechnicalSignals> {
  const startedAt = Date.now();
  const isHttps = targetUrl.startsWith('https://');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; WebAuditRankerBot/1.0; +https://webaudit.local)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const responseTimeMs = Date.now() - startedAt;
    const html = await res.text().catch(() => '');

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const rawTitle = titleMatch?.[1]?.replace(/\s+/g, ' ').trim() || null;
    const title = rawTitle
      ? rawTitle
          .replace(/&#8211;|&ndash;/gi, '–')
          .replace(/&#8212;|&mdash;/gi, '—')
          .replace(/&amp;/gi, '&')
          .replace(/&quot;/gi, '"')
          .replace(/&#39;|&apos;/gi, "'")
      : null;
    const hasViewportMeta = /<meta[^>]+name=["']viewport["'][^>]*>/i.test(html);

    return {
      httpsValid: res.url.startsWith('https://') || isHttps,
      statusCode: res.status,
      title,
      hasViewportMeta,
      securityHeaders: {
        hsts: Boolean(res.headers.get('strict-transport-security')),
        xFrameOptions: Boolean(res.headers.get('x-frame-options')),
        xContentTypeOptions: Boolean(res.headers.get('x-content-type-options')),
        csp: Boolean(res.headers.get('content-security-policy')),
      },
      responseTimeMs,
    };
  } catch {
    return {
      httpsValid: isHttps,
      statusCode: null,
      title: null,
      hasViewportMeta: false,
      securityHeaders: {
        hsts: false,
        xFrameOptions: false,
        xContentTypeOptions: false,
        csp: false,
      },
      responseTimeMs: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPageSpeedInsights(
  targetUrl: string,
  strategy: AuditStrategy,
): Promise<PageSpeedMetrics> {
  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
    targetUrl,
  )}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO&strategy=${strategy}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(endpoint, { signal: controller.signal });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const reason =
        errBody?.error?.message ||
        `PageSpeed API merespons status ${res.status}`;
      return {
        performanceScore: null,
        accessibilityScore: null,
        bestPracticesScore: null,
        seoScore: null,
        lcp: 'Tidak tersedia',
        fcp: 'Tidak tersedia',
        cls: 'Tidak tersedia',
        tbt: 'Tidak tersedia',
        speedIndex: 'Tidak tersedia',
        lcpMs: null,
        fcpMs: null,
        clsNum: null,
        tbtMs: null,
        source: 'server_probe',
        fetchWarning: reason,
      };
    }

    const data = await res.json();
    const cats = data?.lighthouseResult?.categories ?? {};
    const audits = data?.lighthouseResult?.audits ?? {};

    const toPct = (score: unknown): number | null =>
      typeof score === 'number' ? Math.round(score * 100) : null;

    return {
      performanceScore: toPct(cats.performance?.score),
      accessibilityScore: toPct(cats.accessibility?.score),
      bestPracticesScore: toPct(cats['best-practices']?.score),
      seoScore: toPct(cats.seo?.score),
      lcp: audits['largest-contentful-paint']?.displayValue || '-',
      fcp: audits['first-contentful-paint']?.displayValue || '-',
      cls: audits['cumulative-layout-shift']?.displayValue || '-',
      tbt: audits['total-blocking-time']?.displayValue || '-',
      speedIndex: audits['speed-index']?.displayValue || '-',
      lcpMs:
        typeof audits['largest-contentful-paint']?.numericValue === 'number'
          ? Math.round(audits['largest-contentful-paint'].numericValue)
          : null,
      fcpMs:
        typeof audits['first-contentful-paint']?.numericValue === 'number'
          ? Math.round(audits['first-contentful-paint'].numericValue)
          : null,
      clsNum:
        typeof audits['cumulative-layout-shift']?.numericValue === 'number'
          ? Number(audits['cumulative-layout-shift'].numericValue.toFixed(3))
          : null,
      tbtMs:
        typeof audits['total-blocking-time']?.numericValue === 'number'
          ? Math.round(audits['total-blocking-time'].numericValue)
          : null,
      source: 'pagespeed',
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Gagal menghubungi PageSpeed API';
    return {
      performanceScore: null,
      accessibilityScore: null,
      bestPracticesScore: null,
      seoScore: null,
      lcp: 'Tidak tersedia',
      fcp: 'Tidak tersedia',
      cls: 'Tidak tersedia',
      tbt: 'Tidak tersedia',
      speedIndex: 'Tidak tersedia',
      lcpMs: null,
      fcpMs: null,
      clsNum: null,
      tbtMs: null,
      source: 'server_probe',
      fetchWarning: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeStatus(raw: unknown): IndicatorStatus {
  const s = String(raw || '').toLowerCase();
  if (s.includes('terpenuhi') || s === 'pass' || s === 'lengkap') {
    return 'Terpenuhi';
  }
  if (s.includes('sebagian') || s === 'partial') {
    return 'Sebagian';
  }
  return 'Tidak Ditemukan';
}

function defaultScoreForStatus(status: IndicatorStatus): number {
  if (status === 'Terpenuhi') return 100;
  if (status === 'Sebagian') return 55;
  return 15;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/pagespeed', async (req, res) => {
    try {
      const rawUrl = String(req.query.url || '');
      const strategyRaw = String(req.query.strategy || 'MOBILE').toUpperCase();
      const strategy: AuditStrategy =
        strategyRaw === 'DESKTOP' ? 'DESKTOP' : 'MOBILE';

      const normalizedUrl = normalizeUrl(rawUrl);

      const [pageSpeed, technicalSignals] = await Promise.all([
        fetchPageSpeedInsights(normalizedUrl, strategy),
        probeTargetWebsite(normalizedUrl),
      ]);

      res.json({
        url: normalizedUrl,
        domain: normalizeDomain(normalizedUrl),
        strategy,
        pageSpeed,
        technicalSignals,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Permintaan tidak valid.';
      res.status(400).json({ error: message });
    }
  });

  app.post('/api/audit/analyze', async (req, res) => {
    try {
      const rawUrl = String(req.body?.url || '');
      const categoryRaw = String(req.body?.category || 'peradilan_agama');
      const strategyRaw = String(req.body?.strategy || 'MOBILE').toUpperCase();

      const category: AuditCategory =
        categoryRaw === 'umum' ? 'umum' : 'peradilan_agama';
      const strategy: AuditStrategy =
        strategyRaw === 'DESKTOP' ? 'DESKTOP' : 'MOBILE';

      const normalizedUrl = normalizeUrl(rawUrl);
      const domain = normalizeDomain(normalizedUrl);
      const standard = AUDIT_STANDARDS[category];

      const pageSpeed: PageSpeedMetrics = req.body?.pageSpeed ?? {
        performanceScore: null,
        accessibilityScore: null,
        bestPracticesScore: null,
        seoScore: null,
        lcp: '-',
        fcp: '-',
        cls: '-',
        tbt: '-',
        speedIndex: '-',
        lcpMs: null,
        fcpMs: null,
        clsNum: null,
        tbtMs: null,
        source: 'server_probe',
      };

      const technicalSignals: TechnicalSignals = req.body?.technicalSignals ?? {
        httpsValid: normalizedUrl.startsWith('https://'),
        statusCode: null,
        title: null,
        hasViewportMeta: false,
        securityHeaders: {
          hsts: false,
          xFrameOptions: false,
          xContentTypeOptions: false,
          csp: false,
        },
        responseTimeMs: null,
      };

      const ai = getGeminiClient();

      const rubricPrompt = standard.pillars
        .map(
          (p) =>
            `- ${p.id} (${p.name}, bobot ${p.weightLabel}):\n` +
            p.indicators
              .map((ind) => `  * ${ind.id}: ${ind.name} — ${ind.description}`)
              .join('\n'),
        )
        .join('\n');

      const prompt = `Lakukan audit objektif terhadap website dengan domain "${domain}" (URL: ${normalizedUrl}) menggunakan Google Search untuk memeriksa halaman terindeks, menu navigasi publik, transparansi dokumen, serta publikasi terbarunya.

MODE AUDIT: ${standard.title} (${standard.regulationRef})

DATA PENGUKURAN TEKNIS REAL-TIME YANG SUDAH DIKUMPULKAN:
- Strategi Pengujian: ${strategy}
- Judul Halaman (<title>): ${technicalSignals.title || 'Tidak terdeteksi'}
- Status HTTP: ${technicalSignals.statusCode ?? 'Tidak terjangkau langsung'}
- HTTPS/SSL Valid: ${technicalSignals.httpsValid ? 'Ya' : 'Tidak'}
- Viewport Mobile Meta: ${technicalSignals.hasViewportMeta ? 'Ada' : 'Tidak terdeteksi'}
- Security Headers: HSTS=${technicalSignals.securityHeaders.hsts}, X-Frame-Options=${technicalSignals.securityHeaders.xFrameOptions}, X-Content-Type-Options=${technicalSignals.securityHeaders.xContentTypeOptions}, CSP=${technicalSignals.securityHeaders.csp}
- Lighthouse Performance: ${pageSpeed.performanceScore ?? 'Tidak tersedia'}
- Lighthouse Accessibility: ${pageSpeed.accessibilityScore ?? 'Tidak tersedia'}
- Lighthouse Best Practices: ${pageSpeed.bestPracticesScore ?? 'Tidak tersedia'}
- Lighthouse SEO: ${pageSpeed.seoScore ?? 'Tidak tersedia'}
- Core Web Vitals: LCP=${pageSpeed.lcp}, FCP=${pageSpeed.fcp}, CLS=${pageSpeed.cls}, TBT=${pageSpeed.tbt}, Speed Index=${pageSpeed.speedIndex}

RUBRIK PENILAIAN WAJIB:
${rubricPrompt}

TUGAS ANDA:
Telusuri situs ${domain} melalui Google Search (misal pencarian site:${domain}, menu profil, DIPA/LKjIP, LHKPN, SIPP, jadwal sidang, Posbakum, SKM/IPK, SIWAS, widget disabilitas, atau konten utama sesuai mode).
Berikan output HANYA berupa objek JSON valid (tanpa teks tambahan di luar JSON) dengan skema persis berikut:
{
  "site_name": "Nama Instansi atau Pemilik Website yang terdeteksi secara resmi",
  "executive_summary": "Ringkasan 2-3 kalimat dalam Bahasa Indonesia yang alami, hangat, dan mudah dipahami oleh pimpinan atau pengelola website (hindari istilah teknis yang rumit; fokus pada manfaat nyata bagi pengunjung).",
  "pillar_evaluations": [
    {
      "pillar_id": "id pilar sesuai rubrik",
      "score": 85,
      "summary": "Ringkasan penilaian aspek ini dalam 1-2 kalimat yang mudah dipahami pengguna awam.",
      "indicators": [
        {
          "id": "id sub-indikator sesuai rubrik",
          "status": "Terpenuhi | Sebagian | Tidak Ditemukan",
          "score": 90,
          "note": "Penjelasan singkat mengenai temuan nyata di website dengan bahasa yang ramah bagi pengelola layanan."
        }
      ]
    }
  ],
  "findings": [
    {
      "area": "Nama bagian layanan atau halaman",
      "severity": "Tinggi | Sedang | Rendah",
      "issue": "Penjelasan sederhana tentang hal yang kurang optimal dan dampaknya bagi pengunjung website",
      "recommendation": "Langkah perbaikan praktis yang mudah dipahami pengelola website atau pimpinan"
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'Anda adalah penasihat kualitas layanan website publik di Indonesia. Sampaikan penilaian dalam Bahasa Indonesia baku yang alami, ramah, dan mudah dimengerti oleh end user atau pengelola instansi non-teknis—jelaskan dampak bagi pengunjung bukan istilah pemrograman yang kaku. Jangan mengarang temuan yang tidak ada; tandai Tidak Ditemukan jika bukti publik tidak terindeks. Selalu kembalikan JSON murni yang valid.',
          tools: [{ googleSearch: {} }],
        },
      });

      const rawText = response.text ?? '';
      const parsed = extractJsonFromGeminiText(rawText);

      // Ekstrak sumber grounding Google Search
      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const groundingSources: GroundingSource[] = [];
      const seenUris = new Set<string>();
      for (const chunk of groundingChunks) {
        const uri = chunk?.web?.uri;
        const title = chunk?.web?.title;
        if (uri && !seenUris.has(uri)) {
          seenUris.add(uri);
          groundingSources.push({
            title: title || uri,
            uri,
          });
        }
      }

      const rawPillars = Array.isArray(parsed.pillar_evaluations)
        ? parsed.pillar_evaluations
        : [];

      const technicalObjectiveScore = computeTechnicalPillarScore(
        pageSpeed,
        technicalSignals,
      );

      const pillarScores: PillarScore[] = standard.pillars.map((def) => {
        const aiPillar = rawPillars.find(
          (item: Record<string, unknown>) =>
            String(item?.pillar_id || '').toLowerCase() === def.id.toLowerCase(),
        ) as Record<string, unknown> | undefined;

        const aiIndicators = Array.isArray(aiPillar?.indicators)
          ? (aiPillar.indicators as Array<Record<string, unknown>>)
          : [];

        const indicators: SubIndicatorResult[] = def.indicators.map((indDef) => {
          const matched = aiIndicators.find(
            (i) =>
              String(i?.id || '').toLowerCase() === indDef.id.toLowerCase(),
          );
          const status = normalizeStatus(matched?.status);
          const rawScore =
            typeof matched?.score === 'number'
              ? clampScore(matched.score)
              : defaultScoreForStatus(status);

          return {
            id: indDef.id,
            name: indDef.name,
            status,
            note:
              String(matched?.note || '').trim() ||
              (status === 'Terpenuhi'
                ? 'Terdeteksi pada struktur halaman publik website.'
                : status === 'Sebagian'
                  ? 'Ditemukan sebagian, disarankan melengkapi pembaruan berkala.'
                  : 'Belum terdeteksi pada indeks publik atau navigasi utama.'),
            score: rawScore,
            maxScore: 100,
          };
        });

        const avgIndicatorScore =
          indicators.length > 0
            ? clampScore(
                indicators.reduce((sum, item) => sum + item.score, 0) /
                  indicators.length,
              )
            : 50;

        let pillarScore =
          typeof aiPillar?.score === 'number'
            ? clampScore(aiPillar.score)
            : avgIndicatorScore;

        // Rekonsiliasi objektif dengan metrik Lighthouse / probe nyata untuk pilar teknis & aksesibilitas
        if (def.id === 'pilar_3_infrastruktur' || def.id === 'pilar_1_performance') {
          pillarScore = clampScore(
            technicalObjectiveScore * 0.75 + pillarScore * 0.25,
          );
        } else if (
          def.id === 'pilar_2_uiux' &&
          pageSpeed.accessibilityScore !== null
        ) {
          pillarScore = clampScore(
            pillarScore * 0.6 + pageSpeed.accessibilityScore * 0.4,
          );
        } else if (
          def.id === 'pilar_4_security_a11y' &&
          pageSpeed.accessibilityScore !== null
        ) {
          pillarScore = clampScore(
            pillarScore * 0.45 +
              pageSpeed.accessibilityScore * 0.35 +
              technicalObjectiveScore * 0.2,
          );
        } else if (def.id === 'pilar_2_seo' && pageSpeed.seoScore !== null) {
          pillarScore = clampScore(
            pillarScore * 0.55 + pageSpeed.seoScore * 0.45,
          );
        }

        return {
          id: def.id,
          name: def.name,
          weight: def.weight,
          score: pillarScore,
          weightedContribution: clampScore(pillarScore * def.weight),
          summary: String(aiPillar?.summary || def.description).trim(),
          indicators,
        };
      });

      const totalScore = computeWeightedTotalScore(pillarScores);
      const grade = calculateGrade(totalScore);

      const rawFindings = Array.isArray(parsed.findings) ? parsed.findings : [];
      const findings: AuditFinding[] = rawFindings
        .slice(0, 8)
        .map((f: Record<string, unknown>) => {
          const sevRaw = String(f?.severity || 'Sedang');
          const severity: AuditFinding['severity'] = sevRaw
            .toLowerCase()
            .includes('tinggi')
            ? 'Tinggi'
            : sevRaw.toLowerCase().includes('rendah')
              ? 'Rendah'
              : 'Sedang';
          return {
            area: String(f?.area || 'Umum').trim(),
            severity,
            issue: String(f?.issue || 'Perlu peninjauan lebih lanjut.').trim(),
            recommendation: String(
              f?.recommendation || 'Lakukan evaluasi berkala bersama tim pengelola TI.',
            ).trim(),
          };
        });

      const siteName =
        String(parsed.site_name || '').trim() ||
        technicalSignals.title ||
        domain;

      const executiveSummary =
        String(parsed.executive_summary || '').trim() ||
        `Audit terhadap ${siteName} (${domain}) menghasilkan skor total ${totalScore.toFixed(
          1,
        )} dengan predikat ${grade}.`;

      res.json({
        id: `audit-${Date.now()}`,
        url: normalizedUrl,
        domain,
        siteName,
        category,
        strategy,
        auditedAt: new Date().toISOString(),
        totalScore,
        grade,
        pillarScores,
        pageSpeed,
        technicalSignals,
        findings,
        executiveSummary,
        groundingSources,
      });
    } catch (error) {
      let message =
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat menganalisis website.';
      try {
        const parsedErr = JSON.parse(message);
        if (parsedErr?.error?.message) {
          message = parsedErr.error.message;
        }
      } catch {
        // biarkan pesan asli
      }

      if (/quota|rate-limits|RESOURCE_EXHAUSTED/i.test(message)) {
        message =
          'Kuota Gemini API saat ini telah habis. Silakan periksa paket/kuota kunci API Anda di Settings > Secrets atau coba beberapa saat lagi.';
      } else if (/API_KEY_INVALID|PERMISSION_DENIED/i.test(message)) {
        message =
          'Kunci Gemini API tidak valid atau tidak memiliki izin. Silakan periksa konfigurasi di Settings > Secrets.';
      }

      console.error('Error /api/audit/analyze:', error);
      res.status(500).json({ error: message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WebAudit & Ranker Pro server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
