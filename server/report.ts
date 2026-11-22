import { randomUUID } from 'node:crypto';
import { evaluateAutomaticChecklist } from './checklist.ts';
import type { AuditCategory, AuditReport, AuditStrategy, PageSpeedMetrics, TechnicalSignals } from '../src/types/audit.ts';
import { calculateGrade, clampScore, normalizeDomain } from '../src/utils/auditLogic.ts';
import { matchesPageSpeedTarget, missingPageSpeed } from './pageSpeed.ts';

interface MeasuredInput {
  url: string;
  html?: string;
  category: AuditCategory;
  strategy: AuditStrategy;
  pageSpeed: PageSpeedMetrics;
  technicalSignals: TechnicalSignals;
}

/** Ranking technical-v1 excludes AI and unverified content judgments. */
export function buildMeasuredReport(input: MeasuredInput): AuditReport {
  const signals = input.technicalSignals;
  const ps = ['pagespeed', 'lighthouse_local'].includes(input.pageSpeed.source) && !matchesPageSpeedTarget(input.url, input.pageSpeed)
    ? missingPageSpeed('Identitas halaman PageSpeed berbeda atau tidak lengkap; skor tidak digunakan.')
    : input.pageSpeed;
  const categoryScores = [ps.performanceScore, ps.accessibilityScore, ps.bestPracticesScore, ps.seoScore];
  const complete = categoryScores.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100);
  const totalScore = complete ? clampScore(categoryScores.reduce<number>((a, b) => a + (b ?? 0), 0) / 4) : null;
  const rankingEligible = complete && ps.source === 'pagespeed' && input.strategy === 'MOBILE' && new URL(input.url).pathname === '/' && signals.statusCode !== null && signals.statusCode >= 200 && signals.statusCode < 300;
  const auditedAt = new Date().toISOString();
  const checklist = evaluateAutomaticChecklist({ ...input, pageSpeed: ps, checkedAt: auditedAt });
  return {
    url: input.url, category: input.category, strategy: input.strategy, technicalSignals: signals,
    pageSpeed: ps, id: randomUUID(), domain: normalizeDomain(input.url), siteName: signals.title || normalizeDomain(input.url),
    auditedAt, totalScore, grade: totalScore === null ? 'Belum lengkap' : calculateGrade(totalScore),
    methodology: ps.source === 'lighthouse_local' ? 'technical-local-v1' : 'technical-v1', rankingEligible, measurementCoverage: categoryScores.filter((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100).length * 25,
    rankingReason: ps.source === 'lighthouse_local' ? 'Pengukuran Lighthouse lokal; tidak dibandingkan atau disimpan ke peringkat PageSpeed online' : rankingEligible ? 'Skor teknis terukur; bukan nilai kepatuhan atau kelengkapan konten.' : 'Ranking memerlukan homepage MOBILE, respons sukses dan empat skor Lighthouse lengkap; laporan ini tidak masuk ranking.',
    ...checklist, findings: [], groundingSources: [{ title: 'Halaman yang diambil server', uri: input.url }],
    executiveSummary: 'Pemeriksaan teknis satu halaman; bukan audit kepatuhan resmi atau sertifikasi keamanan. Kelengkapan informasi dan aksesibilitas manual masih perlu diverifikasi.',
    aiStatus: 'Tidak digunakan', cloudSynced: false,
  };
}
