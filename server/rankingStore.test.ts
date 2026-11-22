import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { publishRanking, type RankingPublishReport } from './rankingStore.ts';

const report: RankingPublishReport = {
  domain: 'example.org', siteName: 'Example', category: 'umum',
  strategy: 'MOBILE', methodology: 'technical-v1', rankingEligible: true,
  auditedAt: '2026-11-17T08:00:00.000Z', totalScore: 81, grade: 'B',
  pillarScores: [
    { id: 'performance', score: 81 }, { id: 'accessibility', score: 82 },
    { id: 'best-practices', score: 80 }, { id: 'seo', score: 81 },
    { id: 'content', score: null },
  ],
  executiveSummary: 'Measured technical scores; content is not verified.',
};
const enabled = {
  RANKING_PUBLISH_ENABLED: 'true', SUPABASE_URL: 'https://project-ref.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'fake-service-key-for-local-tests-only',
};
const noFetch: typeof fetch = async () => { throw new Error('unexpected request'); };
const migrationPath = new URL('../supabase/migrations/202611170001_trusted_ranking.sql', import.meta.url);
const migration = () => readFileSync(migrationPath, 'utf8');

test('SQL creates isolated constrained technical-v1 tables without promoting legacy data', () => {
  assert.ok(existsSync(migrationPath), 'new migration must exist');
  const sql = migration();
  assert.match(sql, /CREATE TYPE public\.jw_audit_category_v1 AS ENUM\s*\('umum', 'peradilan_agama'\)/i);
  for (const table of ['jw_rankings_v1', 'jw_audit_history_v1']) {
    const body = sql.match(new RegExp(`CREATE TABLE public\\.${table} \\(([\\s\\S]*?)\\n\\);`, 'i'))?.[1];
    assert.ok(body, table);
    for (const column of ['domain', 'site_name', 'category', 'strategy', 'methodology', 'total_score', 'grade', 'pillar_scores', 'findings_summary']) assert.match(body, new RegExp(`\\b${column}\\b`));
    assert.match(body, /category public\.jw_audit_category_v1 NOT NULL/i);
    assert.match(body, /CHECK\s*\(strategy = 'MOBILE'\)/i);
    assert.match(body, /CHECK\s*\(methodology = 'technical-v1'\)/i);
    assert.match(body, /total_score numeric NOT NULL CHECK\s*\(total_score BETWEEN 0 AND 100\)/i);
    assert.match(body, /domain ~ /i);
  }
  assert.match(sql, /PRIMARY KEY\s*\(domain, category, strategy, methodology\)/i);
  assert.match(sql, /audit_count bigint NOT NULL DEFAULT 1 CHECK\s*\(audit_count > 0\)/i);
  assert.match(sql, /score_delta numeric NOT NULL DEFAULT 0/i);
  assert.match(sql, /last_audited_at timestamptz NOT NULL/i);
  assert.match(sql, /id uuid PRIMARY KEY DEFAULT pg_catalog\.gen_random_uuid\(\)/i);
  assert.match(sql, /audited_at timestamptz NOT NULL/i);
  assert.match(sql, /legacy[\s\S]*untrusted/i);
  assert.doesNotMatch(sql, /\b(?:TRUNCATE|DELETE FROM|DROP TABLE)\b/i);
  assert.doesNotMatch(sql, /INSERT INTO public\.jw_\w+\s+SELECT/i);
});

test('SQL permits public SELECT only and revokes the legacy browser writer', () => {
  const sql = migration();
  for (const table of ['jw_rankings_v1', 'jw_audit_history_v1']) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'));
    assert.match(sql, new RegExp(`ON public\\.${table} FOR SELECT TO anon, authenticated USING \\(true\\)`, 'i'));
    assert.match(sql, new RegExp(`GRANT SELECT ON TABLE public\\.${table} TO anon, authenticated, service_role`, 'i'));
    assert.match(sql, new RegExp(`REVOKE INSERT, UPDATE, DELETE ON TABLE public\\.${table} FROM PUBLIC, anon, authenticated, service_role`, 'i'));
    assert.match(sql, new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM PUBLIC, anon, authenticated, service_role`, 'i'));
  }
  assert.doesNotMatch(sql, /CREATE POLICY[^;]*FOR (?:ALL|INSERT|UPDATE|DELETE)/i);
  assert.match(sql, /to_regprocedure\('public\.record_website_audit\(text,text,text,numeric,text,jsonb,text\)'\) IS NOT NULL/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.record_website_audit\(text,text,text,numeric,text,jsonb,text\) FROM PUBLIC, anon, authenticated/i);
});

test('SQL RPC validates inputs and atomically serializes each ranking plus history using service-only execution', () => {
  const sql = migration();
  assert.match(sql, /CREATE FUNCTION public\.jw_record_audit_v1\(\s*p_domain TEXT,\s*p_site_name TEXT,\s*p_category TEXT,\s*p_strategy TEXT,\s*p_methodology TEXT,\s*p_total_score NUMERIC,\s*p_grade TEXT,\s*p_pillar_scores JSONB,\s*p_findings_summary TEXT\s*\)/i);
  assert.match(sql, /RETURNS void[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''/i);
  assert.match(sql, /p_domain IS NULL[\s\S]*p_domain !~ /i);
  assert.match(sql, /p_category IS NULL[\s\S]*p_category NOT IN \('umum', 'peradilan_agama'\)/i);
  assert.match(sql, /p_strategy IS DISTINCT FROM 'MOBILE'/i);
  assert.match(sql, /p_methodology IS DISTINCT FROM 'technical-v1'/i);
  assert.match(sql, /p_total_score IS NULL OR NOT \(p_total_score BETWEEN 0 AND 100\)/i);
  assert.match(sql, /jsonb_typeof\(p_pillar_scores\)/i);
  assert.match(sql, /jsonb_array_elements\(p_pillar_scores\)/i);
  assert.match(sql, /RAISE EXCEPTION[\s\S]*ERRCODE = '22023'/i);
  const lock = sql.indexOf('pg_catalog.pg_advisory_xact_lock');
  const upsert = sql.indexOf('INSERT INTO public.jw_rankings_v1');
  const history = sql.indexOf('INSERT INTO public.jw_audit_history_v1');
  assert.ok(lock > 0 && lock < upsert && upsert < history);
  assert.match(sql, /hashtextextended/i);
  assert.match(sql, /ON CONFLICT \(domain, category, strategy, methodology\) DO UPDATE/i);
  assert.match(sql, /audit_count = current_ranking.audit_count \+ 1/i);
  assert.match(sql, /score_delta = EXCLUDED.total_score - current_ranking.total_score/i);
  assert.match(sql, /last_audited_at = EXCLUDED.last_audited_at/i);
  assert.match(sql, /v_audited_at := pg_catalog.clock_timestamp\(\)/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.jw_record_audit_v1\(text,text,text,text,text,numeric,text,jsonb,text\) FROM PUBLIC, anon, authenticated, service_role/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.jw_record_audit_v1\(text,text,text,text,text,numeric,text,jsonb,text\) TO service_role/i);
  assert.match(sql, /END;\s*\$legacy\$/i);
  assert.doesNotMatch(sql, /WHEN OTHERS|EXCEPTION\s+WHEN/i);
  assert.ok(sql.trim().endsWith('COMMIT;'));
});

test('invalid or ineligible reports fail closed before requesting', async () => {
  const invalid: Array<Partial<RankingPublishReport>> = [
    { rankingEligible: false }, { rankingEligible: undefined },
    { totalScore: null }, { totalScore: NaN }, { totalScore: Infinity },
    { totalScore: -0.01 }, { totalScore: 100.01 }, { strategy: 'DESKTOP' },
    { methodology: 'ai-v1' }, { methodology: undefined }, { category: 'other' },
    ...['', 'https://example.org', 'example.org/path', 'EXAMPLE.org', 'localhost',
      '127.0.0.1', 'a..org', '-a.org', 'a-.org', 'a.org.', 'a_b.org'].map(domain => ({ domain })),
    ...['', 'invalid', '2026-02-30T00:00:00.000Z', '2026-11-17', '2026-11-17T25:00:00Z'].map(auditedAt => ({ auditedAt })),
    { siteName: '' }, { siteName: 'x'.repeat(301) }, { grade: '' },
    { executiveSummary: 'x'.repeat(10001) },
    { pillarScores: [{ id: 'p', score: NaN }] }, { pillarScores: [{ id: 'p', score: 101 }] },
    { pillarScores: [{ id: '', score: 50 }] },
    { pillarScores: [{ id: 'p', score: 50 }, { id: 'p', score: 60 }] },
  ];
  let calls = 0;
  const fake: typeof fetch = async () => { calls++; return new Response(null, { status: 204 }); };
  for (const change of invalid) {
    const result = await publishRanking({ ...report, ...change }, enabled, fake);
    assert.deepEqual(result, { cloudSynced: false, cloudSyncError: 'Ranking report is not eligible for publication.' }, JSON.stringify(change));
  }
  assert.equal(calls, 0);
});

test('publishing is opt-in and disabled mode makes no request', async () => {
  for (const flag of [undefined, 'false', 'TRUE', '1', '']) {
    assert.deepEqual(await publishRanking(report, { RANKING_PUBLISH_ENABLED: flag }, noFetch), { cloudSynced: false });
  }
});

test('configuration accepts only an exact HTTPS Supabase origin and a server key', async () => {
  let calls = 0;
  const fake: typeof fetch = async () => { calls++; return new Response(null, { status: 204 }); };
  for (const url of [undefined, '', 'http://project.supabase.co', 'https://evil.example',
    'https://project.supabase.co.evil.example', 'https://supabase.co',
    'https://user:pass@project.supabase.co', 'https://project.supabase.co/',
    'https://project.supabase.co/path', 'https://project.supabase.co?x=1',
    'https://project.supabase.co#x', 'https://project.supabase.co:443',
    'https://PROJECT.supabase.co', 'https://a.b.supabase.co']) {
    assert.deepEqual(await publishRanking(report, { ...enabled, SUPABASE_URL: url }, fake),
      { cloudSynced: false, cloudSyncError: 'Ranking publication is not configured.' });
  }
  for (const key of [undefined, '', '  ', 'key\nunsafe']) {
    assert.deepEqual(await publishRanking(report, { ...enabled, SUPABASE_SERVICE_ROLE_KEY: key }, fake),
      { cloudSynced: false, cloudSyncError: 'Ranking publication is not configured.' });
  }
  assert.equal(calls, 0);
});

test('HTTP and fetch failures return static errors without body, secret, URL or retries', async () => {
  for (const failure of ['http', 'throw']) {
    let calls = 0;
    const fake: typeof fetch = async () => {
      calls++;
      if (failure === 'throw') throw new Error(`secret ${enabled.SUPABASE_SERVICE_ROLE_KEY} ${enabled.SUPABASE_URL}`);
      return new Response(`secret ${enabled.SUPABASE_SERVICE_ROLE_KEY}`, { status: 401 });
    };
    assert.deepEqual(await publishRanking(report, enabled, fake), {
      cloudSynced: false, cloudSyncError: 'Ranking publication failed.',
    });
    assert.equal(calls, 1);
  }
});

test('request is bounded to 8 seconds even when a fetcher ignores abort', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let signal: AbortSignal | undefined;
  let calls = 0;
  const fake: typeof fetch = async (_url, init) => {
    calls++;
    signal = init?.signal ?? undefined;
    return await new Promise<Response>(() => {});
  };
  const pending = publishRanking(report, enabled, fake);
  let finished = false;
  void pending.then(() => { finished = true; });
  context.mock.timers.tick(7999);
  await Promise.resolve();
  assert.equal(finished, false);
  context.mock.timers.tick(1);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(finished, true, 'publisher must settle by the 8s bound');
  assert.deepEqual(await pending, { cloudSynced: false, cloudSyncError: 'Ranking publication timed out.' });
  assert.equal(signal?.aborted, true);
  assert.equal(calls, 1);
});

test('control suffixes cannot bypass exact domain or origin validation', async () => {
  let calls = 0;
  const fake: typeof fetch = async () => { calls++; return new Response(null, { status: 204 }); };
  for (const suffix of ['\n', '\r', '\r\n']) {
    assert.equal((await publishRanking({ ...report, domain: report.domain + suffix }, enabled, fake)).cloudSynced, false);
    assert.equal((await publishRanking(report, { ...enabled, SUPABASE_URL: enabled.SUPABASE_URL + suffix }, fake)).cloudSynced, false);
    assert.equal((await publishRanking(report, { ...enabled, SUPABASE_SERVICE_ROLE_KEY: enabled.SUPABASE_SERVICE_ROLE_KEY + suffix }, fake)).cloudSynced, false);
  }
  assert.equal(calls, 0);
});

test('eligible reports POST only allowlisted server fields to the service RPC', async () => {
  for (const category of ['umum', 'peradilan_agama']) {
    let calls = 0;
    const fake: typeof fetch = async (url, init) => {
      calls++;
      assert.equal(url, 'https://project-ref.supabase.co/rest/v1/rpc/jw_record_audit_v1');
      assert.equal(init?.method, 'POST');
      assert.equal(init?.redirect, 'error');
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('apikey'), enabled.SUPABASE_SERVICE_ROLE_KEY);
      assert.equal(headers.get('authorization'), `Bearer ${enabled.SUPABASE_SERVICE_ROLE_KEY}`);
      assert.equal(headers.get('content-type'), 'application/json');
      assert.deepEqual(JSON.parse(String(init?.body)), {
        p_domain: report.domain, p_site_name: report.siteName, p_category: category,
        p_strategy: 'MOBILE', p_methodology: 'technical-v1', p_total_score: 81,
        p_grade: 'B', p_pillar_scores: report.pillarScores,
        p_findings_summary: report.executiveSummary,
      });
      return new Response(null, { status: 204 });
    };
    assert.deepEqual(await publishRanking({ ...report, category }, enabled, fake), { cloudSynced: true });
    assert.equal(calls, 1);
  }
});
