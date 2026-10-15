import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

import {
  CARGO_PRODUCT_TREE,
  CARGO_PRODUCTS,
  validateCargoHierarchy,
  normalizeNlpVoyagePayload,
} from '../shared/cargo-mapper.mjs';

async function createSandboxVoyageStore(storeSource) {
  if (!storeSource) {
    storeSource = await readFile(new URL('../src/stores/voyage-store.js', import.meta.url), 'utf8');
  }
  const sandbox = {
    console,
    Date,
    JSON,
    Number,
    String,
    Boolean,
    Object,
    Array,
    Math,
    window: {},
    sandboxOutput: null,
  };

  const strippedSource = storeSource
    .replace(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*['"];?/g, '')
    .replace(/export\s+function/g, 'function')
    .replace(/export\s+const\s+REEFER_BREAKBULK_OPERATIONAL_WARNING\s*=/g, 'const REEFER_BREAKBULK_OPERATIONAL_WARNING =')
    .replace(/export\s+const\s+voyageStore\s*=/g, 'const voyageStore =')
    .replace(/export\s+const\s+useVoyageStore\s*=\s*voyageStore;?/g, '')
    .replace(/export\s*\{[^}]*\};?/g, '');

  const mockZustand = `
    function createStore(fn) {
      let state;
      const listeners = new Set();
      const set = (partial) => {
        const next = typeof partial === 'function' ? partial(state) : partial;
        state = Object.assign({}, state, next);
        listeners.forEach(l => l(state));
      };
      const get = () => state;
      const subscribe = (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      };
      state = fn(set, get);
      return { getState: get, setState: set, subscribe };
    }
    function subscribeWithSelector(fn) { return fn; }
  `;

  vm.runInNewContext(`${mockZustand}\n${strippedSource}\nsandboxOutput = voyageStore;`, sandbox);
  return sandbox.sandboxOutput;
}

test('1. Category & Product Mapping: category "Carga Refrigerada (Reefer)" or product "Plátanos" maps to "Frutas Tropicales y Exóticas" and "Bananas/Plátanos"', () => {
  // Tree & Products include Bananas/Plátanos under Frutas Tropicales y Exóticas
  assert.ok(CARGO_PRODUCT_TREE['Frutas Tropicales y Exóticas'].includes('Bananas/Plátanos'));
  assert.ok(CARGO_PRODUCTS.includes('Bananas/Plátanos'));

  // validateCargoHierarchy with backend category
  const resCat = validateCargoHierarchy('Carga Refrigerada (Reefer)', '');
  assert.equal(resCat.categoriaCarga, 'Frutas Tropicales y Exóticas');
  assert.equal(resCat.productoEspecifico, 'Bananas/Plátanos');

  // validateCargoHierarchy with backend product
  const resProd = validateCargoHierarchy('', 'Plátanos');
  assert.equal(resProd.categoriaCarga, 'Frutas Tropicales y Exóticas');
  assert.equal(resProd.productoEspecifico, 'Bananas/Plátanos');

  // normalizeNlpVoyagePayload with backend payload
  const backendPayload = {
    category: 'Carga Refrigerada (Reefer)',
    product: 'Plátanos',
    tonnage: 8500,
  };
  const normalized = normalizeNlpVoyagePayload(backendPayload);
  assert.equal(normalized.categoriaCarga, 'Frutas Tropicales y Exóticas');
  assert.equal(normalized.productoEspecifico, 'Bananas/Plátanos');
  assert.equal(normalized.cargoCategory, 'Frutas Tropicales y Exóticas');
  assert.equal(normalized.cargoProduct, 'Bananas/Plátanos');
  assert.equal(normalized.category, 'Frutas Tropicales y Exóticas');
  assert.equal(normalized.product, 'Bananas/Plátanos');
  assert.equal(normalized.cargo_specification, '10');
  assert.equal(normalized.speed_laden, 17.5);
  assert.equal(normalized.speed_ballast, 17.5);
  assert.equal(normalized.methodPOL, 'paletizado_portuaria');
  assert.equal(normalized.methodPOD, 'paletizado_portuaria');
});

test('2. Voyage Store Payload Mutation: detects "Reefer", "Plátanos", "Fruta" or target temperature and enforces 17.5 knots and "Paletizado - Grúa Portuaria"', async () => {
  const storeSource = await readFile(new URL('../src/stores/voyage-store.js', import.meta.url), 'utf8');
  const store = await createSandboxVoyageStore(storeSource);

  // Test case A: "Plátanos" product
  store.getState().applyNlpScenario({
    product: 'Plátanos',
    category: 'Carga Refrigerada (Reefer)',
    speed_laden: 12.0, // should be overridden to 17.5
    speed_ballast: 11.0, // should be overridden to 17.5
    methodPOL: 'cuchara_grab', // should be overridden to Paletizado - Grúa Portuaria
    methodPOD: 'cuchara_grab',
  });

  let state = store.getState();
  assert.equal(state.draft.speed_laden, 17.5);
  assert.equal(state.draft.speed_ballast, 17.5);
  assert.equal(state.draft.methodPOL, 'Paletizado - Grúa Portuaria');
  assert.equal(state.draft.methodPOD, 'Paletizado - Grúa Portuaria');
  assert.equal(state.draft.cargoCategory, 'Frutas Tropicales y Exóticas');
  assert.equal(state.draft.cargoProduct, 'Bananas/Plátanos');

  // Test case B: "Fruta" keyword
  store.getState().applyNlpScenario({
    cargo_type: 'Fruta fresca de exportación',
  });
  state = store.getState();
  assert.equal(state.draft.speed_laden, 17.5);
  assert.equal(state.draft.speed_ballast, 17.5);
  assert.equal(state.draft.methodPOL, 'Paletizado - Grúa Portuaria');
  assert.equal(state.draft.methodPOD, 'Paletizado - Grúa Portuaria');

  // Test case C: "Reefer" keyword
  store.getState().applyNlpScenario({
    cargo_type: 'Carga en contenedor Reefer',
  });
  state = store.getState();
  assert.equal(state.draft.speed_laden, 17.5);
  assert.equal(state.draft.speed_ballast, 17.5);
  assert.equal(state.draft.methodPOL, 'Paletizado - Grúa Portuaria');
  assert.equal(state.draft.methodPOD, 'Paletizado - Grúa Portuaria');

  // Test case D: target temperature
  store.getState().applyNlpScenario({
    cargo_type: 'Perecederos generales',
    targetTemperatureCelsius: 4.0,
  });
  state = store.getState();
  assert.equal(state.draft.speed_laden, 17.5);
  assert.equal(state.draft.speed_ballast, 17.5);
  assert.equal(state.draft.methodPOL, 'Paletizado - Grúa Portuaria');
  assert.equal(state.draft.methodPOD, 'Paletizado - Grúa Portuaria');
});

test('3. Financial Engine Multipliers: CAPEX base x 1.40, OPEX base x 1.30, PDA x 1.50 in voyage-cost-engine.js', async () => {
  const costEngine = await import('../voyage-cost-engine.js');
  const api = costEngine.default || costEngine;

  // Constants verification
  assert.equal(api.REEFER_FINANCIAL_MULTIPLIERS.CAPEX, 1.40);
  assert.equal(api.REEFER_FINANCIAL_MULTIPLIERS.OPEX, 1.30);
  assert.equal(api.REEFER_FINANCIAL_MULTIPLIERS.PDA, 1.50);
  assert.equal(api.REEFER_CAPEX_MULTIPLIER, 1.40);
  assert.equal(api.REEFER_OPEX_MULTIPLIER, 1.30);
  assert.equal(api.REEFER_PDA_MULTIPLIER, 1.50);

  // OPEX calculation verification: base for 30000 dwt is 5600; reefer is round(5600 * 1.30) = 7280
  const dryOpex = api.estimateDailyOpexByDwt(30000, false);
  const reeferOpex = api.estimateDailyOpexByDwt(30000, true);
  assert.equal(dryOpex, 5600);
  assert.equal(reeferOpex, Math.round(5600 * 1.30));

  // PDA calculation verification: multiplier is 1.50
  const dryRisk = api.calculateOperationalRisk(10000, '2026-10-20', 2, 'ES', { isReefer: false });
  const reeferRisk = api.calculateOperationalRisk(10000, '2026-10-20', 2, 'ES', { isReefer: true });
  assert.equal(dryRisk.adjustedPDA, 10000);
  assert.equal(reeferRisk.adjustedPDA, 10000 * 1.50);

  // CAPEX calculation verification: multiplier is 1.40
  const dryCapex = api.calculateDailyCapex(30000, { capexUsdPerDwt: 450, capexAnnualRate: 0.10 }, false);
  const reeferCapex = api.calculateDailyCapex(30000, { capexUsdPerDwt: 450, capexAnnualRate: 0.10 }, true);
  assert.equal(Math.round(reeferCapex), Math.round(dryCapex * 1.40));
});

test('4. Strict Restriction: index.html has not been modified in git worktree', async () => {
  const { execSync } = await import('node:child_process');
  const gitDiff = execSync('git diff --name-only index.html', { encoding: 'utf8' }).trim();
  assert.equal(gitDiff, '', 'index.html must not be modified!');
});

test('5. Operational Insights: automatically injects literal operational warning when Reefer in hold (Breakbulk) is detected', async () => {
  const expectedWarning = "Aviso Operativo: Exigir confirmación de Side Doors o Cunas multipallet en puerto. La estiba requiere bloque compacto con Dunnage bags y sistema Gratings libre de obstrucciones para flujo vertical a 13.5ºC";

  // A. cargo-mapper.mjs
  const mapped = normalizeNlpVoyagePayload({
    category: 'Carga Refrigerada (Reefer)',
    product: 'Plátanos'
  });
  assert.ok(Array.isArray(mapped.operationalWarnings));
  assert.ok(mapped.operationalWarnings.includes(expectedWarning));
  assert.ok(mapped.warnings.includes(expectedWarning));

  // B. voyage-store.js in sandbox
  const store = await createSandboxVoyageStore();

  store.getState().applyNlpScenario({
    category: 'Carga Refrigerada (Reefer)',
    product: 'Plátanos',
    palletQuantity: 2500,
    cargo_type: 'Plátanos en bodega',
  });
  const state = store.getState();
  assert.ok(state.draft.operationalWarnings.includes(expectedWarning));
  assert.ok(state.draft.warnings.includes(expectedWarning));
  assert.ok(state.operationalWarnings.includes(expectedWarning));

  // C. voyage-cost-engine.js
  const costEngine = await import('../voyage-cost-engine.js');
  const api = costEngine.default || costEngine;
  assert.equal(api.REEFER_BREAKBULK_OPERATIONAL_WARNING, expectedWarning);

  const costStateResult = api.calculateVoyageCostState({
    tipo_carga: 'Carga Refrigerada (Reefer)',
    product: 'Plátanos',
    capacidad_dwt: 10000,
    tonelaje_neto: 6000,
    calado_actual: 7.5,
    crane_swl_mt: 25,
  });
  assert.ok(costStateResult.operationalWarnings.includes(expectedWarning));
  assert.ok(costStateResult.warnings.includes(expectedWarning));

  const opRisk = api.calculateOperationalRisk(12000, '2026-10-20', 2, 'ES', {
    isReefer: true,
    cargo: 'Plátanos en bodega'
  });
  assert.ok(opRisk.operationalWarnings.includes(expectedWarning));
});

