import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

type PilotConfig = { accessToken: string | null; allowedTargets: string[] };

export function createPilotGate(config: PilotConfig): RequestHandler {
  const expected = config.accessToken === null ? null : Buffer.from(`prakom:${config.accessToken}`, 'utf8');
  return (req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'X-Frame-Options': 'DENY',
    });
    if (expected === null || (req.method === 'GET' && req.originalUrl.split('?')[0] === '/api/health')) {
      next();
      return;
    }
    const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(req.get('authorization') || '');
    if (match) {
      const candidate = Buffer.from(match[1], 'base64');
      const canonical = candidate.toString('base64') === match[1];
      // Pad unequal inputs to avoid crypto exceptions; never accept padded credentials.
      const sameLength = candidate.length === expected.length;
      const equal = timingSafeEqual(sameLength ? candidate : Buffer.alloc(expected.length), expected);
      if (canonical && sameLength && equal) {
        next();
        return;
      }
    }
    res.set('WWW-Authenticate', 'Basic realm="Juru Website Pilot", charset="UTF-8"');
    res.set('Cache-Control', 'no-store');
    res.status(401).type('text/plain').send('Authentication required.');
  };
}

export function assertPilotTarget(url: string, config: PilotConfig): void {
  if (!config.allowedTargets.length) return;
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error('Pilot target is not allowed.');
  }
  if (!config.allowedTargets.includes(hostname)) throw new Error('Pilot target is not allowed.');
}

// Syntax only: public IP resolution and redirect safety remain the caller's SSRF boundary.
function isDomain(host: string): boolean {
  const labels = host.split('.');
  const reserved = /(?:^|\.)(?:localhost|localdomain|local|internal|lan|home|test|invalid|example|onion|arpa|corp|svc|cluster|private|alt)$/;
  return host.length <= 253 && labels.length >= 2 && !reserved.test(host)
    && labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
    && /^(?:[a-z]{2,63}|xn--[a-z0-9-]+)$/.test(labels.at(-1)!);
}

export function parsePilotConfig(env: NodeJS.ProcessEnv): PilotConfig {
  const accessToken = env.PILOT_ACCESS_TOKEN || null;
  if (accessToken !== null && (accessToken.length < 24 || !accessToken.trim() || /[:\x00-\x1f\x7f]/.test(accessToken))) {
    throw new Error('Invalid pilot access token configuration.');
  }
  const rawTargets = env.PILOT_ALLOWED_TARGETS || '';
  if (/[^\x20-\x7e]/.test(rawTargets)) throw new Error('Invalid pilot target configuration.');
  const targets = rawTargets ? rawTargets.split(',').map(value => value.trim().toLowerCase()) : [];
  if (targets.some(value => !isDomain(value))) throw new Error('Invalid pilot target configuration.');
  const allowedTargets = [...new Set(targets)];
  const host = env.HOST || '127.0.0.1';
  const explicitHosts = (env.ALLOWED_HOSTS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)
    && (!accessToken || !explicitHosts.length || !allowedTargets.length)) {
    throw new Error('Non-loopback pilot binding requires explicit access and host/target allowlists.');
  }
  return { accessToken, allowedTargets };
}
