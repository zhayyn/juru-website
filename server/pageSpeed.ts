import type { AuditStrategy, PageSpeedMetrics } from '../src/types/audit.ts';

export function missingPageSpeed(fetchWarning: string): PageSpeedMetrics {
  return { performanceScore: null, accessibilityScore: null, bestPracticesScore: null, seoScore: null,
    lcp: 'Tidak tersedia', fcp: 'Tidak tersedia', cls: 'Tidak tersedia', tbt: 'Tidak tersedia', speedIndex: 'Tidak tersedia',
    lcpMs: null, fcpMs: null, clsNum: null, tbtMs: null, source: 'server_probe', fetchWarning };
}

export function matchesPageSpeedTarget(url: string, identity: { requestedUrl?: unknown; finalUrl?: unknown }): boolean {
  try {
    const expected = new URL(url).href;
    return typeof identity.requestedUrl === 'string' && typeof identity.finalUrl === 'string' &&
      new URL(identity.requestedUrl).href === expected && new URL(identity.finalUrl).href === expected;
  } catch { return false; }
}

export async function fetchPageSpeed(url: string, strategy: AuditStrategy, fetcher: typeof fetch = fetch, env: Readonly<Record<string, string | undefined>> = process.env): Promise<PageSpeedMetrics> {
  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('strategy', strategy);
  for (const cat of ['PERFORMANCE', 'ACCESSIBILITY', 'BEST_PRACTICES', 'SEO']) endpoint.searchParams.append('category', cat);
  try {
    const headers: Record<string, string> = {};
    if (env.PAGESPEED_API_KEY?.trim()) headers['x-goog-api-key'] = env.PAGESPEED_API_KEY.trim();
    const response = await fetcher(endpoint.toString(), { signal: AbortSignal.timeout(20000), redirect: 'error', headers });
    if (!response.ok) return missingPageSpeed(`PageSpeed tidak tersedia (HTTP ${response.status}); tidak ada skor pengganti.`);
    const data = await response.json();
    return parseLighthouseResult(url, data?.lighthouseResult);
  } catch {
    return missingPageSpeed('PageSpeed tidak tersedia atau melewati batas waktu; silakan ukur ulang.');
  }
}

export function parseLighthouseResult(url: string, raw: unknown): PageSpeedMetrics {
  const data = raw as any;
    if (data?.runtimeError != null) {
      return missingPageSpeed('Lighthouse melaporkan kegagalan pengukuran; skor tidak digunakan.');
    }
    if (!matchesPageSpeedTarget(url, data)) {
      return missingPageSpeed('Identitas halaman PageSpeed berbeda atau tidak lengkap; skor tidak digunakan.');
    }
    const cats = data?.categories ?? {};
    const audits = data?.audits ?? {};
    const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
    const percent = (value: unknown): number | null => { const n = number(value); return n !== null && n <= 1 ? Math.round(n * 100) : null; };
    const metric = (id: string) => number(audits[id]?.numericValue);
    const display = (id: string): string => typeof audits[id]?.displayValue === 'string' ? audits[id].displayValue.slice(0, 80) : 'Tidak tersedia';
    return {
      requestedUrl: new URL(data.requestedUrl).href, finalUrl: new URL(data.finalUrl).href,
      performanceScore: percent(cats.performance?.score), accessibilityScore: percent(cats.accessibility?.score),
      bestPracticesScore: percent(cats['best-practices']?.score), seoScore: percent(cats.seo?.score),
      lcp: display('largest-contentful-paint'), fcp: display('first-contentful-paint'), cls: display('cumulative-layout-shift'),
      tbt: display('total-blocking-time'), speedIndex: display('speed-index'),
      lcpMs: metric('largest-contentful-paint') === null ? null : Math.round(metric('largest-contentful-paint')!),
      fcpMs: metric('first-contentful-paint') === null ? null : Math.round(metric('first-contentful-paint')!),
      clsNum: metric('cumulative-layout-shift'), tbtMs: metric('total-blocking-time') === null ? null : Math.round(metric('total-blocking-time')!), source: 'pagespeed',
    };
}

