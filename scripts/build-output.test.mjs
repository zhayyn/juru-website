import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('production CSS references only local assets present in dist, not classes found in evidence HTML', async () => {
  const assets = path.join(root, 'dist/assets');
  const cssFiles = (await readdir(assets)).filter(name => name.endsWith('.css'));
  assert.ok(cssFiles.length > 0, 'production CSS exists');
  for (const file of cssFiles) {
    const css = await readFile(path.join(assets, file), 'utf8');
    for (const match of css.matchAll(/url\(\s*["']?(\/[^\s"')]+)["']?\s*\)/g)) {
      const relative = decodeURIComponent(match[1].split(/[?#]/)[0]).replace(/^\/+/, '');
      await assert.doesNotReject(access(path.join(root, 'dist', relative)), `unresolved production asset: ${match[1]}`);
    }
  }
});
