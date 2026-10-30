import React, { useState, useEffect, useRef } from "react";
import Draggable from "react-draggable";

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
      producto_especifico: "Carga Frigorífica",
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
      total_dias_operativos: 15.0,
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
      bloque_2_especificaciones_buque: defaultBloque2,
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
    producto_especifico: String(producto),
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
    total_dias_operativos: diasTotalesViaje,
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
    bloque_2_especificaciones_buque: bloque2,
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
    bloque_2_especificaciones_buque: bloque2,
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
  const moduleInfo = typeof document !== "undefined" ? detectActiveModule(document) : { id: 'estimator', displayName: 'Reefer Charter - Control de Frigoríficos' };
  const escaneoUniversal = typeof document !== "undefined" ? scanActiveModule(document, moduleInfo) : null;

  return {
    current_module: "reefer_charter",
    vista_activa: "Reefer Charter - Control de Frigoríficos",
    modulo_actual: moduleInfo?.displayName || "Reefer Charter Core PRO",
    parametros_activos: params,
    escaneo_reefer: escaneoReefer,
    escaneo_estructurado: escaneoUniversal || escaneoReefer,
    escaneo_universal: escaneoUniversal,
    suite: "Reefer Charter Core PRO",
    bloques: datosExtraidos?.bloques || datosExtraidos,
    referenciaMadre: referenciaActiva,
  };
}

export const getCoreProUIContext = getReeferUIContext;

const getMaxTransitDays = (producto = '') => {
    const prod = String(producto || '').toLowerCase();
    if (prod.includes('banana') || prod.includes('plátano') || prod.includes('platano')) return 26;
    if (prod.includes('carne fresca') || prod.includes('pescado fresco')) return 18;
    if (prod.includes('verdura') || prod.includes('hortaliza')) return 21;
    if (prod.includes('fármaco') || prod.includes('farmaco') || prod.includes('medicamento') || prod.includes('pharma')) return 30;
    if (prod.includes('cítrico') || prod.includes('citrico') || prod.includes('manzana')) return 35;
    if (prod.includes('congelado') || prod.includes('frozen')) return 60;
    return 40; // Margen por defecto
};

/**
 * Adaptación del Guion Ejecutivo a Reefer (Pallets, PSS y Shelf-Life).
 * Evalúa break-even unitario por pallet, estacionalidad PSS, caducidad comercial shelf-life, ahorro y fugas prevenidas.
 */
function buildMotherExecutiveScript(state = {}) {
  // 1. SCRAPING VISUAL DIRECTO AL DOM (Ojos de MADRE)
  let liveDays = 0;
  let liveProduct = state?.producto || 'Carga Frigorífica';
  let livePss = state?.pssActivo || false;

  if (typeof document !== 'undefined') {
      const domText = document.body.innerText || '';
      
      // Extraer Días Totales reales visibles
      const matchDays = domText.match(/(?:Dias Mar \+ Puerto \+ Margen Clima:)\s*(\d+[\.,]\d+)/i);
      if (matchDays) liveDays = parseFloat(matchDays[1].replace(',', '.'));

      // Extraer Producto real
      if (domText.match(/banana|plátano|platano/i)) liveProduct = 'Bananas';
      else if (domText.match(/carne fresca|pescado fresco/i)) liveProduct = 'Carne Fresca';
      else if (domText.match(/verdura|hortaliza/i)) liveProduct = 'Verdura';
      else if (domText.match(/fármaco|pharma|medicamento/i)) liveProduct = 'Fármacos';
      else if (domText.match(/cítrico|manzana/i)) liveProduct = 'Cítricos';

      // Extraer PSS real
      if (domText.match(/Peak Season Surcharge|PSS/i)) livePss = true;
  }

  // 2. CONSOLIDACIÓN DE DATOS
  const breakEven = Number(state?.breakEvenUnitario ?? state?.breakEven ?? 0).toFixed(2);
  const pallets = Number(state?.pallets || 4000);
  const diasTotales = liveDays > 0 ? liveDays : Number(state?.diasTotales || 0);
  const limiteDias = typeof getMaxTransitDays === 'function' ? getMaxTransitDays(liveProduct) : 40;
  const pssActivo = livePss || state?.pssActivo;
  
  const ahorroAdmin = state?.pdaInyectada ? Math.round(4.5 * 45) : Math.round(2.0 * 45); 
  let fugas = 0;

  // 3. LÓGICA DE AUDITORÍA
  let advertencia = 'Las condiciones operativas y térmicas proyectadas son favorables.';
  let alertaFinanciera = pssActivo ? 'Alerta financiera: Peak Season Surcharge (PSS) detectado. Blindar recargos.' : '';
  
  if (diasTotales > limiteDias) {
      advertencia = `¡ALERTA CRÍTICA DE SHELF-LIFE! El tiempo de tránsito estimado de ${diasTotales.toFixed(1)} días supera el límite de caducidad comercial de ${limiteDias} días para esta mercancía. Riesgo inminente de maduración prematura o pudrición total.`;
      fugas = Math.round(pallets * 120);
  } else if (state?.riesgosDetectados) {
      advertencia = 'Se detectan desviaciones térmicas en el Escenario Estrés. Revise los márgenes de seguridad en puerto.';
  }

  const mensajeAtencion = [advertencia, alertaFinanciera].filter(Boolean).join(' ');

  return `Escaneo analítico completado. El buque es óptimo para los requerimientos de cubicaje. El break-even del armador se sitúa en ${breakEven} dólares por pallet. Atención: ${mensajeAtencion} Impacto de esta estimación paramétrica: se han ahorrado ${ahorroAdmin} dólares en horas de gestión y prevenido exposiciones de riesgo por valor de ${fugas} dólares.`;
}

/**
 * Motor de Voz Neuronal (Web Audio API).
 * Acepta texto libre, decodificando ArrayBuffer vía AudioContext para evitar bloqueos CSP.
 */
async function playNeuralMotherVoice(textToSpeak) {
    if (!textToSpeak) return null;
    try {
        const databridgeUrl = (typeof window !== 'undefined' && window.DATABRIDGE_API_URL) ? window.DATABRIDGE_API_URL : 'https://calm-shortbread-55bcfc.netlify.app';
        const response = await fetch(`${databridgeUrl}/.netlify/functions/madre-voice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: textToSpeak })
        });
        if (!response.ok) throw new Error('Error TTS');
        const arrayBuffer = await response.arrayBuffer();
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.start(0);
        return source;
    } catch (error) {
        console.error("Fallo IA:", error);
    }
}

/**
 * Detector de Módulo y Vista Activa en Reefer Charter Core PRO.
 * Identifica la sección o pestaña activa (Mapa, Rutas, Contenedores Reiner/Multimodal,
 * Temperatura/Compatibilidad, Dossiers, DSS, etc.).
 */
export function detectActiveModule(doc = (typeof document !== "undefined" ? document : null)) {
  if (!doc) {
    return {
      id: "general",
      displayName: "Reefer Charter Core PRO",
      modulo_actual: "Reefer Charter Core PRO",
      container: null,
      isOverlay: false,
    };
  }

  // 1. Overlay modal prioritario (ej. Tracking Live)
  const trackingOverlay = typeof doc.getElementById === "function"
    ? doc.getElementById("tracking-live-overlay")
    : (typeof doc.querySelector === "function" ? doc.querySelector("#tracking-live-overlay") : null);
  if (
    trackingOverlay &&
    (trackingOverlay.classList?.contains?.("is-open") ||
      trackingOverlay.style?.display === "block" ||
      trackingOverlay.style?.display === "flex")
  ) {
    return {
      id: "tracking",
      displayName: "Tracking Satelital en Vivo",
      modulo_actual: "Tracking Satelital en Vivo",
      container: trackingOverlay,
      isOverlay: true,
    };
  }

  // 2. Diccionario de módulos
  const MODULE_DICTIONARY = {
    map: "Mapa y Rutas Frigoríficas",
    estimator: "Calculadora de Viaje Frigorífica (Estimador)",
    multimodal: "Contenedores Reefer (Multimodal / FCL)",
    fcl: "Contenedores Reefer (Multimodal / FCL)",
    decisiones: "Motor de Decisiones Estratégicas (DSS)",
    compatibilidad: "Compatibilidad Buque y Carga Frigorífica",
    cbam: "ETS / CBAM Emisiones Carbono",
    gencon: "Editor de Contrato GENCON",
    asbatankvoy: "Editor de Contrato ASBATANKVOY",
    auditor: "Auditoría de Buques / Due Diligence",
    ais: "Radar AIS / Tráfico y Densidad",
    dossiers: "Dossiers de Operaciones Frigoríficas",
    forwarders: "Workspace Transitarios B2B",
    matching: "Matching de Buques Reefer",
  };

  // 3. Búsqueda de la vista activa .view-section en el DOM
  const viewSections = typeof doc.querySelectorAll === "function" ? Array.from(doc.querySelectorAll(".view-section")) : [];
  const activeSection = viewSections.find((el) => {
    if (el.classList?.contains?.("hidden")) return false;
    if (el.classList?.contains?.("active-block") || el.classList?.contains?.("active-flex")) return true;
    if (typeof window !== "undefined" && window.getComputedStyle) {
      try {
        const style = window.getComputedStyle(el);
        if (style.display !== "none" && style.visibility !== "hidden") return true;
      } catch (_) {}
    }
    return el.offsetParent !== null;
  });

  if (activeSection && activeSection.id) {
    const rawId = activeSection.id.replace(/^view-/, "").toLowerCase();
    const displayName = MODULE_DICTIONARY[rawId] || `Módulo ${rawId.charAt(0).toUpperCase() + rawId.slice(1)}`;
    return {
      id: rawId,
      displayName,
      modulo_actual: displayName,
      container: activeSection,
      isOverlay: false,
    };
  }

  // 4. Fallback con variables globales o botones de navegación
  let detectedId = "";
  if (typeof window !== "undefined") {
    detectedId = window.activeNavigationModuleId || window.currentView || window.currentTab || window.previousContentModuleId || "";
  }
  if (!detectedId && typeof doc.querySelector === "function") {
    const activeNavBtn = doc.querySelector('[data-module-id][aria-current="page"], .tab-btn.bg-blue-600[data-module-id]');
    if (activeNavBtn) {
      detectedId = activeNavBtn.getAttribute("data-module-id") || "";
    }
  }

  detectedId = String(detectedId || "estimator").toLowerCase();
  const targetContainer = (typeof doc.getElementById === "function" ? doc.getElementById(`view-${detectedId}`) : (typeof doc.querySelector === "function" ? doc.querySelector(`#view-${detectedId}`) : null)) ||
    (typeof doc.getElementById === "function" ? doc.getElementById("main-content") : (typeof doc.querySelector === "function" ? doc.querySelector("#main-content") : null)) ||
    doc.body;
  const displayName = MODULE_DICTIONARY[detectedId] || "Reefer Charter Core PRO";

  return {
    id: detectedId,
    displayName,
    modulo_actual: displayName,
    container: targetContainer,
    isOverlay: false,
  };
}

export const detectarModuloActivo = detectActiveModule;

/**
 * Diccionario Estructural de Lectura DOM para Reefer Charter Core PRO.
 * Mapeo prioritario para el Escáner Universal de MADRE hacia Data Bridge.
 */
export const REEFER_DOM_DICTIONARY = {
  mapa: {
    contenedor: "#view-map",
    inputs: ["#map-port-ballast", "#map-port-pol", "#map-port-pod", "#map-laycan-date", "#map-cancelling-date"],
    metricas: ["#sync-miles-label", "#sync-miles-breakdown", "#sync-pol-label", "#sync-pod-label"]
  },
  calculadora: {
    contenedor: "#view-estimator",
    reefer_inputs: [
      "#pallet-quantity",
      "#cargo-volume-cbm",
      "#hold-capacity-cbft",
      "#target-temperature",
      "#ventilation-rate",
      "#controlled-atmosphere",
      "#reefer-plugs",
      "#boxes-quantity",
      "#auxiliary-genset-cost"
    ],
    rutas_inputs: ["#port-ballast", "#port-pol", "#port-pod", "#dist-ballast", "#dist-laden", "#dist-total"],
    buque_inputs: ["#vessel-identity-imo", "#vessel-dwt", "#spd-ballast", "#spd-laden"],
    costes_inputs: ["#fuel-vlsfo-price", "#fuel-lsmgo-price", "#pda-pol", "#pda-pod"],
    metricas_kpi: [
      "#exec-tce",
      "#exec-buy-freight",
      "#exec-sell-freight",
      "#exec-charterer-profit",
      "#exec-spread-mt",
      "#break-even-freight",
      "#total-voyage-costs"
    ],
    inputs: [
      "#pallet-quantity",
      "#cargo-volume-cbm",
      "#hold-capacity-cbft",
      "#target-temperature",
      "#ventilation-rate",
      "#controlled-atmosphere",
      "#reefer-plugs",
      "#boxes-quantity",
      "#auxiliary-genset-cost",
      "#port-ballast",
      "#port-pol",
      "#port-pod",
      "#dist-ballast",
      "#dist-laden",
      "#dist-total",
      "#vessel-identity-imo",
      "#vessel-dwt",
      "#spd-ballast",
      "#spd-laden",
      "#fuel-vlsfo-price",
      "#fuel-lsmgo-price",
      "#pda-pol",
      "#pda-pod",
      "#rate-load",
      "#rate-disch",
      "#freight-buy",
      "#freight-sell"
    ],
    metricas: [
      "#exec-tce",
      "#exec-buy-freight",
      "#exec-sell-freight",
      "#exec-charterer-profit",
      "#exec-spread-mt",
      "#break-even-freight",
      "#total-voyage-costs"
    ]
  },
  dossiers: {
    contenedor: "#view-dossiers",
    inputs: ["#dossiers-search"],
    metricas: ["#dossiers-count", "#dossiers-table-body"]
  },
  decisiones: {
    contenedor: "#view-decisiones",
    inputs: [
      "#input-pol",
      "#input-pod",
      "#input-cargoQty",
      "#input-fleteEstimado",
      "#input-breakEven",
      "#input-loadRate",
      "#input-dischargeRate",
      "#input-jwlaPremiumUSD",
      "#input-ballastDays"
    ],
    metricas: [
      "#display-all-in-gross",
      "#display-net-freight",
      "#val-financial-margin",
      "#val-laycan-buffer",
      "#val-loadrate-required"
    ]
  },
  compatibilidad: {
    contenedor: "#view-compatibilidad",
    inputs: [
      "#compat-header-volume",
      "#compat-header-pol",
      "#compat-header-pod",
      "#compat-header-laycan",
      "#compat-header-loading-rate"
    ],
    metricas: [
      "#hero-compatibility-score",
      "#hero-vessel-name",
      "#hero-technical-justification",
      "#panel-radar-live",
      "#panel-neon-db"
    ],
    acciones: ["#btn-bloquear-fletamento", "#btn-activar-due-diligence"]
  },
  tracking: {
    contenedor: "#tracking-live-overlay",
    inputs: [
      "#tracking-live-contract-ref",
      "#tracking-input-vessel",
      "#tracking-input-pol",
      "#tracking-input-pod",
      "#tracking-input-cargo"
    ],
    metricas: [
      "#tracking-map-route-distance",
      "#tracking-ais-vessel",
      "#tracking-ais-position",
      "#tracking-alert-count"
    ]
  },
  densidad: {
    contenedor: "#view-ais",
    inputs: ["#ais-vessel-search", "#fleet-intel-vessel-type"],
    metricas: [
      "#ais-density-count",
      "#ais-supply-coefficient",
      "#ais-rate-fair",
      "#ais-rate-standard",
      "#ais-rate-offmarket",
      "#ais-vessels-tbody"
    ]
  },
  auditoria: {
    contenedor: "#view-auditor",
    inputs: ["#fileUpload", "#recapInput", "#commercial-nlp-origin"],
    metricas: [
      "#audit-vessel-name-heading",
      "#audit-vessel-owner",
      "#audit-vessel-compat-score",
      "#resProforma",
      "#resRiesgos",
      "#resClausulas",
      "#resEstrategia"
    ]
  }
};

/**
 * Escáner DOM Dinámico y Universal.
 * Captura todos los campos interactivos, estados de UI (ej. modo OWN/CHR)
 * y tablas/tarjetas de resumen de carga refrigerada visibles en pantalla,
 * priorizando la jerarquía de lectura del diccionario REEFER_DOM_DICTIONARY.
 */
export function scanActiveModule(doc = (typeof document !== "undefined" ? document : null), moduleInfo = null) {
  const info = moduleInfo || detectActiveModule(doc);
  const container = info.container || (doc ? doc.body : null);

  const datosFormulario = {};
  const estadosUi = {
    modo: "owner",
  };
  const metricasClaveVisibles = [];
  const processedFieldElements = new Set();

  if (!doc || !container) {
    return {
      suite: "Reefer Charter Core PRO",
      modulo_actual: info.displayName || "Reefer Charter Core PRO",
      timestamp: new Date().toISOString(),
      datos_formulario: datosFormulario,
      estados_ui: estadosUi,
      elementos_visibles: "Sin contenedor activo disponible para captura.",
    };
  }

  // 1.0 Extracción Prioritaria basada en REEFER_DOM_DICTIONARY
  const normId = String(info.id || "").toLowerCase();
  const dictKey = Object.keys(REEFER_DOM_DICTIONARY).find((k) => {
    if (k === normId) return true;
    if (k === "mapa" && (normId === "map" || normId === "mapa" || normId === "rutas")) return true;
    if (k === "calculadora" && (normId === "estimator" || normId === "calculadora")) return true;
    if (k === "densidad" && (normId === "ais" || normId === "densidad")) return true;
    if (k === "auditoria" && (normId === "auditor" || normId === "auditoria")) return true;
    return false;
  });
  const moduleConfig = dictKey ? REEFER_DOM_DICTIONARY[dictKey] : null;

  if (moduleConfig) {
    const targetInputs = [
      ...(Array.isArray(moduleConfig.inputs) ? moduleConfig.inputs : []),
      ...(Array.isArray(moduleConfig.reefer_inputs) ? moduleConfig.reefer_inputs : []),
      ...(Array.isArray(moduleConfig.rutas_inputs) ? moduleConfig.rutas_inputs : []),
      ...(Array.isArray(moduleConfig.buque_inputs) ? moduleConfig.buque_inputs : []),
      ...(Array.isArray(moduleConfig.costes_inputs) ? moduleConfig.costes_inputs : []),
    ];
    const uniqueInputs = Array.from(new Set(targetInputs));

    uniqueInputs.forEach((selector) => {
      try {
        const el = typeof doc.querySelector === "function" ? doc.querySelector(selector) : null;
        if (!el) return;
        processedFieldElements.add(el);

        let fieldKey = "";
        if (el.id && typeof doc.querySelector === "function") {
          const associatedLabel = doc.querySelector(`label[for="${el.id}"]`);
          if (associatedLabel && associatedLabel.textContent) {
            fieldKey = associatedLabel.textContent.trim();
          }
        }
        if (!fieldKey && el.closest) {
          const parentLabel = el.closest("label");
          if (parentLabel && parentLabel.textContent) {
            fieldKey = parentLabel.textContent.replace(el.value || "", "").trim();
          }
        }
        if (!fieldKey && el.getAttribute) {
          fieldKey = el.getAttribute("aria-label") || el.getAttribute("title") || el.placeholder || el.name || el.dataset?.reefer || el.dataset?.field;
        }
        if (!fieldKey) {
          fieldKey = selector;
        }
        fieldKey = fieldKey.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").replace(/[:*]+$/, "").trim() || selector;

        let val = "";
        if (el.tagName?.toLowerCase() === "select") {
          val = el.options?.[el.selectedIndex]?.text?.trim() || el.value || "";
        } else if (el.type === "checkbox") {
          val = el.checked ? "Sí (Activo)" : "No (Inactivo)";
        } else if (el.type === "radio") {
          if (el.checked) val = el.value || "Seleccionado";
          else return;
        } else {
          val = el.value !== undefined ? String(el.value).trim() : (el.textContent?.trim() || "");
        }

        datosFormulario[fieldKey] = val;
      } catch (_) {}
    });

    const targetMetrics = [
      ...(Array.isArray(moduleConfig.metricas) ? moduleConfig.metricas : []),
      ...(Array.isArray(moduleConfig.metricas_kpi) ? moduleConfig.metricas_kpi : []),
    ];
    const uniqueMetrics = Array.from(new Set(targetMetrics));

    uniqueMetrics.forEach((selector) => {
      try {
        const el = typeof doc.querySelector === "function" ? doc.querySelector(selector) : null;
        if (!el) return;
        const rawText = el.innerText || el.textContent || "";
        const cleanText = rawText.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
        if (cleanText) {
          metricasClaveVisibles.push(` - ${selector}: ${cleanText}`);
        }
      } catch (_) {}
    });
  }

  // 1. Estados de UI: Perspectiva OWN/CHR y toggles
  const chrBtn = typeof doc.getElementById === "function"
    ? doc.getElementById("btn-view-mode-charterer")
    : (typeof doc.querySelector === "function" ? doc.querySelector("#btn-view-mode-charterer") : null);
  const isCharterer = (chrBtn && chrBtn.getAttribute("aria-pressed") === "true") ||
    (typeof window !== "undefined" && (window.DualModePerspective === "charterer" || window.State?.viewMode === "charterer"));
  estadosUi.modo = isCharterer ? "charterer" : "owner";

  const toggles = typeof container.querySelectorAll === "function"
    ? container.querySelectorAll('[role="switch"], [data-toggle], button[aria-pressed="true"]')
    : [];
  toggles.forEach((t) => {
    if (t.closest?.("#madre-drawer-panel") || t.id === "madre-topbar-button") return;
    const key = t.getAttribute?.("aria-label") || t.getAttribute?.("title") || t.name || t.id;
    if (key) {
      const isPressed = t.getAttribute?.("aria-pressed") === "true" || t.getAttribute?.("aria-checked") === "true";
      estadosUi[key] = isPressed ? "Activo" : "Inactivo";
    }
  });

  // 2. Valores de formulario: Inputs, Selects, Textareas (Red de seguridad / fallback)
  const fields = typeof container.querySelectorAll === "function"
    ? container.querySelectorAll("input, select, textarea")
    : [];
  fields.forEach((el) => {
    if (processedFieldElements.has(el)) return;
    if (el.closest?.("#madre-drawer-panel") || el.closest?.(".madre-drawer")) return;
    if (el.type === "hidden" && !el.id?.includes("vessel") && !el.id?.includes("cargo") && !el.id?.includes("port") && !el.dataset?.reefer) return;

    let fieldKey = "";
    if (el.id && typeof doc.querySelector === "function") {
      const associatedLabel = doc.querySelector(`label[for="${el.id}"]`);
      if (associatedLabel && associatedLabel.textContent) {
        fieldKey = associatedLabel.textContent.trim();
      }
    }
    if (!fieldKey && el.closest) {
      const parentLabel = el.closest("label");
      if (parentLabel && parentLabel.textContent) {
        fieldKey = parentLabel.textContent.replace(el.value || "", "").trim();
      }
    }
    if (!fieldKey && el.getAttribute) {
      fieldKey = el.getAttribute("aria-label") || el.getAttribute("title") || el.placeholder || el.name || el.id || el.dataset?.reefer || el.dataset?.field;
    }
    if (!fieldKey) return;

    fieldKey = fieldKey.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").replace(/[:*]+$/, "").trim();
    if (!fieldKey) return;

    let val = "";
    if (el.tagName?.toLowerCase() === "select") {
      val = el.options?.[el.selectedIndex]?.text?.trim() || el.value || "";
    } else if (el.type === "checkbox") {
      val = el.checked ? "Sí (Activo)" : "No (Inactivo)";
    } else if (el.type === "radio") {
      if (el.checked) val = el.value || "Seleccionado";
      else return;
    } else {
      val = el.value !== undefined ? String(el.value).trim() : "";
    }

    if (!datosFormulario[fieldKey]) {
      datosFormulario[fieldKey] = val;
    }
  });

  // 3. Tablas y Tarjetas de Carga Refrigerada Visibles
  const visibleSummaryLines = [];

  // Iniciar siempre listando las métricas clave del diccionario si existen
  if (metricasClaveVisibles.length > 0) {
    visibleSummaryLines.push(`[Métricas Clave]:\n${metricasClaveVisibles.join("\n")}`);
  }

  const tables = typeof container.querySelectorAll === "function" ? container.querySelectorAll("table") : [];
  tables.forEach((tbl, idx) => {
    const headers = Array.from(tbl.querySelectorAll?.("th") || []).map((th) => th.textContent?.trim()).filter(Boolean);
    const rows = Array.from(tbl.querySelectorAll?.("tbody tr, tr") || [])
      .slice(0, 10)
      .map((tr) => Array.from(tr.querySelectorAll?.("td") || []).map((td) => td.textContent?.trim()).filter(Boolean).join(" | "))
      .filter(Boolean);

    if (headers.length > 0 || rows.length > 0) {
      visibleSummaryLines.push(`[Tabla ${idx + 1}]: Columnas (${headers.join(", ")})`);
      rows.forEach((r, rIdx) => {
        if (rIdx < 6) visibleSummaryLines.push(`  Fila ${rIdx + 1}: ${r}`);
      });
      if (rows.length > 6) visibleSummaryLines.push(`  ... y ${rows.length - 6} filas más.`);
    }
  });

  const cards = typeof container.querySelectorAll === "function"
    ? container.querySelectorAll(".metric-card, [data-metric], .kpi-card, [data-reefer], .summary-box, .result-card, [data-summary], #res-cost-base-break-even, #res-tce-label, #calc-total-days, .card-summary")
    : [];
  const seenCardTexts = new Set();
  cards.forEach((card) => {
    if (card.closest?.("#madre-drawer-panel")) return;
    const label = card.getAttribute?.("data-metric") || card.getAttribute?.("data-reefer") || card.querySelector?.(".metric-label, .card-label, span, h3, h4")?.textContent?.trim() || card.id;
    const value = card.querySelector?.(".metric-value, .card-value, strong, b")?.textContent?.trim() || card.textContent?.trim();
    if (label && value && !seenCardTexts.has(label + value)) {
      seenCardTexts.add(label + value);
      const cleanVal = value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").slice(0, 120);
      visibleSummaryLines.push(`• ${label}: ${cleanVal}`);
    }
  });

  if (visibleSummaryLines.length === 0 && typeof container.querySelectorAll === "function") {
    const headings = Array.from(container.querySelectorAll("h1, h2, h3, h4")).map((h) => h.textContent?.trim()).filter(Boolean);
    if (headings.length > 0) {
      visibleSummaryLines.push(`Secciones visibles: ${headings.slice(0, 6).join(" | ")}`);
    }
  }

  const resumenVisibles = visibleSummaryLines.length > 0
    ? visibleSummaryLines.join("\n")
    : "No se identificaron tablas o tarjetas de resumen estructuradas en el contenedor activo.";

  return {
    suite: "Reefer Charter Core PRO",
    modulo_actual: info.displayName,
    timestamp: new Date().toISOString(),
    datos_formulario: datosFormulario,
    estados_ui: estadosUi,
    elementos_visibles: resumenVisibles,
  };
}

export const capturarDomModuloActivo = scanActiveModule;

/**
 * Constructor de Prompt con Directiva Cero-Alucinaciones.
 */
export function buildUniversalScanPrompt(scanPayload) {
  return `🔍 **SOLICITUD DE AUDITORÍA TÉCNICA UNIVERSAL MADRE**
======================================================
Módulo Detectado: ${scanPayload.modulo_actual}
Perspectiva Activa: Modo ${scanPayload.estados_ui?.modo === "charterer" ? "FLETADOR (Charterer)" : "ARMADOR (Owner)"}
Marca Temporal: ${scanPayload.timestamp}

DIRECTIVA CERO-ALUCINACIONES (REGLA ESTRICTA OBLIGATORIA):
- Auditar estricta y exclusivamente los datos provistos en el siguiente escaneo JSON del DOM.
- Señalar de forma explícita cualquier incongruencia técnica de transporte en frío (temperaturas fuera de rango para el tipo de mercancía, incompatibilidades de ventilación/humedad, shelf-life crítico superado, desajustes en estiba/pallets o fletes/costes fuera de mercado).
- Listar claramente los campos vacíos clave detectados en el formulario que requieran definición para garantizar la seguridad de la carga frigorífica.
- Está terminantemente prohibido inventar, deducir arbitrariamente o asumir datos no presentes en el JSON.

DATOS CAPTURADOS DEL DOM:
\`\`\`json
${JSON.stringify(scanPayload, null, 2)}
\`\`\`

Emite el diagnóstico técnico ejecutivo basado únicamente en estos parámetros reales.`;
}

/**
 * Generador de Auditoría Cero-Alucinaciones Local
 * Utilizado como fallback en caso de desconexión o fallo en Data Bridge.
 */
export function buildLocalZeroHallucinationAudit(scanPayload) {
  const modulo = scanPayload?.modulo_actual || "Módulo Activo";
  const modo = scanPayload?.estados_ui?.modo === "charterer" ? "FLETADOR (Charterer)" : "ARMADOR (Owner)";
  const datos = scanPayload?.datos_formulario || {};
  const elementos = scanPayload?.elementos_visibles || "Sin elementos visibles adicionales";

  // Identificación de campos vacíos clave
  const camposVacios = Object.entries(datos)
    .filter(([_, v]) => v === "" || v === "(Vacío)" || v === null || v === undefined)
    .map(([k]) => k);

  // Incongruencias técnicas cold-chain
  const incongruencias = [];
  const entries = Object.entries(datos);

  const tempEntry = entries.find(([k]) => /temp|setpoint|temperatura/i.test(k));
  const cargoEntry = entries.find(([k]) => /cargo|mercancia|producto|commodity/i.test(k));
  if (tempEntry && cargoEntry) {
    const tempVal = parseFloat(String(tempEntry[1]).replace(",", "."));
    const cargoVal = String(cargoEntry[1]).toLowerCase();
    if (!isNaN(tempVal)) {
      if ((cargoVal.includes("banana") || cargoVal.includes("platano")) && (tempVal < 12.5 || tempVal > 14.5)) {
        incongruencias.push(`Alerta de temperatura: Setpoint de ${tempVal}°C fuera de ventana segura para bananas (+13.0°C a +13.5°C). Riesgo de chilling injury o maduración acelerada.`);
      } else if (cargoVal.includes("congelado") && tempVal > -18) {
        incongruencias.push(`Alerta térmica crítica: Carga congelada declarada con setpoint a ${tempVal}°C. Requiere umbral de -18.0°C o inferior.`);
      }
    }
  }

  const polEntry = entries.find(([k]) => /\bpol\b|origen|carga/i.test(k) && !/pda|crane/i.test(k));
  const podEntry = entries.find(([k]) => /\bpod\b|destino|descarga/i.test(k) && !/pda|crane/i.test(k));
  if (polEntry && podEntry && polEntry[1] && polEntry[1] !== "" && String(polEntry[1]).trim().toLowerCase() === String(podEntry[1]).trim().toLowerCase()) {
    incongruencias.push(`Incongruencia de ruta: Puerto de carga (${polEntry[1]}) es idéntico al puerto de descarga.`);
  }

  const seccionesDatos = Object.entries(datos)
    .filter(([_, v]) => v !== "" && v !== "(Vacío)" && v !== null && v !== undefined)
    .map(([k, v]) => `• **${k}:** ${v}`);

  const resumenDatos = seccionesDatos.length > 0
    ? seccionesDatos.slice(0, 20).join("\n")
    : "• No se detectaron valores en los campos de formulario del módulo.";

  let reporteCamposVacios = "";
  if (camposVacios.length > 0) {
    reporteCamposVacios = `\n⚠️ **CAMPOS CLAVE PENDIENTES DE DEFINICIÓN:**\n${camposVacios.slice(0, 8).map((c) => `• ${c} *(sin definir)*`).join("\n")}\n`;
  }

  let reporteIncongruencias = "";
  if (incongruencias.length > 0) {
    reporteIncongruencias = `\n🚨 **INCONGRUENCIAS TÉCNICAS DETECTADAS:**\n${incongruencias.map((inc) => `• ${inc}`).join("\n")}\n`;
  } else {
    reporteIncongruencias = `\n✅ **COHERENCIA TÉCNICA:** Parámetros registrados validados sin anomalías térmicas evidentes.\n`;
  }

  return `🔍 **AUDITORÍA FRIGORÍFICA MADRE (ESCANEO DE PANTALLA EN TIEMPO REAL)**

📋 **Módulo Auditado:** ${modulo}
👤 **Perspectiva de Negocio:** Modo ${modo}
🛡️ **Directiva Cero-Alucinaciones:** Verificación técnica auditando estrictamente los datos provistos en pantalla sin asumir ni inventar información.

📊 **VALORES CAPTURADOS EN EL MÓDULO:**
${resumenDatos}
${reporteCamposVacios}${reporteIncongruencias}
🖥️ **RESUMEN DE ELEMENTOS Y KPI VISIBLES:**
${elementos}

🎯 **DIAGNÓSTICO EJECUTIVO MADRE:** Auditoría visual de **${modulo}** completada con éxito bajo la perspectiva de ${modo}.`;
}

if (typeof window !== "undefined") {
  window.getReeferUIContext = getReeferUIContext;
  window.triggerLaserScanEffect = triggerLaserScanEffect;
  window.extractReeferScanData = extractReeferScanData;
  window.buildMotherExecutiveScript = buildMotherExecutiveScript;
  window.playNeuralMotherVoice = playNeuralMotherVoice;
  window.getMaxTransitDays = getMaxTransitDays;
  window.triggerMadrePassiveGlow = triggerMadrePassiveGlow;
  window.detectActiveModule = detectActiveModule;
  window.detectarModuloActivo = detectActiveModule;
  window.scanActiveModule = scanActiveModule;
  window.capturarDomModuloActivo = scanActiveModule;
  window.buildUniversalScanPrompt = buildUniversalScanPrompt;
  window.buildLocalZeroHallucinationAudit = buildLocalZeroHallucinationAudit;
}

/**
 * Notificación Visual Sutil (Passive Glow)
 * Enciende el resplandor del botón superior sin abrir el panel.
 */
export function triggerMadrePassiveGlow() {
  if (typeof document !== "undefined") {
    const topbarGlowElements = document.querySelectorAll(".madre-topbar-glow, #madre-topbar-glow");
    topbarGlowElements.forEach((glow) => {
      glow.style.display = "block";
      glow.classList.add("has-passive-glow");
    });
    const topbarImgElements = document.querySelectorAll(".madre-topbar-img, #madre-topbar-img");
    topbarImgElements.forEach((img) => {
      img.classList.add("grayscale-0", "opacity-100");
      img.classList.remove("grayscale", "opacity-70");
    });
    const topbarBtnElements = document.querySelectorAll(".madre-topbar-btn, #madre-topbar-button");
    topbarBtnElements.forEach((btn) => {
      btn.title = "MADRE: Análisis e informe listos (Clic para abrir)";
    });
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("madre:notification", { detail: { pending: true } }));
  }
}

// export const GlobalMadreDrawer
export function GlobalMadreDrawer({
  isMadreOpen: controlledIsMadreOpen,
  setIsMadreOpen: controlledSetIsMadreOpen,
  isOpen: controlledIsOpen,
  setIsOpen: controlledSetIsOpen,
  referenciaMadre,
  origen = "Reefer Charter Core PRO",
  initialOpen = false,
  showTrigger = true,
  COMANDOS_RAPIDOS = [
    { id: "escaner_pantalla", texto: "🔍 Escanear Pantalla Activa", icono: "❄️" },
    { id: "escenarios", texto: "Genera los 3 escenarios", icono: "📊" },
    { id: "escudo", texto: "Redacta el escudo preventivo", icono: "🛡️" },
    { id: "oferta_50", texto: "El cliente dice que tiene una oferta 50% más barata", icono: "⚔️" },
  ],
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const isMadreOpen = controlledIsMadreOpen !== undefined ? controlledIsMadreOpen : (controlledIsOpen !== undefined ? controlledIsOpen : isOpen);
  const setIsMadreOpen = (val) => {
    const nextVal = typeof val === "function" ? val(isMadreOpen) : val;
    setIsOpen(nextVal);
    if (controlledSetIsMadreOpen) controlledSetIsMadreOpen(nextVal);
    if (controlledSetIsOpen) controlledSetIsOpen(nextVal);
  };
  const dragNodeRef = useRef(null);
  const [hasPendingReport, setHasPendingReport] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputTexto = inputValue;
  const setInputTexto = setInputValue;

  const [isLoading, setIsLoading] = useState(false);
  const loading = isLoading;
  const setLoading = setIsLoading;

  const [mensajes, setMensajes] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Alias para sincronización bidireccional
  const messages = mensajes;

  // Escape key listener to close drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isMadreOpen) {
        setIsMadreOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMadreOpen]);

  // Reset pending state upon opening; Auto-focus ELIMINADO para evitar auto-zoom de pantalla y rotura de layout
  useEffect(() => {
    if (isMadreOpen) {
      setHasPendingReport(false);
    }
  }, [isMadreOpen]);

  // Auto-scroll whenever mensajes change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  // Window API and custom events synchronization
  useEffect(() => {
    const handleOpen = (e) => {
      // Si el evento viene del motor de cálculo, de una alerta de radar o no es un evento de usuario, IGNORAR.
      if (e?.detail?.fromCalculation || e?.fromCalculation || e?.detail?.autoOpen === false || (e && e.isTrusted === false && !e?.detail?.userInitiated)) {
        return;
      }
      // BLOQUEO ABSOLUTO: Si no viene explícitamente de un clic del usuario, abortar.
      if (!e?.detail?.userInitiated) {
        console.log("Apertura automática bloqueada en Reefer Charter.");
        return;
      }
      setHasPendingReport(false);
      setIsMadreOpen(true);
    };
    const handleClose = () => setIsMadreOpen(false);
    const handleToggle = (e) => {
      // Si el evento viene del motor de cálculo, de una alerta de radar o no es un evento de usuario, IGNORAR.
      if (e?.detail?.fromCalculation || e?.fromCalculation || e?.detail?.autoOpen === false || (e && e.isTrusted === false && !e?.detail?.userInitiated)) {
        return;
      }
      // BLOQUEO ABSOLUTO: Si no viene explícitamente de un clic del usuario, abortar.
      if (!e?.detail?.userInitiated) {
        console.log("Toggle automático bloqueado en Reefer Charter.");
        return;
      }
      setHasPendingReport(false);
      setIsMadreOpen((prev) => !prev);
    };
    const handleRadarAlert = (e) => {
      // Las alertas del radar se limitan únicamente a inyectar el mensaje en el historial del chat sin abrir el panel
      const alertMsg = e?.detail?.message || e?.detail?.text || (typeof e?.detail === "string" ? e.detail : null) || e?.message || "Alerta de radar detectada.";
      const newMsg = {
        id: Date.now(),
        rol: "assistant",
        role: "assistant",
        autor: e?.detail?.autor || "Radar AIS",
        sender: "assistant",
        texto: alertMsg,
        text: alertMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMensajes((prev) => [...prev, newMsg]);
    };
    const handleNotification = () => {
      setHasPendingReport(true);
    };

    window.addEventListener("madre:open", handleOpen);
    window.addEventListener("madre:close", handleClose);
    window.addEventListener("madre:toggle", handleToggle);
    window.addEventListener("radar:alert", handleRadarAlert);
    window.addEventListener("madre:notification", handleNotification);

    const handleScanEvent = () => {
      setIsMadreOpen(true);
      handleSendMessage("Escanear pantalla");
    };
    window.addEventListener("madre:scan", handleScanEvent);

    if (typeof window !== "undefined") {
      window.MadrePanelUI = {
        open: (opts) => {
          // BLOQUEO ABSOLUTO: Exige siempre opts?.userInitiated === true
          if (!opts?.userInitiated) {
            console.log("Apertura automática bloqueada en Reefer Charter.");
          }
          if (opts?.fromCalculation || opts?.autoOpen === false || !opts?.userInitiated) return;
          setHasPendingReport(false);
          setIsMadreOpen(true);
        },
        close: () => setIsMadreOpen(false),
        toggle: (opts = { userInitiated: true }) => {
          // BLOQUEO ABSOLUTO: Exige siempre opts?.userInitiated === true
          if (!opts?.userInitiated) {
            console.log("Toggle automático bloqueado en Reefer Charter.");
          }
          if (opts?.fromCalculation || opts?.autoOpen === false || !opts?.userInitiated) return;
          setHasPendingReport(false);
          setIsMadreOpen((prev) => !prev);
        },
        isOpen: () => isMadreOpen,
        scan: () => {
          setIsMadreOpen(true);
          handleSendMessage("Escanear pantalla");
        },
        escanearPantalla: () => {
          setIsMadreOpen(true);
          handleSendMessage("Escanear pantalla");
        },
      };

      window.escanearPantallaMadre = () => {
        window.MadrePanelUI?.scan();
      };
      window.dispararEscaneoUniversal = () => {
        window.MadrePanelUI?.scan();
      };

      const topbarGlowElements = document.querySelectorAll(".madre-topbar-glow, #madre-topbar-glow");
      const topbarBtnElements = document.querySelectorAll(".madre-topbar-btn, #madre-topbar-button");
      const topbarImgElements = document.querySelectorAll(".madre-topbar-img, #madre-topbar-img");

      topbarBtnElements.forEach((btn) => {
        btn.setAttribute("aria-expanded", String(isMadreOpen));
      });
      topbarGlowElements.forEach((glow) => {
        glow.style.display = isMadreOpen || isListening || hasPendingReport ? "block" : "none";
        if (hasPendingReport && !isMadreOpen) {
          glow.classList.add("has-passive-glow");
        } else {
          glow.classList.remove("has-passive-glow");
        }
      });
      topbarImgElements.forEach((img) => {
        if (isMadreOpen || isListening || hasPendingReport) {
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
      window.removeEventListener("madre:scan", handleScanEvent);
      window.removeEventListener("radar:alert", handleRadarAlert);
      window.removeEventListener("madre:notification", handleNotification);
    };
  }, [isOpen, isMadreOpen, isListening, hasPendingReport]);

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
    setIsMadreOpen(false);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const handleScan = () => {
    triggerLaserScanEffect();
    handleSubmit(null, "Escanear pantalla");
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
    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      setInputValue(transcript);
      if (event.results[0].isFinal) {
        await handleSendMessage(transcript);
      }
    };

    recognition.start();
  };

  const handleSendMessage = async (overrideText = null) => {
    const textToProcess = (typeof overrideText === "string" ? overrideText : inputValue).trim();
    if (!textToProcess || isLoading) return;

    // 1. Mostrar mensaje del usuario y bloquear UI
    setInputValue("");
    setIsLoading(true);

    const userMsg = {
      id: Date.now(),
      rol: "user",
      role: "user",
      autor: "Operador",
      sender: "user",
      texto: textToProcess,
      text: textToProcess,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMensajes((prev) => [...prev, userMsg]);

    const lowerInput = textToProcess.toLowerCase();
    let replyText = "";
    const contextoUI = getReeferUIContext();
    let stateForVoice = {
      ...(typeof window !== 'undefined' ? window.State : {}),
      breakEven: contextoUI.bloques?.bloque_6_resumen_operacion_costes?.break_even_usd_pallet || contextoUI.parametros_activos?.breakEven || 0,
      pallets: contextoUI.bloques?.bloque_3_capacidad_estiba?.pallets || contextoUI.parametros_activos?.palletQuantity || 4000,
      producto: contextoUI.bloques?.bloque_2_especificaciones_buque?.producto_especifico || contextoUI.parametros_activos?.commodity || (typeof window !== 'undefined' && window.State?.producto) || 'Carga Frigorífica',
      diasTotales: contextoUI.bloques?.bloque_6_resumen_operacion_costes?.total_dias_operativos || (Number(contextoUI.parametros_activos?.seaDays || 0) + Number(contextoUI.parametros_activos?.portDays || 0)) || (typeof window !== 'undefined' && window.State?.diasTotales) || 0,
      pssActivo: !!(contextoUI.insights?.includes('PSS') || contextoUI.parametros_activos?.pssApplied || (typeof window !== 'undefined' && window.State?.pssActivo)) // O tu bandera booleana exacta
    };

    try {
      // 2. Enrutador local
      if (lowerInput.includes("hola") || lowerInput === "madre") {
        replyText = "¡Hola! Aquí MADRE. Los sistemas frigoríficos están en línea. ¿Deseas que audite la calculadora actual?";
      } else if (lowerInput.includes("escanear") || lowerInput.includes("audita") || lowerInput.includes("roi") || lowerInput.includes("scan") || lowerInput.includes("pantalla")) {
        if (typeof triggerLaserScanEffect === "function") {
          triggerLaserScanEffect();
        }
        const moduleInfo = detectActiveModule();
        const scanPayload = scanActiveModule(document, moduleInfo);
        const promptToSend = buildUniversalScanPrompt(scanPayload);
        const executiveScriptFallback = buildMotherExecutiveScript(stateForVoice);

        // 3. Envío del paquete Universal a Data Bridge madre-chat
        const databridgeUrl = (typeof window !== "undefined" && window.DATABRIDGE_API_URL) ? window.DATABRIDGE_API_URL : "https://calm-shortbread-55bcfc.netlify.app";

        // Sincronización de referencia dinámica de expediente
        const urlParams = new URLSearchParams(window.location.search);
        let activeRef = urlParams.get("ref");
        if (!activeRef && window.location.hash.includes("?")) {
          const hashQuery = window.location.hash.split("?")[1];
          activeRef = new URLSearchParams(hashQuery).get("ref");
        }
        const finalProjectRef = referenciaMadre || activeRef || "RDM/2026-TBN";

        const texto = textToProcess;
        const trimmed = textToProcess;

        const outgoingPayload = {
          prompt: promptToSend, // prompt: trimmed
          mensajeUsuario: texto, // mensajeUsuario: trimmed
          message: trimmed,
          origen: "Reefer Charter",
          current_module: "reefer_charter",
          suite: "Reefer Charter Core PRO",
          modulo_actual: scanPayload.modulo_actual,
          timestamp: scanPayload.timestamp,
          datos_formulario: scanPayload.datos_formulario,
          estados_ui: scanPayload.estados_ui,
          elementos_visibles: scanPayload.elementos_visibles,
          escaneo_universal: scanPayload,
          escaneo_estructurado: scanPayload,
          contexto_ui: getReeferUIContext(),
          history: mensajes
            .filter((m) => (m.text || m.texto) && !m.isError)
            .map((m) => ({
              role: m.role || (m.rol === "user" ? "user" : "assistant"),
              content: m.text || m.texto,
            })),
          context: {
            origin: "Reefer Charter Core PRO",
            projectRef: finalProjectRef,
            activeModule: scanPayload.modulo_actual,
          },
        };

        try {
          const res = await fetch(MADRE_API_ENDPOINT && (typeof window !== "undefined" && window.DATABRIDGE_API_URL ? `${databridgeUrl}/.netlify/functions/madre-chat` : MADRE_API_ENDPOINT), {
            method: "POST",
            mode: "cors",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify(outgoingPayload),
          });

          if (res.ok) {
            const data = await res.json();
            replyText = data?.reply || data?.response || data?.message || data?.text || "";
          }
        } catch (fetchErr) {
          console.warn("Fallo de red conectando con Data Bridge, aplicando auditoría Cero-Alucinaciones:", fetchErr);
        }

        if (!replyText) {
          replyText = (moduleInfo.id === "estimator" && executiveScriptFallback)
            ? executiveScriptFallback
            : buildLocalZeroHallucinationAudit(scanPayload);
        }
      } else {
        // Consultas generales externas vía LLM en Data Bridge
        const databridgeUrl = (typeof window !== "undefined" && window.DATABRIDGE_API_URL) ? window.DATABRIDGE_API_URL : "https://calm-shortbread-55bcfc.netlify.app";

        const urlParams = new URLSearchParams(window.location.search);
        let activeRef = urlParams.get("ref");
        if (!activeRef && window.location.hash.includes("?")) {
          const hashQuery = window.location.hash.split("?")[1];
          activeRef = new URLSearchParams(hashQuery).get("ref");
        }
        const finalProjectRef = referenciaMadre || activeRef || "RDM/2026-TBN";

        const texto = textToProcess;
        const trimmed = textToProcess;
        if (!lowerInput.includes("escan") && !lowerInput.includes("scan") && !lowerInput.includes("pantalla")) {
          delete contextoUI.escaneo_reefer;
        }

        const outgoingPayload = {
          prompt: textToProcess, // prompt: trimmed
          mensajeUsuario: texto, // mensajeUsuario: trimmed
          message: trimmed,
          origen: "Reefer Charter",
          current_module: "reefer_charter",
          contexto_ui: getReeferUIContext(),
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

        const res = await fetch(MADRE_API_ENDPOINT && (typeof window !== "undefined" && window.DATABRIDGE_API_URL ? `${databridgeUrl}/.netlify/functions/madre-chat` : MADRE_API_ENDPOINT), {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(outgoingPayload),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        replyText = data?.reply || data?.response || data?.message || data?.text || "Procesado.";
      }

      // 4. Imprimir respuesta de la IA (Asegura texto legible: text-white) y hablar
      const assistantMsg = {
        id: Date.now() + 1,
        rol: "assistant",
        role: "assistant",
        autor: "MADRE Core",
        sender: "assistant",
        texto: replyText,
        text: replyText,
        className: "text-white",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMensajes((prev) => [...prev, assistantMsg]);

      if (!isMuted) {
        await playNeuralMotherVoice(replyText);
      }
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
        className: "text-white",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMensajes((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e, quickCommandText = null) => {
    if (e?.preventDefault) {
      e.preventDefault();
    }
    const cmdText = typeof quickCommandText === "string" ? quickCommandText : null;
    await handleSendMessage(cmdText);
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
          onClick={() => setIsMadreOpen(!isMadreOpen)}
          aria-label="Abrir panel MADRE"
          title={isMadreOpen || isListening ? "MADRE activa" : "MADRE"}
          className="madre-topbar-btn relative flex items-center justify-center w-10 h-10 rounded-full p-0 bg-transparent border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-white group"
        >
          {(isMadreOpen || isListening) && (
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
              isMadreOpen || isListening
                ? "grayscale-0 opacity-100 scale-110 drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]"
                : "grayscale opacity-70 scale-100 hover:opacity-90"
            }`}
          />
        </button>
      )}

      {/* 2. Widget Flotante Arrastrable MADRE (Estilo Cerebro.ia) */}
      {isMadreOpen && (
        <>
          {/* id="madre-backdrop" liberado al 100% (hidden pointer-events-none) para permitir interacción completa con el mapa/calculadora */}
          <div
            id="madre-backdrop"
            className="madre-backdrop hidden pointer-events-none"
            style={{ display: "none" }}
            aria-hidden="true"
          />

          <Draggable
            nodeRef={dragNodeRef}
            handle=".madre-drag-handle"
            cancel="button, input, textarea, form, .no-drag"
          >
            {/* Refactorizado de sidebar fijo (left-0, border-r) a Widget Flotante Arrastrable (bottom-4, right-4, w-[450px]) */}
            <aside
              ref={dragNodeRef}
              id="madre-drawer-panel"
              className="madre-drawer fixed bottom-4 right-4 z-50 z-[2147483647] w-[450px] max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col text-gray-800"
              style={{ backgroundColor: "#ffffff", color: "#1f2937", zIndex: 2147483647 }}
              role="dialog"
              aria-modal="true"
              aria-label="Panel Inteligente MADRE"
            >
              {/* Barra de Título (Drag Handle) */}
              <header
                className="madre-drawer-header madre-drag-handle cursor-move select-none flex items-center justify-between p-3.5 bg-white border-b border-gray-100 text-gray-800"
                style={{ backgroundColor: "#ffffff", color: "#1f2937" }}
              >
                <div className="madre-drawer-title-wrap flex items-center gap-2.5 pointer-events-none select-none">
                  <div className="madre-avatar-icon flex items-center justify-center w-7 h-7 rounded-full overflow-hidden bg-sky-50 border border-sky-100 shrink-0 flex-shrink-0">
                    <img
                      src="/MADRE.png"
                      alt="MADRE"
                      className="w-7 h-7 rounded-full object-contain grayscale-0 opacity-100"
                    />
                  </div>
                  <div>
                    <h2 className="madre-title-text text-xs md:text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <span className="text-gray-900 font-bold tracking-tight">MADRE</span>
                      <span className="madre-badge-ref text-[9px] font-mono px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                        Cerebro Central
                      </span>
                    </h2>
                    <p className="madre-subtitle-text text-[10px] text-gray-500 truncate max-w-[140px]">
                      Widget Flotante Arrastrable
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 ml-auto text-gray-600 shrink-0 flex-shrink-0 no-drag">
                  {/* Botón de Escanear Pantalla */}
                  <button
                    id="madre-header-scan-button"
                    type="button"
                    className="madre-scan-btn shrink-0 flex-shrink-0 bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-md transition text-xs font-semibold shadow-sm cursor-pointer flex items-center justify-center h-7 px-2.5 gap-1"
                    onClick={handleScan}
                    title="Escanear Pantalla (Módulo Activo)"
                    aria-label="Escanear Pantalla (Módulo Activo)"
                  >
                    <span className="text-xs">🔍</span>
                    <span className="text-[11px] font-medium text-gray-700 whitespace-nowrap">Escanear Pantalla</span>
                  </button>

                  {/* Botón de Voz (Altavoz) */}
                  <button
                    id="madre-mute-button"
                    type="button"
                    className={`madre-mute-btn shrink-0 flex-shrink-0 bg-transparent hover:bg-gray-100 text-gray-600 flex items-center justify-center w-7 h-7 rounded-md transition cursor-pointer border-0 ${
                      isMuted
                        ? "text-rose-500 hover:text-rose-600"
                        : "text-gray-600 hover:text-gray-800"
                    }`}
                    onClick={handleMuteToggle}
                    title={isMuted ? "Activar voz de MADRE" : "Silenciar voz de MADRE"}
                    aria-label={isMuted ? "Activar voz de MADRE" : "Silenciar voz de MADRE"}
                  >
                    {isMuted ? "🔇" : "🔊"}
                  </button>

                  {/* Botón Reset */}
                  <button
                    id="madre-reset-button"
                    type="button"
                    className="madre-reset-btn shrink-0 flex-shrink-0 bg-transparent hover:bg-gray-100 text-gray-600 flex items-center justify-center w-7 h-7 p-1 rounded-md transition text-xs cursor-pointer border-0"
                    onClick={handleReset}
                    title="Reiniciar conversación"
                    aria-label="Reiniciar conversación"
                  >
                    🔄
                  </button>

                  {/* Botón de Cerrar (X) que ejecute setIsMadreOpen(false) */}
                  <button
                    id="madre-close-button"
                    type="button"
                    className="madre-close-btn shrink-0 flex-shrink-0 bg-transparent hover:bg-gray-100 text-gray-600 hover:text-gray-800 flex items-center justify-center w-7 h-7 rounded-md transition cursor-pointer border-0"
                    onClick={() => setIsMadreOpen(false)}
                    aria-label="Cerrar panel MADRE"
                    title="Cerrar"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </header>

              {/* Área de Chat y Altura Máxima */}
              <div
                id="madre-messages-container"
                className="madre-drawer-body flex-1 overflow-y-auto max-h-[60vh] p-3.5 space-y-3 bg-gray-50 text-gray-800"
                style={{ backgroundColor: "#f9fafb", color: "#1f2937", maxHeight: "60vh" }}
              >
                {mensajes.length === 0 ? (
                  <div className="madre-empty-state text-center py-6 px-3 text-gray-500">
                    <div className="madre-empty-icon flex items-center justify-center mb-2">
                      <img src="/MADRE.png" alt="MADRE" className="w-10 h-10 rounded-full object-contain opacity-80" />
                    </div>
                    <h3 className="madre-empty-title text-xs font-bold text-gray-800 mb-1">
                      Cerebro Frigorífico Activo
                    </h3>
                    <p className="madre-empty-desc text-[11px] text-gray-500 max-w-xs mx-auto leading-relaxed mb-3">
                      Escáner visual de pantalla listo para capturar en tiempo real las variables de temperatura, ventilación, pallets y costes refrigerados.
                    </p>
                    <button
                      type="button"
                      onClick={handleScan}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow transition cursor-pointer"
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
                        className={`madre-bubble p-3 text-xs leading-relaxed max-w-[95%] rounded-2xl whitespace-pre-wrap ${
                          msg.rol === "user"
                            ? "bg-blue-50 text-gray-800 border border-blue-100 rounded-br-sm shadow-sm min-w-[150px] w-max max-w-[95%] text-left"
                            : msg.isError
                            ? "bg-red-50 text-red-700 border border-red-200 rounded-bl-sm shadow-sm"
                            : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
                        }`}
                        style={
                          msg.rol === "user"
                            ? { minWidth: "150px", width: "max-content", maxWidth: "95%", textAlign: "left", color: "#1f2937", backgroundColor: "#eff6ff" }
                            : msg.isError
                            ? { color: "#b91c1c", backgroundColor: "#fef2f2" }
                            : { color: "#1f2937", backgroundColor: "#ffffff" }
                        }
                      >
                        <div className="madre-bubble-meta flex items-center justify-between text-[10px] text-gray-400 mb-1">
                          <span className="font-semibold text-gray-600">{msg.autor}</span>
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
                    className="flex items-center gap-3 p-2.5 mx-2 mb-2 rounded-xl bg-white border border-dashed border-sky-300 text-xs text-sky-700 shadow-sm"
                  >
                    <div className="madre-radar-spinner w-3.5 h-3.5 rounded-full border-2 border-sky-600 border-t-transparent animate-spin"></div>
                    <span className="text-[11px] font-medium">MADRE está auditando los parámetros frigoríficos...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input y Footer Fijo en la parte inferior */}
              <footer
                className="madre-drawer-footer relative p-2.5 bg-white border-t border-gray-100 flex-shrink-0"
                style={{ backgroundColor: "#ffffff", color: "#1f2937" }}
              >
                {isListening && (
                  <div
                    id="madre-voice-status"
                    className="madre-voice-status absolute bottom-full left-2.5 right-2.5 mb-2 px-2.5 py-1.5 rounded-md text-[11px] flex items-center justify-between border bg-white/95 border-sky-300 text-sky-700 backdrop-blur-md shadow-lg z-20 pointer-events-auto"
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="inline-block w-2 h-2 rounded-full bg-sky-500 animate-ping"></span>
                      <span id="madre-voice-status-text">🎙️ Escuchando Wake Word...</span>
                    </span>
                    <span id="madre-voice-transcript" className="italic truncate max-w-[180px] text-[10px] text-gray-500"></span>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="madre-input-form flex items-center gap-2 w-full">
                  <button
                    id="madre-mic-button"
                    type="button"
                    onClick={handleMicClick}
                    className={`madre-mic-btn flex-shrink-0 shrink-0 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 transition flex items-center justify-center gap-1.5 cursor-pointer ${isListening ? "ring-2 ring-sky-500 text-sky-600" : ""}`}
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
                    className="madre-chat-input flex-1 min-w-0 px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-800 placeholder-gray-400 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                  <button
                    id="madre-send-button"
                    type="submit"
                    disabled={loading || !inputTexto.trim()}
                    className="madre-send-btn flex-shrink-0 shrink-0 px-3.5 py-1.5 text-xs font-bold bg-[#0e1b2a] hover:bg-gray-800 text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                  >
                    Enviar
                  </button>
                </form>
              </footer>
            </aside>
          </Draggable>
        </>
      )}
    </>
  );
}

export function MadrePanel(props) {
  return <GlobalMadreDrawer {...props} />;
}

export { buildMotherExecutiveScript, playNeuralMotherVoice, getMaxTransitDays };
export default GlobalMadreDrawer;
