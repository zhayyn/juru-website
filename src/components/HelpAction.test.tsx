import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { HelpAction, buildHelpUrl } from './HelpAction.tsx';

test('contextual assistance goes only to the configured number and produces a draft without full report data', () => {
  const target = new URL(buildHelpUrl('pa-semarang.go.id', 'Kecepatan konten utama'));
  assert.equal(target.origin, 'https://wa.me');
  assert.equal(target.pathname, '/6281317361689');
  assert.match(target.searchParams.get('text')!, /pa-semarang.go.id/);
  assert.match(target.searchParams.get('text')!, /Kecepatan konten utama/);
  assert.doesNotMatch(target.searchParams.get('text')!, /jamin|pasti|400/);
});

test('print copy preserves source attribution including AI confirmation limits', () => {
  for (const source of ['AI — perlu konfirmasi', 'Pengukuran', 'Indikator']) {
    const html = renderToStaticMarkup(<HelpAction domain="example.com" area="Sumber uji" severity="Rendah" source={source} issue="Temuan sintetis" />);
    const print = html.match(/<div class="action-print-note[^>]*>([\s\S]*?)<\/div>/)?.[1];
    assert.ok(print);
    assert.ok(print.includes(source), `Print must preserve ${source}`);
  }
});

test('assistance disclosure is explicit, initially hidden, escaped and safe to open voluntarily', () => {
  const html = renderToStaticMarkup(<HelpAction domain="example.com" area="<script>" severity="Tinggi" />);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /data-priority="tinggi"/);
  assert.match(html, /Prioritas Tinggi/);
  assert.match(html, /hidden=""/);
  assert.match(html, /Minta bantuan via WhatsApp/);
  assert.match(html, /tidak mengirim otomatis/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /<script>|onmouseover=|window.location/);
});
