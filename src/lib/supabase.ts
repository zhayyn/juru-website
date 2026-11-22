import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { AuditCategory, AuditHistoryEntry, WebsiteRanking } from '../types/audit';

const LS_URL_KEY = 'webaudit_supabase_url';
const LS_ANON_KEY = 'webaudit_supabase_anon_key';

export interface SupabaseConfigState {
  url: string;
  anonKey: string;
  source: 'env' | 'local' | 'none';
}

function isPublicKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  try {
    const parts = key.split('.');
    if (parts.length !== 3) return false;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).role === 'anon';
  } catch { return false; }
}

export function getSupabaseConfig(): SupabaseConfigState {
  const envUrl = (import.meta.env?.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
  const envKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

  if (envUrl && isPublicKey(envKey)) {
    return { url: envUrl, anonKey: envKey, source: 'env' };
  }

  if (typeof window !== 'undefined') {
    const localUrl = window.localStorage.getItem(LS_URL_KEY)?.trim() ?? '';
    const localKey = window.localStorage.getItem(LS_ANON_KEY)?.trim() ?? '';
    if (localUrl && isPublicKey(localKey)) {
      return { url: localUrl, anonKey: localKey, source: 'local' };
    }
  }

  return { url: '', anonKey: '', source: 'none' };
}

let cachedClient: SupabaseClient | null = null;
let cachedSignature = '';

export function getSupabaseClient(): SupabaseClient | null {
  const cfg = getSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) {
    cachedClient = null;
    cachedSignature = '';
    return null;
  }

  const sig = `${cfg.url}::${cfg.anonKey}`;
  if (!cachedClient || cachedSignature !== sig) {
    cachedClient = createClient(cfg.url, cfg.anonKey, {
      realtime: {
        params: {
          eventsPerSecond: 5,
        },
      },
    });
    cachedSignature = sig;
  }
  return cachedClient;
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = anonKey.trim();
  if (!cleanUrl || !cleanKey) {
    throw new Error('Project URL dan Anon Key Supabase wajib diisi.');
  }
  try {
    const parsed = new URL(cleanUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('URL tidak valid');
    }
  } catch {
    throw new Error('Format Project URL Supabase tidak valid (contoh: https://xxxx.supabase.co).');
  }
  if (!isPublicKey(cleanKey)) throw new Error('Hanya kunci publik anon / publishable yang boleh digunakan di browser.');
  window.localStorage.setItem(LS_URL_KEY, cleanUrl);
  window.localStorage.setItem(LS_ANON_KEY, cleanKey);
  cachedClient = null;
  cachedSignature = '';
}

export function clearSupabaseConfig(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(LS_URL_KEY);
    window.localStorage.removeItem(LS_ANON_KEY);
  }
  cachedClient = null;
  cachedSignature = '';
}

export async function testSupabaseConnection(
  url: string,
  anonKey: string,
): Promise<{ ok: boolean; message: string }> {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = anonKey.trim();
  if (!isPublicKey(cleanKey)) return { ok: false, message: 'Gunakan kunci publik anon / publishable, bukan kunci server.' };
  const tempClient = createClient(cleanUrl, cleanKey);

  const { error } = await tempClient
    .from('jw_rankings_v1')
    .select('domain', { count: 'exact', head: true })
    .eq('strategy', 'MOBILE')
    .eq('methodology', 'technical-v1');

  if (error) {
    if (error.message.includes('relation') || error.code === '42P01' || error.code === 'PGRST205') {
      return {
        ok: false,
        message:
          'Tabel jw_rankings_v1 belum tersedia. Pemilik perlu meninjau migrasi lokal supabase/migrations/202611170001_trusted_ranking.sql; UI tidak menerapkannya.',
      };
    }
    return {
      ok: false,
      message: `Gagal terhubung: ${error.message}`,
    };
  }

  return {
    ok: true,
    message: 'Koneksi baca berhasil. Ini bukan verifikasi keamanan, RLS, atau kesiapan penulisan server.',
  };
}

export async function fetchRankings(client: SupabaseClient | null = getSupabaseClient()): Promise<WebsiteRanking[]> {
  if (!client) return [];

  const { data, error } = await client
    .from('jw_rankings_v1')
    .select('*')
    .eq('strategy', 'MOBILE')
    .eq('methodology', 'technical-v1')
    .order('total_score', { ascending: false });

  if (error) {
    throw new Error(`Gagal memuat papan peringkat: ${error.message}`);
  }

  return (data ?? []).filter((row) => row.total_score !== null && row.total_score !== undefined && Number.isFinite(Number(row.total_score)) && row.ranking_eligible !== false).map((row) => ({
    id: row.id ? String(row.id) : undefined,
    domain: String(row.domain),
    site_name: String(row.site_name ?? row.domain),
    category: (row.category === 'peradilan_agama' ? 'peradilan_agama' : 'umum') as AuditCategory,
    total_score: Number(row.total_score ?? 0),
    score_delta: Number(row.score_delta ?? 0),
    grade: String(row.grade ?? '-'),
    audit_count: Number(row.audit_count ?? 1),
    last_audited_at: String(row.last_audited_at ?? new Date().toISOString()),
    pillar_scores: row.pillar_scores ?? {},
    findings_summary: String(row.findings_summary ?? ''),
  }));
}

export async function fetchAuditHistory(domain: string, category: AuditCategory, client: SupabaseClient | null = getSupabaseClient()): Promise<AuditHistoryEntry[]> {
  if (!client) return [];

  const { data, error } = await client
    .from('jw_audit_history_v1')
    .select('*')
    .eq('domain', domain)
    .eq('category', category)
    .eq('strategy', 'MOBILE')
    .eq('methodology', 'technical-v1')
    .order('audited_at', { ascending: true });

  if (error) {
    throw new Error(`Gagal memuat riwayat audit: ${error.message}`);
  }

  return (data ?? []).filter((row) => row.total_score !== null && row.total_score !== undefined && Number.isFinite(Number(row.total_score)) && row.ranking_eligible !== false).map((row) => ({
    id: String(row.id ?? `${row.domain}-${row.audited_at}`),
    domain: String(row.domain),
    site_name: row.site_name ? String(row.site_name) : undefined,
    category: (row.category === 'peradilan_agama' ? 'peradilan_agama' : 'umum') as AuditCategory,
    total_score: Number(row.total_score ?? 0),
    grade: String(row.grade ?? '-'),
    pillar_scores: row.pillar_scores ?? {},
    findings_summary: String(row.findings_summary ?? ''),
    audited_at: String(row.audited_at ?? new Date().toISOString()),
  }));
}

export function subscribeToRankings(onChange: () => void, onStatus: (active: boolean) => void = () => {}, client: SupabaseClient | null = getSupabaseClient()): () => void {
  onStatus(false);
  if (!client) return () => {};

  const channel: RealtimeChannel = client
    .channel('jw_rankings_v1_realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'jw_rankings_v1',
      },
      () => {
        onChange();
      },
    )
    .subscribe((status) => onStatus(status === 'SUBSCRIBED'));

  return () => {
    onStatus(false);
    void client.removeChannel(channel);
  };
}

export const SUPABASE_SETUP_SQL = `Petunjuk pemilik proyek (owner-only), bukan SQL untuk diterapkan otomatis.
Tinjau migrasi lokal: supabase/migrations/202611170001_trusted_ranking.sql
Hanya pemilik yang boleh meninjau dan menerapkan migrasi lewat prosedur deployment terotorisasi.
Browser hanya membaca jw_rankings_v1 dan jw_audit_history_v1 (MOBILE, technical-v1).
Penulisan skor hanya di server; jangan berikan kredensial server atau hak tulis ke browser.
Uji koneksi baca bukan bukti kesiapan keamanan, RLS, atau keberhasilan penyimpanan server.
Tidak ada migrasi yang dijalankan oleh UI ini.`;
