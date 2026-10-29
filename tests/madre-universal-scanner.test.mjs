import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const drawerSource = readFileSync(new URL('../src/components/GlobalMadreDrawer.jsx', import.meta.url), 'utf8');
const madrePanelJsSource = readFileSync(new URL('../assets/js/madre-panel.js', import.meta.url), 'utf8');
const reeferAuditBuilderSource = readFileSync(new URL('../netlify/functions/_shared/reefer-audit-builder.mjs', import.meta.url), 'utf8');
const madreChatSource = readFileSync(new URL('../netlify/functions/madre-chat.ts', import.meta.url), 'utf8');

test('1. Detector de Módulo y Vista Activa: detectActiveModule identifies sections and overlays', async () => {
  assert.match(drawerSource, /export\s+function\s+detectActiveModule/, 'GlobalMadreDrawer must export detectActiveModule');
  assert.match(madrePanelJsSource, /export\s+function\s+detectarModuloActivo/, 'madre-panel.js must export detectarModuloActivo');

  // Verify module dictionary covers primary Reefer Charter views
  assert.match(drawerSource, /multimodal:\s*["']Contenedores Reefer/);
  assert.match(drawerSource, /map:\s*["']Mapa y Rutas/);
  assert.match(drawerSource, /estimator:\s*["']Calculadora/);
  assert.match(drawerSource, /compatibilidad:\s*["']Compatibilidad/);
  assert.match(drawerSource, /dossiers:\s*["']Dossiers/);
  assert.match(drawerSource, /tracking-live-overlay/);
});

test('2. Escáner DOM Dinámico: captures inputs, selects, textareas, mode OWN/CHR and visible elements', () => {
  assert.match(drawerSource, /export\s+function\s+scanActiveModule/, 'GlobalMadreDrawer must export scanActiveModule');
  assert.match(madrePanelJsSource, /export\s+function\s+capturarDomModuloActivo/, 'madre-panel.js must export capturarDomModuloActivo');

  // Checks OWN/CHR toggle detection
  assert.match(drawerSource, /btn-view-mode-charterer/);
  assert.match(drawerSource, /estadosUi\.modo\s*=\s*isCharterer\s*\?\s*["']charterer["']\s*:\s*["']owner["']/);

  // Gathers form interactive fields
  assert.match(drawerSource, /container\.querySelectorAll\(['"]input,\s*select,\s*textarea['"]\)/);

  // Gathers tables and visible summary cards
  assert.match(drawerSource, /container\.querySelectorAll\(['"]table['"]\)/);
  assert.match(drawerSource, /metric-card/);
});

test('3. Formato del JSON de Salida: conforms strictly to standard specification', () => {
  const expectedKeys = ['suite', 'modulo_actual', 'timestamp', 'datos_formulario', 'estados_ui', 'elementos_visibles'];
  for (const key of expectedKeys) {
    assert.match(drawerSource, new RegExp(`${key}:`), `Drawer scan payload must include ${key}`);
    assert.match(madrePanelJsSource, new RegExp(`${key}:`), `madre-panel.js payload must include ${key}`);
  }
  assert.match(drawerSource, /suite:\s*["']Reefer Charter Core PRO["']/);
  assert.match(madrePanelJsSource, /suite:\s*["']Reefer Charter Core PRO["']/);
});

test('4. Directiva Cero-Alucinaciones: prompts enforce zero assumptions, pointing out cold incongruities and empty fields', () => {
  assert.match(drawerSource, /export\s+function\s+buildUniversalScanPrompt/);
  assert.match(drawerSource, /DIRECTIVA CERO-ALUCINACIONES/);
  assert.match(drawerSource, /Auditar estricta y exclusivamente los datos provistos/);
  assert.match(drawerSource, /prohibido inventar/i);

  assert.match(madrePanelJsSource, /generarPromptCeroAlucinaciones/);
  assert.match(madrePanelJsSource, /DIRECTIVA CERO-ALUCINACIONES/);

  assert.match(reeferAuditBuilderSource, /buildUniversalModuleAuditReply/);
  assert.match(reeferAuditBuilderSource, /CAMPOS CLAVE PENDIENTES DE CUMPLIMENTAR/);
  assert.match(reeferAuditBuilderSource, /INCONGRUENCIAS TÉCNICAS DETECTADAS/);
});

test('5. UI Actions: Header scan button and quick command invoke the universal scanner', () => {
  assert.match(drawerSource, /id="madre-header-scan-button"/, 'Header scan button must be present in drawer');
  assert.match(drawerSource, /id:\s*["']escaner_pantalla["']/);
  assert.match(drawerSource, /window\.MadrePanelUI\s*=\s*\{[\s\S]*?scan:/, 'MadrePanelUI must expose scan method');
  assert.match(drawerSource, /window\.addEventListener\(['"]madre:scan['"]/, 'Must listen to madre:scan event');
});

test('6. Data Bridge backend handles universal module scan and returns structured audit', () => {
  assert.match(madreChatSource, /buildUniversalModuleAuditReply/);
  assert.match(madreChatSource, /universal_screen_scan/);
});
