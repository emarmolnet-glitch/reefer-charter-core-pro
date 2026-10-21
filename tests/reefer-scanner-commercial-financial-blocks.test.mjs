import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { buildReeferScreenAuditReply } from '../netlify/functions/_shared/reefer-audit-builder.mjs';

const drawerSource = readFileSync(new URL('../src/components/GlobalMadreDrawer.jsx', import.meta.url), 'utf8');

function executeExtractReeferScanData(mockDocument = undefined, mockWindow = {}) {
  const sandbox = {
    console,
    parseFloat,
    Math,
    Number,
    String,
    document: mockDocument,
    window: mockWindow,
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

test('1. Static Analysis: GlobalMadreDrawer defines blocks 6, 7, and 8 with all required variables', () => {
  // Block 6: Resumen Operación y Costes
  assert.match(drawerSource, /bloque_6_resumen_operacion_costes/, 'Must define bloque_6_resumen_operacion_costes');
  assert.match(drawerSource, /break_even_usd_pallet/, 'Must define break_even_usd_pallet');
  assert.match(drawerSource, /coste_total_operacion_usd/, 'Must define coste_total_operacion_usd');

  // Block 7: Análisis de Fletes y Riesgos
  assert.match(drawerSource, /bloque_7_analisis_fletes_riesgos/, 'Must define bloque_7_analisis_fletes_riesgos');
  assert.match(drawerSource, /flete_venta_fletador_pallet/, 'Must define flete_venta_fletador_pallet');
  assert.match(drawerSource, /margen_objetivo_pct/, 'Must define margen_objetivo_pct');

  // Block 8: Negociación Comercial
  assert.match(drawerSource, /bloque_8_negociacion_comercial/, 'Must define bloque_8_negociacion_comercial');
  assert.match(drawerSource, /flete_compra_armador_pallet/, 'Must define flete_compra_armador_pallet');
  assert.match(drawerSource, /spread_comercial_pallet/, 'Must define spread_comercial_pallet');
  assert.match(drawerSource, /tce_proyectado_usd_dia/, 'Must define tce_proyectado_usd_dia');
});

test('2. Fallback defaults: extractReeferScanData returns standard financial values when doc is null or empty', () => {
  const { scan, context } = executeExtractReeferScanData(null);

  assert.ok(scan.bloques, 'Must include bloques container');

  // Check Bloque 6
  const b6 = scan.bloques.bloque_6_resumen_operacion_costes;
  assert.ok(b6, 'Must include bloque_6_resumen_operacion_costes');
  assert.equal(b6.break_even_usd_pallet, 28.5);
  assert.equal(b6.coste_total_operacion_usd, 128250.0);

  // Check Bloque 7
  const b7 = scan.bloques.bloque_7_analisis_fletes_riesgos;
  assert.ok(b7, 'Must include bloque_7_analisis_fletes_riesgos');
  assert.equal(b7.flete_venta_fletador_pallet, 35.0);
  assert.equal(b7.margen_objetivo_pct, 15.0);

  // Check Bloque 8
  const b8 = scan.bloques.bloque_8_negociacion_comercial;
  assert.ok(b8, 'Must include bloque_8_negociacion_comercial');
  assert.equal(b8.flete_compra_armador_pallet, 32.5);
  assert.equal(b8.spread_comercial_pallet, 2.5);
  assert.equal(b8.tce_proyectado_usd_dia, 18500.0);
});

test('3. DOM Extraction: captures financial and commercial viability metrics directly from UI IDs', () => {
  const mockDoc = createMockDoc({
    '[data-reefer="pallets"]': { value: '5000' },
    '#res-cost-base-break-even': { textContent: '$31.20 /MT' },
    '#res-cost-total': { textContent: '$156,000' },
    '#freight-sell': { value: '38.50' },
    '#target-margin': { value: '18.9' },
    '#freight-rate': { value: '33.50' },
    '#negotiation-spread-pmt': { textContent: '$5.00 /MT' },
    '#exec-tce': { textContent: '$22,800 / día' },
  });

  const { scan } = executeExtractReeferScanData(mockDoc);

  const b6 = scan.bloques.bloque_6_resumen_operacion_costes;
  assert.equal(b6.break_even_usd_pallet, 31.2);
  assert.equal(b6.coste_total_operacion_usd, 156000);

  const b7 = scan.bloques.bloque_7_analisis_fletes_riesgos;
  assert.equal(b7.flete_venta_fletador_pallet, 38.5);
  assert.equal(b7.margen_objetivo_pct, 18.9);

  const b8 = scan.bloques.bloque_8_negociacion_comercial;
  assert.equal(b8.flete_compra_armador_pallet, 33.5);
  assert.equal(b8.spread_comercial_pallet, 5.0);
  assert.equal(b8.tce_proyectado_usd_dia, 22800);
});

test('4. DOM Extraction: captures metrics using specialized data-reefer attributes', () => {
  const mockDoc = createMockDoc({
    '[data-reefer="pallets"]': { value: '4200' },
    '[data-reefer="break-even"]': { value: '29.75' },
    '[data-reefer="total-cost"]': { value: '124950' },
    '[data-reefer="freight-sell"]': { value: '36.00' },
    '[data-reefer="target-margin"]': { value: '14.5' },
    '[data-reefer="freight-rate"]': { value: '32.00' },
    '[data-reefer="spread"]': { value: '4.00' },
    '[data-reefer="tce"]': { value: '19500' },
  });

  const { scan } = executeExtractReeferScanData(mockDoc);

  const b6 = scan.bloques.bloque_6_resumen_operacion_costes;
  assert.equal(b6.break_even_usd_pallet, 29.75);
  assert.equal(b6.coste_total_operacion_usd, 124950);

  const b7 = scan.bloques.bloque_7_analisis_fletes_riesgos;
  assert.equal(b7.flete_venta_fletador_pallet, 36.0);
  assert.equal(b7.margen_objetivo_pct, 14.5);

  const b8 = scan.bloques.bloque_8_negociacion_comercial;
  assert.equal(b8.flete_compra_armador_pallet, 32.0);
  assert.equal(b8.spread_comercial_pallet, 4.0);
  assert.equal(b8.tce_proyectado_usd_dia, 19500);
});

test('5. Spread calculation: computes spread_comercial_pallet as flete_venta - flete_compra when not explicitly in DOM', () => {
  const mockDoc = createMockDoc({
    '#freight-sell': { value: '41.50' },
    '#freight-rate': { value: '34.20' },
  });

  const { scan } = executeExtractReeferScanData(mockDoc);
  const b8 = scan.bloques.bloque_8_negociacion_comercial;

  assert.equal(b8.flete_compra_armador_pallet, 34.2);
  assert.equal(b8.spread_comercial_pallet, 7.3); // 41.50 - 34.20
});

test('6. State Synchronization: extracts metrics from window.State when DOM elements are not present', () => {
  const mockWindow = {
    State: {
      breakEvenUnitario: 30.5,
      costTotal: 152500,
      freightSell: 37.5,
      targetMargin: 16.0,
      freightRate: 33.0,
      tce: 20500,
    },
  };

  const { scan } = executeExtractReeferScanData(createMockDoc({}), mockWindow);

  const b6 = scan.bloques.bloque_6_resumen_operacion_costes;
  assert.equal(b6.break_even_usd_pallet, 30.5);
  assert.equal(b6.coste_total_operacion_usd, 152500);

  const b7 = scan.bloques.bloque_7_analisis_fletes_riesgos;
  assert.equal(b7.flete_venta_fletador_pallet, 37.5);
  assert.equal(b7.margen_objetivo_pct, 16.0);

  const b8 = scan.bloques.bloque_8_negociacion_comercial;
  assert.equal(b8.flete_compra_armador_pallet, 33.0);
  assert.equal(b8.spread_comercial_pallet, 4.5); // 37.5 - 33.0
  assert.equal(b8.tce_proyectado_usd_dia, 20500);
});

test('7. Packaging in contexto_ui: getReeferUIContext packages escaneo_reefer.bloques with blocks 6, 7, and 8', () => {
  const mockDoc = createMockDoc({
    '#res-cost-base-break-even': { textContent: '$29.00 /MT' },
    '#res-cost-total': { textContent: '$130,500' },
    '#freight-sell': { value: '36.50' },
    '#target-margin': { value: '15.5' },
    '#freight-rate': { value: '32.00' },
    '#exec-tce': { textContent: '$19,200 / día' },
  });

  const { context } = executeExtractReeferScanData(mockDoc);

  assert.ok(context.escaneo_reefer, 'Must have escaneo_reefer in context');
  assert.ok(context.escaneo_reefer.bloques, 'Must have bloques in escaneo_reefer');

  const { bloque_6_resumen_operacion_costes: b6, bloque_7_analisis_fletes_riesgos: b7, bloque_8_negociacion_comercial: b8 } =
    context.escaneo_reefer.bloques;

  assert.ok(b6, 'escaneo_reefer.bloques must have bloque_6_resumen_operacion_costes');
  assert.equal(b6.break_even_usd_pallet, 29.0);
  assert.equal(b6.coste_total_operacion_usd, 130500);

  assert.ok(b7, 'escaneo_reefer.bloques must have bloque_7_analisis_fletes_riesgos');
  assert.equal(b7.flete_venta_fletador_pallet, 36.5);
  assert.equal(b7.margen_objetivo_pct, 15.5);

  assert.ok(b8, 'escaneo_reefer.bloques must have bloque_8_negociacion_comercial');
  assert.equal(b8.flete_compra_armador_pallet, 32.0);
  assert.equal(b8.spread_comercial_pallet, 4.5);
  assert.equal(b8.tce_proyectado_usd_dia, 19200);
});

test('8. Reporting in MADRE: buildReeferScreenAuditReply displays commercial and financial viability blocks', () => {
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
        pallets: 4500,
      },
      bloque_4_costes_fletes: {
        flete_pallet_caja: 38.0,
      },
      bloque_6_resumen_operacion_costes: {
        break_even_usd_pallet: 29.40,
        coste_total_operacion_usd: 132300,
      },
      bloque_7_analisis_fletes_riesgos: {
        flete_venta_fletador_pallet: 38.00,
        margen_objetivo_pct: 17.5,
      },
      bloque_8_negociacion_comercial: {
        flete_compra_armador_pallet: 33.20,
        spread_comercial_pallet: 4.80,
        tce_proyectado_usd_dia: 21400,
      },
    },
  };

  const reply = buildReeferScreenAuditReply(payload);

  // Check Bloque 6 formatting
  assert.ok(reply.includes('BLOQUE 6: RESUMEN DE OPERACIÓN Y COSTES REALES'), 'Must include Bloque 6 header');
  assert.ok(reply.includes('29.40'), 'Must include break-even per pallet');
  assert.ok(reply.includes('132.300') || reply.includes('132300'), 'Must include total operation cost');

  // Check Bloque 7 formatting
  assert.ok(reply.includes('BLOQUE 7: ANÁLISIS DE FLETES Y RIESGOS'), 'Must include Bloque 7 header');
  assert.ok(reply.includes('38.00'), 'Must include charterer sell freight');
  assert.ok(reply.includes('17.5%'), 'Must include target margin percentage');

  // Check Bloque 8 formatting
  assert.ok(reply.includes('BLOQUE 8: NEGOCIACIÓN COMERCIAL Y ARBITRAJE'), 'Must include Bloque 8 header');
  assert.ok(reply.includes('33.20'), 'Must include owner buy freight');
  assert.ok(reply.includes('4.80'), 'Must include commercial spread');
  assert.ok(reply.includes('21.400') || reply.includes('21400'), 'Must include projected TCE per day');
});
