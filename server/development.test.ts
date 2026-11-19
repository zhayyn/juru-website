import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { Server } from 'node:net';
import { homedir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('development entry delegates to the hardened helper rather than creating Vite directly', async () => {
  const entry = await readFile(new URL('../server.ts', import.meta.url), 'utf8');
  const developmentBranch = entry.split("if (process.env.NODE_ENV !== 'production') {")[1]?.split('} else {')[0];
  assert.ok(developmentBranch, 'development startup branch exists');
  assert.match(developmentBranch, /import\(['"]\.\/server\/development\.ts['"]\)/);
  assert.match(developmentBranch, /await createDevelopmentServer\(\)/);
  assert.doesNotMatch(entry, /import\(['"]vite['"]\)/, 'entry must not bypass the hardened helper');
});

// One real-Vite regression tracer: resolved project config, then middleware runtime.
// Reject EVERY TCP listen before the OS sees it, including wildcard/ephemeral binds.
test('development middleware cannot open a WebSocket listener under any DISABLE_HMR setting', { timeout: 30_000 }, async () => {
  const originalCwd = process.cwd();
  const originalDisableHmr = process.env.DISABLE_HMR;
  const originalListen = Server.prototype.listen;
  const projectConfig = fileURLToPath(new URL('../vite.config.ts', import.meta.url));
  const scratch = process.env.TMPDIR || path.join(homedir(), '.hermes/cache/scratch');
  const fixture = await mkdtemp(path.join(scratch, 'juru-dev-websocket-'));
  const attemptedListeners: unknown[][] = [];

  Server.prototype.listen = function (...args: unknown[]) {
    attemptedListeners.push(args);
    throw new Error('Blocked unexpected standalone TCP/WebSocket listener');
  } as typeof Server.prototype.listen;

  try {
    // Reuse the real project config from an empty root, never the app or its .env.
    await writeFile(path.join(fixture, 'vite.config.mts'),
      `import config from ${JSON.stringify(projectConfig)};\n` +
      `export default (env) => ({ ...config(env), envDir: false, logLevel: 'silent', optimizeDeps: { noDiscovery: true, include: [] } });\n`);
    process.chdir(fixture);
    const { resolveConfig } = await import('vite');

    for (const disableHmr of [undefined, 'false', 'true']) {
      if (disableHmr === undefined) delete process.env.DISABLE_HMR;
      else process.env.DISABLE_HMR = disableHmr;
      const label = `DISABLE_HMR=${disableHmr ?? '<unset>'}`;
      // envDir:false also prevents config-only checks from reading any .env.
      const merged = await resolveConfig({ root: fixture, configFile: projectConfig, envDir: false, logLevel: 'silent' }, 'serve');
      assert.deepEqual({ ws: merged.server.ws, hmr: merged.server.hmr },
        { ws: false, hmr: false }, `${label}: project config must disable both transports`);
      assert.deepEqual(merged.server.watch, disableHmr === 'true' ? null : {},
        `${label}: preserve watcher opt-out semantics`);

      const { createDevelopmentServer } = await import('./development.ts');
      const vite = await createDevelopmentServer();
      try {
        assert.deepEqual({ ws: vite.config.server.ws, hmr: vite.config.server.hmr,
          middlewareMode: vite.config.server.middlewareMode, appType: vite.config.appType },
        { ws: false, hmr: false, middlewareMode: true, appType: 'spa' }, label);
        assert.deepEqual(vite.config.server.watch, disableHmr === 'true' ? null : {});
        assert.equal(vite.httpServer, null, `${label}: middleware must not own HTTP listener`);
        // Exercise Vite's own WS listen entry point as well as createServer startup.
        vite.ws.listen();
        assert.equal(vite.ws.clients.size, 0);
        assert.deepEqual(attemptedListeners, [], `${label}: no listener on ANY interface`);
      } finally {
        await vite.close();
      }
    }
  } finally {
    Server.prototype.listen = originalListen;
    process.chdir(originalCwd);
    if (originalDisableHmr === undefined) delete process.env.DISABLE_HMR;
    else process.env.DISABLE_HMR = originalDisableHmr;
    await rm(fixture, { recursive: true, force: true });
  }
});
