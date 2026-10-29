/**
 * madre-panel.js
 * Panel y Escáner Universal de Pantalla para Reefer Charter Core PRO.
 * Detecta dinámicamente el módulo activo, serializa el DOM y envía el JSON
 * al motor de madre-chat en Data Bridge bajo la Directiva Cero-Alucinaciones.
 */

const MADRE_API_ENDPOINT = "/api/madre-chat";

/**
 * 1. Detector de Módulo y Vista Activa en Reefer Charter
 */
export function detectarModuloActivo(doc = (typeof document !== "undefined" ? document : null)) {
  if (!doc) {
    return {
      id: "general",
      displayName: "Reefer Charter Core PRO",
      modulo_actual: "Reefer Charter Core PRO",
      container: null,
      isOverlay: false,
    };
  }

  // Comprobar overlays prioritarios (e.g. Tracking Live)
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

  // Diccionario canónico de módulos de Reefer Charter
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

  // Buscar secciones .view-section activas
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

  // Fallback con estados globales o navbar buttons
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

export const detectActiveModule = detectarModuloActivo;

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
 * 2. Escáner DOM Dinámico y Universal
 * Captura campos interactivos, estados de UI y tablas/tarjetas visibles,
 * priorizando la jerarquía de lectura del diccionario REEFER_DOM_DICTIONARY.
 */
export function capturarDomModuloActivo(doc = (typeof document !== "undefined" ? document : null), moduleInfo = null) {
  const info = moduleInfo || detectarModuloActivo(doc);
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

  // 2.0 Extracción Prioritaria basada en REEFER_DOM_DICTIONARY
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

  // 2.1 Estados de UI: Perspectiva OWN/CHR y Toggles
  const chrBtn = typeof doc.getElementById === "function"
    ? doc.getElementById("btn-view-mode-charterer")
    : (typeof doc.querySelector === "function" ? doc.querySelector("#btn-view-mode-charterer") : null);
  const isCharterer = (chrBtn && chrBtn.getAttribute("aria-pressed") === "true") ||
    (typeof window !== "undefined" && (window.DualModePerspective === "charterer" || window.State?.viewMode === "charterer"));
  estadosUi.modo = isCharterer ? "charterer" : "owner";

  // Capturar otros interruptores o estados de filtro en el módulo
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

  // 2.2 Valores de formulario: Inputs, Selects, Textareas (Red de seguridad / fallback)
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

  // 2.3 Resumen de elementos visibles: Métricas Clave Prioritarias, Tablas y Tarjetas
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
    ? container.querySelectorAll(
        ".metric-card, [data-metric], .kpi-card, [data-reefer], .summary-box, .result-card, [data-summary], #res-cost-base-break-even, #res-tce-label, #calc-total-days, .card-summary"
      )
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
    : "No se identificaron tablas o métricas estructuradas en el contenedor activo.";

  return {
    suite: "Reefer Charter Core PRO",
    modulo_actual: info.displayName,
    timestamp: new Date().toISOString(),
    datos_formulario: datosFormulario,
    estados_ui: estadosUi,
    elementos_visibles: resumenVisibles,
  };
}

export const scanActiveModule = capturarDomModuloActivo;

/**
 * 3. Constructor de Prompt con Directiva Cero-Alucinaciones
 */
export function generarPromptCeroAlucinaciones(scanPayload) {
  return `🔍 **SOLICITUD DE AUDITORÍA TÉCNICA UNIVERSAL MADRE**
======================================================
Módulo Activo: ${scanPayload.modulo_actual}
Perspectiva de Negocio: Modo ${scanPayload.estados_ui?.modo === "charterer" ? "FLETADOR (Charterer)" : "ARMADOR (Owner)"}
Marca Temporal: ${scanPayload.timestamp}

DIRECTIVA CERO-ALUCINACIONES (OBLIGATORIA Y ESTRICTA):
- Auditar estricta y exclusivamente los datos provistos en el escaneo JSON del DOM.
- Señalar de forma explícita cualquier incongruencia técnica de transporte en frío (temperaturas fuera de rango para el tipo de mercancía, incompatibilidades de ventilación/humedad, shelf-life crítico superado, desajustes en estiba/pallets o fletes/costes incoherentes).
- Identificar y listar campos vacíos clave que impidan certificar la viabilidad operativa o financiera.
- ESTÁ TERMINANTEMENTE PROHIBIDO inventar, deducir arbitrariamente o asumir datos no presentes en el JSON.

DATOS CAPTURADOS DEL DOM:
\`\`\`json
${JSON.stringify(scanPayload, null, 2)}
\`\`\`

Emite el dictamen técnico ejecutivo basado únicamente en estos parámetros.`;
}

export const buildUniversalScanPrompt = generarPromptCeroAlucinaciones;

/**
 * 4. Disparador Universal del Escáner de Pantalla MADRE
 */
export async function dispararEscaneoUniversal() {
  const moduleInfo = detectarModuloActivo();
  const scanPayload = capturarDomModuloActivo(document, moduleInfo);
  const promptConDirectiva = generarPromptCeroAlucinaciones(scanPayload);

  const databridgeUrl = (typeof window !== "undefined" && window.DATABRIDGE_API_URL)
    ? window.DATABRIDGE_API_URL
    : "https://calm-shortbread-55bcfc.netlify.app";

  const targetEndpoint = (typeof window !== "undefined" && window.DATABRIDGE_API_URL)
    ? `${databridgeUrl}/.netlify/functions/madre-chat`
    : MADRE_API_ENDPOINT;

  return fetch(targetEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      origen: "Reefer Charter Core PRO",
      suite: "Reefer Charter Core PRO",
      modulo_actual: scanPayload.modulo_actual,
      current_module: moduleInfo.id || "reefer_charter",
      mensajeUsuario: `Escanear pantalla: ${scanPayload.modulo_actual}`,
      prompt: promptConDirectiva,
      message: promptConDirectiva,
      timestamp: scanPayload.timestamp,
      datos_formulario: scanPayload.datos_formulario,
      estados_ui: scanPayload.estados_ui,
      elementos_visibles: scanPayload.elementos_visibles,
      escaneo_universal: scanPayload,
      escaneo_estructurado: scanPayload,
      contexto_ui: {
        suite: "Reefer Charter Core PRO",
        modulo_actual: scanPayload.modulo_actual,
        timestamp: scanPayload.timestamp,
        datos_formulario: scanPayload.datos_formulario,
        estados_ui: scanPayload.estados_ui,
        elementos_visibles: scanPayload.elementos_visibles,
        escaneo_universal: scanPayload,
        escaneo_estructurado: scanPayload,
      },
    }),
  });
}

/**
 * 5. Compatibilidad hacia atrás con dispararEscaneoFrigorifico
 */
export async function dispararEscaneoFrigorifico() {
  return dispararEscaneoUniversal();
}

/**
 * 6. Envío de Mensaje Genérico a MADRE
 */
export async function enviarMensajeMadre(mensajeUsuario = "") {
  const moduleInfo = detectarModuloActivo();
  const scanPayload = capturarDomModuloActivo(document, moduleInfo);

  return fetch(MADRE_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      origen: "Reefer Charter Core PRO",
      suite: "Reefer Charter Core PRO",
      modulo_actual: scanPayload.modulo_actual,
      current_module: moduleInfo.id || "reefer_charter",
      mensajeUsuario,
      prompt: mensajeUsuario,
      contexto_ui: {
        escaneo_universal: scanPayload,
        escaneo_estructurado: scanPayload,
      },
    }),
  });
}

// Asignación en el ámbito global window para uso directo desde la consola o botones legacy
if (typeof window !== "undefined") {
  window.detectarModuloActivo = detectarModuloActivo;
  window.detectActiveModule = detectActiveModule;
  window.capturarDomModuloActivo = capturarDomModuloActivo;
  window.scanActiveModule = scanActiveModule;
  window.generarPromptCeroAlucinaciones = generarPromptCeroAlucinaciones;
  window.buildUniversalScanPrompt = buildUniversalScanPrompt;
  window.dispararEscaneoUniversal = dispararEscaneoUniversal;
  window.dispararEscaneoFrigorifico = dispararEscaneoFrigorifico;
  window.enviarMensajeMadre = enviarMensajeMadre;
}
