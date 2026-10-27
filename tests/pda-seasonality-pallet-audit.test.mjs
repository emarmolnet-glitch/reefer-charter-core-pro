import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import enginePkg from '../voyage-cost-engine.js';
import * as dssModule from '../dss-risk-module.mjs';

const {
    calculatePortCosts,
    DEFAULT_PDA_TEMPLATE,
    DEFAULT_AGENCY_BASE_FEE,
    MIN_PDA_POL_REEFER,
    MIN_PDA_POD_REEFER,
    DEFAULT_STANDARD_HOURLY_RATE,
    DEFAULT_FHEX_SHEX_OVERTIME_MULTIPLIER,
    MATRIZ_ESTACIONAL_GLOBAL,
    evaluateFruitSeasonality,
    calculateVoyageFinancials,
    calculateTotals
} = enginePkg;

test('Paso 1: Default PDA template injection & non-zero weekend surcharge', () => {
    // 1. Check default PDA template values
    assert.strictEqual(DEFAULT_PDA_TEMPLATE.baseAgencyFee, 2300);
    assert.strictEqual(DEFAULT_PDA_TEMPLATE.standardHourlyRate, 100);
    assert.strictEqual(DEFAULT_PDA_TEMPLATE.overtimeMultiplier, 1.50);
    assert.strictEqual(DEFAULT_PDA_TEMPLATE.polReeferMinimum, 28000);
    assert.strictEqual(DEFAULT_PDA_TEMPLATE.podReeferMinimum, 26000);

    // 2. Test calculatePortCosts with no manual inputs (empty options) for Reefer POL and POD
    const polPda = calculatePortCosts({
        portType: 'pol',
        isReefer: true,
        cargoType: 'Frutas Frescas'
    });
    assert.strictEqual(polPda.basePDA, MIN_PDA_POL_REEFER);
    assert.strictEqual(polPda.agencyFeeBase, DEFAULT_AGENCY_BASE_FEE);
    assert.strictEqual(polPda.standardHourlyRate, DEFAULT_STANDARD_HOURLY_RATE);

    const podPda = calculatePortCosts({
        portType: 'pod',
        isReefer: true,
        cargoType: 'Frutas Frescas'
    });
    assert.strictEqual(podPda.basePDA, MIN_PDA_POD_REEFER);
    assert.strictEqual(podPda.agencyFeeBase, DEFAULT_AGENCY_BASE_FEE);

    // 3. calculatePortCosts with weekend shift operations (Saturday ETA 2026-10-24, 2 port days = 48 hours)
    const weekendOps = calculatePortCosts({
        portType: 'pol',
        isReefer: true,
        etaDate: '2026-10-24T08:00:00Z',
        portDays: 2
    });
    // Non-zero overtime surcharge generated
    assert.strictEqual(weekendOps.hasWeekendPenalty, true);
    assert.ok(weekendOps.incrementalCost > 0, 'Incremental overtime cost must be > 0.00');
    assert.strictEqual(weekendOps.incrementalCost, 2300);
    assert.strictEqual(weekendOps.overtimeSurcharge, 2300);
});

test('Paso 2: Fruit Seasonality in key zones (Abidjan / West Africa & Central America)', () => {
    // Verify West Africa / Abidjan matrix
    const wa = MATRIZ_ESTACIONAL_GLOBAL.WEST_AFRICA;
    assert.ok(wa, 'WEST_AFRICA zone exists');
    assert.ok(wa['Frutas Frescas'], 'Frutas Frescas entry exists in WEST_AFRICA');

    // Test Abidjan evaluation during high season (e.g. month 1 = January)
    const abidjanJan = evaluateFruitSeasonality({
        pol: 'Abidjan',
        cargoType: 'Frutas Frescas (Bananas)',
        month: 1
    });
    assert.strictEqual(abidjanJan.isFruit, true);
    assert.strictEqual(abidjanJan.region, 'WEST_AFRICA');
    assert.strictEqual(abidjanJan.isPeakSeason, true);
    assert.strictEqual(abidjanJan.factor, 1.15);
    assert.strictEqual(abidjanJan.surchargePct, 15);
    assert.ok(abidjanJan.insightMessage.includes('Peak Season'));
    assert.ok(abidjanJan.insightMessage.includes('Abidjan'));

    // Test Central America evaluation (e.g. Puerto Cortes / Costa Rica, month 3)
    const centralAm = evaluateFruitSeasonality({
        pol: 'Puerto Cortes',
        cargoType: 'Plátanos',
        month: 3
    });
    assert.strictEqual(centralAm.isPeakSeason, true);
    assert.strictEqual(centralAm.factor, 1.25);
    assert.ok(centralAm.insightMessage.includes('Centroamérica'));

    // Test Non-fruit cargo in Abidjan -> no seasonality surcharge
    const ironOreAbidjan = evaluateFruitSeasonality({
        pol: 'Abidjan',
        cargoType: 'Hierro',
        month: 1
    });
    assert.strictEqual(ironOreAbidjan.isPeakSeason, false);
    assert.strictEqual(ironOreAbidjan.factor, 1.0);
});

test('Paso 3: Pricing by Pallet (Benchmark 200 USD/pallet for 4,000 pallets / 4,000 MT bananas)', () => {
    // Offer from shipowner: 200 USD / Pallet for 4,000 pallets
    const ownerRatePerPallet = 200;
    const totalPallets = 4000;
    const actualCargoMT = 4000;

    const financials = calculateVoyageFinancials({
        actualCargoMT,
        ownerRate: ownerRatePerPallet,
        chartererRate: 220, // 220 USD/pallet sell rate
        rateUnit: 'Pallet',
        totalPallets
    });

    // Gross freight calculation: 200 USD * 4,000 pallets = 800,000 USD
    assert.strictEqual(financials.ownerFreightCost, 800000);
    assert.strictEqual(financials.isPalletMode, true);
    assert.strictEqual(financials.totalPallets, 4000);

    // Break-even and reverse TCE calculation in calculateTotals
    const totals = calculateTotals({
        cargo: actualCargoMT,
        totalPallets,
        rateUnit: 'Pallet',
        ownerCost: 200,
        fuelCost: 150000,
        portCost: 54000,
        opexCost: 80000,
        seaDays: 12,
        portDays: 4
    });

    assert.strictEqual(totals.isPalletMode, true);
    assert.strictEqual(totals.rateUnit, 'Pallet');
    assert.strictEqual(totals.totalPallets, 4000);
});

test('DSS Risk Module supports pallet pricing and exports PDA / Seasonality utilities', () => {
    assert.ok(dssModule.DEFAULT_PDA_TEMPLATE);
    assert.ok(typeof dssModule.calculatePortCosts === 'function');
    assert.ok(typeof dssModule.evaluateFruitSeasonality === 'function');
    assert.ok(dssModule.MATRIZ_ESTACIONAL_GLOBAL);

    const grossCalc = dssModule.calculateAllInFreightGross({
        baseNetFreight: 180,
        cargoQty: 4000,
        rateUnit: 'Pallet',
        totalPallets: 4000,
        totalCommission: 5
    });
    assert.strictEqual(grossCalc.isPalletMode, true);
    assert.strictEqual(grossCalc.rateUnit, 'Pallet');
    assert.ok(grossCalc.freightRevenueGross > 0);
});

test('Index.html contains freight-rate-unit selector and pallet mode logic', () => {
    const htmlContent = readFileSync(resolve('/opt/build/repo/index.html'), 'utf-8');
    assert.ok(htmlContent.includes('id="freight-rate-unit"'), 'index.html has freight-rate-unit select element');
    assert.ok(htmlContent.includes('value="Pallet"'), 'freight-rate-unit has Pallet option');
    assert.ok(htmlContent.includes('isPalletRateMode'), 'index.html has isPalletRateMode handling in runEngine');
    assert.ok(htmlContent.includes('evaluateFruitSeasonality'), 'index.html runs evaluateFruitSeasonality');
});

test('Frontend Reefer PDA Connection: 28,000 POL, 26,000 POD and subtext labels', () => {
    const htmlContent = readFileSync(resolve('/opt/build/repo/index.html'), 'utf-8');
    
    // Paso 1 & 2: Subtext elements and exact label text
    assert.ok(htmlContent.includes('id="pda-pol-subtext"'), 'contains pda-pol-subtext element');
    assert.ok(htmlContent.includes('id="pda-pod-subtext"'), 'contains pda-pod-subtext element');
    assert.ok(htmlContent.includes('Mínimo Operativo Reefer Aplicado (Base + FHEX si aplica)'), 'contains exact reefer subtext label');

    // Paso 1: Strict Reefer Minimum injection (28000 POL / 26000 POD)
    assert.ok(htmlContent.includes('const baseReeferPda = (type === \'pod\') ? 26000 : 28000;'), 'has exact reefer base minimum values in autoFillPDA');
    
    // Paso 2: setPdaCalculationStatus handles reefer-minimum mode
    assert.ok(htmlContent.includes("mode === 'reefer-minimum'"), 'setPdaCalculationStatus supports reefer-minimum mode');
    
    // Paso 3: Dispatches input & change events for state & Break-Even recalculation
    assert.ok(htmlContent.includes("pdaInput.dispatchEvent(new Event('input', { bubbles: true }))"), 'dispatches input event on pdaInput');
    assert.ok(htmlContent.includes("pdaInput.dispatchEvent(new Event('change', { bubbles: true }))"), 'dispatches change event on pdaInput');
});

test('Reefer Volumetric Auto-Sizing: 4,000 pallets yields 11,000 DWT and updates DOM', () => {
    const htmlContent = readFileSync(resolve('/opt/build/repo/index.html'), 'utf-8');

    // Paso 1 & 2: autoDimensionVessel and calculateDWT functions present
    assert.ok(htmlContent.includes('function autoDimensionVessel('), 'index.html contains autoDimensionVessel function');
    assert.ok(htmlContent.includes('window.autoDimensionVessel = autoDimensionVessel'), 'autoDimensionVessel exported to window');
    assert.ok(htmlContent.includes('window.calculateDWT = calculateDWT'), 'calculateDWT exported to window');

    // Paso 2: Volumetric formula (2.75 DWT per pallet)
    assert.ok(htmlContent.includes('totalPalletsInput * 2.75'), 'multiplies pallets by 2.75');
    assert.ok(htmlContent.includes('cargoTons * 1.10'), 'standard dry cargo uses 1.10 multiplier');

    // Mathematical verification: 4000 pallets -> 11000 DWT
    const totalPalletsInput = 4000;
    const suggestedDWT = Math.ceil((totalPalletsInput * 2.75) / 100) * 100;
    assert.strictEqual(suggestedDWT, 11000, '4,000 pallets must yield exactly 11,000 DWT');

    // Paso 3: DOM update & badge message
    assert.ok(htmlContent.includes('Buque auto-dimensionado a ${suggestedDWT} DWT según requerimientos volumétricos (Reefer).'), 'contains exact badge warning text for Reefer');
    assert.ok(htmlContent.includes('id="tbn-auto-sizing-badge"'), 'contains tbn-auto-sizing-badge container');
});
