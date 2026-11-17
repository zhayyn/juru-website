import { Cloud, Moon, Sun } from 'lucide-react';

interface HeaderProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  isSupabaseConnected: boolean;
  onOpenSupabaseModal: () => void;
}

export function Header({
  theme,
  onToggleTheme,
  isSupabaseConnected,
  onOpenSupabaseModal,
}: HeaderProps) {
  return (
    <header className="print:hidden sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:gap-6 sm:px-6 md:gap-8 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#top"
          className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 sm:text-lg dark:text-white"
        >
          WebAudit &amp; Ranker Pro
        </a>

        {/* Zone 2: Clean Single-Line Navigation Links */}
        <nav
          aria-label="Navigasi utama"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          <a
            href="#audit-panel"
            className="whitespace-nowrap shrink-0 py-1 transition-colors hover:text-slate-900 hover:underline underline-offset-4 dark:hover:text-white"
          >
            Periksa Situs
          </a>
          <a
            href="#papan-peringkat"
            className="whitespace-nowrap shrink-0 py-1 transition-colors hover:text-slate-900 hover:underline underline-offset-4 dark:hover:text-white"
          >
            Peringkat
          </a>
          <a
            href="#standar-penilaian"
            className="whitespace-nowrap shrink-0 py-1 transition-colors hover:text-slate-900 hover:underline underline-offset-4 dark:hover:text-white"
          >
            Panduan Nilai
          </a>
        </nav>

        {/* Zone 3: Compact Utility & Primary Action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={
              theme === 'dark'
                ? 'Aktifkan tampilan terang'
                : 'Aktifkan tampilan gelap'
            }
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={onOpenSupabaseModal}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-sky-700 px-3 text-xs font-semibold text-white transition-colors hover:bg-sky-800 whitespace-nowrap shrink-0 sm:gap-2 sm:px-4 sm:text-sm dark:bg-sky-600 dark:hover:bg-sky-500"
          >
            <Cloud className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="sm:hidden">Cloud</span>
            <span className="hidden sm:inline">
              {isSupabaseConnected ? 'Cloud Terhubung' : 'Hubungkan Cloud'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
