import { type FormEvent, useEffect, useState } from 'react';
import { Check, Copy, Database, Loader2, Trash2, X } from 'lucide-react';
import {
  clearSupabaseConfig,
  getSupabaseConfig,
  saveSupabaseConfig,
  SUPABASE_SETUP_SQL,
  testSupabaseConnection,
} from '../lib/supabase';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated: () => void;
}

export function SupabaseModal({
  isOpen,
  onClose,
  onConfigUpdated,
}: SupabaseModalProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'sql'>('config');
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [configSource, setConfigSource] = useState<'env' | 'local' | 'none'>('none');
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const cfg = getSupabaseConfig();
    setUrl(cfg.url);
    setAnonKey(cfg.anonKey);
    setConfigSource(cfg.source);
    setStatusMessage(null);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSaveAndTest = async (e: FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setIsTesting(true);
    try {
      saveSupabaseConfig(url, anonKey);
      const check = await testSupabaseConnection(url, anonKey);
      setConfigSource('local');
      onConfigUpdated();
      setStatusMessage({
        type: check.ok ? 'success' : 'error',
        text: check.message,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = () => {
    clearSupabaseConfig();
    const cfg = getSupabaseConfig();
    setUrl(cfg.url);
    setAnonKey(cfg.anonKey);
    setConfigSource(cfg.source);
    setStatusMessage({
      type: 'success',
      text: 'Konfigurasi lokal dihapus. Aplikasi kembali ke mode pratinjau lokal.',
    });
    onConfigUpdated();
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Gagal menyalin otomatis. Silakan sorot dan salin skrip secara manual.',
      });
    }
  };

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
        aria-labelledby="supabase-modal-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <Database
              className="mt-1 h-5 w-5 shrink-0 text-sky-700 dark:text-sky-400"
              aria-hidden="true"
            />
            <div>
              <h2
                id="supabase-modal-title"
                className="text-lg font-bold text-slate-900 dark:text-white"
              >
                Pengaturan Koneksi Cloud Supabase
              </h2>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                Hubungkan proyek Supabase untuk mengaktifkan papan peringkat publik secara
                realtime lintas pengguna.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal pengaturan Supabase"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Navigasi */}
        <div
          role="tablist"
          className="mt-4 inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-950"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'config'}
            onClick={() => setActiveTab('config')}
            className={`h-8 rounded-md px-3 text-xs font-semibold transition-colors ${
              activeTab === 'config'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Kredensial Proyek
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sql'}
            onClick={() => setActiveTab('sql')}
            className={`h-8 rounded-md px-3 text-xs font-semibold transition-colors ${
              activeTab === 'sql'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Skema SQL Database
          </button>
        </div>

        {activeTab === 'config' ? (
          <form onSubmit={handleSaveAndTest} className="mt-5 space-y-4">
            {configSource === 'env' && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                Kredensial terbaca otomatis dari environment variables{' '}
                <code className="font-mono">VITE_SUPABASE_URL</code> dan{' '}
                <code className="font-mono">VITE_SUPABASE_ANON_KEY</code>.
              </div>
            )}

            <div>
              <label
                htmlFor="supabase-url-input"
                className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                Supabase Project URL
              </label>
              <input
                id="supabase-url-input"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={configSource === 'env'}
                placeholder="https://xyzcompany.supabase.co"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800"
              />
            </div>

            <div>
              <label
                htmlFor="supabase-anon-input"
                className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                Supabase Anon / Public Key
              </label>
              <textarea
                id="supabase-anon-input"
                rows={3}
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                disabled={configSource === 'env'}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="mt-1.5 [field-sizing:content] min-h-20 max-h-48 w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800"
              />
            </div>

            {statusMessage && (
              <div
                role="status"
                className={`rounded-lg border px-3.5 py-2.5 text-xs ${
                  statusMessage.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200'
                }`}
              >
                {statusMessage.text}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              {configSource === 'local' ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-950 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Putuskan Koneksi</span>
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Tutup
                </button>
                {configSource !== 'env' && (
                  <button
                    type="submit"
                    disabled={isTesting}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-700 px-4 text-xs font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-60 dark:bg-sky-600 dark:hover:bg-sky-500"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        <span>Menguji...</span>
                      </>
                    ) : (
                      <span>Simpan &amp; Uji Koneksi</span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        ) : (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Salin skrip SQL berikut lalu jalankan di menu <strong>SQL Editor</strong>{' '}
                dasbor Supabase Anda untuk membuat tabel peringkat, riwayat audit, kebijakan
                akses publik, dan fungsi RPC{' '}
                <code className="font-mono">record_website_audit</code>.
              </p>
              <button
                type="button"
                onClick={handleCopySql}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {copiedSql ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    <span>Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Salin SQL</span>
                  </>
                )}
              </button>
            </div>

            <pre className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-slate-200 dark:border-slate-800">
              {SUPABASE_SETUP_SQL}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
