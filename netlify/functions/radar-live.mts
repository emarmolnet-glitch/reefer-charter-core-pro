import type { Config, Context } from "@netlify/functions";
import { getRadarTraffic, fetchAisStreamAndNeonFallback, persistMerchantFleetInNeon } from "./_shared/aisCoordinator.js";
import { getDatabase } from "netlify-database-client";

type BackgroundContext = Context & {
  waitUntil?(promise: Promise<unknown>): void;
};

export default async (req: Request, context: BackgroundContext) => {
  if (req.method !== "GET") {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  const parameters = new URL(req.url).searchParams;
  const lat = Number(parameters.get("lat"));
  const lon = Number(parameters.get("lon"));
  const radius = Number(parameters.get("radius")) || 30;

  let result: any = null;

  try {
    result = await getRadarTraffic(lat, lon, radius, {
      scheduleRefresh: (p: Promise<unknown>) => context.waitUntil?.(p),
    });

    if (!result || !Array.isArray(result.data) || result.data.length === 0) {
      result = await fetchAisStreamAndNeonFallback({ lat, lon, radius });
    }
  } catch (error: any) {
    console.warn("[radar-live] Error en getRadarTraffic, ejecutando fallback AISStream + Neon:", error?.message || error);
    try {
      result = await fetchAisStreamAndNeonFallback({ lat, lon, radius });
    } catch (fbErr: any) {
      console.error("[radar-live] Fallback falló también:", fbErr?.message || fbErr);
      result = { data: [], rawCount: 0, sourceCounts: { liveRadar: 0, technicalMatches: 0 } };
    }
  }

  const vessels = result && Array.isArray(result.data) ? result.data : [];
  if (vessels.length > 0) {
    context.waitUntil?.((async () => {
      try {
        const dbUrl = Netlify.env.get("DATABASE_URL") ?? Netlify.env.get("NETLIFY_DATABASE_URL") ?? Netlify.env.get("NETLIFY_DB_URL");
        if (!dbUrl) return;
        const database = getDatabase({ connectionString: dbUrl });
        await persistMerchantFleetInNeon(vessels, database.pool);
      } catch (dbErr) {
        console.error("[radar-live] Error en persistMerchantFleetInNeon:", dbErr);
      }
    })());
  }

  return Response.json({ success: true, ...result }, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
};

export const config: Config = {
  path: "/api/radar/live",
};
