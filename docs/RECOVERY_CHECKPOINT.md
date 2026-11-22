# Recovery checkpoint — Juru Website

Updated: 2026-11-22 (WIB). Status: local verification gates complete; hosted deployment remains pending.

## Goal
- Preserve the existing implementation; close remaining review findings and finish evidence-led local verification.
- Honest quest-log UI, accessible help, visible provenance/limitations, practical PA recommendations, feature matrix.

## Permission boundary
- Source/tests/docs edits and local tests completed by Antigravity as single writer after Hermes compaction loop was stopped.
- No deployment/publishing/upload, purchases, credential changes, remote Supabase writes, or Hermes DB modifications performed.

## Current tree / writer
- Logical root: /Users/zhayyn/Projects/juru-website (symlink to /Volumes/MacWorkspace/Projects/juru-website).
- Single writer completed edits cleanly on branch `main`; no concurrent writers or lingering QA servers active.
- Preserved all prior working-tree work and historical evidence logs untouched.

## Completed remediation (`deleg_8cf7bc40` & `deleg_87b1c330`) & release packaging
1. `server/localLighthouse.ts` & `server/localLighthouse.test.ts`: moved `150_000 ms` timeout to cover `launchChrome` startup, added late-launch Chrome cleanup, bounded `chrome.kill()` (`5_000 ms`) so `proxy.close()` cannot hang, and added 3 lifecycle regression tests.
2. `src/components/AuditReportView.tsx` & `src/components/AuditReportView.test.tsx`: made `.methodology-note` (formula, lab-vs-field disclaimer, local Mac limit, `rankingReason`) visible on screen as well as print; reworded security header tooltips and added a visible note clarifying header presence vs manual policy validation.
3. `vite.config.ts`, `server/startupStorage.test.ts`, `server/development.test.ts`, `.gitignore`: split vendor chunks (`<= 216.00 kB`, eliminating `> 500 kB` build warning), ensured scratch directories are created on clean build hosts, and excluded `docs/evidence/` + `bun.lock` from Git.
4. `README.md`, `docs/FEATURE_MATRIX.md`, `docs/FINAL_STATUS.md`: synced `automatic-checklist-v1` documentation, added feature-to-source-to-evidence matrix, and recorded fresh verification results for GitHub push (`zhayyn/juru-website`).

## Fresh local verification (2026-11-22)
- `npm run lint` (`tsc --noEmit`): exit 0.
- `npm test`: 367/367 pass, 0 fail, 0 skipped.
- `npm run build` & `npm run test:build`: exit 0, 1/1 pass (0 chunk >500 kB warnings; max JS chunk `supabase` 216.00 kB / gzip 55.68 kB).
- `node --test scripts/pilot-deployment.test.mjs`: 4/4 pass.
- `npm audit --omit=dev --json`: 0 vulnerabilities across 204 prod dependencies.
- `python3 scripts/production-smoke.py`: `"status": "pass"`, 21/21 clean production-only checks pass.
- `npm run test:browser`: `"status": "pass"`, 16/16 checks pass (desktop, 390px, 320px, PDF, CSV/JSON bytes, `errors: []`) prior to final chunk-split/docs packaging.

## Remaining open gates (external/operator)
- HTTPS hosted deployment (`render.yaml` / `website.juru.ai.id`), live PageSpeed 4-score verification without HTTP 429, optional remote Supabase staging migration/ACL verification, and AI provider provisioning remain pending operator action.
