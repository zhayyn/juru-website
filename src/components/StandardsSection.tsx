import { AUDIT_STANDARDS } from '../data/standards';
import { HoverTip } from './HoverTip';

export function StandardsSection() {
  return (
    <section
      id="standar-penilaian"
      aria-labelledby="standards-heading"
      className="print:hidden rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2
          id="standards-heading"
          className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white"
        >
          <HoverTip description="Skor teknis berasal dari empat kategori Lighthouse; checklist konten hanya untuk verifikasi manual.">
            Panduan Metodologi &amp; Checklist
          </HoverTip>
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Sorot nama aspek untuk melihat penjelasannya
        </span>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        Ranking technical-v1: Performance 25%, Accessibility 25%, Best Practices 25%, SEO 25%.
        Hanya beranda MOBILE dengan empat skor lengkap yang masuk peringkat.
        Checklist manual di bawah tidak masuk skor; bukan audit kepatuhan resmi.
      </p>
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {(['peradilan_agama', 'umum'] as const).map((key) => {
          const std = AUDIT_STANDARDS[key];
          return (
            <div
              key={std.id}
              className="rounded-lg border border-slate-200 p-5 dark:border-slate-800"
            >
              <div className="flex flex-col gap-0.5 border-b border-slate-200 pb-3 dark:border-slate-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  <HoverTip description={std.description}>{std.title}</HoverTip>
                </h3>
                <p className="text-xs font-medium text-sky-800 dark:text-sky-300">
                  {std.regulationRef}
                </p>
              </div>

              <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
                {std.pillars.map((pillar) => (
                  <li
                    key={pillar.id}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-1 last:pb-0"
                  >
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      <HoverTip description={pillar.description}>{pillar.name}</HoverTip>
                    </span>
                    <span className="font-mono text-xs font-bold tabular-nums text-sky-700 dark:text-sky-400">
                      Manual
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
