import { randomUUID } from 'node:crypto';
import { AUDIT_STANDARDS } from '../src/data/standards.ts';
import type { AuditCategory, AuditReport, AuditStrategy, PageSpeedMetrics, PillarScore, TechnicalSignals } from '../src/types/audit.ts';
import { calculateGrade, clampScore, normalizeDomain } from '../src/utils/auditLogic.ts';
import { matchesPageSpeedTarget, missingPageSpeed } from './pageSpeed.ts';

interface MeasuredInput {
  url: string;
  category: AuditCategory;
  strategy: AuditStrategy;
  pageSpeed: PageSpeedMetrics;
  technicalSignals: TechnicalSignals;
}

/** Ranking technical-v1 excludes AI and unverified content judgments. */
export function buildMeasuredReport(input: MeasuredInput): AuditReport {
  const signals = input.technicalSignals;
  const ps = input.pageSpeed.source === 'pagespeed' && !matchesPageSpeedTarget(input.url, input.pageSpeed)
    ? missingPageSpeed('Identitas halaman PageSpeed berbeda atau tidak lengkap; skor tidak digunakan.')
    : input.pageSpeed;
  const categoryScores = [ps.performanceScore, ps.accessibilityScore, ps.bestPracticesScore, ps.seoScore];
  const complete = categoryScores.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100);
  const totalScore = complete ? clampScore(categoryScores.reduce<number>((a, b) => a + (b ?? 0), 0) / 4) : null;
  const rankingEligible = complete && ps.source === 'pagespeed' && input.strategy === 'MOBILE' && new URL(input.url).pathname === '/' && signals.statusCode !== null && signals.statusCode >= 200 && signals.statusCode < 300;
  const pillarScores: PillarScore[] = AUDIT_STANDARDS[input.category].pillars.map((def) => ({
    id: def.id, name: def.name, weight: def.weight, score: null, weightedContribution: null,
    summary: 'Checklist peninjauan manual; tidak memengaruhi ranking technical-v1.',
    indicators: def.indicators.map((ind) => ({ id: ind.id, name: ind.name, status: 'Belum Diverifikasi', score: null, maxScore: 100,
      note: `${ind.description} Belum diverifikasi oleh pemeriksa; audit satu halaman bukan bukti kelengkapan situs.` })),
  }));
  return {
    ...input, pageSpeed: ps, id: randomUUID(), domain: normalizeDomain(input.url), siteName: signals.title || normalizeDomain(input.url),
    auditedAt: new Date().toISOString(), totalScore, grade: totalScore === null ? 'Belum lengkap' : calculateGrade(totalScore),
    methodology: 'technical-v1', rankingEligible, measurementCoverage: categoryScores.filter((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100).length * 25,
    rankingReason: rankingEligible ? 'Skor teknis terukur; bukan nilai kepatuhan atau kelengkapan konten.' : 'Ranking memerlukan homepage MOBILE, respons sukses dan empat skor Lighthouse lengkap; laporan ini tidak masuk ranking.',
    pillarScores, findings: [], groundingSources: [{ title: 'Halaman yang diambil server', uri: input.url }],
    executiveSummary: 'Pemeriksaan teknis satu halaman; bukan audit kepatuhan resmi atau sertifikasi keamanan. Kelengkapan informasi dan aksesibilitas manual masih perlu diverifikasi.',
    aiStatus: 'Tidak digunakan', cloudSynced: false,
  };
}
