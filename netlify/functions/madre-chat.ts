/**
 * madre-chat.ts
 * Endpoint del Cerebro Central MADRE para Reefer Charter.
 * Implementa el bypass anti-timeout instantáneo ante peticiones con escaneo de pantalla visual
 * y soporte para el Escáner Universal de módulos en Reefer Charter Core PRO.
 */

import { buildReeferScreenAuditReply, buildUniversalModuleAuditReply } from "./_shared/reefer-audit-builder.mjs";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: CORS_HEADERS,
    });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  if (req.method === "POST") {
    try {
      body = await req.json();
    } catch {
      try {
        const text = await req.text();
        body = JSON.parse(text);
      } catch {
        body = {};
      }
    }
  }

  const { mensajeUsuario, message, prompt, contexto_ui, context } = body;
  const rawPrompt = String(mensajeUsuario || message || prompt || "");
  const lower = rawPrompt.toLowerCase();

  // --- REEFER CHARTER: BYPASS ANTI-TIMEOUT (ESCANEO DE PANTALLA) ---
  const escaneo = contexto_ui?.escaneo_estructurado;
  const isScanOrScreenAudit =
    lower.includes("escan") ||
    lower.includes("scan") ||
    lower.includes("pantalla") ||
    (lower.includes("auditor") && Boolean(escaneo));

  if (isScanOrScreenAudit && escaneo) {
    const reply = (escaneo?.modulo_actual && typeof buildUniversalModuleAuditReply === "function")
      ? buildUniversalModuleAuditReply(escaneo)
      : buildReeferScreenAuditReply(escaneo);

    return new Response(
      JSON.stringify({
        success: true,
        reply: reply,
        response: reply,
        message: reply,
        text: reply,
        escaneo_procesado: true,
        tipo_auditoria: escaneo?.modulo_actual ? "universal_screen_scan" : "reefer_screen_scan",
      }),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
        },
      }
    );
  }

  // Respuesta general ejecutiva MADRE
  const generalReply = `🛰️ **MADRE Core (Reefer Charter)**: Recibida directiva "${rawPrompt || "Consulta general"}". Para ejecutar la auditoría visual instantánea con los parámetros de la carga refrigerada visible en pantalla, escribe "Escanear pantalla" o usa el comando rápido.`;

  return new Response(
    JSON.stringify({
      success: true,
      reply: generalReply,
      response: generalReply,
      message: generalReply,
      text: generalReply,
      escaneo_procesado: false,
    }),
    {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      },
    }
  );
};

export const handler = async (event: any) => {
  const method = event.httpMethod || "GET";
  if (method === "OPTIONS") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  let body: any = {};
  try {
    body = event.body ? (typeof event.body === "string" ? JSON.parse(event.body) : event.body) : {};
  } catch {
    body = {};
  }

  const { mensajeUsuario, message, prompt, contexto_ui } = body;
  const rawPrompt = String(mensajeUsuario || message || prompt || "");
  const lower = rawPrompt.toLowerCase();

  const escaneo = contexto_ui?.escaneo_estructurado || contexto_ui?.escaneo_reefer?.bloques || contexto_ui?.escaneo_reefer || contexto_ui?.escaneo_universal || body?.escaneo_universal;
  const isScanOrScreenAudit = lower.includes("escan") || lower.includes("scan") || lower.includes("pantalla") || (lower.includes("auditor") && Boolean(escaneo));

  if (isScanOrScreenAudit && escaneo) {
    const reply = (escaneo?.modulo_actual && typeof buildUniversalModuleAuditReply === "function")
      ? buildUniversalModuleAuditReply(escaneo)
      : buildReeferScreenAuditReply(escaneo);

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        reply: reply,
        response: reply,
        message: reply,
        text: reply,
        escaneo_procesado: true,
        tipo_auditoria: escaneo?.modulo_actual ? "universal_screen_scan" : "reefer_screen_scan",
      }),
    };
  }

  const defaultReply = `🛰️ **MADRE Core (Reefer Charter)**: Recibida directiva "${rawPrompt}".`;
  return {
    statusCode: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({
      success: true,
      reply: defaultReply,
      response: defaultReply,
      text: defaultReply,
    }),
  };
};
