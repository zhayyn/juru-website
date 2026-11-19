-- LOCAL-ONLY migration; application/deployment requires a separate operator action.
-- Legacy website ranking/history data is untrusted (browser-supplied scores).
-- It is deliberately neither copied into technical-v1 nor deleted here.
BEGIN;

CREATE TYPE public.jw_audit_category_v1 AS ENUM ('umum', 'peradilan_agama');

CREATE TABLE public.jw_rankings_v1 (
  domain text NOT NULL CHECK (length(domain) <= 253 AND domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$'),
  site_name text NOT NULL CHECK (length(btrim(site_name)) > 0 AND length(site_name) <= 300),
  category public.jw_audit_category_v1 NOT NULL,
  strategy text NOT NULL CHECK (strategy = 'MOBILE'),
  methodology text NOT NULL CHECK (methodology = 'technical-v1'),
  total_score numeric NOT NULL CHECK (total_score BETWEEN 0 AND 100),
  grade text NOT NULL CHECK (length(btrim(grade)) > 0 AND length(grade) <= 32),
  pillar_scores jsonb NOT NULL CHECK (jsonb_typeof(pillar_scores) = 'array'),
  findings_summary text NOT NULL CHECK (length(btrim(findings_summary)) > 0 AND length(findings_summary) <= 10000),
  audit_count bigint NOT NULL DEFAULT 1 CHECK (audit_count > 0),
  score_delta numeric NOT NULL DEFAULT 0 CHECK (score_delta BETWEEN -100 AND 100),
  last_audited_at timestamptz NOT NULL,
  PRIMARY KEY (domain, category, strategy, methodology)
);

CREATE TABLE public.jw_audit_history_v1 (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  domain text NOT NULL CHECK (length(domain) <= 253 AND domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$'),
  site_name text NOT NULL CHECK (length(btrim(site_name)) > 0 AND length(site_name) <= 300),
  category public.jw_audit_category_v1 NOT NULL,
  strategy text NOT NULL CHECK (strategy = 'MOBILE'),
  methodology text NOT NULL CHECK (methodology = 'technical-v1'),
  total_score numeric NOT NULL CHECK (total_score BETWEEN 0 AND 100),
  grade text NOT NULL CHECK (length(btrim(grade)) > 0 AND length(grade) <= 32),
  pillar_scores jsonb NOT NULL CHECK (jsonb_typeof(pillar_scores) = 'array'),
  findings_summary text NOT NULL CHECK (length(btrim(findings_summary)) > 0 AND length(findings_summary) <= 10000),
  audited_at timestamptz NOT NULL
);

COMMENT ON TABLE public.jw_rankings_v1 IS 'Server-recorded MOBILE technical-v1 scores only; legacy data is untrusted and not imported. Not a content/compliance score.';
COMMENT ON TABLE public.jw_audit_history_v1 IS 'New trusted technical-v1 audit events only. Legacy history is retained separately and is untrusted.';

-- Reset default grants too: service_role uses the definer RPC, not table writes.
REVOKE ALL ON TABLE public.jw_rankings_v1 FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.jw_audit_history_v1 FROM PUBLIC, anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.jw_rankings_v1 FROM PUBLIC, anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.jw_audit_history_v1 FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.jw_rankings_v1 TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.jw_audit_history_v1 TO anon, authenticated, service_role;
ALTER TABLE public.jw_rankings_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jw_audit_history_v1 ENABLE ROW LEVEL SECURITY;
CREATE POLICY jw_rankings_v1_public_read ON public.jw_rankings_v1 FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY jw_audit_history_v1_public_read ON public.jw_audit_history_v1 FOR SELECT TO anon, authenticated USING (true);
GRANT USAGE ON TYPE public.jw_audit_category_v1 TO anon, authenticated, service_role;

-- Apply as the trusted migration/table owner. That owner remains the only direct
-- writer; API roles (including service_role) mutate exclusively via this RPC.
-- audited_at/last_audited_at are database recording time. The server validates
-- report.auditedAt; the fixed RPC contract intentionally takes no timestamp.
CREATE FUNCTION public.jw_record_audit_v1(
  p_domain TEXT,
  p_site_name TEXT,
  p_category TEXT,
  p_strategy TEXT,
  p_methodology TEXT,
  p_total_score NUMERIC,
  p_grade TEXT,
  p_pillar_scores JSONB,
  p_findings_summary TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_item jsonb;
  v_ids text[] := ARRAY[]::text[];
  v_audited_at timestamptz;
BEGIN
  IF p_domain IS NULL OR pg_catalog.length(p_domain) > 253 OR p_domain !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$' THEN
    RAISE EXCEPTION 'Invalid ranking domain' USING ERRCODE = '22023';
  END IF;
  IF p_category IS NULL OR p_category NOT IN ('umum', 'peradilan_agama')
     OR p_strategy IS DISTINCT FROM 'MOBILE'
     OR p_methodology IS DISTINCT FROM 'technical-v1' THEN
    RAISE EXCEPTION 'Invalid ranking methodology' USING ERRCODE = '22023';
  END IF;
  IF p_total_score IS NULL OR NOT (p_total_score BETWEEN 0 AND 100) THEN
    RAISE EXCEPTION 'Invalid ranking score' USING ERRCODE = '22023';
  END IF;
  IF p_site_name IS NULL OR pg_catalog.length(pg_catalog.btrim(p_site_name)) = 0 OR pg_catalog.length(p_site_name) > 300
     OR p_grade IS NULL OR pg_catalog.length(pg_catalog.btrim(p_grade)) = 0 OR pg_catalog.length(p_grade) > 32
     OR p_findings_summary IS NULL OR pg_catalog.length(pg_catalog.btrim(p_findings_summary)) = 0 OR pg_catalog.length(p_findings_summary) > 10000 THEN
    RAISE EXCEPTION 'Invalid ranking text' USING ERRCODE = '22023';
  END IF;
  IF p_pillar_scores IS NULL OR pg_catalog.jsonb_typeof(p_pillar_scores) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid ranking pillars' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.jsonb_array_length(p_pillar_scores) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'Invalid ranking pillar count' USING ERRCODE = '22023';
  END IF;
  FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_pillar_scores) LOOP
    IF pg_catalog.jsonb_typeof(v_item) IS DISTINCT FROM 'object'
       OR pg_catalog.jsonb_typeof(v_item->'id') IS DISTINCT FROM 'string'
       OR (v_item->>'id') !~ '^[a-zA-Z0-9_-]{1,80}$'
       OR (v_item->>'id') = ANY(v_ids)
       OR NOT (v_item ? 'score') THEN
      RAISE EXCEPTION 'Invalid ranking pillar' USING ERRCODE = '22023';
    END IF;
    -- null means unmeasured/unverified; never coerce it to a content score.
    IF pg_catalog.jsonb_typeof(v_item->'score') = 'number' THEN
      IF NOT ((v_item->>'score')::numeric BETWEEN 0 AND 100) THEN
        RAISE EXCEPTION 'Invalid ranking pillar score' USING ERRCODE = '22023';
      END IF;
    ELSIF pg_catalog.jsonb_typeof(v_item->'score') IS DISTINCT FROM 'null' THEN
      RAISE EXCEPTION 'Invalid ranking pillar score' USING ERRCODE = '22023';
    END IF;
    v_ids := pg_catalog.array_append(v_ids, v_item->>'id');
  END LOOP;

  -- Transaction-scoped lock also serializes the first-ever insert for this key.
  -- Hash collisions only serialize unrelated keys; they cannot mix their rows.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(p_domain, p_category, p_strategy, p_methodology)::text, 0));
  v_audited_at := pg_catalog.clock_timestamp();

  INSERT INTO public.jw_rankings_v1 AS current_ranking (
    domain, site_name, category, strategy, methodology, total_score, grade,
    pillar_scores, findings_summary, audit_count, score_delta, last_audited_at
  ) VALUES (
    p_domain, p_site_name, p_category::public.jw_audit_category_v1, p_strategy,
    p_methodology, p_total_score, p_grade, p_pillar_scores, p_findings_summary,
    1, 0, v_audited_at
  )
  ON CONFLICT (domain, category, strategy, methodology) DO UPDATE SET
    site_name = EXCLUDED.site_name,
    total_score = EXCLUDED.total_score,
    grade = EXCLUDED.grade,
    pillar_scores = EXCLUDED.pillar_scores,
    findings_summary = EXCLUDED.findings_summary,
    audit_count = current_ranking.audit_count + 1,
    score_delta = EXCLUDED.total_score - current_ranking.total_score,
    last_audited_at = EXCLUDED.last_audited_at;

  INSERT INTO public.jw_audit_history_v1 (
    domain, site_name, category, strategy, methodology, total_score, grade,
    pillar_scores, findings_summary, audited_at
  ) VALUES (
    p_domain, p_site_name, p_category::public.jw_audit_category_v1, p_strategy,
    p_methodology, p_total_score, p_grade, p_pillar_scores, p_findings_summary, v_audited_at
  );
  -- No swallowed exceptions: failure of either write rolls back both.
END;
$function$;

REVOKE ALL ON FUNCTION public.jw_record_audit_v1(text,text,text,text,text,numeric,text,jsonb,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.jw_record_audit_v1(text,text,text,text,text,numeric,text,jsonb,text) TO service_role;

-- Close the old browser score-write entrypoint without changing its data.
DO $legacy$
BEGIN
  IF pg_catalog.to_regprocedure('public.record_website_audit(text,text,text,numeric,text,jsonb,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.record_website_audit(text,text,text,numeric,text,jsonb,text) FROM PUBLIC, anon, authenticated';
  END IF;
END;
$legacy$;

COMMIT;
