import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LeaderboardSection } from './LeaderboardSection.tsx';
import type { WebsiteRanking } from '../types/audit.ts';

const props = { rankings: [], isLoading: false, isSupabaseConnected: false, isRealtimeActive: false, errorMessage: null,
  onReaudit: () => {}, onViewHistory: () => {}, onOpenSupabaseModal: () => {} };

test('leaderboard explicitly scopes method and labels local session as not shared or official', () => {
  const html = renderToStaticMarkup(<LeaderboardSection {...props} />);
  assert.match(html, /Teknis • technical-v1 • MOBILE • beranda/);
  assert.match(html, /bukan ranking resmi\/kepatuhan/);
  assert.match(html, /Sesi Lokal.*tidak dibagikan/);
  assert.doesNotMatch(html, /Terhubung.*Otomatis/);
});

test('null scores are excluded rather than fabricated as zero', () => {
  const row: WebsiteRanking = { domain: 'example.com', site_name: 'Synthetic null', category: 'umum', total_score: null as unknown as number,
    score_delta: 0, grade: 'Tidak terukur', audit_count: 1, last_audited_at: '2026-11-17T00:00:00Z', pillar_scores: {}, findings_summary: '' };
  const html = renderToStaticMarkup(<LeaderboardSection {...props} rankings={[row]} />);
  assert.doesNotMatch(html, /Synthetic null/);
});
