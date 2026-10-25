import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [indexSource, appJsxSource, globalMadreSource, autoSizingSource, costEngineSource, tceWorkspaceSource, dssSource] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/GlobalMadreDrawer.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/hooks/useReeferAutoSizing.js', import.meta.url), 'utf8'),
  readFile(new URL('../voyage-cost-engine.js', import.meta.url), 'utf8'),
  readFile(new URL('../TceCalculatorWorkspace.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/DecisionSupportModule.js', import.meta.url), 'utf8'),
]);

test('1. Layout Integrity: Header and Sidebar layout elements are defined and visible by default', () => {
  assert.match(indexSource, /<header[^>]*class="app-header/);
  assert.match(indexSource, /<aside id="app-navigation-sidebar"/);
  assert.match(appJsxSource, /export\s+function\s+TopNav/);
  assert.match(appJsxSource, /useHeaderVisibility\(defaultVisible\s*=\s*true\)/);
});

test('2. Calculation Success Callback: handleMasterValidationAndCalculate does not apply focus mode or hide layout', () => {
  const handlerStart = indexSource.indexOf('async function handleMasterValidationAndCalculate');
  const handlerEnd = indexSource.indexOf('window.handleMasterValidationAndCalculate = handleMasterValidationAndCalculate;', handlerStart);
  assert.ok(handlerStart !== -1 && handlerEnd !== -1, 'handleMasterValidationAndCalculate must exist');

  const handlerCode = indexSource.slice(handlerStart, handlerEnd);

  // Must not hide header or sidebar
  assert.doesNotMatch(handlerCode, /header-collapsed/);
  assert.doesNotMatch(handlerCode, /applyHeaderVisibility\s*\(\s*false/);
  assert.doesNotMatch(handlerCode, /setHeaderVisibility\s*\(\s*false/);
  assert.doesNotMatch(handlerCode, /app-navigation-sidebar/);
  assert.doesNotMatch(handlerCode, /sidebar.*hidden/);

  // Must not trigger MADRE drawer
  assert.doesNotMatch(handlerCode, /MadrePanelUI/);
  assert.doesNotMatch(handlerCode, /madre:open/);
  assert.doesNotMatch(handlerCode, /madre:toggle/);
  assert.doesNotMatch(handlerCode, /abrirAuditoriaMadreOffcanvas/);
});

test('3. Mathematical Engine: runEngine does not manipulate layout or trigger MADRE', () => {
  const engineStart = indexSource.indexOf('function runEngine() {');
  const engineEnd = indexSource.indexOf('window.runEngine = runEngine;', engineStart);
  assert.ok(engineStart !== -1, 'runEngine must exist');

  const engineCode = indexSource.slice(engineStart, engineEnd > 0 ? engineEnd : engineStart + 5000);

  assert.doesNotMatch(engineCode, /applyHeaderVisibility\s*\(\s*false/);
  assert.doesNotMatch(engineCode, /setHeaderVisibility\s*\(\s*false/);
  assert.doesNotMatch(engineCode, /app-navigation-sidebar/);
  assert.doesNotMatch(handlerOrEngine(engineCode), /MadrePanelUI/);
  assert.doesNotMatch(engineCode, /madre:open/);
});

function handlerOrEngine(code) {
  return code.replace(/\/\/.*$/gm, '');
}

test('4. Auto-Sizing Hook: useReeferAutoSizing does not manipulate layout or open MADRE', () => {
  assert.doesNotMatch(autoSizingSource, /header-collapsed/);
  assert.doesNotMatch(autoSizingSource, /app-navigation-sidebar/);
  assert.doesNotMatch(autoSizingSource, /applyHeaderVisibility/);
  assert.doesNotMatch(autoSizingSource, /MadrePanelUI/);
  assert.doesNotMatch(autoSizingSource, /madre:open/);
});

test('5. TCE Workspace and Voyage Cost Engine: calculations remain static without DOM intrusions', () => {
  assert.doesNotMatch(tceWorkspaceSource, /applyHeaderVisibility/);
  assert.doesNotMatch(tceWorkspaceSource, /app-navigation-sidebar/);
  assert.doesNotMatch(tceWorkspaceSource, /MadrePanelUI/);
  assert.doesNotMatch(tceWorkspaceSource, /madre:open/);

  assert.doesNotMatch(costEngineSource, /applyHeaderVisibility/);
  assert.doesNotMatch(costEngineSource, /app-navigation-sidebar/);
  assert.doesNotMatch(costEngineSource, /MadrePanelUI/);
  assert.doesNotMatch(costEngineSource, /madre:open/);
});

test('6. MADRE Activation Governance: drawer only opens upon user action (button click or voice)', () => {
  // GlobalMadreDrawer initializes with initialOpen = false
  assert.match(globalMadreSource, /initialOpen\s*=\s*false/);
  assert.match(globalMadreSource, /const\s+\[isOpen,\s*setIsOpen\]\s*=\s*useState\(initialOpen\)/);

  // Topbar button triggers user-initiated toggle
  assert.match(indexSource, /id="madre-topbar-button"[^>]*onclick="if\s*\(window\.MadrePanelUI\?\.toggle\)/);
  assert.match(appJsxSource, /id="madre-topbar-button"[\s\S]*?onClick=\{[\s\S]*?window\.MadrePanelUI\.toggle\(\)/);

  // No automatic dispatch of madre:open exists anywhere in production scripts
  assert.doesNotMatch(indexSource, /dispatchEvent\s*\(\s*new\s+CustomEvent\s*\(\s*['"]madre:open['"]/);
  assert.doesNotMatch(appJsxSource, /dispatchEvent\s*\(\s*new\s+CustomEvent\s*\(\s*['"]madre:open['"]/);
  assert.doesNotMatch(dssSource, /dispatchEvent\s*\(\s*new\s+CustomEvent\s*\(\s*['"]madre:open['"]/);
  assert.doesNotMatch(tceWorkspaceSource, /dispatchEvent\s*\(\s*new\s+CustomEvent\s*\(\s*['"]madre:open['"]/);
});
