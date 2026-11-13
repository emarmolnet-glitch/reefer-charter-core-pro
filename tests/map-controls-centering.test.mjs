import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('map controls container is centered horizontally at the top using Tailwind classes', () => {
  // Container div must contain the specified Tailwind centering structure
  assert.match(
    indexSource,
    /class="[^"]*absolute top-4 left-1\/2 -translate-x-1\/2 flex gap-2 justify-center[^"]*"/
  );

  // Both control buttons must be preserved inside the container
  assert.match(indexSource, /id="btn-map-toggle-input"[^>]*onclick="toggleRouteInputPanel\(\)"/);
  assert.match(indexSource, /id="btn-map-fullscreen"[^>]*onclick="toggleRouteMapFullscreen\(\)"/);
});

test('map-control-stack CSS is centered without right-side positioning conflict', () => {
  // The CSS rule should center horizontally and avoid right: 18px
  const cssMatch = indexSource.match(/\.map-control-stack\s*\{([^}]+)\}/);
  assert.ok(cssMatch, '.map-control-stack CSS rule should exist');
  const cssBody = cssMatch[1];

  assert.match(cssBody, /left:\s*50%/);
  assert.match(cssBody, /transform:\s*translateX\(-50%\)/);
  assert.doesNotMatch(cssBody, /right:\s*18px/);
});
