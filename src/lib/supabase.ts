import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { AuditCategory, AuditHistoryEntry, WebsiteRanking } from '../types/audit';

const LS_URL_KEY = 'webaudit_supabase_url';
const LS_ANON_KEY = 'webaudit_supabase_anon_key';

export interface SupabaseConfigState {
  url: string;
  anonKey: string;
  source: 'env' | 'local' | 'none';
}

export function getSupabaseConfig(): SupabaseConfigState {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

  if (envUrl && envKey) {
    return { url: envUrl, anonKey: envKey, source: 'env' };
  }

  if (typeof window !== 'undefined') {
    const localUrl = window.localStorage.getItem(LS_URL_KEY)?.trim() ?? '';
    const localKey = window.localStorage.getItem(LS_ANON_KEY)?.trim() ?? '';
    if (localUrl && localKey) {
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
  const tempClient = createClient(cleanUrl, cleanKey);

  const { error } = await tempClient
    .from('website_rankings')
    .select('domain', { count: 'exact', head: true });

  if (error) {
    if (error.message.includes('relation') || error.code === '42P01' || error.code === 'PGRST205') {
      return {
        ok: false,
        message:
          'Koneksi ke proyek berhasil, tetapi tabel "website_rankings" belum dibuat. Jalankan skrip SQL di tab Skema SQL Database.',
      };
    }
    return {
      ok: false,
      message: `Gagal terhubung: ${error.message}`,
    };
  }

  return {
    ok: true,
    message: 'Koneksi Supabase berhasil dan tabel peringkat siap digunakan.',
  };
}

export async function fetchRankings(): Promise<WebsiteRanking[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('website_rankings')
    .select('*')
    .order('total_score', { ascending: false });

  if (error) {
    throw new Error(`Gagal memuat papan peringkat: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
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

export async function fetchAuditHistory(domain: string): Promise<AuditHistoryEntry[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('audit_history')
    .select('*')
    .eq('domain', domain)
    .order('audited_at', { ascending: true });

  if (error) {
    throw new Error(`Gagal memuat riwayat audit: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
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

export interface RecordAuditParams {
  domain: string;
  siteName: string;
  category: AuditCategory;
  totalScore: number;
  grade: string;
  pillarScores: Record<string, number>;
  findingsSummary: string;
}

export async function recordWebsiteAudit(params: RecordAuditParams): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Koneksi Supabase belum dikonfigurasi.');
  }

  const { error } = await client.rpc('record_website_audit', {
    p_domain: params.domain,
    p_site_name: params.siteName,
    p_category: params.category,
    p_total_score: params.totalScore,
    p_grade: params.grade,
    p_pillar_scores: params.pillarScores,
    p_findings_summary: params.findingsSummary,
  });

  if (error) {
    throw new Error(`Gagal menyinkronkan ke cloud: ${error.message}`);
  }
}

export function subscribeToRankings(onChange: () => void): () => void {
  const client = getSupabaseClient();
  if (!client) return () => {};

  const channel: RealtimeChannel = client
    .channel('website_rankings_realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'website_rankings',
      },
      () => {
        onChange();
      },
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export const SUPABASE_SETUP_SQL = `-- Jalankan skrip ini di SQL Editor proyek Supabase Anda
-- 1. Tabel Peringkat Utama (1 baris per domain)
CREATE TABLE IF NOT EXISTS public.website_rankings (
  domain TEXT PRIMARY KEY,
  site_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('peradilan_agama', 'umum')),
  total_score NUMERIC(5,1) NOT NULL DEFAULT 0,
  score_delta NUMERIC(5,1) NOT NULL DEFAULT 0,
  grade TEXT NOT NULL,
  audit_count INTEGER NOT NULL DEFAULT 1,
  last_audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pillar_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  findings_summary TEXT NOT NULL DEFAULT ''
);

-- 2. Tabel Riwayat Audit (untuk grafik perkembangan skor)
CREATE TABLE IF NOT EXISTS public.audit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL REFERENCES public.website_rankings(domain) ON DELETE CASCADE,
  site_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('peradilan_agama', 'umum')),
  total_score NUMERIC(5,1) NOT NULL,
  grade TEXT NOT NULL,
  pillar_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  findings_summary TEXT NOT NULL DEFAULT '',
  audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_history_domain_time
  ON public.audit_history(domain, audited_at ASC);

-- 3. Aktifkan Row Level Security (RLS) agar publik bisa membaca & mencatat audit via RPC
ALTER TABLE public.website_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Publik dapat melihat peringkat" ON public.website_rankings;
CREATE POLICY "Publik dapat melihat peringkat"
  ON public.website_rankings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Publik dapat melihat riwayat" ON public.audit_history;
CREATE POLICY "Publik dapat melihat riwayat"
  ON public.audit_history FOR SELECT USING (true);

-- 4. Fungsi RPC record_website_audit (menghitung delta skor & mencatat riwayat otomatis)
CREATE OR REPLACE FUNCTION public.record_website_audit(
  p_domain TEXT,
  p_site_name TEXT,
  p_category TEXT,
  p_total_score NUMERIC,
  p_grade TEXT,
  p_pillar_scores JSONB,
  p_findings_summary TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prev_score NUMERIC;
  v_delta NUMERIC := 0;
BEGIN
  SELECT total_score INTO v_prev_score
  FROM public.website_rankings
  WHERE domain = p_domain;

  IF FOUND THEN
    v_delta := ROUND((p_total_score - v_prev_score)::numeric, 1);
    UPDATE public.website_rankings
    SET
      site_name = p_site_name,
      category = p_category,
      total_score = ROUND(p_total_score::numeric, 1),
      score_delta = v_delta,
      grade = p_grade,
      audit_count = audit_count + 1,
      last_audited_at = NOW(),
      pillar_scores = p_pillar_scores,
      findings_summary = p_findings_summary
    WHERE domain = p_domain;
  ELSE
    INSERT INTO public.website_rankings (
      domain, site_name, category, total_score, score_delta,
      grade, audit_count, last_audited_at, pillar_scores, findings_summary
    ) VALUES (
      p_domain, p_site_name, p_category, ROUND(p_total_score::numeric, 1), 0,
      p_grade, 1, NOW(), p_pillar_scores, p_findings_summary
    );
  END IF;

  INSERT INTO public.audit_history (
    domain, site_name, category, total_score, grade, pillar_scores, findings_summary, audited_at
  ) VALUES (
    p_domain, p_site_name, p_category, ROUND(p_total_score::numeric, 1),
    p_grade, p_pillar_scores, p_findings_summary, NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_website_audit(TEXT, TEXT, TEXT, NUMERIC, TEXT, JSONB, TEXT) TO anon, authenticated;

-- 5. Aktifkan Realtime pada tabel website_rankings
ALTER PUBLICATION supabase_realtime ADD TABLE public.website_rankings;
`;
