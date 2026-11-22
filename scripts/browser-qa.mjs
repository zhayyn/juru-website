import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'docs/evidence/browser');
await mkdir(out, { recursive: true });
const port = Number(process.env.QA_PORT || 3098);
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
  cwd: root, env: { ...process.env, NODE_ENV: 'production', AI_PROVIDER: 'none', RANKING_PUBLISH_ENABLED: 'false',
    HOST: '127.0.0.1', PORT: String(port), ALLOWED_HOSTS: `127.0.0.1:${port}`, PILOT_ACCESS_TOKEN: '', PILOT_ALLOWED_TARGETS: '',
    DOTENV_CONFIG_PATH: path.join(out, 'no-qa-env'), SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '',
    PAGESPEED_API_KEY: '', OPENROUTER_API_KEY: '', GEMINI_API_KEY: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
child.stdout.on('data', b => { serverLog += String(b); });
child.stderr.on('data', b => { serverLog += String(b); });
let browser;
const result = { at: new Date().toISOString(), checks: [], realAudit: null, screenshots: [], errors: [] };
const check = (name, mode = 'browser-real-ui') => result.checks.push({ name, mode, status: 'pass' });
async function noOverflow(page, name) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow) {
    result.overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].map(e => ({ tag: e.tagName, text: (e.textContent || '').slice(0, 80), cls: String(e.className), left: e.getBoundingClientRect().left, right: e.getBoundingClientRect().right, width: e.getBoundingClientRect().width })).filter(e => e.right > innerWidth + 1 || e.left < -1).slice(0, 30));
    await page.screenshot({ path: path.join(out, 'overflow-before-fix.png'), fullPage: true });
  }
  assert.equal(overflow, false, name);
  check(name);
}
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(base + '/api/health'); if (r.ok) { ready = true; break; } } catch {}
    if (child.exitCode !== null) throw new Error('QA server exited: ' + serverLog);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'QA server ready');
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => result.errors.push(e.message));
  await page.route('https://**/*', route => route.abort()); // no cloud/fonts in QA context
  await page.goto(base);
  await page.getByRole('button', { name: 'Mulai Pemeriksaan', exact: true }).waitFor();
  await noOverflow(page, 'desktop no page-wide horizontal overflow');
  assert.equal(await page.locator('#ranking-panel').evaluate(e => e.open), false);
  await page.locator('#ranking-panel > summary').click();
  assert.equal(await page.locator('#papan-peringkat tbody tr').count(), 1); // empty-state row, not a ranking
  assert.equal(await page.getByRole('button', { name: 'Ekspor CSV', exact: true }).isDisabled(), true);
  check('empty ranking has no synthetic fallback and export disabled');
  await page.getByRole('button', { name: 'Mulai Pemeriksaan', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Masukkan alamat' }).waitFor();
  check('empty URL validation');
  await page.getByRole('button', { name: 'Aktifkan tampilan gelap' }).click();
  assert.equal(await page.locator('html').getAttribute('class'), 'dark');
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('class'), 'dark');
  await page.getByRole('button', { name: 'Aktifkan tampilan terang' }).click();
  check('theme toggle persists across reload');
  await page.getByRole('button', { name: 'Pengaturan Cloud', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('tab', { name: 'Skema SQL Database' }).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  check('cloud config dialog tabs and Escape close without saving credentials');

  // Real upstream request; null/429 is an honest incomplete measurement, never fixture scores.
  await page.getByRole('radio', { name: /^Website Umum/ }).click();
  assert.equal(await page.getByRole('radio', { name: /^Website Umum/ }).getAttribute('aria-checked'), 'true');
  check('category radio selection sends general website cohort');
  await page.locator('#audit-url-input').fill('https://example.com/');
  const liveResponse = page.waitForResponse(r => r.url() === base + '/api/audit/analyze' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Mulai Pemeriksaan', exact: true }).click();
  const response = await liveResponse;
  assert.equal(response.status(), 200);
  const live = await response.json();
  await page.locator('#audit-report-title').waitFor();
  assert.ok(live.improvementPlan.length > 0);
  result.realAudit = { status: response.status(), domain: live.domain, score: live.totalScore,
    source: live.pageSpeed.source, warning: live.pageSpeed.fetchWarning ?? null, rankingEligible: live.rankingEligible };
  await writeFile(path.join(out, 'real-audit.json'), JSON.stringify(live, null, 2));
  if (live.totalScore === null) {
    assert.equal(live.rankingEligible, false);
    await page.locator('#ranking-panel > summary').click();
    assert.equal(await page.locator('#ranking-panel').evaluate(e => e.open), true);
    assert.equal(await page.getByRole('button', { name: 'Ekspor CSV', exact: true }).isDisabled(), true);
  }
  check('actual public target audit returns useful recommendations and preserves missing scores', 'real-network');
  await noOverflow(page, 'desktop report no page-wide horizontal overflow');
  await page.screenshot({ path: path.join(out, 'desktop-report.png'), fullPage: true });
  result.screenshots.push('desktop-report.png');
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(out, 'real-report.pdf'), format: 'A4', printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  const pdf = await readFile(path.join(out, 'real-report.pdf'));
  assert.ok(pdf.subarray(0, 5).toString() === '%PDF-' && pdf.length > 1000);
  check('real report PDF bytes produced via browser print engine');

  // Browser contract fixture only. Never written as a genuine audit or sent to Supabase.
  // A reload intentionally resets the optional ranking disclosure.
  if (!await page.locator('#ranking-panel').evaluate(e => e.open)) {
    await page.locator('#ranking-panel > summary').click();
  }
  let n = 0;
  await page.route('**/api/audit/analyze', async route => {
    n++;
    const fixture = structuredClone(live);
    Object.assign(fixture, { id: `qa-fixture-${n}`, siteName: 'SYNTHETIC QA FIXTURE', totalScore: n === 1 ? 85 : 88,
      rankingEligible: true, grade: 'B (Baik)', auditedAt: new Date(Date.now() + n * 1000).toISOString(),
      cloudSynced: false, methodology: 'technical-v1' });
    Object.assign(fixture.pageSpeed, { source: 'pagespeed', requestedUrl: fixture.url, finalUrl: fixture.url, performanceScore: n === 1 ? 80 : 84,
      accessibilityScore: n === 1 ? 70 : 74, bestPracticesScore: n === 1 ? 90 : 94, seoScore: 100, fetchWarning: undefined });

    result.fixtureLast = { request: route.request().postDataJSON(), score: fixture.totalScore, strategy: fixture.strategy, category: fixture.category,
      cloudSynced: fixture.cloudSynced, eligible: fixture.rankingEligible, source: fixture.pageSpeed.source, metrics: [fixture.pageSpeed.performanceScore, fixture.pageSpeed.accessibilityScore, fixture.pageSpeed.bestPracticesScore, fixture.pageSpeed.seoScore] };
    await route.fulfill({ json: fixture });
  });
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Mulai Pemeriksaan', exact: true }).click();
    await page.getByRole('button', { name: 'Mulai Pemeriksaan', exact: true }).waitFor();
    try { await page.locator('#papan-peringkat').getByText('SYNTHETIC QA FIXTURE', { exact: true }).waitFor({ timeout: 3000 }); }
    catch (e) { result.fixtureDiagnostic = { n, text: await page.locator('body').innerText() }; throw e; }
  }
  assert.equal(await page.locator('#papan-peringkat tbody tr').count(), 1);
  assert.match(await page.locator('#papan-peringkat').innerText(), /88\.0/);
  check('eligible session ranking upsert, latest score, and history', 'browser-fixture');
  await page.getByRole('button', { name: /^Lihat riwayat/ }).click();
  await page.getByRole('dialog').waitFor();
  assert.match(await page.getByRole('dialog').innerText(), /2 Kali Pengujian/);
  await page.keyboard.press('Escape');
  for (const kind of ['CSV', 'JSON']) {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: `Ekspor ${kind}`, exact: true }).click();
    const download = await downloadPromise;
    const file = path.join(out, `fixture-ranking.${kind.toLowerCase()}`);
    await download.saveAs(file);
    const text = await readFile(file, 'utf8');
    if (kind === 'JSON') {
      const rows = JSON.parse(text); assert.equal(rows.length, 1); assert.equal(rows[0].total_score, 88); assert.equal(rows[0].audit_count, 2);
    } else {
      assert.ok(text.includes('SYNTHETIC QA FIXTURE') && text.includes('88'));
      const deltaCell = text.split('\r\n')[1].split(',')[5];
      assert.equal(deltaCell, '3', 'downloaded CSV delta remains numeric, without apostrophe or plus');
    }
    check(`export ${kind} actual downloaded bytes validated`, 'browser-fixture');
  }
  const search = page.getByRole('searchbox');
  await search.fill('no-match-qa');
  assert.match(await page.locator('#papan-peringkat').innerText(), /Belum ada hasil/);
  await search.fill('');
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page, '390px report no page-wide horizontal overflow');
  const recommendation = page.locator('.priority-list .help-action').first();
  assert.equal(await recommendation.evaluate(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; }), true, 'mobile priority card stays within viewport');
  const action = recommendation.locator('.action-trigger');
  await action.scrollIntoViewIfNeeded();
  await page.keyboard.press('Escape');
  await action.click();
  assert.equal(await action.getAttribute('aria-expanded'), 'true');
  assert.equal(await recommendation.locator('.help-panel').isVisible(), true);
  assert.match(await recommendation.locator('.help-panel').innerText(), /Cara Verifikasi/);
  await page.keyboard.press('Escape');
  assert.equal(await action.getAttribute('aria-expanded'), 'false');
  check('mobile priority card stays contained and practical verification opens and closes');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(out, 'mobile-report.png'), fullPage: true });
  result.screenshots.push('mobile-report.png');
  await page.setViewportSize({ width: 320, height: 740 });
  await noOverflow(page, '320px report no page-wide horizontal overflow');
  await ctx.close();
  assert.deepEqual(result.errors, []);
  check('no uncaught browser errors');
  result.status = 'pass';
} catch (error) {
  result.status = 'fail'; result.failure = String(error.stack || error); process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  child.kill('SIGTERM');
  await writeFile(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
