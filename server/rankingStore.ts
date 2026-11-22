/** Server-only persistence boundary. Never import from the browser bundle. */
export interface RankingPublishReport {
  domain: string;
  siteName: string;
  category: string;
  strategy: string;
  methodology?: string;
  rankingEligible?: boolean;
  auditedAt: string;
  totalScore: number | null;
  grade: string;
  pillarScores: Array<{ id: string; score: number | null }>;
  executiveSummary: string;
}

export interface RankingPublishResult {
  cloudSynced: boolean;
  cloudSyncError?: string;
}

type RankingEnv = Readonly<Record<string, string | undefined>>;
const DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
const score = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;

function validTimestamp(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return false;
  const canonical = value.replace(/(?:\.(\d{1,3}))?Z$/, (_, fraction = '') => `.${fraction.padEnd(3, '0')}Z`);
  return parsed.toISOString() === canonical;
}

function validReport(report: RankingPublishReport): boolean {
  if (!report || report.rankingEligible !== true || !score(report.totalScore) || report.strategy !== 'MOBILE' || report.methodology !== 'technical-v1') return false;
  if (typeof report.domain !== 'string' || !DOMAIN.test(report.domain) || !['umum', 'peradilan_agama'].includes(report.category) || !validTimestamp(report.auditedAt)) return false;
  if (!text(report.siteName, 300) || !text(report.grade, 32) || !text(report.executiveSummary, 10000)) return false;
  if (!Array.isArray(report.pillarScores) || report.pillarScores.length < 1 || report.pillarScores.length > 64) return false;
  const ids = new Set<string>();
  return report.pillarScores.every(p => {
    if (!p || typeof p.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(p.id) || ids.has(p.id) || !(p.score === null || score(p.score))) return false;
    ids.add(p.id);
    return true;
  });
}

export async function publishRanking(
  report: RankingPublishReport,
  env: RankingEnv = process.env,
  fetcher: typeof fetch = fetch,
): Promise<RankingPublishResult> {
  if (env.RANKING_PUBLISH_ENABLED !== 'true') return { cloudSynced: false };
  if (!validReport(report)) return { cloudSynced: false, cloudSyncError: 'Ranking report is not eligible for publication.' };
  if (!env.SUPABASE_URL || !/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.supabase\.co$/.test(env.SUPABASE_URL) || !env.SUPABASE_SERVICE_ROLE_KEY || !/^[\x21-\x7e]+$/.test(env.SUPABASE_SERVICE_ROLE_KEY)) {
    return { cloudSynced: false, cloudSyncError: 'Ranking publication is not configured.' };
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('timeout'));
      }, 8000);
    });
    const response = await Promise.race([timeout, fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/jw_record_audit_v1`, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_domain: report.domain, p_site_name: report.siteName, p_category: report.category,
        p_strategy: report.strategy, p_methodology: report.methodology,
        p_total_score: report.totalScore, p_grade: report.grade,
        p_pillar_scores: report.pillarScores.map(({ id, score }) => ({ id, score })),
        p_findings_summary: report.executiveSummary,
      }),
    })]);
    if (!response.ok) return { cloudSynced: false, cloudSyncError: 'Ranking publication failed.' };
    return { cloudSynced: true };
  } catch {
    return { cloudSynced: false, cloudSyncError: controller.signal.aborted ? 'Ranking publication timed out.' : 'Ranking publication failed.' };
  } finally {
    clearTimeout(timer);
  }
}
