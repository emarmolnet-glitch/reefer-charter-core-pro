import React, { useState, useEffect, useRef } from "react";

export const MADRE_API_ENDPOINT = "https://calm-shortbread-55bcfc.netlify.app/.netlify/functions/madre-chat";

/**
 * Efecto visual del láser escáner superpuesto sobre la pantalla.
 * Desciende desde el header al footer en 1.2s en tonalidad azul/celeste hielo (#0EA5E9).
 */
export function triggerLaserScanEffect() {
  if (typeof document === "undefined") return;
  const laser = document.createElement("div");
  laser.id = "reefer-laser-scanner";
  laser.style.position = "fixed";
  laser.style.top = "0";
  laser.style.left = "0";
  laser.style.width = "100vw";
  laser.style.height = "4px";
  laser.style.backgroundColor = "#0EA5E9"; // EN REEFER USAR #0EA5E9
  laser.style.boxShadow = "0 0 20px #0EA5E9, 0 0 40px #0EA5E9";
  laser.style.zIndex = "999999";
  laser.style.transition = "top 1.2s cubic-bezier(0.4, 0, 0.2, 1)";
  laser.style.pointerEvents = "none";
  document.body.appendChild(laser);

  setTimeout(() => {
    laser.style.top = "100vh";
  }, 50);

  laser.addEventListener("transitionend", () => {
    laser.remove();
  });
}

/**
 * Extracción estructurada del DOM adaptada a la carga refrigerada (Reefer Charter).
 * Extrae y compacta los datos visibles agrupados en 4 bloques específicos.
 */
export function extractReeferScanData(doc = typeof document !== "undefined" ? document : null) {
  if (!doc || typeof doc.querySelector !== "function") {
    const defaultBloque1 = {
      pol: "Rotterdam",
      pod: "Houston",
      dias_navegacion: 12.0,
      dias_puerto: 3.0,
      dias_totales_viaje: 15.0,
      dias_transito_critico: 12.0,
    };
    const defaultBloque2 = {
      tipo_producto: "Carga Frigorífica",
      temperatura_objetivo_c: 13.0,
      ventilacion_cbm_h: "15 CBM/h",
      humedad_controlada: "Estándar Reefer",
    };
    const defaultBloque3 = {
      pallets: 0,
      cajas: 0,
      cbft_bajo_cubierta: 0,
      reefer_plugs: "No requeridos",
    };
    const defaultBloque4 = {
      flete_pallet_caja: 35.0,
      recargo_generadores_combustible: "$0/día",
      pda_pol: 28000,
      pda_pod: 26000,
      tce_proyectado: "$18,500 / día",
    };
    const defaultBloque6 = {
      break_even_usd_pallet: 28.5,
      coste_total_operacion_usd: 128250.0,
    };
    const defaultBloque7 = {
      flete_venta_fletador_pallet: 35.0,
      margen_objetivo_pct: 15.0,
    };
    const defaultBloque8 = {
      flete_compra_armador_pallet: 32.5,
      spread_comercial_pallet: 2.5,
      tce_proyectado_usd_dia: 18500.0,
    };

    const defaultBloques = {
      bloque_1_ruta_tiempos: defaultBloque1,
      bloque_2_mercancia_frio: defaultBloque2,
      bloque_3_capacidad_estiba: defaultBloque3,
      bloque_4_costes_fletes: defaultBloque4,
      bloque_6_resumen_operacion_costes: defaultBloque6,
      bloque_7_analisis_fletes_riesgos: defaultBloque7,
      bloque_8_negociacion_comercial: defaultBloque8,
    };

    return {
      bloques: defaultBloques,
      bloque_1_ruta_tiempos: defaultBloque1,
      bloque_2_mercancia_frio: defaultBloque2,
      bloque_3_capacidad_estiba: defaultBloque3,
      bloque_4_costes_fletes: defaultBloque4,
      bloque_6_resumen_operacion_costes: defaultBloque6,
      bloque_7_analisis_fletes_riesgos: defaultBloque7,
      bloque_8_negociacion_comercial: defaultBloque8,
      ruta_y_tiempos: defaultBloque1,
      mercancia_y_frio: defaultBloque2,
      capacidad_y_estiba: defaultBloque3,
      costes_y_fletes: defaultBloque4,
      resumen_operacion_costes: defaultBloque6,
      analisis_fletes_riesgos: defaultBloque7,
      negociacion_comercial: defaultBloque8,
    };
  }

  const getVal = (selector, fallback = "") => {
    try {
      const el = doc.querySelector(selector);
      if (!el) return fallback;
      if (el.tagName === "SELECT") {
        return el.options?.[el.selectedIndex]?.text || el.value || fallback;
      }
      const v = el.value !== undefined && el.value !== "" ? el.value : (el.textContent || "");
      return String(v).trim() || fallback;
    } catch {
      return fallback;
    }
  };

  const getNum = (selector, fallback = 0) => {
    try {
      const valStr = getVal(selector, "");
      if (!valStr) return fallback;
      const num = parseFloat(String(valStr).replace(/[^0-9.-]/g, ""));
      return Number.isFinite(num) ? num : fallback;
    } catch {
      return fallback;
    }
  };

  // --- EXTRACCIÓN PREVIA DE CARGA / PALLETS / RITMOS ---
  let pallets = getNum('[data-reefer="pallets"], #pallet-quantity, #reverse-pallet-quantity, #ground-pallets');
  if (!pallets && typeof window !== "undefined" && window.State?.palletQuantity) pallets = Number(window.State.palletQuantity);
  if (!pallets && typeof window !== "undefined" && window.dssFormState?.palletQuantity) pallets = Number(window.dssFormState.palletQuantity);

  let ritmoCarga = getNum('[data-reefer="load-rate"], [data-reefer="load_rate"], [data-reefer="ritmo-carga"], #rate-load, #exec-load-rate, #input-loadRate, #gc-laytime-load-val, #ritmo_nominal_pol');
  if (!ritmoCarga && typeof window !== "undefined") {
    ritmoCarga = Number(window.State?.loadRate || window.State?.ritmoRealPol || window.dssFormState?.loadRate || 0);
  }

  let ritmoDescarga = getNum('[data-reefer="discharge-rate"], [data-reefer="discharge_rate"], [data-reefer="ritmo-descarga"], #rate-disch, #exec-disch-rate, #input-dischargeRate, #gc-laytime-disch-val, #ritmo_nominal_pod');
  if (!ritmoDescarga && typeof window !== "undefined") {
    ritmoDescarga = Number(window.State?.dischargeRate || window.State?.dischRate || window.State?.ritmoRealPod || window.dssFormState?.dischargeRate || 0);
  }

  // --- BLOQUE 1: Ruta y Tiempos ---
  let pol = getVal('[data-reefer="pol"], [data-reefer="origin"], #map-port-pol, #input-pol, #match-load-port, .reefer-pol-input, #exec-pol');
  if (!pol && typeof window !== "undefined" && window.State?.pol) pol = window.State.pol;
  if (!pol) pol = "Rotterdam";

  let pod = getVal('[data-reefer="pod"], [data-reefer="destination"], #map-port-pod, #input-pod, #match-unload-port, .reefer-pod-input, #exec-pod');
  if (!pod && typeof window !== "undefined" && window.State?.pod) pod = window.State.pod;
  if (!pod) pod = "Houston";

  // Días de navegación marítima (tránsito crítico)
  let diasTransito = getNum("#exec-sea-days, #sea-days, #transit-days, #total-sea-days, [data-metric=\"transit_days\"], #dias-transito, #dias-navegacion, [data-reefer=\"sea-days\"], [data-reefer=\"transit-days\"]");
  if (!diasTransito && typeof window !== "undefined" && window.State?.seaDays) diasTransito = Number(window.State.seaDays);
  if (!diasTransito) diasTransito = 12.0;
  const diasNavegacionFinal = Math.round((Number(diasTransito) || 12.0) * 10) / 10;

  // Días de puerto (Port Days): capturados de la interfaz o calculados según pallets / ritmos
  let diasPuertoRaw = getNum('#exec-port-days, #shadow-port-days, #input-portDays, #val-portdays-total, #inverse-days-port, #dias-puerto, #port-days, #port-days-total, [data-metric="port_days"], [data-metric="port-days"], [data-reefer="port-days"], [data-reefer="port_days"], [data-reefer="portDays"]');
  if (!diasPuertoRaw && typeof window !== "undefined") {
    diasPuertoRaw = Number(window.State?.portDays || window.State?.totalPortDays || window.State?.tPort || window.State?.diasPuerto || window.dssFormState?.portDays || 0);
  }

  let diasPuertoCalculados = 0;
  if (pallets > 0) {
    if (ritmoCarga > 0 && ritmoDescarga > 0) {
      diasPuertoCalculados = (pallets / ritmoCarga) + (pallets / ritmoDescarga);
    } else if (ritmoCarga > 0) {
      diasPuertoCalculados = (pallets / ritmoCarga) * 2;
    } else if (ritmoDescarga > 0) {
      diasPuertoCalculados = (pallets / ritmoDescarga) * 2;
    } else {
      // Ritmo medio estándar de carga refrigerada: 1.500 pallets/día por escala
      diasPuertoCalculados = (pallets / 1500) * 2;
    }
  } else {
    let cargoQty = getNum('#exec-cargo-qty, #cargo-qty, #input-cargoQty, [data-reefer="cargo-qty"]');
    if (!cargoQty && typeof window !== "undefined") {
      cargoQty = Number(window.State?.cargo || window.State?.cargoQty || window.State?.targetCargoMT || 0);
    }
    if (cargoQty > 0) {
      if (ritmoCarga > 0 && ritmoDescarga > 0) {
        diasPuertoCalculados = (cargoQty / ritmoCarga) + (cargoQty / ritmoDescarga);
      } else if (ritmoCarga > 0) {
        diasPuertoCalculados = (cargoQty / ritmoCarga) * 2;
      } else if (ritmoDescarga > 0) {
        diasPuertoCalculados = (cargoQty / ritmoDescarga) * 2;
      }
    }
  }

  let diasPuerto = diasPuertoRaw > 0 ? diasPuertoRaw : (diasPuertoCalculados > 0 ? diasPuertoCalculados : 3.0);
  const diasPuertoFinal = Math.round(Number(diasPuerto) * 10) / 10;

  // Días totales de viaje (navegación + puerto)
  const diasTotalesViaje = Math.round((diasNavegacionFinal + diasPuertoFinal) * 10) / 10;

  // --- BLOQUE 2: Mercancía y Frío ---
  let producto = getVal('[data-reefer="cargo"], #cargo-product, #cargo-type, .cargo-select, #exec-cargo-type, #input-commodity');
  if (!producto && typeof window !== "undefined" && window.State?.cargoProduct) producto = window.State.cargoProduct;
  if (!producto) producto = "Frutas Frescas / Cítricos";

  const tempEl = doc.querySelector('[data-reefer="temperature"], #setpoint-temp, .reefer-temp-input') || doc.querySelector("#target-temperature, #reverse-target-temperature");
  let tempObj = 13.0;
  if (tempEl) {
    const rawVal = tempEl.value !== undefined ? tempEl.value : tempEl.textContent;
    const parsed = parseFloat(rawVal);
    if (Number.isFinite(parsed)) tempObj = parsed;
  } else if (typeof window !== "undefined" && window.State?.targetTemperatureCelsius !== undefined) {
    tempObj = Number(window.State.targetTemperatureCelsius);
  }

  let ventilacion = getVal('[data-reefer="ventilation"], #ventilation-cbm, #ventilation-rate, input[name*="ventilation"]');
  if (!ventilacion) {
    ventilacion = tempObj < 0 ? "0 CBM/h (Atmósfera Cerrada / Congelado)" : "15 CBM/h (Renovación continua)";
  }

  const caCheckbox = doc.querySelector('[data-reefer="humidity"], #controlled-atmosphere, #controlled-humidity, input[name*="humidity"]');
  let humedad = "Estándar Frigorífica (85-90% HR)";
  if (caCheckbox) {
    if (caCheckbox.type === "checkbox") {
      humedad = caCheckbox.checked ? "Humedad y Atmósfera Controlada Activa (CA: 90% HR, O2 2%, CO2 3%)" : "Humedad relativa convencional (~85% HR)";
    } else {
      humedad = caCheckbox.value || caCheckbox.textContent || humedad;
    }
  }

  // --- BLOQUE 3: Capacidad y Estiba ---
  let cajas = getNum('[data-reefer="boxes"], #boxes-quantity, #cajas-cantidad, #cargo-boxes');
  if (!cajas && pallets > 0) {
    cajas = Math.round(pallets * 72);
  }

  let volCbm = getNum('[data-reefer="cbft"], #cargo-volume-cbm, #reverse-cargo-volume-cbm, #hold-capacity-cbft, #exec-cargo-qty');
  if (!volCbm && typeof window !== "undefined" && window.State?.cargoVolumeCBM) volCbm = Number(window.State.cargoVolumeCBM);
  if (!volCbm && pallets > 0) volCbm = Math.round(pallets * 1.8);

  const cbftBajoCubierta = Math.round(volCbm > 0 ? volCbm * 35.3147 : (pallets > 0 ? pallets * 63.5 : 250000));

  let reeferPlugs = getVal('[data-reefer="plugs"], #reefer-plugs, #plugs-required');
  if (!reeferPlugs) {
    const plugsCount = Math.ceil(pallets > 0 ? pallets / 20 : 12);
    reeferPlugs = `${plugsCount} conexiones 380V/440V 32A operativas`;
  }

  // --- BLOQUE 4: Costes y Fletes ---
  let fleteUnitario = getNum('[data-reefer="freight"], #freight-rate, #freight-sell, #exec-sell-freight, #exec-buy-freight, #flete-pallet');
  if (!fleteUnitario && typeof window !== "undefined" && (window.State?.fleteUnitario || window.State?.freightSell)) {
    fleteUnitario = Number(window.State.fleteUnitario || window.State.freightSell);
  }
  if (!fleteUnitario) fleteUnitario = 35.0;

  let auxGenset = getNum('[data-reefer="genset"], #auxiliary-genset-cost, #reverse-auxiliary-genset-cost, input[name="auxiliaryGensetDailyCost"]');
  if (!auxGenset && typeof window !== "undefined" && window.State?.auxiliaryGensetDailyCost) auxGenset = Number(window.State.auxiliaryGensetDailyCost);
  const recargoGeneradores = auxGenset > 0 ? `$${auxGenset.toFixed(2)}/día (Genset Auxiliar)` : "$450.00/día (MGO Generador)";

  const pdaPol = getNum('#pda-pol, input[name*="pda_pol"], [id*="pda-pol"]', 28000);
  const pdaPod = getNum('#pda-pod, input[name*="pda_pod"], [id*="pda-pod"]', 26000);

  let tceProyectado = getVal('#exec-tce, #tce-spot-theoretical-value, #tce-result, #calc-tce, [data-metric="tce"]');
  if (!tceProyectado || tceProyectado === "—" || tceProyectado === "$0 / día") {
    if (typeof window !== "undefined" && window.State?.tce) {
      tceProyectado = `$${Number(window.State.tce).toLocaleString("en-US")} / día`;
    } else {
      tceProyectado = "$18,500 / día";
    }
  }

  const bloque1 = {
    pol: String(pol),
    pod: String(pod),
    dias_navegacion: diasNavegacionFinal,
    dias_puerto: diasPuertoFinal,
    dias_totales_viaje: diasTotalesViaje,
    dias_transito_critico: diasNavegacionFinal,
  };

  const bloque2 = {
    tipo_producto: String(producto),
    temperatura_objetivo_c: tempObj,
    ventilacion_cbm_h: String(ventilacion),
    humedad_controlada: String(humedad),
  };

  const bloque3 = {
    pallets: Number(pallets) || 0,
    cajas: Number(cajas) || 0,
    cbft_bajo_cubierta: Number(cbftBajoCubierta) || 0,
    reefer_plugs: String(reeferPlugs),
  };

  const bloque4 = {
    flete_pallet_caja: Number(fleteUnitario) || 35.0,
    recargo_generadores_combustible: String(recargoGeneradores),
    pda_pol: Number(pdaPol) || 28000,
    pda_pod: Number(pdaPod) || 26000,
    tce_proyectado: String(tceProyectado),
  };

  // --- BLOQUE 6: Resumen Operación y Costes ---
  let breakEvenPallet = getNum(
    '[data-reefer="break-even"], [data-reefer="break_even"], [data-reefer="break-even-pallet"], [data-reefer="breakeven"], #res-cost-base-break-even, #res-breakeven, #res-coa-breakeven, #coa-preview-breakeven, #input-breakEven, #negotiation-break-even, #cmp-actual-breakeven, #val-financial-breakeven-unit, #print-breakeven, #break-even-pallet, #breakeven-pallet'
  );
  if (!breakEvenPallet && typeof window !== "undefined") {
    breakEvenPallet = Number(window.State?.breakEvenUnitario || window.State?.breakEven || window.State?.costBaseBreakEven || window.dssFormState?.breakEven || window.dssFormState?.breakEvenUnitario || 0);
  }

  let costeTotalOperacion = getNum(
    '[data-reefer="coste-total"], [data-reefer="coste_total"], [data-reefer="total-cost"], [data-reefer="total-costs"], [data-reefer="voyage-cost"], #res-cost-total, #cost-plus-total-costs, #input-estimated-cost, #print-cost-total, #total-costs-bar, #total-voyage-cost, #total-cost'
  );
  if (!costeTotalOperacion && typeof window !== "undefined") {
    costeTotalOperacion = Number(window.State?.costTotal || window.State?.totalCosts || window.State?.totalVoyageCost || window.State?.coste_total_estimado || 0);
  }

  if (!costeTotalOperacion && breakEvenPallet > 0 && pallets > 0) {
    costeTotalOperacion = Math.round(breakEvenPallet * pallets);
  } else if (!breakEvenPallet && costeTotalOperacion > 0 && pallets > 0) {
    breakEvenPallet = Math.round((costeTotalOperacion / pallets) * 100) / 100;
  }

  if (!breakEvenPallet) breakEvenPallet = 28.5;
  if (!costeTotalOperacion) {
    costeTotalOperacion = pallets > 0 ? Math.round(pallets * breakEvenPallet) : 128250.0;
  }

  const breakEvenFinal = Math.round(Number(breakEvenPallet) * 100) / 100;
  const costeTotalFinal = Math.round(Number(costeTotalOperacion) * 100) / 100;

  // --- BLOQUE 7: Análisis de Fletes y Riesgos ---
  let fleteVenta = getNum(
    '[data-reefer="flete-venta"], [data-reefer="freight-sell"], [data-reefer="freight_sell"], [data-reefer="selling-freight"], [data-reefer="flete-venta-pallet"], #freight-sell, #res-venta-sugerida, #coa-detail-charterer-target, #negotiation-charterer-target, #selling-freight, #flete-venta, #target-freight-sell, #exec-sell-freight, #flete-pallet, #print-freight-sell, [data-reefer="freight"]'
  );
  if (!fleteVenta && typeof window !== "undefined") {
    fleteVenta = Number(window.State?.freightSell || window.State?.fleteVenta || window.State?.sellingFreight || window.State?.chartererFreight || window.State?.fleteUnitario || window.dssFormState?.freightSell || 0);
  }
  if (!fleteVenta && fleteUnitario > 0) {
    fleteVenta = fleteUnitario;
  }
  if (!fleteVenta) fleteVenta = 35.0;

  let margenObjetivo = getNum(
    '[data-reefer="margen"], [data-reefer="target-margin"], [data-reefer="margin"], [data-reefer="margen-objetivo"], #target-margin, #cost-plus-target-margin, #margin-charterer, #input-margin, #margen-objetivo, #target-margin-pct'
  );
  if (!margenObjetivo && typeof window !== "undefined") {
    margenObjetivo = Number(window.State?.targetMargin || window.State?.margenObjetivo || window.State?.marginCharterer || window.State?.ownerMarginPercent || 0);
  }
  if (!margenObjetivo && fleteVenta > 0 && breakEvenFinal > 0 && fleteVenta > breakEvenFinal) {
    margenObjetivo = Math.round(((fleteVenta - breakEvenFinal) / fleteVenta) * 1000) / 10;
  }
  if (!margenObjetivo) margenObjetivo = 15.0;

  const fleteVentaFinal = Math.round(Number(fleteVenta) * 100) / 100;
  const margenObjetivoFinal = Math.round(Number(margenObjetivo) * 100) / 100;

  // --- BLOQUE 8: Negociación Comercial ---
  let fleteCompra = getNum(
    '[data-reefer="flete-compra"], [data-reefer="freight-rate"], [data-reefer="freight_rate"], [data-reefer="buying-freight"], [data-reefer="flete-compra-pallet"], #freight-rate, #coa-detail-owner-purchase, #cost-plus-min-freight-rate, #negotiation-owner-offer, #buying-freight, #flete-compra, #freight-rate-calc, #input-freightRate, #exec-buy-freight, #print-freight-rate'
  );
  if (!fleteCompra && typeof window !== "undefined") {
    fleteCompra = Number(window.State?.freightRate || window.State?.freightCost || window.State?.fleteCompra || window.State?.ownerFreight || window.State?.flete_compra_usd_mt || 0);
  }
  if (!fleteCompra) fleteCompra = 32.50;

  let spreadComercial = getNum(
    '[data-reefer="spread"], [data-reefer="spread-pallet"], [data-reefer="commercial-spread"], #negotiation-spread-pmt, #spread-comercial, #commercial-spread'
  );
  if (!spreadComercial && fleteVentaFinal > 0 && fleteCompra > 0) {
    spreadComercial = fleteVentaFinal - fleteCompra;
  }
  if (!spreadComercial) {
    spreadComercial = Math.round((fleteVentaFinal - Number(fleteCompra)) * 100) / 100;
  }

  let tceDia = getNum(
    '[data-reefer="tce"], [data-reefer="tce-day"], [data-reefer="tce-usd-dia"], #exec-tce, #tce-spot-theoretical-value, #tce-result, #calc-tce, [data-metric="tce"], #negotiation-owner-tce, #negotiation-target-tce, #res-tce-label'
  );
  if (!tceDia && typeof window !== "undefined") {
    tceDia = Number(window.State?.tce || window.State?.projectedTce || window.State?.tceObtenido || 0);
  }
  if (!tceDia) {
    const tceFromStr = parseFloat(String(tceProyectado).replace(/[^0-9.-]/g, ""));
    tceDia = Number.isFinite(tceFromStr) && tceFromStr > 0 ? tceFromStr : 18500.0;
  }

  const fleteCompraFinal = Math.round(Number(fleteCompra) * 100) / 100;
  const spreadComercialFinal = Math.round(Number(spreadComercial) * 100) / 100;
  const tceDiaFinal = Math.round(Number(tceDia) * 100) / 100;

  const bloque6 = {
    break_even_usd_pallet: breakEvenFinal,
    coste_total_operacion_usd: costeTotalFinal,
  };

  const bloque7 = {
    flete_venta_fletador_pallet: fleteVentaFinal,
    margen_objetivo_pct: margenObjetivoFinal,
  };

  const bloque8 = {
    flete_compra_armador_pallet: fleteCompraFinal,
    spread_comercial_pallet: spreadComercialFinal,
    tce_proyectado_usd_dia: tceDiaFinal,
  };

  const bloques = {
    bloque_1_ruta_tiempos: bloque1,
    bloque_2_mercancia_frio: bloque2,
    bloque_3_capacidad_estiba: bloque3,
    bloque_4_costes_fletes: bloque4,
    bloque_6_resumen_operacion_costes: bloque6,
    bloque_7_analisis_fletes_riesgos: bloque7,
    bloque_8_negociacion_comercial: bloque8,
  };

  return {
    bloques,
    bloque_1_ruta_tiempos: bloque1,
    bloque_2_mercancia_frio: bloque2,
    bloque_3_capacidad_estiba: bloque3,
    bloque_4_costes_fletes: bloque4,
    bloque_6_resumen_operacion_costes: bloque6,
    bloque_7_analisis_fletes_riesgos: bloque7,
    bloque_8_negociacion_comercial: bloque8,
    ruta_y_tiempos: bloque1,
    mercancia_y_frio: bloque2,
    capacidad_y_estiba: bloque3,
    costes_y_fletes: bloque4,
    resumen_operacion_costes: bloque6,
    analisis_fletes_riesgos: bloque7,
    negociacion_comercial: bloque8,
  };
}

/**
 * Helper para extraer el contexto actual de la interfaz de Reefer Charter.
 * Empaqueta la extracción en contexto_ui.escaneo_reefer.
 */
export function getReeferUIContext() {
  const params = {};
  let referenciaActiva = null;

  if (typeof document !== "undefined" && document && typeof document.querySelector === "function") {
    const tempEl = document.querySelector('[data-reefer="temperature"], #setpoint-temp, .reefer-temp-input') || document.querySelector("#target-temperature");
    const cargoEl = document.querySelector('[data-reefer="cargo"], #cargo-type, .cargo-select');
    const polEl = document.querySelector('[data-reefer="pol"], [data-reefer="origin"], #input-pol, #match-load-port, .reefer-pol-input');
    const podEl = document.querySelector('[data-reefer="pod"], [data-reefer="destination"], #input-pod, #match-unload-port, .reefer-pod-input');

    if (tempEl) {
      const val = parseFloat(tempEl.value !== undefined ? tempEl.value : tempEl.textContent);
      if (Number.isFinite(val)) params.target_temperature = val;
    }
    if (cargoEl) {
      params.cargo_type = cargoEl.value || (cargoEl.textContent ? cargoEl.textContent.trim() : null);
    }
    if (polEl) {
      params.pol = polEl.value || (polEl.textContent ? polEl.textContent.trim() : null);
    }
    if (podEl) {
      params.pod = podEl.value || (podEl.textContent ? podEl.textContent.trim() : null);
    }

    if (typeof document.querySelectorAll === "function") {
      const allTextEls = Array.from(document.querySelectorAll("span, div, p, h1, h2, h3, h4, h5, h6, input"));
      const refEl = allTextEls.find((el) => {
        const text = el.value || el.textContent || "";
        return text.includes("RDM/");
      });
      if (refEl) {
        const match = (refEl.value || refEl.textContent).match(/RDM\/\d{4}-\d{4,}/);
        if (match) referenciaActiva = match[0];
      }
    }
  }

  // Empaquetado del escaneo reefer en los bloques frigoríficos
  const datosExtraidos = typeof document !== "undefined" && document ? extractReeferScanData(document) : extractReeferScanData(null);
  const escaneoReefer = { bloques: datosExtraidos };

  return {
    current_module: "reefer_charter",
    vista_activa: "Reefer Charter - Control de Frigoríficos",
    parametros_activos: params,
    escaneo_reefer: escaneoReefer,
    referenciaMadre: referenciaActiva,
  };
}

export const getCoreProUIContext = getReeferUIContext;

if (typeof window !== "undefined") {
  window.getReeferUIContext = getReeferUIContext;
  window.triggerLaserScanEffect = triggerLaserScanEffect;
  window.extractReeferScanData = extractReeferScanData;
}

// export const GlobalMadreDrawer
export function GlobalMadreDrawer({
  referenciaMadre,
  origen = "Reefer Charter Core PRO",
  initialOpen = false,
  showTrigger = true,
  COMANDOS_RAPIDOS = [
    { id: "escaner_pantalla", texto: "🔍 Escanear Pantalla Frigorífica", icono: "❄️" },
    { id: "escenarios", texto: "Genera los 3 escenarios", icono: "📊" },
    { id: "escudo", texto: "Redacta el escudo preventivo", icono: "🛡️" },
    { id: "oferta_50", texto: "El cliente dice que tiene una oferta 50% más barata", icono: "⚔️" },
  ],
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [inputTexto, setInputTexto] = useState("");
  const [mensajes, setMensajes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Alias para sincronización bidireccional
  const messages = mensajes;

  // Escape key listener to close drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus input automatically upon opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Auto-scroll whenever mensajes change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  // Window API and custom events synchronization
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const handleClose = () => setIsOpen(false);
    const handleToggle = () => setIsOpen((prev) => !prev);

    window.addEventListener("madre:open", handleOpen);
    window.addEventListener("madre:close", handleClose);
    window.addEventListener("madre:toggle", handleToggle);

    if (typeof window !== "undefined") {
      window.MadrePanelUI = {
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((prev) => !prev),
        isOpen: () => isOpen,
      };

      const topbarGlowElements = document.querySelectorAll(".madre-topbar-glow, #madre-topbar-glow");
      const topbarBtnElements = document.querySelectorAll(".madre-topbar-btn, #madre-topbar-button");
      const topbarImgElements = document.querySelectorAll(".madre-topbar-img, #madre-topbar-img");

      topbarBtnElements.forEach((btn) => {
        btn.setAttribute("aria-expanded", String(isOpen));
      });
      topbarGlowElements.forEach((glow) => {
        glow.style.display = isOpen || isListening ? "block" : "none";
      });
      topbarImgElements.forEach((img) => {
        if (isOpen || isListening) {
          img.classList.add("grayscale-0", "opacity-100", "scale-110");
          img.classList.remove("grayscale", "opacity-70", "scale-100");
        } else {
          img.classList.remove("grayscale-0", "opacity-100", "scale-110");
          img.classList.add("grayscale", "opacity-70", "scale-100");
        }
      });
    }

    return () => {
      window.removeEventListener("madre:open", handleOpen);
      window.removeEventListener("madre:close", handleClose);
      window.removeEventListener("madre:toggle", handleToggle);
    };
  }, [isOpen, isListening]);

  const speakText = (text) => {
    if (isMuted || typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text.replace(/[*#_`~[\]]/g, "").trim();
      const utterance = new SpeechSynthesisUtterance(clean);
      const isEnglish = document.documentElement.lang?.startsWith("en") || window.location.href.includes("lang=en");
      utterance.lang = isEnglish ? "en-US" : "es-ES";
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch (_) {}
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const handleReset = () => {
    setMensajes([]);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const handleMicClick = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("El reconocimiento de voz no está soportado en este navegador. Utiliza Google Chrome.");
      return;
    }
    const recognition = new SpeechRecognition();
    const isEnglish = document.documentElement.lang?.startsWith("en");
    recognition.lang = isEnglish ? "en-US" : "es-ES";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (err) => {
      console.error("Error de micrófono:", err);
      setIsListening(false);
    };
    recognition.onresult = (event) => {
      const speechText = event.results[0][0].transcript;
      setInputTexto(speechText);
    };

    recognition.start();
  };

 const handleSubmit = async (e, quickCommandText = null) => {
    if (e?.preventDefault) {
      e.preventDefault();
    }
    const texto = (typeof quickCommandText === "string" ? quickCommandText : inputTexto).trim();
    const trimmed = texto;
    if (!trimmed || loading) return;

    // Disparar el haz de luz láser de escaneo si la orden pide escaneo o auditoría
    const lower = trimmed.toLowerCase();
    const isScanCommand = lower.includes("escan") || lower.includes("scan") || lower.includes("pantalla") || lower.includes("auditor");
    if (isScanCommand && typeof triggerLaserScanEffect === "function") {
      triggerLaserScanEffect();
    }

    const userMsg = {
      id: Date.now(),
      rol: "user",
      role: "user",
      autor: "Operador",
      sender: "user",
      texto: trimmed,
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMensajes((prev) => [...prev, userMsg]);
    setInputTexto("");
    setLoading(true);

    try {
      // Sincronización de referencia dinámica de expediente
      const urlParams = new URLSearchParams(window.location.search);
      let activeRef = urlParams.get("ref");
      if (!activeRef && window.location.hash.includes("?")) {
        const hashQuery = window.location.hash.split("?")[1];
        activeRef = new URLSearchParams(hashQuery).get("ref");
      }
      const finalProjectRef = referenciaMadre || activeRef || "RDM/2026-TBN";

      // 1. Obtenemos el contexto completo de la interfaz (incluye los datos del escáner por defecto)
      const contextoUI = getReeferUIContext();
      
      // 2. Si NO es un comando de escaneo, eliminamos los datos pesados para que responda natural
      if (!isScanCommand) {
        delete contextoUI.escaneo_reefer;
      }

      // 3. Construimos UN SOLO paquete de envío perfecto para que Core Pro lo entienda siempre
      const outgoingPayload = {
        mensajeUsuario: trimmed,
        message: trimmed,
        prompt: trimmed,
        origen: "Reefer Charter",
        current_module: "reefer_charter",
        contexto_ui: contextoUI,
        history: mensajes
          .filter((m) => (m.text || m.texto) && !m.isError)
          .map((m) => ({
            role: m.role || (m.rol === "user" ? "user" : "assistant"),
            content: m.text || m.texto,
          })),
        context: {
          origin: "Reefer Charter Core PRO",
          projectRef: finalProjectRef,
        },
      };

      const response = await fetch(MADRE_API_ENDPOINT, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(outgoingPayload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const replyText =
        data?.reply || data?.response || data?.message || data?.text || "Auditoría MADRE procesada.";

      const assistantMsg = {
        id: Date.now() + 1,
        rol: "assistant",
        role: "assistant",
        autor: "MADRE Core",
        sender: "assistant",
        texto: replyText,
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMensajes((prev) => [...prev, assistantMsg]);
      speakText(replyText);
    } catch (err) {
      console.error("MADRE Connection Error:", err);
      const errorMsg = {
        id: Date.now() + 1,
        rol: "assistant",
        role: "assistant",
        autor: "MADRE Core",
        sender: "assistant",
        texto: "Error de conexión con el Cerebro Central en Data Bridge. Verifica los permisos CORS o reintenta.",
        text: "Error de conexión con el Cerebro Central en Data Bridge. Verifica los permisos CORS o reintenta.",
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMensajes((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };
  const handleQuickCommandClick = (cmd) => {
    const cmdText = cmd?.texto || cmd;
    handleSubmit(null, cmdText);
  };

  return (
    <>
      {/* 1. Botón Isotipo MADRE en TopBar */}
      {showTrigger && (
        <button
          id="madre-topbar-button"
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir panel MADRE"
          title={isOpen || isListening ? "MADRE activa" : "MADRE"}
          className="madre-topbar-btn relative flex items-center justify-center w-10 h-10 rounded-full p-0 bg-transparent border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 group"
        >
          {(isOpen || isListening) && (
            <div
              id="madre-topbar-glow"
              className="madre-topbar-glow absolute inset-0 rounded-full animate-pulse bg-cyan-500 blur-md pointer-events-none opacity-80"
              aria-hidden="true"
            />
          )}
          <img
            id="madre-topbar-img"
            src="/MADRE.png"
            alt="MADRE"
            className={`madre-topbar-img w-10 h-10 rounded-full relative z-10 object-contain transition-all duration-300 ${
              isOpen || isListening
                ? "grayscale-0 opacity-100 scale-110 drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]"
                : "grayscale opacity-70 scale-100 hover:opacity-90"
            }`}
          />
        </button>
      )}

      {/* 2. Drawer Lateral y Backdrop */}
      {isOpen && (
        <>
          <div
            id="madre-backdrop"
            className="madre-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm z-[2147483646] transition-opacity"
            style={{ zIndex: 2147483646 }}
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <aside
            id="madre-drawer-panel"
            className="madre-drawer fixed top-0 left-0 bottom-0 w-full max-w-lg bg-slate-900 text-slate-100 shadow-2xl z-[2147483647] flex flex-col border-r border-slate-800 animate-in slide-in-from-left duration-300"
            style={{ backgroundColor: "#0f172a", color: "#f1f5f9", zIndex: 2147483647 }}
            role="dialog"
            aria-modal="true"
            aria-label="Panel Inteligente MADRE"
          >
            {/* Header */}
            <header
              className="madre-drawer-header flex items-center justify-between p-4 bg-slate-950 border-b border-slate-800"
              style={{ backgroundColor: "#020617", color: "#f8fafc" }}
            >
              <div className="madre-drawer-title-wrap flex items-center gap-3">
                <div className="madre-avatar-icon flex items-center justify-center w-8 h-8 rounded-full overflow-hidden bg-cyan-950/60 border border-cyan-500/40 shrink-0 flex-shrink-0">
                  <img
                    src="/MADRE.png"
                    alt="MADRE"
                    className="w-8 h-8 rounded-full object-contain grayscale-0 opacity-100"
                  />
                </div>
                <div>
                  <h2 className="madre-title-text text-sm font-bold text-white flex items-center gap-2">
                    <span className="text-white font-bold tracking-tight">MADRE</span>
                    <span className="madre-badge-ref text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Cerebro Central
                    </span>
                  </h2>
                  <p className="madre-subtitle-text text-[11px] text-slate-400">
                    Cerebro Operacional Marítimo & Frigorífico (Reefer Charter)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 ml-auto text-white shrink-0 flex-shrink-0">
                <button
                  id="madre-mute-button"
                  type="button"
                  className={`madre-mute-btn shrink-0 flex-shrink-0 text-white flex items-center justify-center w-8 h-8 rounded-md transition ${
                    isMuted
                      ? "text-rose-400 hover:text-rose-300 hover:bg-slate-800"
                      : "text-white hover:text-cyan-300 hover:bg-slate-800"
                  }`}
                  onClick={handleMuteToggle}
                  title={isMuted ? "Activar voz de MADRE" : "Silenciar voz de MADRE"}
                  aria-label={isMuted ? "Activar voz de MADRE" : "Silenciar voz de MADRE"}
                >
                  {isMuted ? "🔇" : "🔊"}
                </button>
                <button
                  id="madre-reset-button"
                  type="button"
                  className="madre-reset-btn shrink-0 flex-shrink-0 text-white flex items-center justify-center w-8 h-8 p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition text-xs"
                  onClick={handleReset}
                  title="Reiniciar conversación"
                  aria-label="Reiniciar conversación"
                >
                  🔄
                </button>
                <button
                  id="madre-close-button"
                  type="button"
                  className="madre-close-btn shrink-0 flex-shrink-0 text-white flex items-center justify-center w-8 h-8 rounded-md hover:text-slate-200 hover:bg-slate-800 transition"
                  onClick={handleClose}
                  aria-label="Cerrar panel MADRE"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </header>

            {/* Mensajes */}
            <div
              id="madre-messages-container"
              className="madre-drawer-body flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900 text-slate-100"
              style={{ backgroundColor: "#0f172a", color: "#f1f5f9" }}
            >
              {mensajes.length === 0 ? (
                <div className="madre-empty-state text-center py-8 px-4 text-slate-400">
                  <div className="madre-empty-icon flex items-center justify-center mb-3">
                    <img src="/MADRE.png" alt="MADRE" className="w-12 h-12 rounded-full object-contain opacity-80" />
                  </div>
                  <h3 className="madre-empty-title text-sm font-bold text-slate-200 mb-1">
                    Cerebro Frigorífico Activo
                  </h3>
                  <p className="madre-empty-desc text-xs text-slate-400 max-w-xs mx-auto leading-relaxed mb-4">
                    Escáner visual de pantalla listo para capturar en tiempo real las variables de temperatura, ventilación, pallets y costes refrigerados.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      triggerLaserScanEffect();
                      handleSubmit(null, "Escanear pantalla");
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow transition"
                  >
                    <span>⚡ Activar Escáner Visual</span>
                  </button>
                </div>
              ) : (
                mensajes.map((msg) => (
                  <div
                    key={msg.id}
                    className={`madre-message flex flex-col ${
                      msg.rol === "user" ? "madre-message--user items-end" : "madre-message--assistant items-start"
                    }`}
                  >
                    <div
                      className={`madre-bubble p-3 text-xs leading-relaxed max-w-[95%] text-white rounded-2xl whitespace-pre-wrap ${
                        msg.rol === "user"
                          ? "bg-cyan-600 text-white rounded-br-sm shadow-md min-w-[150px] w-max max-w-[95%] text-left"
                          : msg.isError
                          ? "bg-red-950 text-red-200 border border-red-800 rounded-bl-sm"
                          : "bg-slate-800 border border-slate-700 text-white !text-white rounded-bl-sm shadow-md"
                      }`}
                      style={
                        msg.rol === "user"
                          ? { minWidth: "150px", width: "max-content", maxWidth: "95%", textAlign: "left", color: "#ffffff" }
                          : { color: "#ffffff" }
                      }
                    >
                      <div className="madre-bubble-meta flex items-center justify-between text-[10px] opacity-70 mb-1">
                        <span className="font-semibold">{msg.autor}</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <div className="whitespace-pre-wrap break-words">{msg.texto || msg.text}</div>
                    </div>
                  </div>
                ))
              )}
              {loading && (
                <div
                  id="madre-loading-indicator"
                  className="flex items-center gap-3 p-3 mx-4 mb-2 rounded-xl bg-slate-800/60 border border-dashed border-cyan-500/40 text-xs text-cyan-300"
                >
                  <div className="madre-radar-spinner w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin"></div>
                  <span>MADRE está auditando los parámetros frigoríficos...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Comandos Rápidos */}
            <div
              className="madre-quick-commands-bar p-3 bg-slate-950/90 border-t border-slate-800"
              style={{ backgroundColor: "#020617", color: "#f8fafc" }}
            >
              <span className="madre-quick-title text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                ⚡ Comandos Rápidos (1-Clic)
              </span>
              <div className="madre-quick-buttons-row flex flex-col gap-1.5">
                {COMANDOS_RAPIDOS.map((cmd) => (
                  <button
                    key={cmd.id}
                    type="button"
                    disabled={loading}
                    onClick={() => handleQuickCommandClick(cmd)}
                    className="madre-quick-btn flex items-center justify-between text-left px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs transition hover:border-cyan-500/50 hover:text-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="flex items-center gap-2">
                      <span>{cmd.icono}</span>
                      <span className="font-medium">{cmd.texto}</span>
                    </span>
                    <span className="text-[10px] text-slate-400">↵</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Input y Footer */}
            <footer
              className="madre-drawer-footer relative p-3 bg-slate-950 border-t border-slate-800 flex-shrink-0"
              style={{ backgroundColor: "#020617", color: "#f8fafc" }}
            >
              {isListening && (
                <div
                  id="madre-voice-status"
                  className="madre-voice-status absolute bottom-full left-3 right-3 mb-2 px-2.5 py-1.5 rounded-md text-[11px] flex items-center justify-between border bg-slate-900/95 border-cyan-500/50 text-cyan-200 backdrop-blur-md shadow-lg z-20 pointer-events-auto"
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                    <span id="madre-voice-status-text">🎙️ Escuchando Wake Word... (Escuchando...)</span>
                  </span>
                  <span id="madre-voice-transcript" className="italic truncate max-w-[180px] text-[10px] opacity-80"></span>
                </div>
              )}
              <form onSubmit={handleSubmit} className="madre-input-form flex items-center gap-2 w-full">
                <button
                  id="madre-mic-button"
                  type="button"
                  onClick={handleMicClick}
                  className={`madre-mic-btn flex-shrink-0 shrink-0 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center justify-center gap-1.5 ${isListening ? "ring-2 ring-cyan-400 text-cyan-300" : ""}`}
                  title="Activar escucha de voz"
                  aria-label="Activar escucha de voz"
                >
                  <span className="text-sm select-none">🎙️</span>
                </button>
                <input
                  ref={inputRef}
                  id="madre-chat-input"
                  type="text"
                  value={inputTexto}
                  onChange={(e) => setInputTexto(e.target.value)}
                  placeholder="Pregunta a MADRE o escribe 'Escanear pantalla'..."
                  className="madre-chat-input flex-1 min-w-0 px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
                <button
                  id="madre-send-button"
                  type="submit"
                  disabled={loading || !inputTexto.trim()}
                  className="madre-send-btn flex-shrink-0 shrink-0 px-4 py-2 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed shadow"
                >
                  Enviar
                </button>
              </form>
            </footer>
          </aside>
        </>
      )}
    </>
  );
}

export function MadrePanel(props) {
  return <GlobalMadreDrawer {...props} />;
}

export default GlobalMadreDrawer;
