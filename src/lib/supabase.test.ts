import test from 'node:test';
import assert from 'node:assert/strict';
import * as supabase from './supabase.ts';
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';

function readClient(rows: object[]) {
  const calls: unknown[][] = [];
  const query = {
    select(...args: unknown[]) { calls.push(['select', ...args]); return query; },
    eq(...args: unknown[]) { calls.push(['eq', ...args]); return query; },
    order(...args: unknown[]) { calls.push(['order', ...args]); return Promise.resolve({ data: rows, error: null }); },
  };
  const client = { from(table: string) { calls.push(['from', table]); return query; } } as unknown as SupabaseClient;
  return { client, calls };
}

test('cloud reads use trusted technical-v1 MOBILE tables and category-scoped history; no browser writer or executable setup SQL', async () => {
  const row = { domain: 'example.com', category: 'umum', total_score: 75, audited_at: '2026-11-17T00:00:00Z', last_audited_at: '2026-11-17T00:00:00Z' };
  const rankings = readClient([row, { ...row, total_score: null }]);
  assert.equal((await supabase.fetchRankings(rankings.client)).length, 1);
  assert.ok(rankings.calls.some(c => c[0] === 'from' && c[1] === 'jw_rankings_v1'));
  for (const filter of [['eq', 'strategy', 'MOBILE'], ['eq', 'methodology', 'technical-v1']]) assert.ok(rankings.calls.some(c => JSON.stringify(c) === JSON.stringify(filter)));
  const history = readClient([row]);
  await supabase.fetchAuditHistory('example.com', 'umum', history.client);
  for (const call of [['from', 'jw_audit_history_v1'], ['eq', 'category', 'umum'], ['eq', 'strategy', 'MOBILE'], ['eq', 'methodology', 'technical-v1']]) assert.ok(history.calls.some(c => JSON.stringify(c) === JSON.stringify(call)));
  const source = readFileSync(new URL('./supabase.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /recordWebsiteAudit|\.rpc\(/);
  assert.match(supabase.SUPABASE_SETUP_SQL, /supabase\/migrations\/202611170001_trusted_ranking.sql/);
  assert.match(supabase.SUPABASE_SETUP_SQL, /pemilik|owner/i);
  assert.doesNotMatch(supabase.SUPABASE_SETUP_SQL, /GRANT EXECUTE|CREATE TABLE|CREATE OR REPLACE FUNCTION/);
});

test('realtime is active only after SUBSCRIBED, resets on failure and cleanup', () => {
  let notify: (status: string) => void = () => {};
  const states: boolean[] = [];
  let removed = false;
  const channel = { on(_event: string, config: { table: string }, _cb: () => void) {
    assert.equal(config.table, 'jw_rankings_v1'); return channel;
  }, subscribe(callback: (status: string) => void) { notify = callback; return channel; } };
  const client = { channel: () => channel, removeChannel: () => { removed = true; } } as unknown as SupabaseClient;
  const stop = supabase.subscribeToRankings(() => {}, active => states.push(active), client);
  assert.deepEqual(states, [false]);
  notify('SUBSCRIBED'); notify('CHANNEL_ERROR'); notify('SUBSCRIBED'); stop();
  assert.deepEqual(states, [false, true, false, true, false]);
  assert.equal(removed, true);
});

test('configuration accepts public keys only and never exposes rejected key material', () => {
  const values = new Map<string, string>();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k),
  } } });
  const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.synthetic`;
  try {
    for (const bad of ['sb_secret_synthetic', jwt('service_role'), 'invalid-public-key']) {
      assert.throws(() => supabase.saveSupabaseConfig('https://example.com', bad), /publik|public|anon/i);
      values.set('webaudit_supabase_url', 'https://example.com'); values.set('webaudit_supabase_anon_key', bad);
      assert.equal(supabase.getSupabaseConfig().source, 'none');
    }
    for (const good of ['sb_publishable_synthetic', jwt('anon')]) {
      supabase.saveSupabaseConfig('https://example.com/', good);
      assert.equal(supabase.getSupabaseConfig().source, 'local');
    }
  } finally {
    supabase.clearSupabaseConfig();
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('connection success copy describes read access, not security or write readiness', () => {
  const source = readFileSync(new URL('./supabase.ts', import.meta.url), 'utf8');
  assert.match(source, /baca berhasil/i);
  assert.doesNotMatch(source, /tabel peringkat siap digunakan|Jalankan skrip SQL/);
});

test('SSR without browser environment has no configured Supabase client', () => {
  assert.deepEqual(supabase.getSupabaseConfig(), { url: '', anonKey: '', source: 'none' });
  assert.equal(supabase.getSupabaseClient(), null);
});
