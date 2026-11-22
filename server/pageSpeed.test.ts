import test from 'node:test';
import assert from 'node:assert/strict';
import * as pageSpeed from './pageSpeed.ts';

test('PageSpeed mengurai nilai valid dan membatasi skor/NaN serta mengirim satu permintaan', async () => {
  let requested = '';
  const data = { lighthouseResult: { requestedUrl: 'https://example.com/', finalUrl: 'https://example.com/', categories: { performance: { score: .8 }, accessibility: { score: null }, 'best-practices': { score: 5 }, seo: { score: .9 } },
    audits: { 'largest-contentful-paint': { numericValue: 2345.6, displayValue: '2.3 s' }, 'cumulative-layout-shift': { numericValue: .031 } } } };
  const result = await pageSpeed.fetchPageSpeed('https://example.com/', 'MOBILE', async (url) => { requested = String(url); return Response.json(data); });
  assert.equal(result.performanceScore, 80);
  assert.equal(result.accessibilityScore, null);
  assert.equal(result.bestPracticesScore, null);
  assert.equal(result.seoScore, 90);
  assert.equal(result.lcpMs, 2346);
  assert.equal(result.clsNum, .031);
  assert.equal(result.source, 'pagespeed');
  assert.equal(result.requestedUrl, 'https://example.com/');
  assert.equal(result.finalUrl, 'https://example.com/');
  assert.equal(new URL(requested).searchParams.getAll('category').length, 4);
});

test('PageSpeed menolak skor untuk URL akhir yang berbeda dari halaman probe', async () => {
  const result = await pageSpeed.fetchPageSpeed('https://example.com/', 'MOBILE', async () => Response.json({
    lighthouseResult: {
      requestedUrl: 'https://example.com/', finalUrl: 'https://outside-pilot.example/secret-path',
      categories: { performance: { score: 1 }, accessibility: { score: 1 }, 'best-practices': { score: 1 }, seo: { score: 1 } },
    },
  }));
  assert.equal(result.performanceScore, null);
  assert.equal(result.source, 'server_probe');
  assert.ok(!JSON.stringify(result).includes('secret-path'));
});

test('runtimeError Lighthouse membatalkan semua skor walaupun kategori lengkap', async () => {
  const result = await pageSpeed.fetchPageSpeed('https://example.com/', 'MOBILE', async () => Response.json({
    lighthouseResult: {
      requestedUrl: 'https://example.com/', finalUrl: 'https://example.com/',
      runtimeError: { code: 'SYNTHETIC_FAILURE', message: 'upstream-private-error' },
      categories: { performance: { score: 1 }, accessibility: { score: 1 }, 'best-practices': { score: 1 }, seo: { score: 1 } },
    },
  }));
  assert.equal(result.performanceScore, null);
  assert.equal(result.source, 'server_probe');
  assert.ok(!JSON.stringify(result).includes('upstream-private-error'));
});

test('identitas permintaan PageSpeed wajib tersedia dan cocok dengan probe', async () => {
  for (const requestedUrl of [undefined, '', 'https://other.example/', 'https://example.com/profil']) {
    const result = await pageSpeed.fetchPageSpeed('https://example.com/', 'MOBILE', async () => Response.json({
      lighthouseResult: {
        requestedUrl, finalUrl: 'https://example.com/',
        categories: { performance: { score: 1 }, accessibility: { score: 1 }, 'best-practices': { score: 1 }, seo: { score: 1 } },
      },
    }));
    assert.equal(result.performanceScore, null, `requestedUrl=${requestedUrl}`);
    assert.equal(result.source, 'server_probe');
  }
});

test('identitas akhir harus lengkap dan identik; tidak melonggarkan host, path, skema, query atau fragmen', async () => {
  const categories = { performance: { score: 1 }, accessibility: { score: 1 }, 'best-practices': { score: 1 }, seo: { score: 1 } };
  for (const finalUrl of [undefined, '', 'not a URL', '/relative', 'https://www.example.com/', 'https://example.com/profil', 'http://example.com/', 'https://example.com/?q=1', 'https://example.com/#changed', 'https://user@example.com/']) {
    const result = await pageSpeed.fetchPageSpeed('https://example.com/', 'MOBILE', async () => Response.json({
      lighthouseResult: { requestedUrl: 'https://example.com/', finalUrl, categories },
    }));
    assert.equal(result.performanceScore, null, `finalUrl=${finalUrl}`);
    assert.equal(result.source, 'server_probe');
  }
  const canonical = await pageSpeed.fetchPageSpeed('https://example.com/', 'MOBILE', async () => Response.json({
    lighthouseResult: { requestedUrl: 'https://EXAMPLE.com:443', finalUrl: 'https://example.com', categories },
  }));
  assert.equal(canonical.performanceScore, 100);
  assert.equal(canonical.finalUrl, 'https://example.com/');
});

test('kegagalan PageSpeed menghasilkan metrik null tanpa pengganti waktu server', async () => {
  let calls = 0;
  const result = await pageSpeed.fetchPageSpeed('https://example.com/', 'MOBILE', async () => { calls++; return new Response('{"error":{"message":"do not leak upstream details"}}', { status: 429 }); });
  assert.equal(calls, 1);
  assert.equal(result.performanceScore, null);
  assert.equal(result.lcpMs, null);
  assert.match(result.fetchWarning!, /429/);
  assert.ok(!result.fetchWarning!.includes('leak'));
});

test('opsional key PageSpeed dikirim hanya ke Google di header server, bukan URL atau laporan', async () => {
  let endpoint = '';
  let header = '';
  const fetcher: typeof fetch = async (url, init) => {
    endpoint = String(url);
    header = new Headers(init?.headers).get('x-goog-api-key') || '';
    return new Response('{}', { status: 429 });
  };
  const result = await pageSpeed.fetchPageSpeed('https://example.com/', 'MOBILE', fetcher, { PAGESPEED_API_KEY: 'synthetic-key-for-injection-only' });
  assert.equal(new URL(endpoint).origin, 'https://www.googleapis.com');
  assert.equal(new URL(endpoint).searchParams.has('key'), false);
  assert.equal(header, 'synthetic-key-for-injection-only');
  assert.ok(!JSON.stringify(result).includes('synthetic-key'));
});
