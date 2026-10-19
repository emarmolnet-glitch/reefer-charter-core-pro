import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { calculateOptimalDwt, isTbnVessel } from '../src/hooks/useReeferAutoSizing.mjs';
import { buildVoyageStowagePlan } from '../src/voyage-stowage-builder.mjs';

test('1. calculateOptimalDwt correctly infers optimal DWT with 5% safety margin and round to next hundred', () => {
  // Test case 1: 10,000 MT * 1.8 SF = 18,000 CBM / 1.25 = 14,400 * 1.05 = 15,120 -> ceil to 100 -> 15,200 DWT
  const dwt1 = calculateOptimalDwt(10000, 1.8);
  assert.equal(dwt1, 15200);

  // Test case 2: 4,000 MT * 2.5 SF = 10,000 CBM / 1.25 = 8,000 * 1.05 = 8,400 -> ceil to 100 -> 8,400 DWT
  const dwt2 = calculateOptimalDwt(4000, 2.5);
  assert.equal(dwt2, 8400);

  // Test case 3: 5,000 MT * 1.2 SF = 6,000 CBM / 1.25 = 4,800 * 1.05 = 5,040 -> ceil to 100 -> 5,100 DWT
  const dwt3 = calculateOptimalDwt(5000, 1.2);
  assert.equal(dwt3, 5100);

  // Test case 4: invalid inputs return 0
  assert.equal(calculateOptimalDwt(0, 1.5), 0);
  assert.equal(calculateOptimalDwt(1000, 0), 0);
});

test('2. isTbnVessel accurately identifies TBN, To Be Named, and default states', () => {
  assert.equal(isTbnVessel('TBN'), true);
  assert.equal(isTbnVessel('tbn'), true);
  assert.equal(isTbnVessel('MV TBN'), true);
  assert.equal(isTbnVessel('TBN (To Be Named)'), true);
  assert.equal(isTbnVessel('TO BE NOMINATED'), true);
  assert.equal(isTbnVessel(''), true);
  assert.equal(isTbnVessel(null), true);
  assert.equal(isTbnVessel(undefined), true);
  assert.equal(isTbnVessel({ name: 'TBN' }), true);
  assert.equal(isTbnVessel({ vesselName: 'MV TBN' }), true);

  // Named vessel is not TBN
  assert.equal(isTbnVessel('COOL SPIRIT'), false);
  assert.equal(isTbnVessel({ name: 'BALTIC STREAM' }), false);
});

test('3. buildVoyageStowagePlan suppresses OVERCAPACITY for TBN vessels and auto-sizes DWT', () => {
  // Overcapacity payload on TBN vessel
  const tbnVoyage = {
    vessel: 'TBN',
    cargo: 4000,
    cargoVolumeCBM: 10000,
    vesselCubicCapacity: 5750,
    cargoType: 'Frutas Tropicales y Exóticas',
    vesselType: 'Reefer Vessel',
    dwt: 6000,
  };

  const plan = buildVoyageStowagePlan(tbnVoyage);

  // Must NOT fail with ERROR or OVERCAPACITY because vessel is TBN and auto-sizes
  assert.equal(plan.status, 'OK', 'TBN vessel status should be OK');
  assert.equal(plan.hydrodynamicsAndSafety.isCubicCapacityExceeded, false, 'isCubicCapacityExceeded should be false for TBN');
  assert.equal(plan.hydrodynamicsAndSafety.safetyReport, '✓ CUMPLE CAPACIDAD CÚBICA');
  assert.equal(plan.hydrodynamicsAndSafety.imoCompliance, '100%');
  assert.equal(plan.hydrodynamicsAndSafety.isTbn, true);
  assert.ok(plan.hydrodynamicsAndSafety.optimalDwt > 0, 'optimalDwt should be calculated');
  assert.match(
    plan.hydrodynamicsAndSafety.autoSizingBadge,
    /⚡ Buque auto-dimensionado a \d+ DWT según exigencias volumétricas\./
  );
});

test('4. UI templates and components contain dynamic UI badge and suppress red alert', async () => {
  const [visualSource, indexSource, workspaceSource] = await Promise.all([
    readFile(new URL('../src/components/VisualStowagePlan.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../TceCalculatorWorkspace.tsx', import.meta.url), 'utf8'),
  ]);

  // VisualStowagePlan badge and suppression
  assert.match(visualSource, /isTbn/);
  assert.match(visualSource, /⚡ Buque auto-dimensionado a \{optimalDwt\} DWT según exigencias volumétricas\./);

  // index.html badge
  assert.match(indexSource, /id="tbn-auto-sizing-badge"/);
  assert.match(indexSource, /⚡ Buque auto-dimensionado a/);
  assert.match(indexSource, /según exigencias volumétricas\./);

  // TceCalculatorWorkspace badge and hook integration
  assert.match(workspaceSource, /useReeferAutoSizing/);
  assert.match(workspaceSource, /⚡ Buque auto-dimensionado a \{optimalDwt\} DWT según exigencias volumétricas\./);
});
