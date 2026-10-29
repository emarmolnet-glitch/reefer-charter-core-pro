import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [assistantEntrySource, dssSource, globalMadreSource] = await Promise.all([
  readFile(new URL('../src/sea-assistant-entry.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/DecisionSupportModule.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/GlobalMadreDrawer.jsx', import.meta.url), 'utf8'),
]);

test('1. sea-assistant-entry.js: Calculation resolution does not force panel open', () => {
  assert.match(
    assistantEntrySource,
    /isFromCalculation\s*=\s*Boolean\(\s*options\.fromCalculation\s*\|\|\s*options\.background/
  );
  assert.match(
    assistantEntrySource,
    /if\s*\(!isFromCalculation\s*&&\s*options\.userInitiated\s*===\s*true\)\s*\{\s*setOpen\(true\);\s*\}/
  );
});

test('2. DecisionSupportModule.js: renderizarAuditoriaDss keeps card hidden in background', () => {
  const renderAuditStart = dssSource.indexOf('export function renderizarAuditoriaDss');
  const renderAuditEnd = dssSource.indexOf('export function abrirAuditoriaMadreOffcanvas', renderAuditStart);
  assert.ok(renderAuditStart !== -1 && renderAuditEnd !== -1, 'renderizarAuditoriaDss must exist');

  const renderAuditCode = dssSource.slice(renderAuditStart, renderAuditEnd);
  assert.doesNotMatch(renderAuditCode, /cardContainer\.classList\.remove\(['"]hidden['"]\)/);
});

test('3. GlobalMadreDrawer.jsx: Passive glow notification is exported and supported', () => {
  assert.match(globalMadreSource, /export function triggerMadrePassiveGlow/);
  assert.match(globalMadreSource, /madre:notification/);
  assert.match(globalMadreSource, /has-passive-glow/);
});

test('4. GlobalMadreDrawer.jsx: MadrePanelUI.open rejects automatic calculation triggers', () => {
  assert.match(
    globalMadreSource,
    /open:\s*\(opts\)\s*=>\s*\{[\s\S]*?if\s*\(opts\?\.fromCalculation\s*\|\|\s*opts\?\.autoOpen\s*===\s*false\s*\|\|\s*!opts\?\.userInitiated\)\s*return;/
  );
});
