import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const [storeSource, workspaceSource, indexSource, assistantSource, draftEntrySource, costEngineSource] = await Promise.all([
  readFile(new URL('../src/stores/voyage-store.js', import.meta.url), 'utf8'),
  readFile(new URL('../TceCalculatorWorkspace.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/sea-assistant-entry.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/voyage-draft-entry.js', import.meta.url), 'utf8'),
  readFile(new URL('../voyage-cost-engine.js', import.meta.url), 'utf8'),
]);

test('1. UI Inputs: Section 2 and TceCalculatorWorkspace explicitly declare inputs for all 5 reefer variables', async () => {
  // index.html Section 2 inputs
  assert.match(indexSource, /id="pallet-quantity"[^>]*oninput="handleReeferInputChange\('palletQuantity',/);
  assert.match(indexSource, /id="cargo-volume-cbm"[^>]*oninput="handleReeferInputChange\('cargoVolumeCBM',/);
  assert.match(indexSource, /id="target-temperature"[^>]*oninput="handleReeferInputChange\('targetTemperatureCelsius',/);
  assert.match(indexSource, /id="deck-height"[^>]*oninput="handleReeferInputChange\('deckHeight',/);
  assert.match(indexSource, /id="auxiliary-genset-cost"[^>]*oninput="handleReeferInputChange\('auxiliaryGensetDailyCost',/);
  assert.match(indexSource, /id="controlled-atmosphere"[^>]*onchange="handleReeferInputChange\('requiresControlledAtmosphere',/);

  // TceCalculatorWorkspace inputs
  assert.match(workspaceSource, /id="reverse-pallet-quantity"/);
  assert.match(workspaceSource, /id="reverse-cargo-volume-cbm"/);
  assert.match(workspaceSource, /id="reverse-target-temperature"/);
  assert.match(workspaceSource, /id="reverse-deck-height"/);
  assert.match(workspaceSource, /id="reverse-auxiliary-genset-cost"/);
  assert.match(workspaceSource, /id="reverse-controlled-atmosphere"/);
});

test('2. Style Alignment: Atmósfera Controlada (CA) button matches height and alignment of adjacent inputs', async () => {
  // index.html: Controlled atmosphere element matches input-gc and h-9 height
  assert.match(indexSource, /<label\s+id="label-controlled-atmosphere"[^>]*class="[^"]*input-gc[^"]*h-9/);
  assert.match(indexSource, /Atmósfera Controlada \(CA\)/);

  // TceCalculatorWorkspace: matches h-10 with adjacent inputs
  assert.match(workspaceSource, /htmlFor="reverse-controlled-atmosphere"[^>]*className="[^"]*h-10[^"]*rounded-lg/);
});

test('3. Data Bridge & NLP Ingestion: voyage-store.js applyNlpScenario hydrates all 5 reefer values and profiles speed', async () => {
  assert.match(storeSource, /palletQuantity/);
  assert.match(storeSource, /cargoVolumeCBM/);
  assert.match(storeSource, /targetTemperatureCelsius/);
  assert.match(storeSource, /deckHeight/);
  assert.match(storeSource, /auxiliaryGensetDailyCost/);
  assert.match(storeSource, /defaultReeferSpeed\s*=\s*isReeferCargo\s*\?\s*17\.5/);

  // Sandbox simulation of applyNlpScenario with reefer payload
  const sandbox = {
    console, Date, JSON, Number, String, Boolean, Object, Array, Math, window: {},
  };
  const strippedSource = storeSource
    .replace(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*['"];?/g, '')
    .replace(/export\s+function/g, 'function')
    .replace(/export\s+const\s+REEFER_BREAKBULK_OPERATIONAL_WARNING\s*=/g, 'const REEFER_BREAKBULK_OPERATIONAL_WARNING =')
    .replace(/const\s+EMPTY_DRAFT\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\);/, 'const EMPTY_DRAFT = Object.freeze({$1});')
    .replace(/export\s+const\s+voyageStore\s*=/g, 'const voyageStore =')
    .replace(/export\s+const\s+useVoyageStore\s*=\s*voyageStore;?/g, '');

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
      state = fn(set, get);
      return { getState: get, setState: set };
    }
    function subscribeWithSelector(fn) { return fn; }
  `;

  vm.runInNewContext(`${mockZustand}\n${strippedSource}\nthis.store = voyageStore;`, sandbox);
  const store = sandbox.store;

  store.getState().applyNlpScenario({
    cargo_type: 'Frutas Cítricas (Reefer)',
    palletQuantity: 3200,
    cargoVolumeCBM: 5800,
    targetTemperatureCelsius: 5.5,
    deckHeight: 2.35,
    auxiliaryGensetDailyCost: 420,
    requiresControlledAtmosphere: true,
  });

  const state = store.getState();
  assert.equal(state.palletQuantity, 3200);
  assert.equal(state.cargoVolumeCBM, 5800);
  assert.equal(state.targetTemperatureCelsius, 5.5);
  assert.equal(state.deckHeight, 2.35);
  assert.equal(state.auxiliaryGensetDailyCost, 420);
  assert.equal(state.requiresControlledAtmosphere, true);

  // Speed forced/suggested to 17.5 knots for reefer operations
  assert.equal(state.draft.speed_laden, 17.5);
  assert.equal(state.draft.speed_ballast, 17.5);
});

test('4. Assistant & Draft Ingestion: sea-assistant-entry and voyage-draft-entry synchronize UI inputs and activeVoyage', async () => {
  // Check sea-assistant-entry.js reefer hydration
  assert.match(assistantSource, /palletQuantity/);
  assert.match(assistantSource, /cargoVolumeCBM/);
  assert.match(assistantSource, /targetTemperatureCelsius/);
  assert.match(assistantSource, /deckHeight/);
  assert.match(assistantSource, /auxiliaryGensetDailyCost/);
  assert.match(assistantSource, /updateInputs\(.*\["spd-laden".*17\.5/);
  assert.match(assistantSource, /updateInputs\(.*\["spd-ballast".*17\.5/);

  // Check voyage-draft-entry.js maps reefer fields to inputs
  assert.match(draftEntrySource, /setValue\('pallet-quantity'/);
  assert.match(draftEntrySource, /setValue\('cargo-volume-cbm'/);
  assert.match(draftEntrySource, /setValue\('target-temperature'/);
  assert.match(draftEntrySource, /setValue\('deck-height'/);
  assert.match(draftEntrySource, /setValue\('auxiliary-genset-cost'/);
  assert.match(draftEntrySource, /setValue\('spd-laden',\s*17\.5/);
  assert.match(draftEntrySource, /setValue\('spd-ballast',\s*17\.5/);

  // Check index.html defines hydrateReeferFromDataBridge
  assert.match(indexSource, /function hydrateReeferFromDataBridge/);
  assert.match(indexSource, /hydrateReeferFromDataBridge\(payload\)/);
});

test('5. Speed Profiling: Reefer operations force/suggest 17.5 knots speed profile', async () => {
  assert.match(indexSource, /function isReeferOperation/);
  assert.match(indexSource, /segment:\s*"Reefer Vessel",\s*minDwt:\s*0,\s*maxDwt:\s*Infinity,\s*speedBallast:\s*17\.5,\s*speedLaden:\s*17\.5/);
  assert.match(indexSource, /source:\s*'Reefer speed profile'/);
});

test('6. Financial Engine: CAPEX (+28%), OPEX Base (+20%), Seguros (Inherent Vice), and PDA (+25%)', async () => {
  // CAPEX: +28% daily amortization in buildExecutiveShipClassAnalysis
  assert.match(indexSource, /capexMultiplier\s*=\s*isReefer\s*\?\s*1\.28\s*:\s*1\.00/);
  assert.match(indexSource, /\+28% Recargo Planta Frigorífica\/CAPEX/);

  // OPEX Base: +20% daily opex in calculateFixedOpex
  assert.match(indexSource, /isReefer\s*\?\s*Math\.round\(calculatedOpex\s*\*\s*1\.20\)\s*:\s*calculatedOpex/);

  // Seguros: Inherent Vice / cold-chain loss risk premium
  assert.match(indexSource, /reeferInsuranceRiskPremium\s*=\s*isReefer\s*\?\s*\(dwt\s*\*\s*0\.012\)\s*:\s*0/);
  assert.match(indexSource, /Prima Riesgo Cadena de Frío \/ Inherent Vice/);

  // PDA: +25% fruit terminals & priority tugs
  assert.match(indexSource, /totalPDA\s*\*=\s*1\.25;\s*\/\/\s*Terminales fruteras y remolcadores prioritarios/);
  assert.match(indexSource, /Terminal Frutera \/ Reefer Priority Surcharge/);

  // Cost engine opex & PDA multipliers
  assert.match(costEngineSource, /estimateDailyOpexByDwt\(dwt,\s*isReefer\s*=\s*false\)/);
  assert.match(costEngineSource, /return isReefer \? Math\.round\(base \* (?:1\.30|1\.20|REEFER_FINANCIAL_MULTIPLIERS\.OPEX)\) : base;/);
  assert.match(costEngineSource, /reeferMultiplier = isReefer \? (?:1\.50?|1\.25|REEFER_FINANCIAL_MULTIPLIERS\.PDA) : 1\.0;/);
});
