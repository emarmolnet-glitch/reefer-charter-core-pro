import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import esbuild from 'esbuild';

const tceWorkspaceSource = await readFile(new URL('../TceCalculatorWorkspace.tsx', import.meta.url), 'utf8');

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
  MATRIZ_ESTACIONAL_GLOBAL,
  normalizeRegion,
  calculateSuggestedFreight,
  calculateReverseTceResults,
} = sandbox.module.exports;

test('1. MATRIZ_ESTACIONAL_GLOBAL structure and values', () => {
  assert.equal(MATRIZ_ESTACIONAL_GLOBAL.WEST_AFRICA.Reefer[1], 1.15);
  assert.equal(MATRIZ_ESTACIONAL_GLOBAL.WEST_AFRICA.Reefer[3], 1.18);
  assert.equal(MATRIZ_ESTACIONAL_GLOBAL.WEST_AFRICA.Reefer[10], 1.20);
  assert.equal(MATRIZ_ESTACIONAL_GLOBAL.WEST_AFRICA.Grain[10], 1.22);
  assert.equal(MATRIZ_ESTACIONAL_GLOBAL.WEST_AFRICA.Grain[11], 1.25);

  assert.equal(MATRIZ_ESTACIONAL_GLOBAL.SOUTH_AMERICA.Reefer[1], 1.30);
  assert.equal(MATRIZ_ESTACIONAL_GLOBAL.SOUTH_AMERICA.Reefer[2], 1.32);
  assert.equal(MATRIZ_ESTACIONAL_GLOBAL.SOUTH_AMERICA.Reefer[3], 1.35);
  assert.equal(MATRIZ_ESTACIONAL_GLOBAL.SOUTH_AMERICA.Grain[3], 1.30);
  assert.equal(MATRIZ_ESTACIONAL_GLOBAL.SOUTH_AMERICA.Grain[4], 1.38);

  assert.equal(MATRIZ_ESTACIONAL_GLOBAL.MEDITERRANEAN.Citrus[0], 1.15);
  assert.equal(MATRIZ_ESTACIONAL_GLOBAL.MEDITERRANEAN.Citrus[1], 1.18);
  assert.equal(MATRIZ_ESTACIONAL_GLOBAL.MEDITERRANEAN.Citrus[11], 1.15);

  assert.equal(MATRIZ_ESTACIONAL_GLOBAL.SOUTH_EAST_ASIA.Rice[10], 1.16);
  assert.equal(MATRIZ_ESTACIONAL_GLOBAL.SOUTH_EAST_ASIA.Rice[11], 1.18);
});

test('2. normalizeRegion normalizes regional inputs accurately', () => {
  assert.equal(normalizeRegion('West Africa'), 'WEST_AFRICA');
  assert.equal(normalizeRegion('WAF'), 'WEST_AFRICA');
  assert.equal(normalizeRegion('South America'), 'SOUTH_AMERICA');
  assert.equal(normalizeRegion('ECSA'), 'SOUTH_AMERICA');
  assert.equal(normalizeRegion('Mediterranean'), 'MEDITERRANEAN');
  assert.equal(normalizeRegion('Spain Port'), 'MEDITERRANEAN');
  assert.equal(normalizeRegion('South East Asia'), 'SOUTH_EAST_ASIA');
  assert.equal(normalizeRegion('Asia Pacific'), 'SOUTH_EAST_ASIA');
  assert.equal(normalizeRegion('North Sea'), 'DEFAULT');
  assert.equal(normalizeRegion(null), 'DEFAULT');
  assert.equal(normalizeRegion(undefined), 'DEFAULT');
});

test('3. calculateSuggestedFreight computes seasonal freight rates with commercial margin', () => {
  // South America, Reefer, month 1 (factor 1.30)
  // ownerBaseCost: 100, commercialMargin: 0.15 (15%)
  // Base with margin: 100 * 1.15 = 115
  // Seasonal adjustment: 115 * 1.30 = 149.50
  const freightJanSA = calculateSuggestedFreight({
    ownerBaseCost: 100,
    commercialMargin: 0.15,
    region: 'South America',
    commodity: 'Reefer',
    month: 1,
  });
  assert.equal(freightJanSA, 149.50);

  // Unknown region/commodity/month defaults to 1.0 factor
  const freightDefault = calculateSuggestedFreight({
    ownerBaseCost: 100,
    commercialMargin: 0.15,
    region: 'North Sea',
    commodity: 'Reefer',
    month: 1,
  });
  assert.equal(freightDefault, 115.00);
});

test('4. calculateReverseTceResults incorporates intelligent suggested freight into return values', () => {
  const baseParams = {
    tceTarget: 15000,
    cargoVolume: 30000,
    daysSea: 10,
    daysPort: 5,
    seaFuelConsumption: 20,
    portFuelConsumption: 2,
    vlsfoPrice: 600,
    ifoPrice: 0,
    mgoPrice: 800,
    bunkerCost: 128000,
    portCosts: 50000,
    bunkerDailyPortCost: 1600,
    totalCo2Emissions: 600,
    euaPrice: 70,
    etsCoverage: 0.5,
    opexDaily: 4000,
    contractShipments: 4,
    ownerMarginPercent: 10,
    chartererMarginPercent: 5,
    hasScrubber: false,
    laycanDiasLibres: 0,
    impactoRiesgo: 0,
    riesgoDias: 0,
    applyBunkerIndexAdjustment: false,
    contractBunkerIndexBase: 0,
  };

  const results = calculateReverseTceResults(baseParams);

  assert.ok(typeof results.suggestedOwnerSale === 'number');
  assert.ok(typeof results.suggestedChartererSale === 'number');
  assert.ok(results.suggestedOwnerSale > 0);
  assert.ok(results.suggestedChartererSale > results.suggestedOwnerSale);
  // Charterer sale is derived from suggestedOwnerSale with chartererMarginPercent
  const expectedChartererSale = Number((results.suggestedOwnerSale * 1.05).toFixed(2));
  assert.equal(results.suggestedChartererSale, expectedChartererSale);
});
