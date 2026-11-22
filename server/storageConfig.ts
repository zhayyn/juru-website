import path from 'node:path';

interface StorageConfig { enabled: boolean; path?: string; savedReportsEnabled: boolean }

/** Local persistence is private by default; hosted disk availability must be explicit. */
export function resolveStorageConfig(env: NodeJS.ProcessEnv, home: string): StorageConfig {
  const loopback = ['127.0.0.1', '::1', 'localhost'].includes(env.HOST || '127.0.0.1');
  if (env.AUDIT_STORAGE_ENABLED !== undefined && !['true', 'false'].includes(env.AUDIT_STORAGE_ENABLED)) throw new Error('Konfigurasi penyimpanan tidak valid.');
  const enabled = env.AUDIT_STORAGE_ENABLED === 'true' || (loopback && env.AUDIT_STORAGE_ENABLED !== 'false');
  if (!enabled) return { enabled: false, savedReportsEnabled: false };
  if (!loopback && !env.AUDIT_DB_PATH) throw new Error('Jalur database pada volume persisten diperlukan.');
  const dbPath = env.AUDIT_DB_PATH || path.join(home, '.local/share/juru-website/audits.sqlite');
  if (!path.isAbsolute(dbPath)) throw new Error('Jalur database harus absolut.');
  return { enabled: true, path: dbPath, savedReportsEnabled: loopback };
}
