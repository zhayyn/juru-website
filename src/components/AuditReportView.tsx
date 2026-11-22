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
import { buildImprovementPlan } from '../utils/recommendations';
import { HoverTip } from './HoverTip';
import { HelpAction } from './HelpAction';

interface AuditReportViewProps {
  report: AuditReport;
  onOpenSupabaseModal: () => void;
}

function decodeTitle(value: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—' };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|ndash|mdash);/gi, (entity, key: string) => {
    if (!key.startsWith('#')) return named[key.toLowerCase()] ?? entity;
    const number = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : entity;
  });
}

function safeHttpHref(value: string): string | undefined {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; }
  catch { return undefined; }
}

function StatusLabel({ status }: { status: IndicatorStatus }) {
  if (status === 'Belum Diverifikasi') {
    return <span className="text-xs font-semibold text-slate-500">Belum Diverifikasi</span>;
  }
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
      <span>Tidak teramati pada halaman ini</span>
    </span>
  );
}

function getScoreToneClass(score: number | null): string {
  if (score === null) return 'text-slate-500 dark:text-slate-400';
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

  const improvementPlan = buildImprovementPlan(report);
  const probeKnown = report.technicalSignals.statusCode !== null;

  const strategyLabel =
    report.strategy === 'MOBILE' ? 'Tampilan Ponsel' : 'Tampilan Komputer';

  const metrics = [
    {
      label: 'Performance',
      tip: 'Menggambarkan seberapa gesit halaman website dimuat untuk pengunjung.',
      value:
        report.pageSpeed.performanceScore !== null
          ? `${report.pageSpeed.performanceScore} / 100`
          : '—',
    },
    {
      label: 'Aksesibilitas',
      tip: 'Menilai kenyamanan website bagi seluruh pengunjung, termasuk pengguna disabilitas.',
      value:
        report.pageSpeed.accessibilityScore !== null
          ? `${report.pageSpeed.accessibilityScore} / 100`
          : '—',
    },
    {
      label: 'Praktik Terbaik',
      tip: 'Skor Best Practices Lighthouse, bukan jaminan keamanan situs.',
      value:
        report.pageSpeed.bestPracticesScore !== null
          ? `${report.pageSpeed.bestPracticesScore} / 100`
          : '—',
    },
    {
      label: 'Pemeriksaan SEO',
      tip: 'Pemeriksaan SEO otomatis Lighthouse; bukan jaminan indeks atau posisi Google.',
      value:
        report.pageSpeed.seoScore !== null ? `${report.pageSpeed.seoScore} / 100` : '—',
    },
    {
      label: 'Konten utama · LCP',
      tip: 'Waktu yang dibutuhkan hingga konten paling penting tampil penuh di layar pengunjung.',
      value: report.pageSpeed.lcp,
    },
    {
      label: 'Tampilan awal · FCP',
      tip: 'Waktu pertama kali layar mulai menampilkan isi halaman setelah diklik.',
      value: report.pageSpeed.fcp,
    },
    {
      label: 'Pergeseran & blokir',
      tip: 'Mengukur apakah tata letak halaman bergeser tiba-tiba atau tersendat saat dimuat.',
      value: `CLS ${report.pageSpeed.cls} · TBT ${report.pageSpeed.tbt}`,
    },
  ];

  return (
    <section
      aria-labelledby="audit-report-title"
      className="audit-report print-surface rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="report-kicker" aria-label="Sumber pengukuran">
        <span className="source-badge">{report.pageSpeed.source === 'lighthouse_local' ? 'Lighthouse lokal' : report.pageSpeed.source === 'pagespeed' ? 'Google PageSpeed' : 'Pengukuran belum lengkap'}</span>
        <span>Satu halaman · {strategyLabel}</span>
        {report.pageSpeed.source === 'lighthouse_local' && <span>v{report.pageSpeed.lighthouseVersion || '—'} · {report.pageSpeed.measuredAt ? formatDateTimeId(report.pageSpeed.measuredAt) : formatDateTimeId(report.auditedAt)} · bukan PageSpeed Google</span>}
      </div>
      {/* Header Laporan & Skor Utama */}
      <div className="report-heading flex flex-col gap-6 border-b border-slate-200 pb-6 lg:flex-row lg:items-start lg:justify-between dark:border-slate-800">
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
            {decodeTitle(report.siteName)}
          </h2>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <a
              href={safeHttpHref(report.url)}
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
            ) : report.pageSpeed.source === 'lighthouse_local' ? (
              <span className="text-xs text-slate-600 dark:text-slate-400">Laporan lokal · tidak masuk peringkat online</span>
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
                    : 'Belum tersimpan bersama · hanya server dapat menyimpan hasil yang memenuhi syarat'}
                </span>
              </button>
            )}
          </div>

          <p data-storage-status={report.storage?.status || 'disabled'} className={`storage-status text-xs ${report.storage?.status === 'failed' ? 'text-amber-800 dark:text-amber-300' : 'text-slate-600 dark:text-slate-400'}`}>
            {report.storage?.status === 'saved' ? 'Tersimpan di database server · SQLite' : report.storage?.status === 'failed' ? 'Belum tersimpan di database · simpan PDF sebagai salinan' : 'Penyimpanan database nonaktif'}
          </p>
          <div className="report-caption"><HoverTip description={report.executiveSummary}>Ringkasan audit</HoverTip></div>
        </div>

        {/* Kartu Skor Total & Tombol Cetak */}
        <div className="total-score-card flex flex-col items-start justify-between gap-4 rounded-lg sm:flex-row sm:items-center border border-slate-200 bg-slate-50/70 p-4 sm:min-w-[250px] lg:flex-col lg:items-end dark:border-slate-800 dark:bg-slate-950/60">
          <div className="lg:text-right">
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              <HoverTip
                align="right"
                description="Rata-rata empat skor Lighthouse: Performance, Accessibility, Best Practices, SEO; masing-masing berbobot 25%. Jika tidak lengkap, skor tidak tersedia."
              >
                Rata-rata teknis
              </HoverTip>
            </span>
            <div className="mt-1 flex items-baseline gap-1.5 lg:justify-end">
              <span
                className={`font-mono text-4xl font-bold tracking-tight tabular-nums ${getScoreToneClass(
                  report.totalScore,
                )}`}
              >
                {report.totalScore === null ? '—' : report.totalScore.toFixed(1)}
              </span>
              <span className="whitespace-nowrap font-mono text-sm text-slate-500 dark:text-slate-400">
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

      <div className="methodology-strip"><HoverTip description={`Skor teknis ${report.methodology || 'technical-v1'}: rata-rata empat kategori, masing-masing 25%. Checklist tidak masuk skor. ${report.rankingReason || ''}`}>Metode &amp; batasan</HoverTip><span>Satu halaman · bukan audit kepatuhan resmi</span></div>
      <p className="methodology-note mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
        Skor teknis {report.methodology || 'technical-v1'} = (Performance + Accessibility + Best Practices + SEO) / 4,
        masing-masing 25%. Checklist konten dan pemeriksaan manual tidak masuk skor.{' '}
        {report.pageSpeed.source === 'lighthouse_local' ? <>Lighthouse lokal {report.pageSpeed.lighthouseVersion || ''}, bukan hasil PageSpeed Google. Waktu pengukuran: {report.pageSpeed.measuredAt ? formatDateTimeId(report.pageSpeed.measuredAt) : formatDateTimeId(report.auditedAt)}. Hasil dipengaruhi Mac dan koneksi lokal; bukan data lapangan Core Web Vitals atau bukti kepatuhan resmi.</> : <>PageSpeed adalah uji lab, bukan data lapangan Core Web Vitals atau bukti kepatuhan resmi.</>}
        {report.rankingReason && <span> Kelayakan peringkat: {report.rankingReason}.</span>}
      </p>

      {/* Peringatan apabila pengukuran kecepatan sedang terbatas */}
      {report.pageSpeed.fetchWarning && (
        <div
          role="status"
          className="mt-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {report.pageSpeed.fetchWarning} Skor yang tidak terukur tetap —; probe HTTP tidak menggantikan Lighthouse.
          </span>
        </div>
      )}

      {improvementPlan.length > 0 && (
        <aside className="next-action print-avoid-break" aria-labelledby="next-action-title">
          <div><p className="eyebrow" id="next-action-title">Prioritas berikutnya</p>
          <h3><HoverTip description={improvementPlan[0].recommendation}>{improvementPlan[0].area}</HoverTip></h3></div>
          <a href="#audit-actions">Lihat langkah perbaikan ↓</a>
        </aside>
      )}

      {/* Strip Metrik Kecepatan & Keamanan Pengunjung */}
      <div className="mt-6 print-avoid-break">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          <HoverTip description="Ringkasan pengalaman pengunjung saat membuka situs Anda. Sorot masing-masing judul di bawah untuk arti angkanya.">
            Gambaran Kecepatan &amp; Kenyamanan Pengunjung
          </HoverTip>
        </h3>

        <div className="metric-grid mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="metric-card rounded-lg border border-slate-200 p-3 dark:border-slate-800"
            >
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                <HoverTip description={metric.tip}>{metric.label}</HoverTip>
              </span>
              <span className="mt-1 block font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white">
                {metric.value}
              </span>
            </div>
          ))}

          <div className="metric-card rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              <HoverTip
                align="right"
                description="Hasil probe koneksi HTTPS dan waktu respon; bukan audit keamanan menyeluruh."
              >
                Koneksi HTTPS
              </HoverTip>
            </span>
            <span className="mt-1 inline-flex items-center gap-1 font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
              {probeKnown && report.technicalSignals.httpsValid ? (
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
                {!probeKnown ? 'Belum Diverifikasi' : report.technicalSignals.httpsValid ? 'HTTPS teramati' : 'HTTPS tidak teramati'}
                {report.technicalSignals.responseTimeMs !== null
                  ? ` · ${Math.round(report.technicalSignals.responseTimeMs)}ms`
                  : ''}
              </span>
            </span>
          </div>
        </div>

        {/* Ringkasan Perlindungan Keamanan */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-800 dark:text-slate-200">
            <HoverTip description="Kehadiran header keamanan HTTP yang teramati pada satu halaman; kehadiran header bukan validasi isi kebijakan atau jaminan keamanan menyeluruh.">
              Perlindungan Browser:
            </HoverTip>
          </span>
          <span>
            <HoverTip description="Header Strict-Transport-Security (HSTS) teramati pada respons; nilai max-age dan pengalihan HTTP ke HTTPS tetap perlu diverifikasi manual.">
              Enkripsi Paksa:
            </HoverTip>{' '}
            <strong className="font-medium text-slate-900 dark:text-white">
              {!probeKnown ? 'Belum Diverifikasi' : report.technicalSignals.securityHeaders.hsts ? 'Teramati' : 'Tidak teramati'}
            </strong>
          </span>
          <span>
            <HoverTip description="Header X-Frame-Options teramati pada respons; direktif pembatasan frame tetap perlu diverifikasi manual.">
              Anti-Penyisipan:
            </HoverTip>{' '}
            <strong className="font-medium text-slate-900 dark:text-white">
              {!probeKnown ? 'Belum Diverifikasi' : report.technicalSignals.securityHeaders.xFrameOptions ? 'Teramati' : 'Tidak teramati'}
            </strong>
          </span>
          <span>
            <HoverTip description="Header X-Content-Type-Options teramati pada respons; pastikan bernilai nosniff melalui pemeriksaan manual.">
              Proteksi Berkas:
            </HoverTip>{' '}
            <strong className="font-medium text-slate-900 dark:text-white">
              {!probeKnown ? 'Belum Diverifikasi' : report.technicalSignals.securityHeaders.xContentTypeOptions ? 'Teramati' : 'Tidak teramati'}
            </strong>
          </span>
          <span>
            <HoverTip description="Header Content-Security-Policy (CSP) teramati pada respons; kehadiran header belum membuktikan direktif bebas wildcard atau efektif mencegah injeksi.">
              Kebijakan Konten:
            </HoverTip>{' '}
            <strong className="font-medium text-slate-900 dark:text-white">
              {!probeKnown ? 'Belum Diverifikasi' : report.technicalSignals.securityHeaders.csp ? 'Teramati' : 'Tidak teramati'}
            </strong>
          </span>
        </div>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          Status <strong>Teramati</strong> hanya menandakan header ada pada satu respons halaman; isi direktif, pengalihan HTTP→HTTPS, dan efektivitas proteksi tetap perlu diverifikasi manual.
        </p>

        {probeKnown && report.technicalSignals.modernWeb && (
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-800 dark:text-slate-200">
              <HoverTip description="Pemeriksaan kesesuaian HTML semantik, dukungan tema browser, dan integritas aset CDN pihak ketiga.">
                Kepatuhan Web Modern:
              </HoverTip>
            </span>
            <span>
              <HoverTip description="Memastikan skrip dan stylesheet dari CDN pihak ketiga dilindungi atribut integrity agar tidak mudah dimodifikasi dari luar.">
                Integritas CDN (SRI):
              </HoverTip>{' '}
              <strong className="font-medium text-slate-900 dark:text-white">
                {report.technicalSignals.modernWeb.unverifiedExternalAssets === 0
                  ? 'Terpenuhi'
                  : `${report.technicalSignals.modernWeb.unverifiedExternalAssets} aset tanpa SRI`}
              </strong>
            </span>
            <span>
              <HoverTip description="Keberadaan atribut bahasa dokumen (<html lang>) dan penanda konten utama (<main>) untuk keterbacaan serta alat bantu.">
                Bahasa &amp; Landmark HTML:
              </HoverTip>{' '}
              <strong className="font-medium text-slate-900 dark:text-white">
                {report.technicalSignals.modernWeb.hasLangAttribute && report.technicalSignals.modernWeb.hasMainLandmark
                  ? 'Lengkap'
                  : report.technicalSignals.modernWeb.hasLangAttribute || report.technicalSignals.modernWeb.hasMainLandmark
                    ? 'Sebagian'
                    : 'Belum teramati'}
              </strong>
            </span>
            <span>
              <HoverTip description="Deklarasi color-scheme agar latar belakang awal, scrollbar, dan kontrol formulir browser menyesuaikan tema terang/gelap.">
                Skema Tema Browser:
              </HoverTip>{' '}
              <strong className="font-medium text-slate-900 dark:text-white">
                {report.technicalSignals.modernWeb.hasColorSchemeMeta ? 'Teramati' : 'Tidak teramati'}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* Hal yang Perlu Diperbaiki & Saran Langkah Perbaikan */}
      {improvementPlan.length > 0 && (
        <div id="audit-actions" className="audit-actions mt-8">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            <HoverTip description="Daftar hal yang paling berdampak pada pengalaman pengunjung beserta saran langkah perbaikannya.">
              Hal yang Perlu Diperbaiki &amp; Saran Praktis
            </HoverTip>
          </h3>
          <ul className="priority-list">
            {improvementPlan.map(item => <li key={item.id}>
              <HelpAction domain={report.domain} area={item.area} severity={item.severity}
                source={item.source} issue={item.issue} recommendation={item.recommendation} verification={item.verification} />
            </li>)}
          </ul>
        </div>
      )}

      {/* Rincian Skor Per Aspek & Indikator */}
      <div className="mt-8 space-y-5">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          <HoverTip description="Bukti yang ditemukan otomatis terbatas pada satu halaman. Isi dokumen, periode, dan pemenuhan seluruh indikator tetap perlu diperiksa manusia.">
            {report.checklistVersion ? 'Checklist otomatis & verifikasi' : 'Checklist pemeriksaan manual'}
          </HoverTip>
        </h3>
        {report.checklistVersion && <div className="checklist-summary text-xs text-slate-600 dark:text-slate-400">
          <code>{report.checklistVersion}</code>
          {report.checklistSummary && <p>{report.checklistSummary.withEvidence} / {report.checklistSummary.total} indikator memiliki bukti terbatas · {report.checklistSummary.manual} perlu pemeriksaan manual.<br />
            Ini cakupan bukti, bukan persentase kepatuhan. Tautan kandidat belum membuktikan isi atau periode dokumen.</p>}
        </div>}

        {report.pillarScores.map((pillar) => (
          <div
            key={pillar.id}
            className="manual-pillar rounded-lg border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                <HoverTip description={pillar.summary}>{pillar.name}</HoverTip>
              </h4>
              <div className="flex items-baseline gap-3 shrink-0">
                <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  Checklist · tidak diskor
                </span>
                <span
                  className={`font-mono text-lg font-bold tabular-nums ${getScoreToneClass(
                    pillar.score,
                  )}`}
                >
                  {pillar.score === null ? '—' : pillar.score.toFixed(1)}
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
                      {ind.checkMode && <span className="text-xs text-slate-500 dark:text-slate-400">{ind.checkMode === 'automatic' ? 'Otomatis' : ind.checkMode === 'partial' ? 'Bukti terbatas' : 'Manual'}</span>}
                    </div>
                    {ind.evidence && ind.evidence.some(e => safeHttpHref(e.url)) && <>
                      <details className="checklist-evidence print:hidden">
                        <summary>Bukti ({ind.evidence.filter(e => safeHttpHref(e.url)).length})</summary>
                        <ul>{ind.evidence.filter(e => safeHttpHref(e.url)).map((e, index) => <li key={`${e.url}-${index}`}>
                          <a href={safeHttpHref(e.url)} target="_blank" rel="noopener noreferrer">{e.url}</a>
                          <p>{e.source} · {e.detail}</p>
                        </li>)}</ul>
                      </details>
                      <ul className="checklist-print-evidence hidden print:block">{ind.evidence.filter(e => safeHttpHref(e.url)).map((e, index) => <li key={index}>{e.url} — {e.source}: {e.detail}</li>)}</ul>
                    </>}
                    <p className="hidden print:block mt-1 text-xs text-slate-600">
                      {ind.note}
                    </p>
                  </div>
                  <div className="shrink-0 font-mono text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                    {ind.score === null ? '—' : ind.score.toFixed(0)} / 100
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Halaman Publik yang Diperiksa */}
      {report.groundingSources.length > 0 && (
        <div className="mt-8 border-t border-slate-200 pt-5 print-avoid-break dark:border-slate-800">
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Sumber Bukti Pengukuran
          </h3>
          <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {report.groundingSources.filter(source => safeHttpHref(source.uri)).slice(0, 8).map((source) => (
              <li key={source.uri} className="truncate">
                <a
                  href={safeHttpHref(source.uri)}
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