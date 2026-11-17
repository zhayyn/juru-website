import { useCallback, useEffect, useRef, useState } from 'react';
import { Cloud, Database } from 'lucide-react';
import { AuditForm, type AuditStepId } from './components/AuditForm';
import { AuditReportView } from './components/AuditReportView';
import { Header } from './components/Header';
import { HistoryModal } from './components/HistoryModal';
import { LeaderboardSection } from './components/LeaderboardSection';
import { StandardsSection } from './components/StandardsSection';
import { SupabaseModal } from './components/SupabaseModal';
import { SAMPLE_LOCAL_HISTORY, SAMPLE_LOCAL_RANKINGS } from './data/standards';
import {
  fetchAuditHistory,
  fetchRankings,
  getSupabaseClient,
  recordWebsiteAudit,
  subscribeToRankings,
} from './lib/supabase';
import type {
  AuditCategory,
  AuditHistoryEntry,
  AuditReport,
  AuditStrategy,
  WebsiteRanking,
} from './types/audit';
import {
  buildPillarSummaryMap,
  normalizeDomain,
  normalizeUrl,
} from './utils/auditLogic';

const THEME_STORAGE_KEY = 'webaudit_theme';

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
  const [rankings, setRankings] = useState<WebsiteRanking[]>(() =>
    getSupabaseClient() ? [] : SAMPLE_LOCAL_RANKINGS,
  );
  const [localHistoryMap, setLocalHistoryMap] = useState<
    Record<string, AuditHistoryEntry[]>
  >(SAMPLE_LOCAL_HISTORY);
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
      setRankings((prev) => (prev.length > 0 ? prev : SAMPLE_LOCAL_RANKINGS));
      setRankingsError(null);
      return;
    }

    setIsLoadingRankings(true);
    setRankingsError(null);
    try {
      const data = await fetchRankings();
      setRankings(data);
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

    setIsRealtimeActive(true);
    const unsubscribe = subscribeToRankings(() => {
      void loadCloudRankings();
    });

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
      setRankings(SAMPLE_LOCAL_RANKINGS);
    }
  };

  const runAudit = async (overrideUrl?: string, overrideCategory?: AuditCategory) => {
    const targetInput = overrideUrl ?? urlInput;
    const targetCategory = overrideCategory ?? category;

    setAuditError(null);

    let normalizedUrl: string;
    let domain: string;
    try {
      normalizedUrl = normalizeUrl(targetInput);
      domain = normalizeDomain(normalizedUrl);
    } catch (err) {
      setAuditError(
        err instanceof Error ? err.message : 'Format URL tidak valid.',
      );
      return;
    }

    setIsAuditing(true);
    setAuditStep('pagespeed');

    try {
      // Tahap 1: Pengukuran PageSpeed Insights v5 (coba langsung dari browser, fallback ke server probe)
      const psServerPromise = fetch(
        `/api/pagespeed?url=${encodeURIComponent(normalizedUrl)}&strategy=${strategy}`,
      );

      let clientPageSpeed: AuditReport['pageSpeed'] | null = null;
      try {
        const psController = new AbortController();
        const psTimer = setTimeout(() => psController.abort(), 16000);
        const directEndpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
          normalizedUrl,
        )}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO&strategy=${strategy}`;
        const directRes = await fetch(directEndpoint, {
          signal: psController.signal,
        });
        clearTimeout(psTimer);
        if (directRes.ok) {
          const data = await directRes.json();
          const cats = data?.lighthouseResult?.categories ?? {};
          const audits = data?.lighthouseResult?.audits ?? {};
          const toPct = (v: unknown): number | null =>
            typeof v === 'number' ? Math.round(v * 100) : null;
          clientPageSpeed = {
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
        }
      } catch {
        // Fallback ke hasil pengukuran server
      }

      const psResponse = await psServerPromise;
      const psJson = await psResponse.json();
      if (!psResponse.ok) {
        throw new Error(psJson?.error || 'Gagal mengukur metrik PageSpeed.');
      }

      const finalPageSpeed = clientPageSpeed ?? psJson.pageSpeed;

      // Tahap 2: Analisis Konten & Kepatuhan via Gemini + Google Search Grounding
      setAuditStep('gemini');
      const analyzeResponse = await fetch('/api/audit/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: normalizedUrl,
          domain,
          category: targetCategory,
          strategy,
          pageSpeed: finalPageSpeed,
          technicalSignals: psJson.technicalSignals,
        }),
      });

      const analyzeJson = await analyzeResponse.json();
      if (!analyzeResponse.ok) {
        throw new Error(
          analyzeJson?.error || 'Gagal menjalankan analisis kepatuhan AI.',
        );
      }

      // Tahap 3: Penetapan Skor Terbobot
      setAuditStep('scoring');
      const baseReport: AuditReport = {
        ...analyzeJson,
        cloudSynced: false,
      };

      // Tahap 4: Sinkronisasi Papan Peringkat (Supabase RPC atau Pratinjau Lokal)
      setAuditStep('sync');
      const pillarMap = buildPillarSummaryMap(baseReport.pillarScores);
      const client = getSupabaseClient();

      if (client) {
        try {
          await recordWebsiteAudit({
            domain: baseReport.domain,
            siteName: baseReport.siteName,
            category: baseReport.category,
            totalScore: baseReport.totalScore,
            grade: baseReport.grade,
            pillarScores: pillarMap,
            findingsSummary: baseReport.executiveSummary,
          });
          baseReport.cloudSynced = true;
          await loadCloudRankings();
        } catch (syncErr) {
          baseReport.cloudSynced = false;
          baseReport.cloudSyncError =
            syncErr instanceof Error
              ? syncErr.message
              : 'Gagal menyimpan ke Supabase';
        }
      } else {
        // Pembaruan state lokal saat Supabase belum dikonfigurasi
        setRankings((prev) => {
          const existing = prev.find((r) => r.domain === baseReport.domain);
          const delta = existing
            ? Math.round((baseReport.totalScore - existing.total_score) * 10) / 10
            : 0;
          const updatedItem: WebsiteRanking = {
            domain: baseReport.domain,
            site_name: baseReport.siteName,
            category: baseReport.category,
            total_score: baseReport.totalScore,
            score_delta: delta,
            grade: baseReport.grade,
            audit_count: existing ? existing.audit_count + 1 : 1,
            last_audited_at: baseReport.auditedAt,
            pillar_scores: pillarMap,
            findings_summary: baseReport.executiveSummary,
          };
          const others = prev.filter((r) => r.domain !== baseReport.domain);
          return [updatedItem, ...others].sort(
            (a, b) => b.total_score - a.total_score,
          );
        });

        setLocalHistoryMap((prev) => {
          const list = prev[baseReport.domain] ?? [];
          const newEntry: AuditHistoryEntry = {
            id: baseReport.id,
            domain: baseReport.domain,
            site_name: baseReport.siteName,
            category: baseReport.category,
            total_score: baseReport.totalScore,
            grade: baseReport.grade,
            pillar_scores: pillarMap,
            findings_summary: baseReport.executiveSummary,
            audited_at: baseReport.auditedAt,
          };
          return {
            ...prev,
            [baseReport.domain]: [...list, newEntry],
          };
        });
      }

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
      const localEntries = localHistoryMap[ranking.domain] ?? [
        {
          id: `local-${ranking.domain}`,
          domain: ranking.domain,
          site_name: ranking.site_name,
          category: ranking.category,
          total_score: ranking.total_score,
          grade: ranking.grade,
          pillar_scores: ranking.pillar_scores,
          findings_summary: ranking.findings_summary,
          audited_at: ranking.last_audited_at,
        },
      ];
      setHistoryEntries(localEntries);
      return;
    }

    setIsLoadingHistory(true);
    try {
      const rows = await fetchAuditHistory(ranking.domain);
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
        {/* Baris Pengaturan Cepat Penyimpanan Online */}
        {!isSupabaseConnected && (
          <div
            role="region"
            aria-label="Pengaturan awal koneksi cloud"
            className="print:hidden flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-3">
              <Database
                className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-400"
                aria-hidden="true"
              />
              <p className="text-xs text-slate-700 sm:text-sm dark:text-slate-300">
                <strong className="font-semibold text-slate-900 dark:text-white">
                  Mode pratinjau lokal:
                </strong>{' '}
                Sambungkan akun penyimpanan online agar daftar peringkat dapat diakses bersama.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSupabaseModalOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3.5 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-100 whitespace-nowrap shrink-0 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-900/60"
            >
              <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Atur Supabase Sekarang</span>
            </button>
          </div>
        )}

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

        <LeaderboardSection
          rankings={rankings}
          isLoading={isLoadingRankings}
          isSupabaseConnected={isSupabaseConnected}
          isRealtimeActive={isRealtimeActive}
          errorMessage={rankingsError}
          onReaudit={handleReaudit}
          onViewHistory={(item) => void handleViewHistory(item)}
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        />

        <StandardsSection />
      </main>

      <footer className="print:hidden border-t border-slate-200 bg-white py-6 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <span>
            WebAudit &amp; Ranker Pro · Platform Audit Kualitas &amp; Kepatuhan Website
          </span>
          <span>
            Mendukung Standar Peradilan Agama (Badilag / SINOVA / KMA 2-144/2022) &amp;
            Web Modern
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
