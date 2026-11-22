import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { HoverTip } from './HoverTip.tsx';

test('description starts hidden with an accessible keyboard trigger and stable relationship', () => {
  const html = renderToStaticMarkup(<HoverTip description="Keterangan tambahan">Judul singkat</HoverTip>);
  assert.match(html, /data-tip-trigger="true"/);
  assert.match(html, /role="button"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-describedby="[^"]+"/);
  assert.match(html, /role="tooltip"[^>]*hidden=""/);
});

test('passive tooltip text inside a button does not create a nested keyboard target', () => {
  const html = renderToStaticMarkup(<button><HoverTip passive description="Petunjuk">Pilih standar</HoverTip></button>);
  assert.doesNotMatch(html, /tabindex|role="button"/);
  assert.match(html, /Petunjuk/);
});
