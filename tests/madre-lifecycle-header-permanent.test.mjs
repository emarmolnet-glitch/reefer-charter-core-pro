import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [appJsxSource, globalMadreSource, indexHtmlSource] = await Promise.all([
  readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/GlobalMadreDrawer.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
]);

test('1. GlobalMadreDrawer: handleOpen natively rejects non-user events and calculation triggers', () => {
  // Verifies the exact required guard in handleOpen
  assert.match(
    globalMadreSource,
    /if\s*\(\s*e\?\.detail\?\.fromCalculation\s*\|\|\s*e\?\.fromCalculation\s*\|\|\s*e\?\.detail\?\.autoOpen\s*===\s*false\s*\|\|\s*\(e\s*&&\s*e\.isTrusted\s*===\s*false\s*&&\s*!e\?\.detail\?\.userInitiated\)\s*\)/
  );
});

test('2. GlobalMadreDrawer: radar:alert listener injects into chat without opening drawer', () => {
  assert.match(globalMadreSource, /window\.addEventListener\(["']radar:alert["'],\s*handleRadarAlert\)/);
  assert.match(globalMadreSource, /window\.removeEventListener\(["']radar:alert["'],\s*handleRadarAlert\)/);

  // handleRadarAlert calls setMensajes and does NOT call setIsOpen(true)
  const radarAlertStart = globalMadreSource.indexOf('const handleRadarAlert =');
  const radarAlertEnd = globalMadreSource.indexOf('window.addEventListener("madre:open"', radarAlertStart);
  assert.ok(radarAlertStart !== -1 && radarAlertEnd !== -1, 'handleRadarAlert must exist');

  const radarAlertCode = globalMadreSource.slice(radarAlertStart, radarAlertEnd);
  assert.match(radarAlertCode, /setMensajes\(/);
  assert.doesNotMatch(radarAlertCode, /setIsOpen\s*\(\s*true\s*\)/);
});

test('3. App.jsx: Header visibility is permanently locked to true', () => {
  // getStoredHeaderVisibility returns true
  assert.match(appJsxSource, /export\s+function\s+getStoredHeaderVisibility/);
  // setStoredHeaderVisibility forces true
  assert.match(appJsxSource, /const\s+boolVal\s*=\s*true/);

  // useHeaderVisibility initializes and keeps true
  assert.match(appJsxSource, /window\.setHeaderVisibility\s*=\s*\(val\)\s*=>\s*\{[\s\S]*?const\s+next\s*=\s*true/);
  assert.match(appJsxSource, /window\.toggleHeaderVisibility\s*=\s*\(\)\s*=>\s*\{[\s\S]*?const\s+next\s*=\s*true/);

  // handleVisibilityEvent ignores false
  assert.match(appJsxSource, /if\s*\(\s*nextVal\s*===\s*false\s*\)\s*\{\s*return;\s*\}/);
});

test('4. index.html: applyHeaderVisibility and setHeaderVisibility permanently enforce true', () => {
  assert.match(indexHtmlSource, /function\s+applyHeaderVisibility\(visible,\s*smooth\s*=\s*true\)\s*\{[\s\S]*?const\s+isVisible\s*=\s*true;/);
  assert.match(indexHtmlSource, /function\s+setHeaderVisibility\(visible\)\s*\{[\s\S]*?const\s+next\s*=\s*true;/);
});
