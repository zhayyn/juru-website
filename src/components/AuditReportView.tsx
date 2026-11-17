import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  ExternalLink,
  Printer,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { AuditReport, IndicatorStatus } from '../types/audit';
import { formatCategoryLabel, formatDateTimeId } from '../utils/auditLogic';
import { HoverTip } from './HoverTip';

interface AuditReportViewProps {
  report: AuditReport;
  onOpenSupabaseModal: () => void;
}

function StatusLabel({ status }: { status: IndicatorStatus }) {
  if (status === 'Terpenuhi') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Terpenuhi</span>
      </span>
    );
  }
  if (status === 'Sebagian') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Sebagian</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400">
      <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>Belum Tersedia</span>
    </span>
  );
}

function getScoreToneClass(score: number): string {
  if (score >= 85) return 'text-emerald-700 dark:text-emerald-400';
  if (score >= 70) return 'text-sky-700 dark:text-sky-400';
  if (score >= 55) return 'text-amber-700 dark:text-amber-400';
  return 'text-red-700 dark:text-red-400';
}

export function AuditReportView({
  report,
  onOpenSupabaseModal,
}: AuditReportViewProps) {
  const handlePrint = () => {
    window.print();
  };

  const strategyLabel =
    report.strategy === 'MOBILE' ? 'Tampilan Ponsel' : 'Tampilan Komputer';

  const metrics = [
    {
      label: 'Kecepatan Situs',
      tip: 'Menggambarkan seberapa gesit halaman website dimuat untuk pengunjung.',
      value:
        report.pageSpeed.performanceScore !== null
          ? `${report.pageSpeed.performanceScore}`
          : '—',
    },
    {
      label: 'Kemudahan Akses',
      tip: 'Menilai kenyamanan website bagi seluruh pengunjung, termasuk pengguna disabilitas.',
      value:
        report.pageSpeed.accessibilityScore !== null
          ? `${report.pageSpeed.accessibilityScore}`
          : '—',
    },
    {
      label: 'Keamanan & Standar',
      tip: 'Memastikan website aman dikunjungi dan mengikuti praktik terbaik web modern.',
      value:
        report.pageSpeed.bestPracticesScore !== null
          ? `${report.pageSpeed.bestPracticesScore}`
          : '—',
    },
    {
      label: 'Mudah Ditemukan',
      tip: 'Mengukur seberapa siap halaman website muncul rapi di hasil pencarian Google.',
      value:
        report.pageSpeed.seoScore !== null ? `${report.pageSpeed.seoScore}` : '—',
    },
    {
      label: 'Tampil Utama',
      tip: 'Waktu yang dibutuhkan hingga konten paling penting tampil penuh di layar pengunjung.',
      value: report.pageSpeed.lcp,
    },
    {
      label: 'Respon Awal',
      tip: 'Waktu pertama kali layar mulai menampilkan isi halaman setelah diklik.',
      value: report.pageSpeed.fcp,
    },
    {
      label: 'Kestabilan Layar',
      tip: 'Mengukur apakah tata letak halaman bergeser tiba-tiba atau tersendat saat dimuat.',
      value: `${report.pageSpeed.cls} · ${report.pageSpeed.tbt}`,
    },
  ];

  return (
    <section
      aria-labelledby="audit-report-title"
      className="print-surface rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Header Laporan & Skor Utama */}
      <div className="flex flex-col gap-6 border-b border-slate-200 pb-6 lg:flex-row lg:items-start lg:justify-between dark:border-slate-800">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-sky-800 dark:text-sky-300">
              Hasil Pemeriksaan Website
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatCategoryLabel(report.category)}</span>
            <span aria-hidden="true">·</span>
            <span>{strategyLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{formatDateTimeId(report.auditedAt)}</span>
          </div>

          <h2
            id="audit-report-title"
            className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
          >
            {report.siteName}
          </h2>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <a
              href={report.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-sky-700 hover:underline dark:text-sky-400"
            >
              <span>{report.domain}</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
              ·
            </span>
            {report.cloudSynced ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Tersimpan di Peringkat Online</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={onOpenSupabaseModal}
                className="print:hidden inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
              >
                <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {report.cloudSyncError
                    ? `Belum tersimpan (${report.cloudSyncError})`
                    : 'Mode lokal · Hubungkan Cloud untuk menyimpan ke peringkat bersama'}
                </span>
              </button>
            )}
          </div>

          <p className="max-w-3xl pt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {report.executiveSummary}
          </p>
        </div>

        {/* Kartu Skor Total & Tombol Cetak */}
        <div className="flex flex-row items-center justify-between gap-6 rounded-lg border border-slate-200 bg-slate-50/70 p-4 sm:min-w-[250px] lg:flex-col lg:items-end dark:border-slate-800 dark:bg-slate-950/60">
          <div className="lg:text-right">
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              <HoverTip
                align="right"
                description="Nilai gabungan dari kelengkapan informasi, kenyamanan tampilan, serta kecepatan dan keamanan website (skala 0 sampai 100)."
              >
                Nilai Keseluruhan
              </HoverTip>
            </span>
            <div className="mt-1 flex items-baseline gap-1.5 lg:justify-end">
              <span
                className={`font-mono text-4xl font-bold tracking-tight tabular-nums ${getScoreToneClass(
                  report.totalScore,
                )}`}
              >
                {report.totalScore.toFixed(1)}
              </span>
              <span className="font-mono text-sm text-slate-500 dark:text-slate-400">
                / 100
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              Predikat: {report.grade}
            </p>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="print:hidden inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            <span>Cetak / Simpan PDF</span>
          </button>
        </div>
      </div>

      {/* Peringatan apabila pengukuran kecepatan sedang terbatas */}
      {report.pageSpeed.fetchWarning && (
        <div
          role="status"
          className="mt-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Layanan pengukur kecepatan eksternal sedang padat, sehingga nilai kecepatan
            dihitung dari pemeriksaan respon langsung ke website Anda.
          </span>
        </div>
      )}

      {/* Strip Metrik Kecepatan & Keamanan Pengunjung */}
      <div className="mt-6 print-avoid-break">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          <HoverTip description="Ringkasan pengalaman pengunjung saat membuka situs Anda. Sorot masing-masing judul di bawah untuk arti angkanya.">
            Gambaran Kecepatan &amp; Kenyamanan Pengunjung
          </HoverTip>
        </h3>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
            >
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                <HoverTip description={metric.tip}>{metric.label}</HoverTip>
              </span>
              <span className="mt-1 block font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white">
                {metric.value}
              </span>
            </div>
          ))}

          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              <HoverTip
                align="right"
                description="Menandakan koneksi pengunjung terlindungi gembok keamanan HTTPS beserta waktu respon awal situs."
              >
                Sertifikat Aman
              </HoverTip>
            </span>
            <span className="mt-1 inline-flex items-center gap-1 font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
              {report.technicalSignals.httpsValid ? (
                <ShieldCheck
                  className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
              ) : (
                <ShieldAlert
                  className="h-3.5 w-3.5 text-red-600 dark:text-red-400"
                  aria-hidden="true"
                />
              )}
              <span>
                {report.technicalSignals.httpsValid ? 'Aman' : 'Belum Aman'}
                {report.technicalSignals.responseTimeMs !== null
                  ? ` · ${report.technicalSignals.responseTimeMs}ms`
                  : ''}
              </span>
            </span>
          </div>
        </div>

        {/* Ringkasan Perlindungan Keamanan */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-800 dark:text-slate-200">
            <HoverTip description="Lapisan perlindungan otomatis di browser pengunjung untuk mencegah pencurian data atau penyalahgunaan halaman.">
              Perlindungan Browser:
            </HoverTip>
          </span>
          <span>
            <HoverTip description="Memastikan pengunjung selalu diarahkan ke jalur koneksi terenkripsi (HTTPS).">
              Enkripsi Paksa:
            </HoverTip>{' '}
            <strong className="font-medium text-slate-900 dark:text-white">
              {report.technicalSignals.securityHeaders.hsts ? 'Aktif' : 'Belum aktif'}
            </strong>
          </span>
          <span>
            <HoverTip description="Mencegah halaman situs Anda disisipkan ke situs lain tanpa izin.">
              Anti-Penyisipan:
            </HoverTip>{' '}
            <strong className="font-medium text-slate-900 dark:text-white">
              {report.technicalSignals.securityHeaders.xFrameOptions
                ? 'Aktif'
                : 'Belum aktif'}
            </strong>
          </span>
          <span>
            <HoverTip description="Mencegah browser salah membaca tipe berkas unduhan yang berisiko.">
              Proteksi Berkas:
            </HoverTip>{' '}
            <strong className="font-medium text-slate-900 dark:text-white">
              {report.technicalSignals.securityHeaders.xContentTypeOptions
                ? 'Aktif'
                : 'Belum aktif'}
            </strong>
          </span>
          <span>
            <HoverTip description="Membatasi skrip luar yang boleh berjalan agar website terhindar dari sisipan berbahaya.">
              Kebijakan Konten:
            </HoverTip>{' '}
            <strong className="font-medium text-slate-900 dark:text-white">
              {report.technicalSignals.securityHeaders.csp ? 'Aktif' : 'Belum aktif'}
            </strong>
          </span>
        </div>
      </div>

      {/* Rincian Skor Per Aspek & Indikator */}
      <div className="mt-8 space-y-5">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          <HoverTip description="Rincian nilai per bagian. Sorot setiap judul aspek atau indikator di bawah untuk membaca penjelasannya.">
            Rincian Aspek Penilaian
          </HoverTip>
        </h3>

        {report.pillarScores.map((pillar) => (
          <div
            key={pillar.id}
            className="print-avoid-break rounded-lg border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                <HoverTip description={pillar.summary}>{pillar.name}</HoverTip>
              </h4>
              <div className="flex items-baseline gap-3 shrink-0">
                <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  Bobot {Math.round(pillar.weight * 100)}%
                </span>
                <span
                  className={`font-mono text-lg font-bold tabular-nums ${getScoreToneClass(
                    pillar.score,
                  )}`}
                >
                  {pillar.score.toFixed(1)}
                </span>
              </div>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {pillar.indicators.map((ind) => (
                <div
                  key={ind.id}
                  className="flex items-center justify-between gap-4 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        <HoverTip description={ind.note}>{ind.name}</HoverTip>
                      </span>
                      <StatusLabel status={ind.status} />
                    </div>
                    <p className="hidden print:block mt-1 text-xs text-slate-600">
                      {ind.note}
                    </p>
                  </div>
                  <div className="shrink-0 font-mono text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                    {ind.score.toFixed(0)} / 100
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Hal yang Perlu Diperbaiki & Saran Langkah Perbaikan */}
      {report.findings.length > 0 && (
        <div className="mt-8 print-avoid-break">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            <HoverTip description="Daftar hal yang paling berdampak pada pengalaman pengunjung beserta saran langkah perbaikannya.">
              Hal yang Perlu Diperbaiki &amp; Saran Praktis
            </HoverTip>
          </h3>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Bagian &amp; Prioritas
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Kondisi yang Ditemukan
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Saran Perbaikan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {report.findings.map((item, idx) => (
                  <tr
                    key={`${item.area}-${idx}`}
                    className="align-top text-xs leading-relaxed"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      <div>{item.area}</div>
                      <div
                        className={`mt-1 text-xs font-medium ${
                          item.severity === 'Tinggi'
                            ? 'text-red-700 dark:text-red-400'
                            : item.severity === 'Sedang'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        Prioritas {item.severity}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {item.issue}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {item.recommendation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Halaman Publik yang Diperiksa */}
      {report.groundingSources.length > 0 && (
        <div className="mt-8 border-t border-slate-200 pt-5 print-avoid-break dark:border-slate-800">
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Halaman yang Diperiksa di Pencarian Publik
          </h3>
          <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {report.groundingSources.slice(0, 8).map((source) => (
              <li key={source.uri} className="truncate">
                <a
                  href={source.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1.5 text-xs text-sky-700 hover:underline dark:text-sky-400"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{source.title || source.uri}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
