import { useMemo, useState } from 'react';
import {
  Award,
  Download,
  FileJson,
  History,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import type { AuditCategory, WebsiteRanking } from '../types/audit';
import {
  buildCsvExport,
  formatCategoryLabel,
  formatDateTimeId,
  formatRelativeTimeId,
} from '../utils/auditLogic';
import { HoverTip } from './HoverTip';

export type LeaderboardFilter = 'all' | AuditCategory;

interface LeaderboardSectionProps {
  rankings: WebsiteRanking[];
  isLoading: boolean;
  isSupabaseConnected: boolean;
  isRealtimeActive: boolean;
  errorMessage: string | null;
  onReaudit: (domain: string, category: AuditCategory) => void;
  onViewHistory: (ranking: WebsiteRanking) => void;
  onOpenSupabaseModal: () => void;
}

function RankDisplay({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span
        title="Peringkat 1 (Emas)"
        className="inline-flex items-center gap-1 font-mono text-sm font-bold text-amber-600 tabular-nums dark:text-amber-400"
      >
        <Award className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>#1</span>
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span
        title="Peringkat 2 (Perak)"
        className="inline-flex items-center gap-1 font-mono text-sm font-bold text-slate-500 tabular-nums dark:text-slate-300"
      >
        <Award className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>#2</span>
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span
        title="Peringkat 3 (Perunggu)"
        className="inline-flex items-center gap-1 font-mono text-sm font-bold text-orange-700 tabular-nums dark:text-orange-400"
      >
        <Award className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>#3</span>
      </span>
    );
  }
  return (
    <span className="font-mono text-sm font-medium text-slate-600 tabular-nums dark:text-slate-400">
      #{rank}
    </span>
  );
}

function DeltaDisplay({ delta }: { delta: number }) {
  if (delta > 0.05) {
    return (
      <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
        ▲ +{delta.toFixed(1)}
      </span>
    );
  }
  if (delta < -0.05) {
    return (
      <span className="font-mono text-xs font-semibold text-red-700 tabular-nums dark:text-red-400">
        ▼ {delta.toFixed(1)}
      </span>
    );
  }
  return (
    <span className="font-mono text-xs text-slate-400 tabular-nums dark:text-slate-500">
      — 0.0
    </span>
  );
}

export function LeaderboardSection({
  rankings,
  isLoading,
  isSupabaseConnected,
  isRealtimeActive,
  errorMessage,
  onReaudit,
  onViewHistory,
  onOpenSupabaseModal,
}: LeaderboardSectionProps) {
  const [filter, setFilter] = useState<LeaderboardFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRankings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rankings.filter((item) => {
      if (!Number.isFinite(item.total_score)) return false;
      if (filter !== 'all' && item.category !== filter) return false;
      if (!q) return true;
      return (
        item.site_name.toLowerCase().includes(q) ||
        item.domain.toLowerCase().includes(q) ||
        item.grade.toLowerCase().includes(q)
      );
    });
  }, [rankings, filter, searchQuery]);

  const handleExportCsv = () => {
    const csvContent = buildCsvExport(filteredRankings);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `webaudit-leaderboard-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const jsonContent = JSON.stringify(filteredRankings, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `webaudit-leaderboard-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section
      id="papan-peringkat"
      aria-labelledby="leaderboard-heading"
      className="print:hidden rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Judul & Keterangan Sinkronisasi */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-sky-800 dark:text-sky-300">
              Peringkat Teknis
            </span>
            <span aria-hidden="true">·</span>
            {isSupabaseConnected ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                {isRealtimeActive && (
                  <span
                    className="h-2 w-2 rounded-full bg-emerald-500"
                    aria-hidden="true"
                  />
                )}
                <span>
                  {isRealtimeActive
                    ? 'Terhubung & Terbarui Otomatis'
                    : 'Terhubung ke Penyimpanan Online'}
                </span>
              </span>
            ) : (
              <span>
                Sesi Lokal · tidak dibagikan ·{' '}
                <button
                  type="button"
                  onClick={onOpenSupabaseModal}
                  className="font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800 dark:text-sky-400"
                >
                  Sambungkan penyimpanan online
                </button>
              </span>
            )}
          </div>

          <h2
            id="leaderboard-heading"
            className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white"
          >
            <HoverTip description="Skor teknis empat kategori Lighthouse; bukan ranking resmi/kepatuhan.">
              Teknis • technical-v1 • MOBILE • beranda
            </HoverTip>
          </h2>
          <p className="mt-2 text-xs text-slate-500">bukan ranking resmi/kepatuhan</p>
        </div>

        {/* Tombol Ekspor */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredRankings.length === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Ekspor CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            disabled={filteredRankings.length === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Ekspor JSON</span>
          </button>
        </div>
      </div>

      {/* Filter Kategori & Pencarian */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="group"
          aria-label="Filter kategori papan peringkat"
          className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-950"
        >
          {(
            [
              { id: 'all', label: 'Semua' },
              { id: 'peradilan_agama', label: 'Peradilan Agama' },
              { id: 'umum', label: 'Website Umum' },
            ] as Array<{ id: LeaderboardFilter; label: string }>
          ).map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(tab.id)}
                className={`h-8 rounded-md px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:max-w-xs">
          <label htmlFor="leaderboard-search" className="sr-only">
            Cari nama website atau domain
          </label>
          <input
            id="leaderboard-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari instansi atau domain..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
          />
          <Search
            className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Pesan Error Memuat Data */}
      {errorMessage && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
        >
          {errorMessage}
        </div>
      )}

      {/* Tabel Papan Peringkat */}
      <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-700 dark:bg-slate-950 dark:text-slate-300">
            <tr>
              <th scope="col" className="px-4 py-3">
                Peringkat
              </th>
              <th scope="col" className="px-4 py-3">
                <HoverTip description="Sorot nama website pada baris tabel untuk membaca ringkasan hasil pemeriksaan terakhir.">
                  Nama Website &amp; Domain
                </HoverTip>
              </th>
              <th scope="col" className="px-4 py-3">
                Kategori
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                <HoverTip
                  align="right"
                  description="Rata-rata empat skor Lighthouse pada beranda MOBILE dengan methodology technical-v1."
                >
                  Skor teknis
                </HoverTip>
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                <HoverTip
                  align="right"
                  description="Selisih kenaikan atau penurunan nilai dibandingkan pemeriksaan sebelumnya."
                >
                  Perubahan
                </HoverTip>
              </th>
              <th scope="col" className="px-4 py-3">
                <HoverTip description="Tingkat capaian mutu berdasarkan perolehan nilai akhir.">
                  Predikat Mutu
                </HoverTip>
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                <HoverTip
                  align="right"
                  description="Berapa kali website ini telah diperiksa."
                >
                  Diperiksa
                </HoverTip>
              </th>
              <th scope="col" className="px-4 py-3">
                Pembaruan Terakhir
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Tindakan
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="animate-pulse">
                  <td className="px-4 py-3.5" colSpan={9}>
                    <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-800" />
                  </td>
                </tr>
              ))
            ) : filteredRankings.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center">
                  <SlidersHorizontal
                    className="mx-auto h-7 w-7 text-slate-400"
                    aria-hidden="true"
                  />
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                    Belum ada hasil teknis terukur yang sesuai
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Ubah kata kunci pencarian atau periksa website baru di atas.
                  </p>
                </td>
              </tr>
            ) : (
              filteredRankings.map((item, idx) => (
                <tr
                  key={`${item.domain}:${item.category}`}
                  className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-950/60"
                >
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <RankDisplay rank={idx + 1} />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {item.findings_summary ? (
                        <HoverTip description={item.findings_summary}>
                          {item.site_name}
                        </HoverTip>
                      ) : (
                        item.site_name
                      )}
                    </div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {item.domain}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-700 whitespace-nowrap dark:text-slate-300">
                    {formatCategoryLabel(item.category)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                    {item.total_score.toFixed(1)}
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <DeltaDisplay delta={item.score_delta} />
                  </td>
                  <td className="px-4 py-3.5 text-xs font-medium text-slate-800 whitespace-nowrap dark:text-slate-200">
                    {item.grade}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                    {item.audit_count}x
                  </td>
                  <td
                    className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap dark:text-slate-400"
                    title={formatDateTimeId(item.last_audited_at)}
                  >
                    {formatRelativeTimeId(item.last_audited_at)}
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onReaudit(item.domain, item.category)}
                        aria-label={`Audit ulang ${item.site_name}`}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <RefreshCw className="h-3 w-3" aria-hidden="true" />
                        <span>Audit Ulang</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onViewHistory(item)}
                        aria-label={`Lihat riwayat ${item.site_name}`}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2.5 text-xs font-medium text-sky-800 transition-colors hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-900/60"
                      >
                        <History className="h-3 w-3" aria-hidden="true" />
                        <span>Lihat Riwayat</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
