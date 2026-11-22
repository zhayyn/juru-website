import { useCallback, useEffect, useRef, useState } from 'react';
import { AuditForm, type AuditStepId } from './components/AuditForm';
import { AuditReportView } from './components/AuditReportView';
import { Header } from './components/Header';
import { HistoryModal } from './components/HistoryModal';
import { LeaderboardSection } from './components/LeaderboardSection';
import { QuestBoard } from './components/QuestBoard';
import { StandardsSection } from './components/StandardsSection';
import { SupabaseModal } from './components/SupabaseModal';
import {
  fetchAuditHistory,
  fetchRankings,
  getSupabaseClient,
  subscribeToRankings,
} from './lib/supabase';
import type {
  AuditCategory,
  AuditHistoryEntry,
  AuditReport,
  AuditStrategy,
  WebsiteRanking,
} from './types/audit';
import { normalizeUrl } from './utils/auditLogic';

const THEME_STORAGE_KEY = 'webaudit_theme';

export async function requestTechnicalAudit(url: string, category: AuditCategory, strategy: AuditStrategy): Promise<AuditReport> {
  const response = await fetch('/api/audit/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, category, strategy }),
  });
  const report = await response.json();
  if (!response.ok) throw new Error(report?.error || 'Gagal menjalankan audit teknis.');
  return report;
}

interface LocalAuditState {
  rankings: WebsiteRanking[];
  historyMap: Record<string, AuditHistoryEntry[]>;
}

const cohortKey = (domain: string, category: AuditCategory) => `${domain}:${category}`;
const validScore = (score: unknown): score is number =>
  typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100;

export function addLocalAudit(state: LocalAuditState, report: AuditReport): LocalAuditState {
  const metrics = report.pageSpeed;
  if (report.cloudSynced || report.methodology !== 'technical-v1' || report.strategy !== 'MOBILE' ||
      report.rankingEligible !== true || !validScore(report.totalScore) || metrics.source !== 'pagespeed' ||
      ![metrics.performanceScore, metrics.accessibilityScore, metrics.bestPracticesScore, metrics.seoScore].every(validScore)) return state;

  const key = cohortKey(report.domain, report.category);
  const history = state.historyMap[key] ?? [];
  if (history.some(entry => entry.id === report.id)) return state;
  const entry: AuditHistoryEntry = {
    id: report.id, domain: report.domain, site_name: report.siteName, category: report.category,
    total_score: report.totalScore, grade: report.grade, pillar_scores: report.pillarScores,
    findings_summary: report.executiveSummary, audited_at: report.auditedAt,
  };
  const entries = [...history, entry].sort((a, b) => a.audited_at.localeCompare(b.audited_at));
  const latest = entries[entries.length - 1];
  const previous = entries[entries.length - 2];
  const ranking: WebsiteRanking = {
    domain: latest.domain, site_name: latest.site_name ?? latest.domain, category: latest.category,
    total_score: latest.total_score, score_delta: previous ? latest.total_score - previous.total_score : 0,
    grade: latest.grade, audit_count: entries.length, last_audited_at: latest.audited_at,
    pillar_scores: latest.pillar_scores, findings_summary: latest.findings_summary,
  };
  return {
    rankings: [...state.rankings.filter(item => cohortKey(item.domain, item.category) !== key), ranking]
      .sort((a, b) => b.total_score - a.total_score || cohortKey(a.domain, a.category).localeCompare(cohortKey(b.domain, b.category))),
    historyMap: { ...state.historyMap, [key]: entries },
  };
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  // State konfigurasi & papan peringkat Supabase
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(() =>
    Boolean(getSupabaseClient()),
  );
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [rankings, setRankings] = useState<WebsiteRanking[]>([]);
  const [localAudits, setLocalAudits] = useState<LocalAuditState>({ rankings: [], historyMap: {} });
  const [isLoadingRankings, setIsLoadingRankings] = useState(false);
  const [rankingsError, setRankingsError] = useState<string | null>(null);

  // State formulir & proses audit
  const [urlInput, setUrlInput] = useState('');
  const [category, setCategory] = useState<AuditCategory>('peradilan_agama');
  const [strategy, setStrategy] = useState<AuditStrategy>('MOBILE');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditStep, setAuditStep] = useState<AuditStepId>('idle');
  const [auditError, setAuditError] = useState<string | null>(null);
  const [currentReport, setCurrentReport] = useState<AuditReport | null>(null);

  // State modal riwayat
  const [historyTarget, setHistoryTarget] = useState<WebsiteRanking | null>(null);
  const [historyEntries, setHistoryEntries] = useState<AuditHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const reportRef = useRef<HTMLDivElement | null>(null);

  // Sinkronisasi class .dark pada <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const loadCloudRankings = useCallback(async () => {
    const client = getSupabaseClient();
    setIsSupabaseConnected(Boolean(client));

    if (!client) {
      setIsRealtimeActive(false);
      setRankings([]);
      setRankingsError(null);
      return;
    }

    setIsLoadingRankings(true);
    setRankingsError(null);
    try {
      const data = await fetchRankings();
      setRankings(data);
      setIsSupabaseConnected(true);
    } catch (err) {
      setRankingsError(
        err instanceof Error ? err.message : 'Gagal memuat papan peringkat cloud.',
      );
    } finally {
      setIsLoadingRankings(false);
    }
  }, []);

  useEffect(() => {
    void loadCloudRankings();

    const client = getSupabaseClient();
    if (!client) {
      setIsRealtimeActive(false);
      return;
    }

    const unsubscribe = subscribeToRankings(() => {
      void loadCloudRankings();
    }, setIsRealtimeActive);

    return () => {
      unsubscribe();
      setIsRealtimeActive(false);
    };
  }, [loadCloudRankings, isSupabaseConnected]);

  const handleSupabaseConfigUpdated = () => {
    const connected = Boolean(getSupabaseClient());
    setIsSupabaseConnected(connected);
    if (connected) {
      void loadCloudRankings();
    } else {
      setRankings([]);
    }
  };

  const runAudit = async (overrideUrl?: string, overrideCategory?: AuditCategory) => {
    const targetInput = overrideUrl ?? urlInput;
    const targetCategory = overrideCategory ?? category;

    setAuditError(null);

    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeUrl(targetInput);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : 'Format URL tidak valid.');
      return;
    }

    setIsAuditing(true);
    setAuditStep('pagespeed');
    try {
      const baseReport = await requestTechnicalAudit(normalizedUrl, targetCategory, strategy);
      setAuditStep('sync');
      if (baseReport.cloudSynced) await loadCloudRankings();
      else setLocalAudits(previous => addLocalAudit(previous, baseReport));

      setCurrentReport(baseReport);
      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      setAuditError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat memproses audit website.',
      );
    } finally {
      setIsAuditing(false);
      setAuditStep('idle');
    }
  };

  const handleReaudit = (domain: string, itemCategory: AuditCategory) => {
    const targetUrl = `https://${domain}`;
    setUrlInput(targetUrl);
    setCategory(itemCategory);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    void runAudit(targetUrl, itemCategory);
  };

  const handleViewHistory = async (ranking: WebsiteRanking) => {
    setHistoryTarget(ranking);
    setHistoryError(null);

    const client = getSupabaseClient();
    if (!client) {
      const localEntries = localAudits.historyMap[cohortKey(ranking.domain, ranking.category)] ?? [];
      setHistoryEntries(localEntries);
      return;
    }

    setIsLoadingHistory(true);
    try {
      const rows = await fetchAuditHistory(ranking.domain, ranking.category);
      setHistoryEntries(rows);
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : 'Gagal memuat riwayat dari Supabase.',
      );
      setHistoryEntries([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  return (
    <div id="top" className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Header
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        isSupabaseConnected={isSupabaseConnected}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
      />

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <QuestBoard />
        <AuditForm
          url={urlInput}
          onUrlChange={setUrlInput}
          category={category}
          onCategoryChange={setCategory}
          strategy={strategy}
          onStrategyChange={setStrategy}
          isAuditing={isAuditing}
          currentStep={auditStep}
          errorMessage={auditError}
          onSubmit={() => void runAudit()}
        />

        {currentReport && (
          <div ref={reportRef}>
            <AuditReportView
              report={currentReport}
              onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
            />
          </div>
        )}

        <details className="secondary-panel" id="ranking-panel"><summary>Peringkat teknis <span>opsional</span></summary>
        <LeaderboardSection
          rankings={isSupabaseConnected ? rankings : localAudits.rankings}
          isLoading={isLoadingRankings}
          isSupabaseConnected={isSupabaseConnected}
          isRealtimeActive={isRealtimeActive}
          errorMessage={rankingsError}
          onReaudit={handleReaudit}
          onViewHistory={(item) => void handleViewHistory(item)}
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        />

        </details>
        <details className="secondary-panel" id="methodology-panel"><summary>Metode &amp; standar</summary><StandardsSection /></details>
      </main>

      <footer className="print:hidden border-t border-slate-200 bg-white py-6 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <span>
            Juru Website · Pemeriksaan teknis &amp; checklist pendamping
          </span>
          <span>
            Bukan audit resmi, sertifikasi keamanan, atau jaminan kepatuhan.
          </span>
        </div>
      </footer>

      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConfigUpdated={handleSupabaseConfigUpdated}
      />

      <HistoryModal
        ranking={historyTarget}
        history={historyEntries}
        isLoading={isLoadingHistory}
        errorMessage={historyError}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}
