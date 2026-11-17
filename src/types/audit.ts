export type AuditCategory = 'peradilan_agama' | 'umum';

export type AuditStrategy = 'MOBILE' | 'DESKTOP';

export type IndicatorStatus = 'Terpenuhi' | 'Sebagian' | 'Tidak Ditemukan';

export interface SubIndicatorResult {
  id: string;
  name: string;
  status: IndicatorStatus;
  note: string;
  score: number;
  maxScore: number;
}

export interface PillarScore {
  id: string;
  name: string;
  weight: number; // e.g. 0.4, 0.3
  score: number; // 0 - 100
  weightedContribution: number;
  summary: string;
  indicators: SubIndicatorResult[];
}

export interface PageSpeedMetrics {
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  lcp: string;
  fcp: string;
  cls: string;
  tbt: string;
  speedIndex: string;
  lcpMs: number | null;
  fcpMs: number | null;
  clsNum: number | null;
  tbtMs: number | null;
  source: 'pagespeed' | 'server_probe';
  fetchWarning?: string;
}

export interface TechnicalSignals {
  httpsValid: boolean;
  statusCode: number | null;
  title: string | null;
  hasViewportMeta: boolean;
  securityHeaders: {
    hsts: boolean;
    xFrameOptions: boolean;
    xContentTypeOptions: boolean;
    csp: boolean;
  };
  responseTimeMs: number | null;
}

export interface AuditFinding {
  area: string;
  severity: 'Tinggi' | 'Sedang' | 'Rendah';
  issue: string;
  recommendation: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface AuditReport {
  id: string;
  url: string;
  domain: string;
  siteName: string;
  category: AuditCategory;
  strategy: AuditStrategy;
  auditedAt: string;
  totalScore: number;
  grade: string;
  pillarScores: PillarScore[];
  pageSpeed: PageSpeedMetrics;
  technicalSignals: TechnicalSignals;
  findings: AuditFinding[];
  executiveSummary: string;
  groundingSources: GroundingSource[];
  cloudSynced: boolean;
  cloudSyncError?: string;
}

export interface WebsiteRanking {
  id?: string;
  domain: string;
  site_name: string;
  category: AuditCategory;
  total_score: number;
  score_delta: number;
  grade: string;
  audit_count: number;
  last_audited_at: string;
  pillar_scores: Record<string, number> | PillarScore[];
  findings_summary: string;
}

export interface AuditHistoryEntry {
  id: string;
  domain: string;
  site_name?: string;
  category: AuditCategory;
  total_score: number;
  grade: string;
  pillar_scores: Record<string, number> | PillarScore[];
  findings_summary: string;
  audited_at: string;
}
