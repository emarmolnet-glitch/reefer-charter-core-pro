import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const drawerSource = readFileSync(new URL('../src/components/GlobalMadreDrawer.jsx', import.meta.url), 'utf8');

function executeGetReeferUIContext(mockDocument = undefined) {
  const sandbox = {
    console,
    parseFloat,
    document: mockDocument,
    window: {},
  };
  const script = `
    ${drawerSource
      .replace(/import\s*[^;]+;?/g, '')
      .replace(/export\s+const\s+MADRE_API_ENDPOINT[^;]+;/g, '')
      .replace(/export\s+function\s+GlobalMadreDrawer[\s\S]*$/, '')
      .replace(/export\s+function/g, 'function')
      .replace(/export\s+const/g, 'const')}
    output = getReeferUIContext();
  `;
  vm.runInNewContext(script, sandbox);
  return JSON.parse(JSON.stringify(sandbox.output));
}

function createMockDoc(elements = {}) {
  return {
    querySelector: (selector) => {
      const parts = selector.split(',').map((s) => s.trim());
      for (const part of parts) {
        if (elements[part]) {
          return elements[part];
        }
      }
      return null;
    },
  };
}

test('1. Static Analysis: GlobalMadreDrawer exports getReeferUIContext and attaches contexto_ui to fetch payload', () => {
  // Verifies helper function exists and returns required signature
  assert.match(drawerSource, /export\s+function\s+getReeferUIContext\s*\(\)/, 'Must export getReeferUIContext');
  assert.match(drawerSource, /current_module:\s*["']reefer_charter["']/, 'Must set current_module to reefer_charter');
  assert.match(drawerSource, /vista_activa:\s*["']Reefer Charter - Control de Frigoríficos["']/, 'Must set vista_activa');
  assert.match(drawerSource, /parametros_activos:\s*params/, 'Must include parametros_activos');

  // Verifies DOM query selectors
  assert.match(drawerSource, /document\.querySelector\(['"]\[data-reefer="temperature"\], #setpoint-temp, \.reefer-temp-input['"]\)/);
  assert.match(drawerSource, /document\.querySelector\(['"]\[data-reefer="cargo"\], #cargo-type, \.cargo-select['"]\)/);

  // Verifies payload includes contexto_ui alongside existing fields
  assert.match(drawerSource, /contexto_ui:\s*getReeferUIContext\(\)/, 'Outgoing payload must include contexto_ui: getReeferUIContext()');
  assert.match(drawerSource, /mensajeUsuario:\s*trimmed/);
  assert.match(drawerSource, /message:\s*trimmed/);
  assert.match(drawerSource, /prompt:\s*trimmed/);
  assert.match(drawerSource, /context:\s*\{[\s\S]*origin:\s*["']Reefer Charter Core PRO["']/);
});

test('2. getReeferUIContext returns defaults when no elements are in DOM', () => {
  const mockDoc = createMockDoc({});
  const context = executeGetReeferUIContext(mockDoc);
  assert.equal(context.current_module, 'reefer_charter');
  assert.equal(context.vista_activa, 'Reefer Charter - Control de Frigoríficos');
  assert.deepEqual(context.parametros_activos, {});
});

test('3. getReeferUIContext safely extracts temperature and cargo type using data-reefer attributes', () => {
  const mockDoc = createMockDoc({
    '[data-reefer="temperature"]': { value: '-18.5' },
    '[data-reefer="cargo"]': { value: 'Frozen Fish' },
  });
  const context = executeGetReeferUIContext(mockDoc);
  assert.equal(context.parametros_activos.target_temperature, -18.5);
  assert.equal(context.parametros_activos.cargo_type, 'Frozen Fish');
});

test('4. getReeferUIContext safely extracts temperature from textContent when value is absent', () => {
  const mockDoc = createMockDoc({
    '#setpoint-temp': { textContent: '4.2' },
    '#cargo-type': { value: 'Citrus / Oranges' },
  });
  const context = executeGetReeferUIContext(mockDoc);
  assert.equal(context.parametros_activos.target_temperature, 4.2);
  assert.equal(context.parametros_activos.cargo_type, 'Citrus / Oranges');
});

test('5. getReeferUIContext extracts POL and POD when present in DOM', () => {
  const mockDoc = createMockDoc({
    '.reefer-temp-input': { value: '-22.0' },
    '.cargo-select': { textContent: 'Vaccines / Pharma' },
    '[data-reefer="pol"]': { value: 'Rotterdam' },
    '[data-reefer="pod"]': { value: 'Santos' },
  });
  const context = executeGetReeferUIContext(mockDoc);
  assert.equal(context.parametros_activos.target_temperature, -22.0);
  assert.equal(context.parametros_activos.cargo_type, 'Vaccines / Pharma');
  assert.equal(context.parametros_activos.pol, 'Rotterdam');
  assert.equal(context.parametros_activos.pod, 'Santos');
});

test('6. getReeferUIContext works gracefully in headless/SSR environments where document is undefined', () => {
  const context = executeGetReeferUIContext(undefined);
  assert.equal(context.current_module, 'reefer_charter');
  assert.equal(context.vista_activa, 'Reefer Charter - Control de Frigoríficos');
  assert.deepEqual(context.parametros_activos, {});
});
