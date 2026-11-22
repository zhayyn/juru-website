import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchLocalLighthouse, localMeasurementEnabled, runLocalLighthouse } from './localLighthouse.ts';

const fixture = { requestedUrl: 'https://example.com/', finalUrl: 'https://example.com/', lighthouseVersion: '13.6.0', fetchTime: '2026-11-21T02:00:00Z', categories: { performance: { score: .42 }, accessibility: { score: .8 }, 'best-practices': { score: .9 }, seo: { score: .7 } }, audits: {} };
test('local Lighthouse returns real runner categories with distinct source and provenance', async () => {
  const metrics = await fetchLocalLighthouse('https://example.com/', 'MOBILE', async () => fixture);
  assert.equal(metrics.source, 'lighthouse_local');
  assert.equal(metrics.performanceScore, 42);
  assert.equal(metrics.accessibilityScore, 80);
  assert.equal(metrics.lighthouseVersion, '13.6.0');
  assert.equal(metrics.measuredAt, fixture.fetchTime);
});
test('local Lighthouse rejects foreign identity, runtime error and runner failure without invented scores', async () => {
  for (const value of [{ ...fixture, finalUrl: 'https://other.example/' }, { ...fixture, runtimeError: { code: 'FAILED' } }]) {
    const metrics = await fetchLocalLighthouse('https://example.com/', 'MOBILE', async () => value);
    assert.equal(metrics.performanceScore, null);
    assert.equal(metrics.source, 'server_probe');
  }
  const metrics = await fetchLocalLighthouse('https://example.com/', 'MOBILE', async () => { throw Error('private message'); });
  assert.equal(metrics.performanceScore, null);
  assert.ok(!JSON.stringify(metrics).includes('private message'));
});
test('local browser measurement requires explicit local mode and loopback server; HTTPS target only', async () => {
  assert.equal(localMeasurementEnabled({}), false);
  assert.equal(localMeasurementEnabled({ MEASUREMENT_PROVIDER: 'lighthouse_local', HOST: '127.0.0.1' }), true);
  assert.throws(() => localMeasurementEnabled({ MEASUREMENT_PROVIDER: 'lighthouse_local', HOST: '0.0.0.0' }));
  let ran = false;
  const metrics = await fetchLocalLighthouse('http://example.com/', 'MOBILE', async () => { ran = true; return fixture; });
  assert.equal(ran, false);
  assert.equal(metrics.performanceScore, null);
});

test('runLocalLighthouse times out when Chrome launch hangs, closes proxy, and cleans up late Chrome', async () => {
  let proxyClosed = false;
  let lateChromeKilled = false;
  let resolveLaunch!: (instance: { port: number; kill: () => void }) => void;

  await assert.rejects(
    runLocalLighthouse('https://example.com/', 'MOBILE', {
      startProxy: async () => ({
        port: 41234,
        close: async () => {
          proxyClosed = true;
        },
      }),
      launchChrome: () =>
        new Promise((resolve) => {
          resolveLaunch = resolve;
        }),
      runLighthouse: async () => {
        throw new Error('runLighthouse should not be called after launch timeout');
      },
      timeoutMs: 25,
      killTimeoutMs: 25,
    }),
    /Local audit timeout/,
  );

  assert.equal(proxyClosed, true);

  resolveLaunch({
    port: 9222,
    kill: () => {
      lateChromeKilled = true;
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(lateChromeKilled, true);
});

test('runLocalLighthouse bounds hanging chrome.kill so proxy.close still completes', async () => {
  let proxyClosed = false;

  const lhr = await runLocalLighthouse('https://example.com/', 'MOBILE', {
    startProxy: async () => ({
      port: 41235,
      close: async () => {
        proxyClosed = true;
      },
    }),
    launchChrome: async () => ({
      port: 9222,
      kill: () => new Promise<void>(() => {}),
    }),
    runLighthouse: async () => ({ lhr: fixture as never }),
    timeoutMs: 250,
    killTimeoutMs: 25,
  });

  assert.equal(lhr, fixture);
  assert.equal(proxyClosed, true);
});

test('runLocalLighthouse closes proxy even when chrome.kill rejects', async () => {
  let proxyClosed = false;

  const lhr = await runLocalLighthouse('https://example.com/', 'MOBILE', {
    startProxy: async () => ({
      port: 41236,
      close: async () => {
        proxyClosed = true;
      },
    }),
    launchChrome: async () => ({
      port: 9222,
      kill: () => Promise.reject(new Error('kill failed')),
    }),
    runLighthouse: async () => ({ lhr: fixture as never }),
    timeoutMs: 250,
    killTimeoutMs: 25,
  });

  assert.equal(lhr, fixture);
  assert.equal(proxyClosed, true);
});
