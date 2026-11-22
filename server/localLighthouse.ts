import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import type { AuditStrategy, PageSpeedMetrics } from '../src/types/audit.ts';
import { missingPageSpeed, parseLighthouseResult } from './pageSpeed.ts';

export interface LocalChromeInstance {
  port: number;
  kill: () => unknown;
}

export interface LocalLighthouseDeps {
  startProxy?: () => Promise<{ port: number; close: () => Promise<void> }>;
  launchChrome?: (opts?: Parameters<typeof launch>[0]) => Promise<LocalChromeInstance>;
  runLighthouse?: (
    url: string,
    flags: Parameters<typeof lighthouse>[1],
    config?: Parameters<typeof lighthouse>[2],
  ) => Promise<{ lhr?: unknown } | undefined>;
  timeoutMs?: number;
  killTimeoutMs?: number;
}

export function localMeasurementEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  if (env.MEASUREMENT_PROVIDER !== 'lighthouse_local') return false;
  if (!['127.0.0.1', 'localhost', '::1'].includes(env.HOST || '127.0.0.1')) throw new Error('Local Lighthouse requires loopback binding.');
  return true;
}

async function killChromeBounded(instance: LocalChromeInstance | undefined, killTimeoutMs: number): Promise<void> {
  if (!instance) return;
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(() => instance.kill()).catch(() => undefined),
      new Promise<void>((resolve) => {
        // This deadline must keep Node alive until cleanup can close the proxy.
        killTimer = setTimeout(resolve, killTimeoutMs);
      }),
    ]);
  } catch {
    // Ignore cleanup errors so proxy shutdown always executes.
  } finally {
    clearTimeout(killTimer);
  }
}

export async function runLocalLighthouse(
  url: string,
  strategy: AuditStrategy,
  deps: LocalLighthouseDeps = {},
): Promise<unknown> {
  const startProxy = deps.startProxy ?? (async () => (await import('./lighthouseProxy.ts')).startLighthouseProxy());
  const launchChrome = deps.launchChrome ?? launch;
  const runLighthouse = deps.runLighthouse ?? lighthouse;
  const timeoutMs = deps.timeoutMs ?? 150_000;
  const killTimeoutMs = deps.killTimeoutMs ?? 5_000;

  const proxy = await startProxy();
  let chrome: LocalChromeInstance | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const work = (async () => {
    const launched = await launchChrome({
      chromePath: process.env.LIGHTHOUSE_CHROME_PATH || undefined,
      chromeFlags: [
        '--headless=new', '--disable-quic', '--disable-background-networking',
        '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
        `--proxy-server=http://127.0.0.1:${proxy.port}`, '--proxy-bypass-list=<-loopback>',
      ],
    });
    if (timedOut) {
      await killChromeBounded(launched, killTimeoutMs);
      throw new Error('Local audit timeout.');
    }
    chrome = launched;
    const result = await runLighthouse(
      url,
      {
        port: launched.port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        maxWaitForLoad: 45_000,
      },
      strategy === 'DESKTOP' ? desktopConfig : undefined,
    );
    if (!result?.lhr) throw new Error('No Lighthouse result.');
    return result.lhr;
  })();

  // Prevent unhandled rejection when work fails after the timeout race settles.
  work.catch(() => {});

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(new Error('Local audit timeout.'));
    }, timeoutMs);
    // Awaited work may have no live handles (for example a stalled Chrome launch).
    // Keep its deadline referenced so the promise always settles before shutdown.
  });

  try {
    return await Promise.race([work, timeoutPromise]);
  } finally {
    clearTimeout(timer);
    try {
      await killChromeBounded(chrome, killTimeoutMs);
    } finally {
      await proxy.close();
    }
  }
}

export async function fetchLocalLighthouse(url: string, strategy: AuditStrategy, runner: (url: string, strategy: AuditStrategy) => Promise<unknown> = runLocalLighthouse): Promise<PageSpeedMetrics> {
  try {
    if (new URL(url).protocol !== 'https:') return missingPageSpeed('Lighthouse lokal hanya mendukung HTTPS publik.');
    const raw = await runner(url, strategy);
    const metrics = parseLighthouseResult(url, raw);
    if (metrics.source !== 'pagespeed') return metrics;
    const data = raw as { lighthouseVersion?: unknown; fetchTime?: unknown };
    return { ...metrics, source: 'lighthouse_local', lighthouseVersion: typeof data.lighthouseVersion === 'string' ? data.lighthouseVersion.slice(0, 30) : undefined, measuredAt: typeof data.fetchTime === 'string' ? data.fetchTime.slice(0, 40) : undefined };
  } catch { return missingPageSpeed('Lighthouse lokal gagal atau melewati batas waktu; tidak ada skor pengganti.'); }
}
