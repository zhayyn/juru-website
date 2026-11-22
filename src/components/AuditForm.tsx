import { type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Loader2,
  Monitor,
  Scale,
  Search,
  Smartphone,
} from 'lucide-react';
import { AUDIT_STANDARDS, QUICK_TEST_DOMAINS } from '../data/standards';
import type { AuditCategory, AuditStrategy } from '../types/audit';
import { HoverTip } from './HoverTip';

export type AuditStepId = 'idle' | 'pagespeed' | 'probe' | 'scoring' | 'sync';

interface AuditFormProps {
  url: string;
  onUrlChange: (value: string) => void;
  category: AuditCategory;
  onCategoryChange: (value: AuditCategory) => void;
  strategy: AuditStrategy;
  onStrategyChange: (value: AuditStrategy) => void;
  isAuditing: boolean;
  currentStep: AuditStepId;
  errorMessage: string | null;
  onSubmit: () => void;
}

const PIPELINE_STEPS: Array<{ id: AuditStepId; label: string; detail: string }> = [
  {
    id: 'pagespeed',
    label: '1. Mengukur Kecepatan',
    detail: 'Server mengukur empat kategori Lighthouse. Proses dapat memerlukan beberapa menit.',
  },
  {
    id: 'probe',
    label: '2. Probe Teknis Beranda',
    detail: 'Server memeriksa HTTP, viewport dan header; konten tetap perlu verifikasi manual.',
  },
  {
    id: 'scoring',
    label: '3. Menghitung Nilai',
    detail: 'Rata-rata empat skor Lighthouse, masing-masing berbobot 25% dari hasil pengukuran langsung.',
  },
  {
    id: 'sync',
    label: '4. Menyimpan Laporan',
    detail: 'Laporan dan bukti checklist disimpan server bila database aktif; ranking online terpisah dan hanya untuk hasil yang memenuhi syarat.',
  },
];

export function AuditForm({
  url,
  onUrlChange,
  category,
  onCategoryChange,
  strategy,
  onStrategyChange,
  isAuditing,
  currentStep,
  errorMessage,
  onSubmit,
}: AuditFormProps) {
  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const activeStepIndex = PIPELINE_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <section
      id="audit-panel"
      aria-labelledby="audit-panel-heading"
      className="print:hidden rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="max-w-2xl">
        <h1
          id="audit-panel-heading"
          className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white [text-wrap:balance]"
        >
          <HoverTip
            placement="bottom"
            description="Masukkan alamat publik, periksa skor dan checklist otomatis tanpa AI, lalu simpan PDF. Deskripsi tersedia saat disorot, difokuskan atau diketuk."
          >
            Periksa kualitas website
          </HoverTip>
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Satu halaman publik · bukan audit kepatuhan resmi
        </p>
      </div>

      {/* Pemilih Mode Audit (Dual-Mode Selector) */}
      <div className="mt-6">
        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
          <HoverTip description="Pilih standar penilaian yang sesuai dengan jenis website yang sedang diperiksa.">
            Jenis Penilaian Website
          </HoverTip>
        </span>
        <div
          role="radiogroup"
          aria-label="Mode standar audit"
          className="mt-2.5 grid grid-cols-1 gap-3.5 md:grid-cols-2"
        >
          {(['peradilan_agama', 'umum'] as AuditCategory[]).map((modeKey) => {
            const std = AUDIT_STANDARDS[modeKey];
            const isSelected = category === modeKey;
            const Icon = modeKey === 'peradilan_agama' ? Scale : Globe;

            return (
              <button
                key={modeKey}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
                aria-description={`${std.description} ${std.regulationRef}`}
                disabled={isAuditing}
                onClick={() => onCategoryChange(modeKey)}
                onKeyDown={event => {
                  const modes: AuditCategory[] = ['peradilan_agama', 'umum'];
                  const index = modes.indexOf(modeKey);
                  let next: number;
                  if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (index + 1) % modes.length;
                  else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (index + modes.length - 1) % modes.length;
                  else if (event.key === 'Home') next = 0;
                  else if (event.key === 'End') next = modes.length - 1;
                  else return;
                  event.preventDefault();
                  onCategoryChange(modes[next]);
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
                }}
                className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-3.5 text-left transition-colors ${
                  isSelected
                    ? 'border-sky-700 bg-sky-50/70 dark:border-sky-400 dark:bg-sky-950/40'
                    : 'border-slate-200 bg-slate-50/40 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-slate-700'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`h-5 w-5 shrink-0 ${
                      isSelected
                        ? 'text-sky-700 dark:text-sky-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      <HoverTip passive description={`${std.description} ${std.regulationRef}`}>
                        {std.title}
                      </HoverTip>
                    </div>

                  </div>
                </div>

                <span className="shrink-0 font-mono text-xs font-medium text-slate-500 tabular-nums dark:text-slate-400">
                  {std.pillars.length} Aspek
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Formulir Input URL & Strategi Perangkat */}
      <form onSubmit={handleFormSubmit} className="mt-6 space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <label
              htmlFor="audit-url-input"
              className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
            >
              <HoverTip description="Ketikkan alamat website yang ingin diperiksa. Sistem akan merapikan alamat domain secara otomatis saat menyimpan ke daftar peringkat.">
                Alamat Website
              </HoverTip>
            </label>
            <div className="relative mt-1.5">
              <input
                id="audit-url-input"
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => onUrlChange(e.target.value)}
                disabled={isAuditing}
                placeholder="Contoh: https://pa-semarang.go.id"
                aria-invalid={errorMessage ? 'true' : 'false'}
                aria-describedby={errorMessage ? 'audit-url-error' : undefined}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-sky-400 dark:disabled:bg-slate-800"
              />
              <Search
                className="pointer-events-none absolute right-3.5 top-3 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
            </div>
          </div>

          <div className="lg:col-span-4">
            <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
              <HoverTip description="Pilih simulasi tampilan layar yang ingin diuji: Ponsel (pengunjung seluler) atau Komputer (layar lebar).">
                Tampilan Pengujian
              </HoverTip>
            </span>
            <div
              role="group"
              aria-label="Strategi perangkat pengujian"
              className="mt-1.5 grid h-11 grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-950"
            >
              <button
                type="button"
                disabled={isAuditing}
                aria-pressed={strategy === 'MOBILE'}
                onClick={() => onStrategyChange('MOBILE')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  strategy === 'MOBILE'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Ponsel</span>
              </button>
              <button
                type="button"
                disabled={isAuditing}
                aria-pressed={strategy === 'DESKTOP'}
                onClick={() => onStrategyChange('DESKTOP')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  strategy === 'DESKTOP'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Komputer</span>
              </button>
            </div>
          </div>
        </div>

        {/* Contoh cepat & tombol submit */}
        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-medium">Coba cepat:</span>
            {QUICK_TEST_DOMAINS.map((sample) => (
              <button
                key={sample.url}
                type="button"
                disabled={isAuditing}
                onClick={() => {
                  onUrlChange(sample.url);
                  onCategoryChange(sample.category);
                }}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800"
              >
                {sample.label}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={isAuditing}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-700/60 whitespace-nowrap shrink-0 dark:bg-sky-600 dark:hover:bg-sky-500"
          >
            {isAuditing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Sedang Memeriksa...</span>
              </>
            ) : (
              <span>Mulai Pemeriksaan</span>
            )}
          </button>
        </div>

        {/* Pesan Kesalahan Validasi atau API */}
        {errorMessage && (
          <div
            id="audit-url-error"
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}
      </form>

      {/* Indikator Progres Bertahap */}
      {isAuditing && (
        <div
          aria-live="polite"
          className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800"
        >
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PIPELINE_STEPS.map((step, index) => {
              const isDone = activeStepIndex > index;
              const isActive = activeStepIndex === index;

              return (
                <li
                  key={step.id}
                  className={`rounded-lg border px-3.5 py-3 transition-colors ${
                    isActive
                      ? 'border-sky-600 bg-sky-50/70 dark:border-sky-500 dark:bg-sky-950/30'
                      : isDone
                        ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                        : 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-950/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isDone ? (
                      <CheckCircle2
                        className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden="true"
                      />
                    ) : isActive ? (
                      <Loader2
                        className="h-4 w-4 shrink-0 animate-spin text-sky-700 dark:text-sky-400"
                        aria-hidden="true"
                      />
                    ) : (
                      <span
                        className="inline-block h-4 w-4 shrink-0 rounded-full border border-slate-300 dark:border-slate-700"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      <HoverTip description={step.detail}>{step.label}</HoverTip>
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
