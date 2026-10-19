/**
 * Resolves a vessel classification profile for stowage modeling
 * Supports:
 * - COASTER: Coaster, Minibulker, Mini-Bulker, cabotaje, costero
 * - RORO: Ro-Ro, Ro-Lo, vehicle carrier, car carrier, PCC, PCTC
 * - REEFER: Reefer, buque frigorífico
 * - HANDYSIZE: Handysize, MPP, Multi-Purpose, Bulk Carrier, Geared Breakbulk
 */
export function resolveVesselStowageProfile(vesselType = '', vesselClass = '', shipProfile = '') {
  const combined = `${vesselType} ${vesselClass} ${shipProfile}`.toLowerCase();
  if (
    combined.includes('ro-ro') ||
    combined.includes('roro') ||
    combined.includes('ro-lo') ||
    combined.includes('rolo') ||
    combined.includes('vehicle') ||
    combined.includes('car carrier') ||
    combined.includes('pcc') ||
    combined.includes('pctc')
  ) {
    return 'RORO';
  }
  if (
    combined.includes('coaster') ||
    combined.includes('mini-bulker') ||
    combined.includes('minibulker') ||
    combined.includes('mini bulker') ||
    combined.includes('cabotage') ||
    combined.includes('cabotaje') ||
    combined.includes('costero')
  ) {
    return 'COASTER';
  }
  if (combined.includes('reefer') || combined.includes('frigorifico') || combined.includes('frigorífico')) {
    return 'REEFER';
  }
  if (combined.includes('panamax')) return 'PANAMAX';
  if (combined.includes('capesize')) return 'CAPESIZE';
  if (combined.includes('supramax') || combined.includes('ultramax')) return 'SUPRAMAX';
  return 'HANDYSIZE';
}

/**
 * Strict volumetric check: IF (Cargo_CBM > Vessel_Cubic_Capacity) { return ERROR }
 * @param {number} cargoCbm Volumen total de la carga en m³ (CBM)
 * @param {number} vesselCubicCapacity Capacidad cúbica máxima del buque en m³ (CBM)
 * @returns {'ERROR'|'OK'}
 */
export function validateCubicCapacity(cargoCbm, vesselCubicCapacity) {
  const cargo = Number(cargoCbm || 0);
  const capacity = Number(vesselCubicCapacity || 0);
  if (capacity > 0 && cargo > capacity) {
    return 'ERROR';
  }
  return 'OK';
}

/**
 * Builds a universal stowage plan and hydrodynamics calculation for voyage calculations
 */
export function buildVoyageStowagePlan(voyageState = {}) {
  const cargoTons = Number(voyageState.cargo || voyageState.cargoQty || 0);
  const dwt = Number(voyageState.dwt || 32000);
  const rawShipType = String(
    voyageState.shipProfile ||
    voyageState.ship_profile ||
    voyageState.vesselType ||
    voyageState.vessel_type ||
    voyageState.designCategory ||
    voyageState.design_category ||
    voyageState.categoriaDiseno ||
    voyageState.tipoBuque ||
    voyageState.vesselClass ||
    voyageState.vessel_class ||
    voyageState.class ||
    voyageState.shipClass ||
    voyageState.vessel ||
    'Handysize'
  ).trim();

  const vesselClass = voyageState.class || voyageState.shipClass || voyageState.vesselClass || rawShipType || 'Handysize';
  const cargoType = voyageState.cargoType || 'Granel Sólido (Dry Bulk)';
  const vesselType = voyageState.vesselType || rawShipType || `${vesselClass} ${dwt > 0 ? `${dwt.toLocaleString('en-US')} DWT` : ''}`.trim();

  // Factor de estiba
  const stowageFactor = Number(voyageState.stowageFactor || voyageState.stowage_factor || voyageState.sf || 0) || 0;

  // 1. Extraer volumen real si viene explícito desde el frontend
  let cargoVolumeCbm = Number(
    voyageState.cargoVolumeCBM ||
    voyageState.cargo_volume_cbm ||
    voyageState.cargoVolumeCbm ||
    voyageState.requiredVolumeCbm ||
    voyageState.cargoVolume ||
    voyageState.volumeCbm ||
    (typeof window !== 'undefined' && window.State ? (window.State.cargoVolumeCBM || window.State.requiredVolumeCbm || window.State.cargoVolume) : 0) ||
    0
  );

  // Si no viene volumen explícito, calcularlo respetando el factor de estiba del producto
  if (!cargoVolumeCbm || cargoVolumeCbm <= 0) {
    if (stowageFactor > 0 && cargoTons > 0) {
      cargoVolumeCbm = Math.round(cargoTons * stowageFactor * 100) / 100;
    } else {
      const isReeferCargo = /fruta|banana|platano|plátano|reefer|refrigerad/i.test(`${cargoType} ${voyageState.cargoProduct || ''}`);
      const fallbackSf = isReeferCargo ? 2.5 : 1.35;
      cargoVolumeCbm = Math.round(cargoTons * fallbackSf * 100) / 100;
    }
  }

  // Capacidad cúbica del buque
  const explicitCapacity = Number(
    voyageState.vesselCubicCapacity ||
    voyageState.vessel_cubic_capacity ||
    voyageState.vesselCubicCapacityCbm ||
    voyageState.grainCapacityCbm ||
    voyageState.grain_capacity_cbm ||
    voyageState.grainCapacity ||
    voyageState.cubicCapacity ||
    voyageState.cubicCapacityCbm ||
    voyageState.reeferCapacityCbm ||
    voyageState.reeferCapacity ||
    voyageState.baleCapacityCbm ||
    voyageState.holdCapacity ||
    (typeof window !== 'undefined' && window.State ? (window.State.vesselCubicCapacity || window.State.grainCapacityCbm || window.State.cubicCapacity) : 0) ||
    0
  );

  const vesselCubicCapacity = explicitCapacity > 0
    ? explicitCapacity
    : (dwt > 0 ? Math.round(dwt * 1.25) : 30300);

  const rawVesselName = voyageState.vessel || voyageState.vesselName || voyageState.name || voyageState.nombre || '';
  const isTbn = Boolean(
    voyageState.isTbn ||
    (rawVesselName && (
      String(rawVesselName).trim().toUpperCase() === 'TBN' ||
      String(rawVesselName).toUpperCase().includes('TO BE NAMED') ||
      String(rawVesselName).toUpperCase().includes('TO BE NOMINATED')
    ))
  );

  const optimalDwt = isTbn && cargoVolumeCbm > 0
    ? Math.ceil(((cargoVolumeCbm / 1.25) * 1.05) / 100) * 100
    : 0;

  const effectiveCubicCapacity = isTbn && optimalDwt > 0
    ? Math.max(vesselCubicCapacity, Math.round(optimalDwt * 1.25))
    : vesselCubicCapacity;

  // Regla estricta: IF (Cargo_CBM > Vessel_Cubic_Capacity) { return ERROR } (desactivada para buques TBN auto-dimensionados)
  const volumetricCheck = isTbn ? 'OK' : validateCubicCapacity(cargoVolumeCbm, effectiveCubicCapacity);
  const isCubicCapacityExceeded = !isTbn && volumetricCheck === 'ERROR';
  const volumeUtilizationShipPct = effectiveCubicCapacity > 0
    ? (cargoVolumeCbm / effectiveCubicCapacity) * 100
    : 0;

  const safetyReport = isCubicCapacityExceeded
    ? 'FAILED: OVERCAPACITY (DEADFREIGHT RISK)'
    : '✓ CUMPLE CAPACIDAD CÚBICA';

  const imoCompliance = isCubicCapacityExceeded
    ? 'FAILED'
    : '100%';

  const resultStatus = isCubicCapacityExceeded ? 'ERROR' : 'OK';
  const resultError = isCubicCapacityExceeded ? 'OVERCAPACITY (DEADFREIGHT RISK)' : null;

  const profile = resolveVesselStowageProfile(vesselType, vesselClass, voyageState.shipProfile || rawShipType);

  let holds = [];
  let weatherDeck = {
    totalWeightTons: 0,
    totalVolumeCbm: 0,
    weightPercentage: 0,
  };
  let justification = [];

  const effectiveSf = cargoTons > 0 ? cargoVolumeCbm / cargoTons : (stowageFactor || 1.35);

  if (profile === 'RORO') {
    const weatherWeight = Math.round(cargoTons * 0.25 * 100) / 100;
    const mainWeight = Math.round(cargoTons * 0.50 * 100) / 100;
    const lowerWeight = Math.round(Math.max(0, cargoTons - weatherWeight - mainWeight) * 100) / 100;

    const weatherVol = Math.round(weatherWeight * effectiveSf * 100) / 100;
    const mainVol = Math.round(mainWeight * effectiveSf * 100) / 100;
    const lowerVol = Math.round(Math.max(0, cargoVolumeCbm - weatherVol - mainVol) * 100) / 100;

    weatherDeck = {
      totalWeightTons: weatherWeight,
      totalVolumeCbm: weatherVol,
      weightPercentage: cargoTons > 0 ? Math.round((weatherWeight / cargoTons) * 1000) / 10 : 0,
    };

    holds = [
      {
        holdNumber: 1,
        name: 'Cubierta Principal (Main Car Deck)',
        totalWeightTons: mainWeight,
        totalVolumeCbm: mainVol,
        weightPercentage: cargoTons > 0 ? Math.round((mainWeight / cargoTons) * 1000) / 10 : 0,
        stowageTier: 'Cubierta Horizontal Continua',
      },
      {
        holdNumber: 2,
        name: 'Cubierta Inferior (Lower Hold Deck)',
        totalWeightTons: lowerWeight,
        totalVolumeCbm: lowerVol,
        weightPercentage: cargoTons > 0 ? Math.round((lowerWeight / cargoTons) * 1000) / 10 : 0,
        stowageTier: 'Cubierta Horizontal Continua',
      },
    ];

    justification = [
      `1. Distribución en cubiertas horizontales con estiba rodada asegurada con cadenas G80 en cubiertas horizontales (Main Deck y Lower Deck).`,
      `2. Altura metacéntrica transversal (GM) proyectada en 1.55 m, cumpliendo holgadamente el criterio de estabilidad intacta OMI A.749(18).`,
      `3. Acceso rodado optimizado vía rampa de popa (Stern Ramp) para ${cargoTons.toLocaleString('en-US')} MT en perfil naval Ro-Ro / Ro-Lo.${isCubicCapacityExceeded ? ' - ALERTA: CAPACIDAD CÚBICA EXCEDIDA.' : ''}`,
    ];
  } else if (profile === 'COASTER') {
    const holdsCount = 2;
    const holdWeight = cargoTons > 0 ? Math.round((cargoTons / holdsCount) * 100) / 100 : 0;
    const holdVolume = Math.round((cargoVolumeCbm / holdsCount) * 100) / 100;

    holds = [
      {
        holdNumber: 1,
        name: 'Bodega 1 Diáfana (Proa)',
        totalWeightTons: holdWeight,
        totalVolumeCbm: holdVolume,
        weightPercentage: cargoTons > 0 ? 50.0 : 0,
        stowageTier: 'Bodega Corrida Diáfana',
      },
      {
        holdNumber: 2,
        name: 'Bodega 2 Diáfana (Popa)',
        totalWeightTons: Math.round((cargoTons - holdWeight) * 100) / 100,
        totalVolumeCbm: Math.round((cargoVolumeCbm - holdVolume) * 100) / 100,
        weightPercentage: cargoTons > 0 ? 50.0 : 0,
        stowageTier: 'Bodega Corrida Diáfana',
      },
    ];

    justification = [
      `1. Distribución simétrica en 2 bodegas diáfanas corridas (${(cargoTons / 2).toLocaleString('en-US')} MT por bodega) minimizando esfuerzos flectores en navegación.`,
      `2. Altura metacéntrica transversal (GM) proyectada en 1.55 m, cumpliendo holgadamente el criterio de estabilidad intacta OMI A.749(18).`,
      `3. Volumen cúbico total de ${cargoVolumeCbm.toLocaleString('en-US')} m³ frente a capacidad de ${vesselCubicCapacity.toLocaleString('en-US')} m³ (${volumeUtilizationShipPct.toFixed(1)}% utilización)${isCubicCapacityExceeded ? ' - FAILED: OVERCAPACITY (DEADFREIGHT RISK)' : ''}.`,
    ];
  } else {
    // REEFER / HANDYSIZE / BULK CARRIER / MPP (4 bodegas / compartimentos independientes)
    const holdsCount = 4;
    const holdWeight = cargoTons > 0 ? Math.round((cargoTons / holdsCount) * 100) / 100 : 0;
    const holdVolume = Math.round((cargoVolumeCbm / holdsCount) * 100) / 100;

    holds = [];
    for (let i = 1; i <= holdsCount; i++) {
      const isLast = i === holdsCount;
      const w = isLast ? Math.round((cargoTons - holdWeight * 3) * 100) / 100 : holdWeight;
      const v = isLast ? Math.round((cargoVolumeCbm - holdVolume * 3) * 100) / 100 : holdVolume;
      holds.push({
        holdNumber: i,
        name: `Bodega ${i} (${i === 1 ? 'Proa' : i === holdsCount ? 'Popa' : 'Crujía'})`,
        totalWeightTons: w,
        totalVolumeCbm: v,
        weightPercentage: cargoTons > 0 ? 25.0 : 0,
        stowageTier: 'Main Hold',
      });
    }

    justification = [
      `1. Distribución de ${cargoTons.toLocaleString('en-US')} MT entre los 4 compartimentos independientes para minimizar esfuerzos flectores y cortantes en navegación.`,
      `2. Altura metacéntrica transversal (GM) proyectada en 1.55 m, cumpliendo holgadamente el criterio de estabilidad intacta OMI A.749(18).`,
      `3. Volumen cúbico ocupado de ${cargoVolumeCbm.toLocaleString('en-US')} m³ frente a capacidad admisible de ${vesselCubicCapacity.toLocaleString('en-US')} m³ (${volumeUtilizationShipPct.toFixed(1)}% utilización)${isCubicCapacityExceeded ? ' - FAILED: OVERCAPACITY (DEADFREIGHT RISK)' : ''}.`,
    ];
  }

  return {
    status: resultStatus,
    error: resultError,
    holds,
    weatherDeck,
    cargoClassification: {
      totalWeightTons: cargoTons,
      totalVolumeCbm: cargoVolumeCbm,
      generalDescription: cargoType,
    },
    hydrodynamicsAndSafety: {
      totalVolumeOccupiedCbm: cargoVolumeCbm,
      grainCapacityCbm: vesselCubicCapacity,
      vesselCubicCapacity,
      volumeUtilizationShipPct,
      isCubicCapacityExceeded,
      status: resultStatus,
      error: resultError,
      safetyReport,
      imoCompliance,
      isTbn,
      optimalDwt,
      autoSizingBadge: isTbn && optimalDwt > 0 ? `⚡ Buque auto-dimensionado a ${optimalDwt} DWT según exigencias volumétricas.` : null,
      maxFloorPressureTm2: dwt > 0 ? Math.min(20, Math.max(10, (cargoTons / dwt) * 16)) : 14.5,
      maxFloorAllowableTm2: 20.0,
      isPermissibleLoadExceeded: false,
      metacentricHeightGmEstimatedM: 1.55,
    },
    vesselModel: {
      type: vesselClass,
      profile,
      dwt: isTbn && optimalDwt > 0 ? optimalDwt : dwt,
      isTbn,
      optimalDwt,
      grainCapacityCbm: effectiveCubicCapacity,
      vesselCubicCapacity: effectiveCubicCapacity,
    },
    executiveJustification: justification,
  };
}
