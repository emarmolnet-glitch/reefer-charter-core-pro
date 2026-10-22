/**
 * madre-panel.js
 * Panel y Escáner Visual de Pantalla Frigorífica para Reefer Charter.
 */

export async function dispararEscaneoFrigorifico() {
  const datosExtraidos = typeof window !== "undefined" && typeof window.extractReeferScanData === "function"
    ? window.extractReeferScanData(document)
    : (typeof document !== "undefined" ? extractReeferScanData(document) : {});

  const MADRE_API_ENDPOINT = "https://calm-shortbread-55bcfc.netlify.app/.netlify/functions/madre-chat";

  return fetch(MADRE_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      prompt: "Escanear Pantalla Frigorífica",
      mensajeUsuario: "Audita esta operación de transporte frigorífico.",
      origen: "Reefer Charter",
      current_module: "reefer_charter",
      contexto_ui: {
        // Envolvemos los datos explícitamente en la clave que espera el backend reefer
        escaneo_reefer: { bloques: datosExtraidos } 
      }
    })
  });
}

if (typeof window !== "undefined") {
  window.dispararEscaneoFrigorifico = dispararEscaneoFrigorifico;
}
