import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import esbuild from 'esbuild';

const tceWorkspaceSource = await readFile(new URL('../TceCalculatorWorkspace.tsx', import.meta.url), 'utf8');
const componentWorkspaceSource = await readFile(new URL('../src/components/TceCalculatorWorkspace.tsx', import.meta.url), 'utf8');

// Bundle TceCalculatorWorkspace into a self-contained IIFE/CJS object for VM execution
const bundleResult = await esbuild.build({
  stdin: {
    contents: tceWorkspaceSource,
    resolveDir: process.cwd(),
    loader: 'tsx',
  },
  bundle: true,
  format: 'cjs',
  write: false,
  plugins: [{
    name: 'mock-externals',
    setup(build) {
      build.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'mock' }));
      build.onLoad({ filter: /^react$/, namespace: 'mock' }, () => ({
        contents: 'module.exports = { useEffect: () => {}, useMemo: (fn) => fn(), useRef: () => ({ current: null }), useState: (v) => [v, () => {}] };',
      }));
    },
  }],
});

const sandbox = {
  module: { exports: {} },
  exports: {},
  window: {
    location: { protocol: 'https:', origin: 'https://app.seacharter.com', search: '', href: 'https://app.seacharter.com' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  document: { getElementById: () => null, querySelector: () => null },
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
  console,
  setTimeout,
  clearTimeout,
};
vm.createContext(sandbox);
vm.runInContext(bundleResult.outputFiles[0].text, sandbox);

const {
  calculateCoreFreight,
  calculateReverseTceResults,
  calculateSuggestedFreight,
  MATRIZ_ESTACIONAL_GLOBAL,
  MIN_PDA_POL_REEFER,
  MIN_PDA_POD_REEFER,
} = sandbox.module.exports;

test('1. Static Analysis: TceCalculatorWorkspace applies unconditional Reefer PDA floors', () => {
  assert.equal(MIN_PDA_POL_REEFER, 28000);
  assert.equal(MIN_PDA_POD_REEFER, 26000);

  // Verifies unconditional floor syntax
  assert.match(tceWorkspaceSource, /polCost\s*=\s*Math\.max\(polCost,\s*28000\);/);
  assert.match(tceWorkspaceSource, /podCost\s*=\s*Math\.max\(podCost,\s*26000\);/);
  assert.match(tceWorkspaceSource, /const portCosts = polCost \+ podCost;/);
  // Verifies no conditional wrapper on the PDA floor
  assert.doesNotMatch(tceWorkspaceSource, /if\s*\(values\.commodity === 'Reefer'\)\s*\{\s*polCost\s*=\s*Math\.max/);

  // Both root and src/components paths resolve identical content
  assert.match(componentWorkspaceSource, /polCost\s*=\s*Math\.max\(polCost,\s*28000\);/);
  assert.match(componentWorkspaceSource, /podCost\s*=\s*Math\.max\(podCost,\s*26000\);/);
});

test('2. calculateCoreFreight unconditionally enforces $28,000 POL and $26,000 POD minimums', () => {
  // Even with low raw port costs and without explicit commodity, unconditional floor applies
  const stateWithoutCommodity = {
    tceTarget: 15000,
    cargoVolume: 10000,
    daysSea: 10,
    daysPort: 5,
    seaFuelConsumption: 10,
    portFuelConsumption: 1,
    vlsfoPrice: 600,
    ifoPrice: 0,
    mgoPrice: 800,
    portCosts: 20000, // $20,000 total -> would be $10k POL / $10k POD without floor
    totalCo2Emissions: 0,
    euaPrice: 0,
    etsCoverage: 0,
    hasScrubber: false,
  };

  const results = calculateCoreFreight(stateWithoutCommodity);

  // POL floored from $10k to $28k, POD floored from $10k to $26k -> Total portCosts = $54,000
  assert.equal(results.polCost, 28000);
  assert.equal(results.podCost, 26000);
  assert.equal(results.portCosts, 54000);

  // Bunker: sea = 10 * 10 * 600 = 60,000; port = 5 * 1 * 800 = 4,000; total = 64,000
  // Total costs: (15000 * 15) + 64000 + 54000 + 0 = 225,000 + 64,000 + 54,000 = 343,000
  assert.equal(results.totalCosts, 343000);
  // minFreightRate = 343,000 / 10,000 = 34.30
  assert.equal(results.minFreightRate, 34.30);
});

test('3. calculateCoreFreight respects explicit higher asymmetric polCost and podCost', () => {
  const asymmetricState = {
    tceTarget: 10000,
    cargoVolume: 10000,
    daysSea: 5,
    daysPort: 2,
    seaFuelConsumption: 5,
    portFuelConsumption: 1,
    vlsfoPrice: 500,
    ifoPrice: 0,
    mgoPrice: 700,
    portCosts: 0,
    polCost: 35000, // Above $28k minimum -> remains $35,000
    podCost: 15000, // Below $26k minimum -> floored to $26,000
    totalCo2Emissions: 0,
    euaPrice: 0,
    etsCoverage: 0,
    hasScrubber: false,
  };

  const results = calculateCoreFreight(asymmetricState);

  assert.equal(results.polCost, 35000);
  assert.equal(results.podCost, 26000);
  assert.equal(results.portCosts, 61000);
});

test('4. Cost-Plus calculator also unconditionally enforces minimum PDAs', () => {
  const costPlusState = {
    dailyOpex: 5000,
    targetMargin: 10,
    marginType: 'percentage',
    daysSea: 5,
    daysPort: 5,
    bunkerCost: 30000,
    portCosts: 18000, // $18k -> floored to $28k + $26k = $54k
    cargoVolume: 5000,
  };

  const costPlusResults = calculateCoreFreight(costPlusState);

  assert.equal(costPlusResults.polCost, 28000);
  assert.equal(costPlusResults.podCost, 26000);
  assert.equal(costPlusResults.portCosts, 54000);
  // totalOpex: 5000 * 10 = 50,000. totalCosts = 50,000 + 30,000 + 54,000 = 134,000
  assert.equal(costPlusResults.totalCosts, 134000);
});

test('5. calculateReverseTceResults incorporates floored PDAs and outputs freightBuy and freightSell with seasonality', () => {
  const reverseParams = {
    tceTarget: 15000,
    cargoVolume: 20000,
    daysSea: 8,
    daysPort: 12,
    seaFuelConsumption: 5.5,
    portFuelConsumption: 0.5,
    vlsfoPrice: 610,
    ifoPrice: 0,
    mgoPrice: 830,
    bunkerCost: 100000,
    portCosts: 25000, // generic DWT calculation (< 54k)
    bunkerDailyPortCost: 2000,
    totalCo2Emissions: 0,
    euaPrice: 0,
    etsCoverage: 0,
    opexDaily: 3000,
    contractShipments: 1,
    ownerMarginPercent: 10,
    chartererMarginPercent: 5,
    hasScrubber: false,
    laycanDiasLibres: 0,
    impactoRiesgo: 0,
    riesgoDias: 0,
    applyBunkerIndexAdjustment: false,
    contractBunkerIndexBase: 0,
  };

  const results = calculateReverseTceResults(reverseParams);

  assert.equal(results.portCosts, 54000);
  assert.equal(results.polCost, 28000);
  assert.equal(results.podCost, 26000);

  // Verifies freightBuy and freightSell are defined
  assert.ok(typeof results.freightBuy === 'number');
  assert.ok(typeof results.freightSell === 'number');
  assert.ok(typeof results.seasonalMultiplier === 'number');
  assert.ok(results.seasonalMultiplier >= 1.0);
  assert.equal(results.freightSell, results.suggestedChartererSale);
});

test('6. calculateSuggestedFreight applies seasonality without requiring a strict commodity check', () => {
  // South America with no commodity provided defaults to Reefer seasonality
  const freightSA = calculateSuggestedFreight({
    ownerBaseCost: 100,
    commercialMargin: 0.10,
    region: 'South America',
    month: 1,
  });
  // 100 * 1.10 * 1.30 = 143.00
  assert.equal(freightSA, 143.00);

  // Unknown region defaults to 1.0 factor
  const freightDefault = calculateSuggestedFreight({
    ownerBaseCost: 100,
    commercialMargin: 0.10,
    region: 'North Sea',
    month: 1,
  });
  // 100 * 1.10 * 1.0 = 110.00
  assert.equal(freightDefault, 110.00);
});
