import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { resolveStorageConfig } from './server/storageConfig.ts';
import { createAuditStore } from './server/auditStore.ts';
import { createAuditApi } from './server/api.ts';
import { assertPublicTarget, fetchPublicHtml } from './server/publicTarget.ts';
import { fetchPageSpeed } from './server/pageSpeed.ts';
import { localMeasurementEnabled } from './server/localLighthouse.ts';
import { analyzeWithAi } from './server/aiProvider.ts';
import { publishRanking } from './server/rankingStore.ts';
import { inspectModernWebSignals } from './src/utils/auditLogic.ts';
import { parsePilotConfig, createPilotGate, assertPilotTarget } from './server/pilotGuard.ts';

const directory = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const allowedHosts = (process.env.ALLOWED_HOSTS || `127.0.0.1:${port},localhost:${port}`).split(',').map(s => s.trim()).filter(Boolean);

async function startServer() {
  const pilot = parsePilotConfig(process.env);
  const localMeasurement = localMeasurementEnabled(process.env);
  const validateTarget = (url: string) => assertPilotTarget(url, pilot);
  const storageConfig = resolveStorageConfig(process.env, homedir());
  let store: ReturnType<typeof createAuditStore> | undefined;
  if (storageConfig.enabled) {
    try { store = createAuditStore(storageConfig.path!); }
    catch { /* Audit remains usable; the response will explicitly report failed storage. */ }
  }
  const app = express();
  app.disable('x-powered-by');
  app.use(createPilotGate(pilot));
  app.use((req, res, next) => {
    if (!allowedHosts.includes(req.get('host') || '')) { res.status(403).json({ error: 'Host tidak diizinkan.' }); return; }
    next();
  });
  app.use(createAuditApi({
    validate: async url => { validateTarget(url); await assertPublicTarget(url); },
    probe: async url => {
      const result = await fetchPublicHtml(url, { validateTarget });
      validateTarget(result.url);
      const title = result.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300) || null;
      return { url: result.url, html: result.html, technicalSignals: {
        statusCode: result.status, httpsValid: result.url.startsWith('https://'), title,
        hasViewportMeta: /<meta\b(?=[^>]*\bname\s*=\s*["']viewport["'])[^>]*>/i.test(result.html),
        responseTimeMs: result.responseTimeMs,
        securityHeaders: {
          hsts: Boolean(result.headers['strict-transport-security']),
          xFrameOptions: Boolean(result.headers['x-frame-options']),
          xContentTypeOptions: Boolean(result.headers['x-content-type-options']),
          csp: Boolean(result.headers['content-security-policy']),
        },
        modernWeb: inspectModernWebSignals(result.html, result.url),
      } };
    },
    measure: localMeasurement ? async (url, strategy) => {
      const { fetchLocalLighthouse } = await import('./server/localLighthouse.ts');
      return fetchLocalLighthouse(url, strategy);
    } : fetchPageSpeed,
    analyze: async prompt => {
      if (process.env.AI_PROVIDER === 'gemini' && process.env.GEMINI_FREE_TIER_CONFIRMED !== 'true') throw new Error('Konfirmasi proyek Gemini unpaid diperlukan.');
      return analyzeWithAi(prompt);
    },
    publish: report => publishRanking(report),
    ...(storageConfig.enabled ? {
      persist: async report => {
        if (!store || store.save(report).status !== 'saved') throw new Error('Penyimpanan tidak tersedia.');
      },
      readSaved: async id => {
        if (!store) throw new Error('Penyimpanan tidak tersedia.');
        return store.get(id);
      },
    } : {}),
  }, { allowedHosts, savedReportsEnabled: storageConfig.savedReportsEnabled }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', methodology: 'technical-v1' }));
  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Endpoint tidak tersedia.' }); });
  if (process.env.NODE_ENV !== 'production') {
    const { createDevelopmentServer } = await import('./server/development.ts');
    const vite = await createDevelopmentServer();
    app.use(vite.middlewares);
  } else {
    const dist = path.resolve(directory, 'dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  const server = app.listen(port, host, () => console.log(`Juru Website: http://${host}:${port}`));
  const closeStore = () => { store?.close(); store = undefined; };
  server.once('error', () => { closeStore(); process.exitCode = 1; });
  const shutdown = () => {
    const deadline = setTimeout(() => { closeStore(); process.exit(1); }, 5000);
    deadline.unref();
    server.close(() => { clearTimeout(deadline); closeStore(); process.exit(0); });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
startServer().catch(() => { console.error('Server gagal dimulai; periksa konfigurasi lokal.'); process.exit(1); });
