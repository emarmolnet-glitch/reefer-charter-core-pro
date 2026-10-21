import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { buildReeferScreenAuditReply } from '../netlify/functions/_shared/reefer-audit-builder.mjs';

const drawerSource = readFileSync(new URL('../src/components/GlobalMadreDrawer.jsx', import.meta.url), 'utf8');

function executeExtractReeferScanData(mockDocument = undefined) {
  const sandbox = {
    console,
    parseFloat,
    Math,
    Number,
    String,
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
    outputScan = extractReeferScanData(document);
    outputContext = getReeferUIContext();
  `;
  vm.runInNewContext(script, sandbox);
  return {
    scan: JSON.parse(JSON.stringify(sandbox.outputScan)),
    context: JSON.parse(JSON.stringify(sandbox.outputContext)),
  };
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
    querySelectorAll: (selector) => {
      const parts = selector.split(',').map((s) => s.trim());
      const matched = [];
      for (const part of parts) {
        if (elements[part]) {
          matched.push(elements[part]);
        }
      }
      return matched;
    },
  };
}

test('1. Static Analysis: extractReeferScanData and getReeferUIContext define required parameters', () => {
  // Checks export
  assert.match(drawerSource, /export\s+function\s+extractReeferScanData/);
  assert.match(drawerSource, /export\s+function\s+getReeferUIContext/);

  // Checks block 1 parameters
  assert.match(drawerSource, /dias_navegacion/, 'Must define dias_navegacion');
  assert.match(drawerSource, /dias_puerto/, 'Must define dias_puerto');
  assert.match(drawerSource, /dias_totales_viaje/, 'Must define dias_totales_viaje');

  // Checks structure under bloques.bloque_1_ruta_tiempos
  assert.match(drawerSource, /bloque_1_ruta_tiempos:\s*bloque1/, 'Must attach bloque_1_ruta_tiempos');
  assert.match(drawerSource, /escaneo_reefer:\s*escaneoReefer/, 'Must attach escaneo_reefer in context');
});

test('2. extractReeferScanData returns fallback default values when doc is null or empty', () => {
  const { scan, context } = executeExtractReeferScanData(null);

  assert.ok(scan.bloques, 'Must include bloques container');
  assert.ok(scan.bloques.bloque_1_ruta_tiempos, 'Must include bloque_1_ruta_tiempos inside bloques');

  const b1 = scan.bloques.bloque_1_ruta_tiempos;
  assert.equal(b1.dias_navegacion, 12.0);
  assert.equal(b1.dias_puerto, 3.0);
  assert.equal(b1.dias_totales_viaje, 15.0);
  assert.equal(b1.dias_totales_viaje, b1.dias_navegacion + b1.dias_puerto);
});

test('3. dias_puerto is extracted directly from the interface when explicitly present', () => {
  const mockDoc = createMockDoc({
    '#exec-sea-days': { textContent: '10.5 días' },
    '#exec-port-days': { textContent: '4.5 días' },
    '[data-reefer="pol"]': { value: 'Guayaquil' },
    '[data-reefer="pod"]': { value: 'Vlissingen' },
    '[data-reefer="pallets"]': { value: '4500' },
  });

  const { scan, context } = executeExtractReeferScanData(mockDoc);
  const b1 = scan.bloques.bloque_1_ruta_tiempos;

  assert.equal(b1.pol, 'Guayaquil');
  assert.equal(b1.pod, 'Vlissingen');
  assert.equal(b1.dias_navegacion, 10.5);
  assert.equal(b1.dias_puerto, 4.5);
  assert.equal(b1.dias_totales_viaje, 15.0);
});

test('4. dias_puerto is calculated accurately based on pallets and distinct loading / discharging rates', () => {
  // 4800 pallets, load rate 1600 pallets/day (3 days), discharge rate 1200 pallets/day (4 days) => 7 port days
  const mockDoc = createMockDoc({
    '#exec-sea-days': { textContent: '11.0' },
    '[data-reefer="pallets"]': { value: '4800' },
    '#rate-load': { value: '1600' },
    '#rate-disch': { value: '1200' },
  });

  const { scan, context } = executeExtractReeferScanData(mockDoc);
  const b1 = scan.bloques.bloque_1_ruta_tiempos;

  assert.equal(b1.dias_navegacion, 11.0);
  assert.equal(b1.dias_puerto, 7.0);
  assert.equal(b1.dias_totales_viaje, 18.0);
  assert.equal(b1.dias_totales_viaje, b1.dias_navegacion + b1.dias_puerto);
});

test('5. dias_puerto is calculated based on pallets and a single daily rhythm', () => {
  // 3000 pallets, load rate 1500 pallets/day => 2 days loading + 2 days discharging = 4 port days
  const mockDoc = createMockDoc({
    '#exec-sea-days': { textContent: '8.0' },
    '[data-reefer="pallets"]': { value: '3000' },
    '[data-reefer="load-rate"]': { value: '1500' },
  });

  const { scan } = executeExtractReeferScanData(mockDoc);
  const b1 = scan.bloques.bloque_1_ruta_tiempos;

  assert.equal(b1.dias_navegacion, 8.0);
  assert.equal(b1.dias_puerto, 4.0);
  assert.equal(b1.dias_totales_viaje, 12.0);
});

test('6. dias_puerto defaults to standard reefer pallet rhythm when pallets are given without explicit rates', () => {
  // 3000 pallets, standard rhythm 1500 pallets/day => (3000 / 1500) * 2 = 4 port days
  const mockDoc = createMockDoc({
    '#exec-sea-days': { textContent: '9.0' },
    '[data-reefer="pallets"]': { value: '3000' },
  });

  const { scan } = executeExtractReeferScanData(mockDoc);
  const b1 = scan.bloques.bloque_1_ruta_tiempos;

  assert.equal(b1.dias_navegacion, 9.0);
  assert.equal(b1.dias_puerto, 4.0);
  assert.equal(b1.dias_totales_viaje, 13.0);
});

test('7. getReeferUIContext packages escaneo_reefer with bloques.bloque_1_ruta_tiempos correctly', () => {
  const mockDoc = createMockDoc({
    '[data-reefer="origin"]': { value: 'Coronel' },
    '[data-reefer="destination"]': { value: 'Philadelphia' },
    '[data-reefer="sea-days"]': { value: '14.2' },
    '[data-reefer="port-days"]': { value: '5.3' },
  });

  const { context } = executeExtractReeferScanData(mockDoc);

  assert.ok(context.escaneo_reefer, 'contexto_ui must have escaneo_reefer');
  assert.ok(context.escaneo_reefer.bloques, 'escaneo_reefer must have bloques');
  assert.ok(context.escaneo_reefer.bloques.bloque_1_ruta_tiempos, 'Must have bloque_1_ruta_tiempos');

  const b1 = context.escaneo_reefer.bloques.bloque_1_ruta_tiempos;
  assert.equal(b1.pol, 'Coronel');
  assert.equal(b1.pod, 'Philadelphia');
  assert.equal(b1.dias_navegacion, 14.2);
  assert.equal(b1.dias_puerto, 5.3);
  assert.equal(b1.dias_totales_viaje, 19.5);
});

test('8. buildReeferScreenAuditReply displays dias_puerto and dias_totales_viaje when present in scan', () => {
  const payload = {
    bloques: {
      bloque_1_ruta_tiempos: {
        pol: 'Puerto Cortés',
        pod: 'Rotterdam',
        dias_navegacion: 13.5,
        dias_puerto: 4.5,
        dias_totales_viaje: 18.0,
      },
      bloque_2_mercancia_frio: {
        tipo_producto: 'Melones Refrigerados',
        temperatura_objetivo_c: 7.0,
      },
      bloque_3_capacidad_estiba: {
        pallets: 3600,
      },
      bloque_4_costes_fletes: {
        flete_pallet_caja: 38.0,
      },
    },
  };

  const reply = buildReeferScreenAuditReply(payload);

  assert.ok(reply.includes('Puerto Cortés'), 'Must include POL');
  assert.ok(reply.includes('Rotterdam'), 'Must include POD');
  assert.ok(reply.includes('13.5'), 'Must include transit/navigation days');
  assert.ok(reply.includes('4.5'), 'Must include port days');
  assert.ok(reply.includes('18'), 'Must include total voyage days');
  assert.ok(reply.includes('Melones Refrigerados'), 'Must include commodity');
});
