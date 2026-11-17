import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { AuditHistoryEntry, WebsiteRanking } from '../types/audit';
import { formatCategoryLabel, formatDateTimeId } from '../utils/auditLogic';

interface HistoryModalProps {
  ranking: WebsiteRanking | null;
  history: AuditHistoryEntry[];
  isLoading: boolean;
  errorMessage: string | null;
  onClose: () => void;
}

export function HistoryModal({
  ranking,
  history,
  isLoading,
  errorMessage,
  onClose,
}: HistoryModalProps) {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!ranking) return;
    setActivePointIndex(null);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ranking, onClose]);

  if (!ranking) return null;

  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.audited_at).getTime() - new Date(b.audited_at).getTime(),
  );

  // Dimensi SVG grafik garis
  const width = 640;
  const height = 210;
  const padX = 44;
  const padY = 26;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const points = sortedHistory.map((entry, idx) => {
    const x =
      sortedHistory.length === 1
        ? padX + innerW / 2
        : padX + (idx / (sortedHistory.length - 1)) * innerW;
    const clamped = Math.max(0, Math.min(100, entry.total_score));
    const y = padY + ((100 - clamped) / 100) * innerH;
    return { x, y, entry };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const activePoint =
    activePointIndex !== null && points[activePointIndex]
      ? points[activePointIndex]
      : points[points.length - 1] ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-modal-title"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-sky-800 dark:text-sky-300">
              Riwayat Perkembangan Skor Audit · {formatCategoryLabel(ranking.category)}
            </p>
            <h2
              id="history-modal-title"
              className="mt-1 text-xl font-bold text-slate-900 dark:text-white"
            >
              {ranking.site_name}
            </h2>
            <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
              {ranking.domain}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal riwayat"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Memuat riwayat audit dari database...</span>
            </div>
          ) : errorMessage ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
            >
              {errorMessage}
            </div>
          ) : sortedHistory.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              Belum ada catatan riwayat terdahulu untuk domain ini.
            </div>
          ) : (
            <>
              {/* Grafik Garis Perkembangan Skor */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Tren Skor ({sortedHistory.length} Kali Pengujian)
                  </span>
                  {activePoint && (
                    <span className="font-mono text-xs text-slate-700 tabular-nums dark:text-slate-300">
                      {formatDateTimeId(activePoint.entry.audited_at)} · Skor{' '}
                      <strong>{activePoint.entry.total_score.toFixed(1)}</strong> (
                      {activePoint.entry.grade})
                    </span>
                  )}
                </div>

                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  role="img"
                  aria-label={`Grafik perkembangan skor ${ranking.site_name}`}
                  className="h-auto w-full overflow-visible"
                >
                  {/* Garis kisi horizontal */}
                  {[0, 25, 50, 75, 100].map((val) => {
                    const y = padY + ((100 - val) / 100) * innerH;
                    return (
                      <g key={val}>
                        <line
                          x1={padX}
                          y1={y}
                          x2={width - padX}
                          y2={y}
                          className="stroke-slate-200 dark:stroke-slate-800"
                          strokeDasharray="3 3"
                        />
                        <text
                          x={padX - 8}
                          y={y + 4}
                          textAnchor="end"
                          className="fill-slate-400 font-mono text-[10px] dark:fill-slate-500"
                        >
                          {val}
                        </text>
                      </g>
                    );
                  })}

                  {/* Garis tren */}
                  {points.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={polylinePoints}
                    />
                  )}

                  {/* Titik data interaktif */}
                  {points.map((pt, idx) => {
                    const isFocused =
                      activePointIndex === idx ||
                      (activePointIndex === null && idx === points.length - 1);
                    return (
                      <g key={pt.entry.id}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isFocused ? 6 : 4.5}
                          tabIndex={0}
                          role="button"
                          aria-label={`Audit ${formatDateTimeId(pt.entry.audited_at)}: skor ${pt.entry.total_score.toFixed(1)}`}
                          onMouseEnter={() => setActivePointIndex(idx)}
                          onFocus={() => setActivePointIndex(idx)}
                          className={`cursor-pointer transition-all ${
                            isFocused
                              ? 'fill-sky-600 stroke-white stroke-2 dark:fill-sky-400 dark:stroke-slate-900'
                              : 'fill-white stroke-sky-600 stroke-2 dark:fill-slate-900 dark:stroke-sky-400'
                          }`}
                        />
                        <text
                          x={pt.x}
                          y={pt.y - 10}
                          textAnchor="middle"
                          className="fill-slate-800 font-mono text-[10px] font-semibold dark:fill-slate-200"
                        >
                          {pt.entry.total_score.toFixed(1)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Daftar Catatan Riwayat Audit */}
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Catatan Kronologis Hasil Audit
                </h3>
                <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                  {[...sortedHistory].reverse().map((item) => (
                    <li key={item.id} className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-500 tabular-nums dark:text-slate-400">
                          {formatDateTimeId(item.audited_at)}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {item.grade}
                          </span>
                          <span className="font-mono text-sm font-bold tabular-nums text-sky-700 dark:text-sky-400">
                            {item.total_score.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                        {item.findings_summary || 'Tidak ada catatan tambahan.'}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
