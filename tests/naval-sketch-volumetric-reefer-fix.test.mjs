import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildVoyageStowagePlan,
  resolveVesselStowageProfile,
  validateCubicCapacity,
} from '../src/voyage-stowage-builder.mjs';

const visualStowageSource = readFileSync(new URL('../src/components/VisualStowagePlan.jsx', import.meta.url), 'utf8');
const modalSource = readFileSync(new URL('../src/components/VoyageExecutiveReportModal.jsx', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// ============================================================================
// OBJETIVO 1: Corrección de Textos y "Spanglish" en el Render 2D y PDF
// ============================================================================

test('Objetivo 1.1: Título dinámico o REEFER VESSEL (4 INDEPENDENT COMPARTMENTS) en lugar de HANDYSIZE / BULK CARRIER', () => {
  assert.match(
    visualStowageSource,
    /REEFER VESSEL \(4 INDEPENDENT COMPARTMENTS\)/,
    'Debe incluir REEFER VESSEL (4 INDEPENDENT COMPARTMENTS)'
  );
  assert.doesNotMatch(
    visualStowageSource,
    /HANDYSIZE \/ BULK CARRIER \(4 BODEGAS INDEPENDIENTES & GRÚAS\)/,
    'No debe contener el título estático anterior de Handysize Bulk Carrier'
  );
});

test('Objetivo 1.2: CUBIERTA SUPERIOR DESPEJADA sustituida por WEATHER DECK CLEARED', () => {
  assert.match(
    visualStowageSource,
    /WEATHER DECK CLEARED/,
    'Debe mostrar WEATHER DECK CLEARED'
  );
  assert.doesNotMatch(
    visualStowageSource,
    /CUBIERTA SUPERIOR \(WEATHER DECK\) DESPEJADA/,
    'No debe contener el texto anterior en Spanglish de cubierta superior'
  );
});

test('Objetivo 1.3: CASTILLO PROA sustituido por FORECASTLE', () => {
  assert.match(
    visualStowageSource,
    /<text[^>]*>\s*FORECASTLE\s*<\/text>/,
    'La etiqueta del castillo de proa debe ser FORECASTLE'
  );
});

test('Objetivo 1.4: Bodega Principal sustituida por Main Hold en perfiles navales', () => {
  const plan = buildVoyageStowagePlan({ cargo: 20000, dwt: 32000 });
  for (const hold of plan.holds) {
    assert.equal(hold.stowageTier, 'Main Hold', 'Cada compartimento debe tener stowageTier como Main Hold');
  }
  assert.match(
    visualStowageSource,
    /'Main Hold'/,
    'VisualStowagePlan debe utilizar Main Hold como tier por defecto'
  );
});

test('Objetivo 1.5: CARGA ACTIVA sustituida por ACTIVE CARGO', () => {
  assert.match(
    visualStowageSource,
    /<text[^>]*>\s*ACTIVE CARGO\s*<\/text>/,
    'El indicador de carga activa debe ser ACTIVE CARGO'
  );
  assert.doesNotMatch(
    visualStowageSource,
    /<text[^>]*>\s*CARGA ACTIVA\s*<\/text>/,
    'No debe contener CARGA ACTIVA en la bodega'
  );
});

test('Objetivo 1.6: WATERLINE sin Spanglish', () => {
  assert.match(
    visualStowageSource,
    /≈ ≈ ≈ WATERLINE ≈ ≈ ≈/,
    'La línea de flotación debe rotularse limpiamente como WATERLINE'
  );
  assert.doesNotMatch(
    visualStowageSource,
    /WATERLINE \/ CALADO DE DISEÑO/,
    'No debe contener Spanglish en el rótulo de waterline'
  );
});

test('Objetivo 1.7: Itinerario cambia "Puerto Lastre:" por "Ballast Port:"', () => {
  assert.match(
    modalSource,
    /<span className="text-slate-600">Ballast Port:<\/span>/,
    'VoyageExecutiveReportModal debe usar Ballast Port:'
  );
  assert.doesNotMatch(
    modalSource,
    /<span className="text-slate-600">Puerto Lastre:<\/span>/,
    'VoyageExecutiveReportModal no debe contener Puerto Lastre:'
  );

  assert.match(
    indexSource,
    /ballastPort:\s*"Ballast Port:",/,
    'index.html rTexts.es debe usar Ballast Port:'
  );
  assert.match(
    indexSource,
    /<span class="text-slate-400">Ballast Port:<\/span>/,
    'index.html sección COA debe usar Ballast Port:'
  );
});

// ============================================================================
// OBJETIVO 2: FIX CRÍTICO Lógica de Volumen vs Peso (Stowage Factor & Overcapacity)
// ============================================================================

test('Objetivo 2.1: Regla estricta validateCubicCapacity IF (Cargo_CBM > Vessel_Cubic_Capacity) { return ERROR }', () => {
  assert.equal(validateCubicCapacity(10000, 5750), 'ERROR', '10.000 CBM > 5.750 CBM debe retornar ERROR');
  assert.equal(validateCubicCapacity(5000, 5750), 'OK', '5.000 CBM <= 5.750 CBM debe retornar OK');
  assert.equal(validateCubicCapacity(5750, 5750), 'OK', '5.750 CBM == 5.750 CBM debe retornar OK');
});

test('Objetivo 2.2: Test de Caso Real: 4.000 MT de plátanos (10.000 CBM) en buque de 5.750 CBM', () => {
  const overcapacityVoyage = {
    cargo: 4000,
    cargoVolumeCBM: 10000, // 4.000 MT plátanos calculados en 10.000 CBM
    vesselCubicCapacity: 5750, // Capacidad máxima del buque
    cargoType: 'Frutas Tropicales y Exóticas',
    cargoProduct: 'Bananas/Plátanos (requiere 13°C)',
    vesselType: 'Reefer Vessel',
    class: 'Reefer',
    dwt: 6000,
  };

  const plan = buildVoyageStowagePlan(overcapacityVoyage);

  // 1. Debe arrastrar el valor real de 10.000 CBM (NO 3000 m³)
  assert.equal(
    plan.hydrodynamicsAndSafety.totalVolumeOccupiedCbm,
    10000,
    'Cubic Volume Occupied debe ser exactamente 10.000 m³'
  );
  assert.equal(
    plan.cargoClassification.totalVolumeCbm,
    10000,
    'Clasificación de carga debe reflejar 10.000 m³'
  );

  // 2. Capacidad del buque debe registrar 5.750 CBM
  assert.equal(
    plan.hydrodynamicsAndSafety.grainCapacityCbm,
    5750,
    'Capacidad cúbica del buque debe ser 5.750 m³'
  );

  // 3. Regla estricta: estado ERROR y bandera de exceso activa
  assert.equal(plan.status, 'ERROR', 'El estado del plan debe ser ERROR');
  assert.equal(plan.hydrodynamicsAndSafety.status, 'ERROR', 'El estado hidrodinámico debe ser ERROR');
  assert.equal(plan.hydrodynamicsAndSafety.isCubicCapacityExceeded, true, 'isCubicCapacityExceeded debe ser true');

  // 4. Porcentaje de ocupación real > 100% (10.000 / 5.750 = 173.91%)
  assert.ok(
    plan.hydrodynamicsAndSafety.volumeUtilizationShipPct > 100,
    'La utilización debe mostrar el porcentaje real mayor al 100%'
  );
  assert.equal(
    plan.hydrodynamicsAndSafety.volumeUtilizationShipPct.toFixed(1),
    '173.9',
    'La utilización debe ser exactamente 173.9%'
  );

  // 5. SAFETY REPORT debe marcar FAILED: OVERCAPACITY (DEADFREIGHT RISK)
  assert.equal(
    plan.hydrodynamicsAndSafety.safetyReport,
    'FAILED: OVERCAPACITY (DEADFREIGHT RISK)',
    'El dictamen de seguridad debe ser FAILED: OVERCAPACITY (DEADFREIGHT RISK)'
  );

  // 6. IMO COMPLIANCE debe marcar FAILED
  assert.equal(
    plan.hydrodynamicsAndSafety.imoCompliance,
    'FAILED',
    'IMO COMPLIANCE debe ser FAILED'
  );
});

test('Objetivo 2.3: Caso Válido sin sobrecapacidad (4.000 CBM en buque de 5.750 CBM)', () => {
  const validVoyage = {
    cargo: 2000,
    cargoVolumeCBM: 4000,
    vesselCubicCapacity: 5750,
    cargoType: 'Frutas Cítricas',
    vesselType: 'Reefer Vessel',
    dwt: 6000,
  };

  const plan = buildVoyageStowagePlan(validVoyage);

  assert.equal(plan.status, 'OK');
  assert.equal(plan.hydrodynamicsAndSafety.isCubicCapacityExceeded, false);
  assert.equal(plan.hydrodynamicsAndSafety.safetyReport, '✓ CUMPLE CAPACIDAD CÚBICA');
  assert.equal(plan.hydrodynamicsAndSafety.imoCompliance, '100%');
  assert.ok(plan.hydrodynamicsAndSafety.volumeUtilizationShipPct < 100);
});

test('Objetivo 2.4: VisualStowagePlan renderiza IMO COMPLIANCE en rojo, SAFETY REPORT y alerta visual ante sobrecapacidad', () => {
  // Verificación de estructura y clases condicionales en el componente React
  assert.match(
    visualStowageSource,
    /text-rose-800 bg-rose-50 border-rose-300/,
    'Debe pintar el badge de IMO COMPLIANCE en rojo ante sobrecapacidad'
  );
  assert.match(
    visualStowageSource,
    /IMO COMPLIANCE: FAILED/,
    'Debe indicar IMO COMPLIANCE: FAILED cuando se excede'
  );
  assert.match(
    visualStowageSource,
    /<th[^>]*>SAFETY REPORT<\/th>/,
    'La columna de la tabla debe titularse SAFETY REPORT'
  );
  assert.match(
    visualStowageSource,
    /'FAILED: OVERCAPACITY \(DEADFREIGHT RISK\)'/,
    'La celda de dictamen debe contener FAILED: OVERCAPACITY (DEADFREIGHT RISK)'
  );
  assert.match(
    visualStowageSource,
    /TECHNICAL AND HYDRODYNAMIC VALIDATION/,
    'Debe incluir el título en inglés TECHNICAL AND HYDRODYNAMIC VALIDATION'
  );
});

test('Objetivo 2.5: VoyageExecutiveReportModal arrastra cargoVolumeCBM hacia el plan de estiba', () => {
  assert.match(
    modalSource,
    /data\.cargoVolumeCBM/,
    'VoyageExecutiveReportModal debe extraer cargoVolumeCBM'
  );
  assert.match(
    modalSource,
    /cargoVolumeCbm:\s*frontendCbm > 0 \? frontendCbm : undefined/,
    'VoyageExecutiveReportModal debe pasar el volumen real del frontend a buildVoyageStowagePlan'
  );
});
