import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const [storeSource, workspaceSource, indexSource] = await Promise.all([
  readFile(new URL('../src/stores/voyage-store.js', import.meta.url), 'utf8'),
  readFile(new URL('../TceCalculatorWorkspace.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
]);

test('1. voyageStore initializes reefer cargo variables and eliminates dry bulk weight fields from initial draft', async () => {
  // Check reefer initial variables in EMPTY_DRAFT / initial state
  assert.match(storeSource, /cargoVolumeCBM:\s*0/);
  assert.match(storeSource, /palletQuantity:\s*0/);
  assert.match(storeSource, /deckHeight:\s*2\.2/);
  assert.match(storeSource, /targetTemperatureCelsius:\s*13(\.0)?/);
  assert.match(storeSource, /requiresControlledAtmosphere:\s*false/);
  assert.match(storeSource, /auxiliaryGensetDailyCost:\s*0/);

  // Verify EMPTY_DRAFT does not define dry bulk weight fields
  const emptyDraftMatch = storeSource.match(/const EMPTY_DRAFT = Object\.freeze\(\{([\s\S]*?)\}\);/);
  assert.ok(emptyDraftMatch, 'EMPTY_DRAFT should be defined');
  const emptyDraftBody = emptyDraftMatch[1];
  assert.doesNotMatch(emptyDraftBody, /\bdwt:\s*\d+/);
  assert.doesNotMatch(emptyDraftBody, /\bgross_tonnage:\s*/);
  assert.doesNotMatch(emptyDraftBody, /\bnet_tonnage:\s*/);
  assert.doesNotMatch(emptyDraftBody, /\bcargoQty:\s*/);
});

test('2. voyageStore mutator setCargoDetails updates reefer variables and preserves project_ref and vessel patching', async () => {
  assert.match(storeSource, /setCargoDetails:\s*\(details = \{\}\) => set\(\(current\) => \{/);
  assert.match(storeSource, /patchSection2Vessel/);
  assert.match(storeSource, /patchVesselData/);

  // Evaluate store in sandbox
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
    .replace(/export\s+default\s+/g, '')
    .replace(/export\s+function/g, 'function')
    .replace(/export\s+const\s+/g, 'const ')
    .replace(/export\s+let\s+/g, 'let ')
    .replace(/const\s+EMPTY_DRAFT\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\);/, 'const EMPTY_DRAFT = Object.freeze({$1});');

  // Provide mock createStore and subscribeWithSelector
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
  const store = sandbox.sandboxOutput;
  assert.ok(store, 'Store should instantiate');

  // Verify initial state
  const initial = store.getState();
  assert.equal(initial.cargoVolumeCBM, 0);
  assert.equal(initial.palletQuantity, 0);
  assert.equal(initial.deckHeight, 2.2);
  assert.equal(initial.targetTemperatureCelsius, 13.0);
  assert.equal(initial.requiresControlledAtmosphere, false);
  assert.equal(initial.auxiliaryGensetDailyCost, 0);

  // Update via setCargoDetails
  store.getState().setCargoDetails({
    cargoVolumeCBM: 4500,
    palletQuantity: 2500,
    deckHeight: 2.4,
    targetTemperatureCelsius: 4.5,
    requiresControlledAtmosphere: true,
    auxiliaryGensetDailyCost: 350,
  });

  const updated = store.getState();
  assert.equal(updated.cargoVolumeCBM, 4500);
  assert.equal(updated.palletQuantity, 2500);
  assert.equal(updated.deckHeight, 2.4);
  assert.equal(updated.targetTemperatureCelsius, 4.5);
  assert.equal(updated.requiresControlledAtmosphere, true);
  assert.equal(updated.auxiliaryGensetDailyCost, 350);

  assert.equal(updated.draft.cargoVolumeCBM, 4500);
  assert.equal(updated.draft.palletQuantity, 2500);
  assert.equal(updated.draft.deckHeight, 2.4);
  assert.equal(updated.draft.targetTemperatureCelsius, 4.5);
  assert.equal(updated.draft.requiresControlledAtmosphere, true);
  assert.equal(updated.draft.auxiliaryGensetDailyCost, 350);
});

test('3. TceCalculatorWorkspace provides Reefer Cargo inputs connected to Zustand with reefer variables', async () => {
  // Check exact input labels
  assert.match(workspaceSource, /Cantidad de Palets/);
  assert.match(workspaceSource, /Volumen CBM/);
  assert.match(workspaceSource, /Temperatura Objetivo °C/);
  assert.match(workspaceSource, /Atmósfera Controlada \(CA\)/);

  // Check inputs connection to voyageStore
  assert.match(workspaceSource, /voyageStore\.getState\(\)/);
  assert.match(workspaceSource, /voyageStore\.subscribe/);
  assert.match(workspaceSource, /setCargoDetails/);

  // Check step 0.1 on temperature
  assert.match(workspaceSource, /step="0\.1"/);

  // Check CBM suffix instead of MT for cargoVolume
  assert.match(workspaceSource, /\{ key: 'cargoVolume', label: 'Volumen CBM', suffix: 'CBM' \}/);
  assert.doesNotMatch(workspaceSource, /\{ key: 'cargoVolume', label: 'Toneladas carga', suffix: 'MT' \}/);
});

test('4. index.html replaces visual cargo weight inputs with Reefer Cargo inputs connected to Zustand', async () => {
  // Check visual inputs in Section 2
  assert.match(indexSource, /id="pallet-quantity"/);
  assert.match(indexSource, /id="cargo-volume-cbm"/);
  assert.match(indexSource, /id="target-temperature"/);
  assert.match(indexSource, /id="controlled-atmosphere"/);

  // Check labels
  assert.match(indexSource, /Cantidad de Palets/);
  assert.match(indexSource, /Volumen CBM/);
  assert.match(indexSource, /Temperatura Objetivo °C/);
  assert.match(indexSource, /Atmósfera Controlada \(CA\)/);

  // Check handleReeferInputChange connection to voyageStore
  assert.match(indexSource, /function handleReeferInputChange/);
  assert.match(indexSource, /setCargoDetails/);
});

test('5. Global synchronization: voyageCalculated packages all reefer variables into window.activeVoyage for DSS', async () => {
  // Verify activeVoyagePayload packaging reefer fields
  assert.match(indexSource, /cargoVolumeCBM,\s*palletQuantity,\s*deckHeight,\s*targetTemperatureCelsius,\s*requiresControlledAtmosphere,\s*auxiliaryGensetDailyCost/);

  // Verify window.activeVoyage publication
  assert.match(indexSource, /window\.activeVoyage\s*=\s*activeVoyagePayload;/);
  assert.match(indexSource, /window\.State\.activeVoyage\s*=\s*activeVoyagePayload;/);
  assert.match(indexSource, /window\.State\.cargoVolumeCBM\s*=\s*cargoVolumeCBM;/);
  assert.match(indexSource, /window\.State\.palletQuantity\s*=\s*palletQuantity;/);

  // Verify dispatch of voyageCalculated
  assert.match(indexSource, /window\.dispatchEvent\(new CustomEvent\('voyageCalculated', \{ detail: activeVoyagePayload \}\)\)/);

  // Verify DSS hydration in syncDecisionesFromCalculator
  assert.match(indexSource, /dssFormState\.cargoVolumeCBM\s*=\s*cargoVolumeCBM;/);
  assert.match(indexSource, /dssFormState\.palletQuantity\s*=\s*palletQuantity;/);
  assert.match(indexSource, /dssFormState\.targetTemperatureCelsius\s*=\s*targetTemperatureCelsius;/);
  assert.match(indexSource, /dssFormState\.requiresControlledAtmosphere\s*=\s*requiresControlledAtmosphere;/);
});
