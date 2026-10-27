import { useState, useEffect, useRef } from 'react';

/**
 * Calculates optimal vessel DWT based on cargo weight, stowage factor, and naval cubic coefficient.
 * Optimal_DWT = Math.ceil((cargo_weight * stowage_factor / 1.25) * 1.05 / 100) * 100;
 */
export function calculateOptimalDwt(cargoWeight, stowageFactor, options = {}) {
  const totalPallets = Number(options?.totalPallets ?? options?.palletQuantity ?? 0);
  const isPalletRateMode = Boolean(options?.isPalletRateMode || options?.isPalletMode || totalPallets > 0);
  const cargoCategory = String(options?.cargoCategory || options?.cargoType || '');
  const isReeferVolume = isPalletRateMode || cargoCategory.includes('Frutas');

  if (isReeferVolume && totalPallets > 0) {
    return Math.ceil((totalPallets * 2.75) / 100) * 100;
  }

  const weight = Number(cargoWeight) || 0;
  const sf = Number(stowageFactor) || 0;
  if (weight <= 0 || sf <= 0) return 0;
  const requiredCbm = weight * sf;
  return Math.ceil(((requiredCbm / 1.25) * 1.05) / 100) * 100;
}

/**
 * Determines whether a vessel is in 'TBN (To Be Named)' mode.
 * Strictly evaluates empty strings, null, and undefined as true.
 */
export function isTbnVessel(vessel) {
  if (vessel === null || vessel === undefined || vessel === '') return true;
  const name = typeof vessel === 'string'
    ? vessel
    : (vessel?.name ?? vessel?.vesselName ?? vessel?.vessel_name ?? vessel?.nombre ?? '');
  if (name === null || name === undefined) return true;
  const normalized = String(name).trim().toUpperCase();
  return (
    normalized === '' ||
    normalized === 'TBN' ||
    normalized.includes('TBN') ||
    normalized.includes('TO BE NAMED') ||
    normalized.includes('TO BE NOMINATED')
  );
}

/**
 * Hook for Zero-Click Auto-Sizing (DWT inference) in Reefer Charter.
 * Intercepts changes to cargo_weight and stowage_factor, auto-adjusts DWT for TBN vessels,
 * triggers financial calculations, and exposes the auto-sizing UI badge state.
 */
export function useReeferAutoSizing({
  cargoWeight: propCargoWeight,
  stowageFactor: propStowageFactor,
  vessel: propVessel,
  voyageStore: propVoyageStore,
  onDwtChange,
} = {}) {
  const [optimalDwt, setOptimalDwt] = useState(0);
  const [isAutoSized, setIsAutoSized] = useState(false);
  const lastInjectedDwtRef = useRef(0);

  useEffect(() => {
    const vStore = propVoyageStore || (typeof window !== 'undefined' ? (window.voyageStore || window.VoyageStore || window.useVoyageStore) : null);
    const storeState = vStore?.getState?.() || {};
    const winState = typeof window !== 'undefined' ? window.State || {} : {};

    const rawWeight = propCargoWeight !== undefined
      ? propCargoWeight
      : (storeState.draft?.cargoVolumeCBM && !storeState.draft?.palletQuantity
        ? storeState.draft.cargoVolumeCBM * 0.5
        : (storeState.draft?.palletQuantity || winState.cargo || winState.cargoQty || (typeof document !== 'undefined' ? (parseFloat(document.getElementById('cargo-qty')?.value) || parseFloat(document.getElementById('pallet-quantity')?.value)) : 0)));

    const rawSf = propStowageFactor !== undefined
      ? propStowageFactor
      : (winState.stowageFactor || (typeof document !== 'undefined' ? parseFloat(document.getElementById('cargo-sf')?.value) : 1.35) || 1.35);

    let rawVessel = propVessel;
    if (rawVessel === undefined && typeof document !== 'undefined') {
      const vInput = document.getElementById('nombre-buque-calculadora') || document.getElementById('vessel-name');
      if (vInput) {
        rawVessel = vInput.value;
      }
    }
    if (rawVessel === undefined) {
      rawVessel = storeState.draft?.vessel ?? winState.vessel ?? winState.vesselName ?? '';
    }

    const weight = Number(rawWeight) || 0;
    const sf = Number(rawSf) || 1.35;
    const isTbn = isTbnVessel(rawVessel);

    const totalPallets = Number(storeState.draft?.palletQuantity || winState.palletQuantity || (typeof document !== 'undefined' ? document.getElementById('pallet-quantity')?.value : 0)) || 0;
    const isPalletRateMode = (typeof document !== 'undefined' && document.getElementById('freight-rate-unit')?.value === 'Pallet')
      || (winState.rateUnit === 'Pallet')
      || (totalPallets > 0);
    const cargoCat = (typeof document !== 'undefined' ? (document.getElementById('cargo-category')?.value || document.getElementById('cargo-type')?.value) : '') || '';
    const isReeferVolume = isPalletRateMode || cargoCat.includes('Frutas');

    if ((weight > 0 && sf > 0) || (isReeferVolume && totalPallets > 0)) {
      const calculatedDwt = calculateOptimalDwt(weight, sf, { totalPallets, isPalletRateMode, cargoCategory: cargoCat });
      setOptimalDwt(calculatedDwt);

      if (isTbn && calculatedDwt > 0) {
        setIsAutoSized(true);

        // Forcefully update vanilla HTML DOM directly on every evaluation
        if (typeof document !== 'undefined') {
          const dwtInput = document.getElementById('vessel-dwt');
          if (dwtInput && Number(dwtInput.value) !== calculatedDwt) {
            dwtInput.value = calculatedDwt;
            if (typeof window.updateSection2LocalState === 'function') {
              window.updateSection2LocalState('vessel-dwt', calculatedDwt);
            }
            if (typeof window.handleDWTChange === 'function') {
              window.handleDWTChange(true, false);
            }
          }
          const identityDwtInput = document.getElementById('vessel-identity-dwt');
          if (identityDwtInput && Number(identityDwtInput.value) !== calculatedDwt) {
            identityDwtInput.value = String(calculatedDwt);
          }
          const badgeEl = document.getElementById('tbn-auto-sizing-badge');
          if (badgeEl) {
            badgeEl.classList.remove('hidden');
            badgeEl.textContent = isReeferVolume
              ? `⚡ Buque auto-dimensionado a ${calculatedDwt} DWT según requerimientos volumétricos (Reefer).`
              : `⚡ Buque auto-dimensionado a ${calculatedDwt} DWT según exigencias volumétricas.`;
          }
        }

        // 1. Inject into voyageStore
        if (typeof vStore?.getState?.()?.patchSection2Vessel === 'function') {
          vStore.getState().patchSection2Vessel({
            dwt: calculatedDwt,
            vesselDwt: calculatedDwt,
            name: typeof rawVessel === 'string' && rawVessel.trim() === '' ? '' : 'TBN',
            vesselName: typeof rawVessel === 'string' && rawVessel.trim() === '' ? '' : 'TBN',
          });
        }

        // 2. Inject into window.State
        if (typeof window !== 'undefined' && window.State) {
          window.State.vesselDwt = calculatedDwt;
          window.State.dwt = calculatedDwt;
          window.State.capacidad_dwt = calculatedDwt;
        }

        if (typeof onDwtChange === 'function') {
          onDwtChange(calculatedDwt);
        }

        if (lastInjectedDwtRef.current !== calculatedDwt) {
          lastInjectedDwtRef.current = calculatedDwt;

          // 4. Trigger calculations (runEngine / pricing router)
          if (typeof window !== 'undefined') {
            if (typeof window.runEngine === 'function') {
              window.runEngine();
            }
            if (typeof window.updateVesselPricingRouter === 'function') {
              window.updateVesselPricingRouter();
            }
          }
        }
      } else {
        setIsAutoSized(false);
        if (typeof document !== 'undefined') {
          const badgeEl = document.getElementById('tbn-auto-sizing-badge');
          if (badgeEl) badgeEl.classList.add('hidden');
        }
      }
    } else {
      setOptimalDwt(0);
      setIsAutoSized(false);
      if (typeof document !== 'undefined') {
        const badgeEl = document.getElementById('tbn-auto-sizing-badge');
        if (badgeEl) badgeEl.classList.add('hidden');
      }
    }
  }, [propCargoWeight, propStowageFactor, propVessel, propVoyageStore, onDwtChange]);

  const badgeText = isAutoSized && optimalDwt > 0
    ? `⚡ Buque auto-dimensionado a ${optimalDwt} DWT según exigencias volumétricas.`
    : null;

  return {
    optimalDwt,
    isAutoSized,
    badgeText,
  };
}

export default useReeferAutoSizing;
