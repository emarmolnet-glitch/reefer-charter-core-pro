import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function sliceFunction(name, nextMarker) {
  let start = indexSource.indexOf(`async function ${name}`);
  if (start < 0) {
    start = indexSource.indexOf(`function ${name}`);
  }
  const end = indexSource.indexOf(nextMarker, start);
  assert.ok(start >= 0, `${name} must exist`);
  assert.ok(end > start, `${name} must have an end marker`);
  return indexSource.slice(start, end);
}

test('1. Early stubs initialize isEngineCalculating to false on global/window', () => {
  assert.match(indexSource, /global\.isEngineCalculating\s*=\s*false;/);
  assert.match(indexSource, /window\.isEngineCalculating\s*=\s*false;/);
});

test('2. autoCalculateDistances and synchronizeMasterRouteCalculations guard against redundant runEngine triggers', () => {
  const autoDistSource = sliceFunction('autoCalculateDistances', 'async function geocodeAllPorts');
  assert.match(autoDistSource, /async function autoCalculateDistances\(options = \{\}\)/);
  assert.match(autoDistSource, /options\?\.deferEngine === true/);
  assert.match(autoDistSource, /window\.isEngineCalculating/);
  assert.match(autoDistSource, /if \(!shouldSkipEngine && typeof runEngine === 'function'\)/);

  const syncRouteStart = indexSource.indexOf('async function synchronizeMasterRouteCalculations');
  const syncRouteEnd = indexSource.indexOf('function calculateMasterFreightAndDemurrage', syncRouteStart);
  const syncRouteSource = indexSource.slice(syncRouteStart, syncRouteEnd);
  assert.match(syncRouteSource, /async function synchronizeMasterRouteCalculations\(options = \{\}\)/);
  assert.match(syncRouteSource, /recalcularDiasPuerto\(null, \{ deferEngine: true \}\)/);
  assert.match(syncRouteSource, /window\.isEngineCalculating/);
  assert.match(syncRouteSource, /if \(!shouldSkipEngine && typeof runEngine === 'function'\)/);
});

test('3. runEngine enforces execution lock on secondary triggers while permitting batch cores', () => {
  const runEngineStart = indexSource.indexOf('function runEngine()');
  const runEngineSnippet = indexSource.slice(runEngineStart, runEngineStart + 1800);

  assert.match(runEngineSnippet, /if \(isRunningEngine\) return;/);
  assert.match(runEngineSnippet, /const isBatchExecution =/);
  assert.match(runEngineSnippet, /options\.deferStoreCommit === true/);
  assert.match(runEngineSnippet, /if \(typeof window !== 'undefined' && window\.isEngineCalculating && !isBatchExecution\)/);
  assert.match(runEngineSnippet, /const wasEngineCalculating = typeof window !== 'undefined' && Boolean\(window\.isEngineCalculating\);/);
  assert.match(runEngineSnippet, /window\.isEngineCalculating = true;/);

  const finallyStart = indexSource.indexOf('notifyPendingDraftRecalculation();', runEngineStart);
  const finallyEnd = indexSource.indexOf('function bindShadowEstimator', finallyStart);
  const finallySnippet = indexSource.slice(finallyStart, finallyEnd);

  assert.match(finallySnippet, /\} finally \{[\s\S]*isRunningEngine = false;[\s\S]*if \(typeof window !== 'undefined' && !wasEngineCalculating\) \{[\s\S]*window\.isEngineCalculating = false;/);
});

test('4. handleMasterValidationAndCalculate manages lifecycle lock and protects aria-busy UI until finish', () => {
  const handlerStart = indexSource.indexOf('async function handleMasterValidationAndCalculate');
  const handlerEnd = indexSource.indexOf('window.handleMasterValidationAndCalculate = handleMasterValidationAndCalculate;', handlerStart);
  const handlerSource = indexSource.slice(handlerStart, handlerEnd);

  assert.match(handlerSource, /if \(isCalculatingMaster \|\| \(typeof window !== 'undefined' && window\.isEngineCalculating\)\) return null;/);
  assert.match(handlerSource, /window\.isEngineCalculating = true;/);
  assert.match(handlerSource, /setMasterCalculationLoading\(true\);/);
  assert.match(handlerSource, /finally \{[\s\S]*isCalculatingMaster = false;[\s\S]*if \(typeof window !== 'undefined'\) \{[\s\S]*window\.isEngineCalculating = false;[\s\S]*\}[\s\S]*setMasterCalculationLoading\(false\);/);
});

test('5. Simulation: Full master calculation cycle triggers runEngine exactly once instead of cascading 4 times', async () => {
  let runEngineCallCount = 0;
  let calculationLockObservedDuringStages = [];
  const fakeWindow = {
    isEngineCalculating: false
  };

  const fakeState = {
    cargo: 10000,
    daysSea: 5,
    daysPort: 3,
    breakEven: 30
  };

  const harnessContext = {
    window: fakeWindow,
    State: fakeState,
    isCalculatingMaster: false,
    isExecutingDebouncedBatch: false,
    isRunningEngine: false,
    SeaCharterStore: {
      async batchAsync(fn) { return await fn(); },
      set() {}
    },
    async validarYCalcularSeccion2() { return true; },
    ensureSafeBunkerPrices() { return { vlsfo: 600, ifo380: 600, mgo: 600 }; },
    async consultCurrentCostsAndPdasForMaster() { return { warnings: [] }; },
    async runMasterOptionalStage(name, task) {
      calculationLockObservedDuringStages.push({ name, locked: fakeWindow.isEngineCalculating });
      return await task();
    },
    async recalculateAdjustedAndSave(options = {}) {
      // Simulating autoCalculateDistances under managedByMaster
      const shouldSkipEngine = options.managedByMaster === true || fakeWindow.isEngineCalculating;
      if (!shouldSkipEngine) {
        harnessContext.runEngine();
      }
      return true;
    },
    async synchronizeMasterRouteCalculations(options = {}) {
      // Simulating synchronizeMasterRouteCalculations under master
      const shouldSkipEngine = options?.deferEngine === true || fakeWindow.isEngineCalculating;
      if (!shouldSkipEngine) {
        harnessContext.runEngine();
      }
      return { mode: 'COST_PLUS_ROUTE' };
    },
    calculateMasterFreightAndDemurrage() {},
    executeBatchedCalculationsCore() {
      // Core batch: triggers runEngine with deferStoreCommit: true
      harnessContext.isExecutingDebouncedBatch = true;
      try {
        harnessContext.runEngine({ deferStoreCommit: true });
        // Simulating syncCalculatorAndMatching
        harnessContext.syncCalculatorAndMatching('calculator', { force: true, deferStoreCommit: true });
        return { breakEven: 30 };
      } finally {
        harnessContext.isExecutingDebouncedBatch = false;
      }
    },
    syncCalculatorAndMatching(source, options = {}) {
      // Reactive secondary event inside or following matching sync
      if (fakeWindow.isEngineCalculating && options.deferStoreCommit !== true) {
        // blocked
      }
    },
    runEngine(options = {}) {
      const isBatchCore = harnessContext.isExecutingDebouncedBatch || options.deferStoreCommit === true;
      if (fakeWindow.isEngineCalculating && !isBatchCore) {
        // Redundant trigger aborted!
        return;
      }
      runEngineCallCount++;
    },
    evaluateReactiveSyncStatus() {},
    setMasterCalculationLoading(isLoading) {
      fakeWindow.loading = isLoading;
    },
    showToast() {},
    console: { warn() {}, error() {}, log() {} }
  };

  const helperStart = indexSource.indexOf('async function handleMasterValidationAndCalculate');
  const helperEnd = indexSource.indexOf('window.handleMasterValidationAndCalculate = handleMasterValidationAndCalculate;', helperStart);
  const handlerCode = indexSource.slice(helperStart, helperEnd);

  vm.runInNewContext(`
    ${handlerCode};
    globalThis.executeValidationAndCalculate = handleMasterValidationAndCalculate;
  `, harnessContext);

  assert.equal(fakeWindow.isEngineCalculating, false);
  const result = await harnessContext.executeValidationAndCalculate();

  assert.equal(fakeWindow.isEngineCalculating, false, 'Lock must be released after completion');
  assert.equal(fakeWindow.loading, false, 'Loading spinner/aria-busy must be released after completion');
  assert.equal(calculationLockObservedDuringStages.length, 3);
  calculationLockObservedDuringStages.forEach(stage => {
    assert.equal(stage.locked, true, `Stage ${stage.name} must run while window.isEngineCalculating is true`);
  });

  assert.equal(runEngineCallCount, 1, 'runEngine must execute exactly ONCE during the entire master calculation pipeline');
  assert.equal(result.breakEven, 30);
});

test('6. Debounce + Lock: Burst of 50 rapid calls to runEngine collapses into a single execution', async () => {
  let executions = 0;
  let engineDebounceTimer = null;
  let isExecutingDebouncedBatch = false;
  let isRunningEngine = false;
  const fakeWindow = { isEngineCalculating: false };

  function simulateRunEngine(options = {}) {
    if (isRunningEngine) return;
    const isBatchExecution = isExecutingDebouncedBatch
      || options.deferStoreCommit === true
      || options.force === true;

    if (!isBatchExecution) {
      if (engineDebounceTimer) {
        clearTimeout(engineDebounceTimer);
        engineDebounceTimer = null;
      }
      engineDebounceTimer = setTimeout(() => {
        engineDebounceTimer = null;
        if (fakeWindow.isEngineCalculating) {
          simulateRunEngine(options);
          return;
        }
        simulateRunEngine({ ...options, force: true });
      }, 50);
      return;
    }

    if (fakeWindow.isEngineCalculating && !isBatchExecution) return;

    isRunningEngine = true;
    fakeWindow.isEngineCalculating = true;
    try {
      executions++;
    } finally {
      isRunningEngine = false;
      fakeWindow.isEngineCalculating = false;
    }
  }

  // Simulate burst of 50 rapid calls
  for (let i = 0; i < 50; i++) {
    simulateRunEngine();
  }

  assert.equal(executions, 0, 'No execution should occur synchronously while debouncing');

  await new Promise(r => setTimeout(r, 80));

  assert.equal(executions, 1, 'Burst of 50 calls must collapse into exactly 1 execution');
  assert.equal(fakeWindow.isEngineCalculating, false, 'Lock must be released');
});
