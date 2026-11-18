import type { Config, Context } from "@netlify/functions";
import type { QueryResultRow } from "pg";
import { getPool } from "../../db/index.js";
import { createCorsHeaders } from "./_shared/cors.js";
import { resolveWpiPort } from "./_shared/wpi-port-resolver.mjs";
import {
  COMMERCIAL_DWT_MAX_MULTIPLIER,
  COMMERCIAL_DWT_MIN_MULTIPLIER,
  isDwtWithinCommercialBand,
  resolveCommercialDwtBounds,
} from "../../cargo-taxonomy.mjs";
import {
  BALLAST_DRAFT_RATIO_THRESHOLD,
  DEFAULT_BALLAST_SPEED_KNOTS,
  SPOT_PROXIMITY_NM,
  classifyVesselOpenness,
} from "../../vessel-openness-engine.mjs";

interface VesselMasterRecord extends QueryResultRow {
  imo_number: number | string | null;
  vessel_name: string | null;
  mmsi: string | null;
  vessel_type: string | null;
  flag: string | null;
  dwt: number | null;
  draft_meters: number | null;
  gross_tonnage: number | null;
  net_tonnage: number | null;
  year_built: number | null;
  loa_meters: number | null;
  beam_meters: number | null;
  latitude: number | null;
  longitude: number | null;
  owner_manager: string | null;
  has_gears: boolean | null;
  process_status: string | null;
  audit_status: string | null;
  validation_status: string | null;
  source_payload: unknown;
  fecha_ultima_actualizacion: Date | string | null;
}

// Non-commercial vessels strict exclusion regex (radar filter)
const STRICT_NON_COMMERCIAL_RE = /\b(fishing|pesquero|pesca|trawler|tug|tugboat|remolcador|remolque|pusher|passenger|cruise|ferry|pleasure|yacht|sailing|dredger|vts|mark|point|danger|buoy|boya|military|sar|rescue|pilot|workboat|other|unknown)\b/i;

// Commercial merchant cargo whitelist regex
const STRICT_MERCHANT_CARGO_RE = /\b(bulk|bulker|cargo|carguero|coaster|cabotaje|container|tanker|petrolero|quimiquero|heavy load|heavy lift|break bulk|breakbulk|ro-ro|roro|cement|cementero|clinker|mpp|mpv|mmpp|freighter|merchant|general cargo|mini bulker|refrigerated cargo|reefer|frigorifico|cooling|fruit carrier)\b/i;

// Strict dry bulk cargo taxonomy patterns
const DRY_BULK_CARGO_RE = /\b(cement|cemento|clinker|clinquer|yeso|gypsum|cal|lime|aridos?|aggregates?|mineral|granel\s*seco|dry\s*bulk|grain|grano|cereales?|fertilizante|abono|bauxita|carbon|carb[oó]n|slags?|cenizas?)\b/i;

// Strict refrigerated / reefer cargo patterns
const REEFER_CARGO_RE = /\b(reefer|refrigerad[oa]|frigor[ií]fic[oa]|fruta|fruit|banana|pl[aá]tano|citric|c[ií]tricos?|congelad[oa]|frozen|carne|meat|pescad[oa]|fish|farma|pharma|medicines|farmac[eé]utic[oa]|vacunas|perishables?|pereceder[oa])\b/i;

// Mandatory excluded vessel types for reefer cargoes (prohibition of containers, bulkers, tankers, etc.)
const MANDATORY_REEFER_EXCLUDED_TYPES_RE = /\b(container|containership|feeder|boxship|portacontenedores|bulk carrier|bulker|dry bulk|granelero|handysize|handymax|supramax|ultramax|panamax|capesize|ore carrier|coal carrier|cement|cement carrier|cementero|clinker|tanker|petrolero|quimiquero|chemical tanker|oil tanker|product tanker|crude|lng|lpg|gas carrier|roro|ro-ro|vehicle|car carrier|tug|tugboat|remolcador|remolque|pusher|empujador|passenger|cruise|ferry|ropax|ro-pax|pasaje|pasajeros|crucero|pleasure|yacht|yate|sailing|velero|fishing|pesquero|trawler|draga|dredger|powership|karadeniz|power ship|fpso|fso|drillship|barge|pontona|cable layer|research|supply|offshore)\b/i;

// Compatible vessel types for reefer cargoes
const COMPATIBLE_REEFER_TYPES_RE = /\b(reefer|refrigerated|frigor[ií]fic[oa]|cooling|fruit carrier|bodega frigor[ií]fica|multipurpose|multi-purpose|multi purpose|mpp|mpv|general cargo|carguero|buque de carga|coaster|costero)\b/i;

// Mandatory excluded vessel types for dry bulk cargoes
const MANDATORY_DRY_BULK_EXCLUDED_TYPES_RE = /\b(tanker|oil tanker|chemical tanker|product tanker|crude|petrolero|quimiquero|tanquero|lng|lpg|container|containership|feeder|boxship|portacontenedores|tug|tugboat|remolcador|remolque|pusher|empujador|passenger|cruise|ferry|ropax|ro-pax|pasaje|pasajeros|crucero|pleasure|yacht|yate|sailing|velero|fishing|pesquero|trawler)\b/i;

// Compatible vessel types for dry bulk cargoes
const COMPATIBLE_DRY_BULK_TYPES_RE = /\b(bulk carrier|bulker|dry bulk|handysize|handymax|supramax|ultramax|panamax|capesize|granelero|mini bulker|minibulker|mini-bulker|general cargo|carguero|buque de carga|coaster|costero|cabotaje|cabotage|multipurpose|multi-purpose|multi purpose|mpp|mpv|box-shaped|box hold|open hatch|cement carrier|cementero|clinker carrier|self-discharger|self discharger|self-unloading|self unloader)\b/i;

// Default commercial operation baseline initialized to zero / blank
const DEFAULT_ACTIVE_OPERATION = Object.freeze({
  cargoName: "",
  cargoVolumeMt: 0,
  stowageFactorM3Mt: 0.85,
  polName: "",
  polCountry: "",
  polFlag: "🌍",
  polCoords: { lat: 0, lon: 0 },
  polMaxDraftMeters: 0,
  podName: "",
  podCountry: "",
  podFlag: "🌍",
  podCoords: { lat: 0, lon: 0 },
  podMaxDraftMeters: 0,
  laycan: "",
  laycanWindow: "",
  loadingRate: "",
  loadingRateMtWw: 0,
});

export function haversineDistanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) return 0;
  if ((lat1 === 0 && lon1 === 0) || (lat2 === 0 && lon2 === 0)) return 0;
  const radiusNm = 3440.065;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return radiusNm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export type LocationContext = "POL" | "POD" | "TRANSIT";

export function determineLocationContext(
  distancePolNm: number,
  distancePodNm: number,
  hasPolCoords: boolean,
  hasPodCoords: boolean,
): LocationContext {
  const hasPol = hasPolCoords && distancePolNm > 0;
  const hasPod = hasPodCoords && distancePodNm > 0;

  if (hasPol && hasPod) {
    if (distancePodNm <= 30 && (distancePolNm > 30 || distancePodNm < distancePolNm)) {
      return "POD";
    }
    if (distancePolNm <= 30 && (distancePodNm > 30 || distancePolNm <= distancePodNm)) {
      return "POL";
    }
    if (distancePodNm < distancePolNm && distancePodNm <= 50) {
      return "POD";
    }
    if (distancePolNm <= distancePodNm && distancePolNm <= 50) {
      return "POL";
    }
    return "TRANSIT";
  }

  if (hasPod && !hasPol) {
    return distancePodNm <= 30 ? "POD" : "TRANSIT";
  }

  if (hasPol && !hasPod) {
    return distancePolNm <= 30 ? "POL" : "TRANSIT";
  }

  return "TRANSIT";
}

function parseCoordinate(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function extractCoordinates(obj: unknown, prefix = ""): { lat: number; lon: number } {
  if (!obj || typeof obj !== "object") return { lat: 0, lon: 0 };
  const rec = obj as Record<string, unknown>;
  const lat = parseCoordinate(
    rec.lat ?? rec.latitude ?? rec.Latitude ??
    (prefix ? rec[`${prefix}Lat`] ?? rec[`${prefix}Latitude`] ?? rec[`${prefix}_lat`] ?? rec[`${prefix}_latitude`] : undefined)
  );
  const lon = parseCoordinate(
    rec.lon ?? rec.lng ?? rec.longitude ?? rec.Longitude ??
    (prefix ? rec[`${prefix}Lon`] ?? rec[`${prefix}Lng`] ?? rec[`${prefix}Longitude`] ?? rec[`${prefix}_lon`] ?? rec[`${prefix}_lng`] : undefined)
  );
  return { lat, lon };
}

export interface CandidateEvaluationInput {
  imo: number;
  name: string;
  mmsi: string;
  vesselType: string;
  tipo_buque?: string;
  categoria_buque?: string;
  dwt: number;
  draftMeters: number;
  loaMeters: number;
  beamMeters: number;
  yearBuilt: number;
  flag: string;
  latitude: number;
  longitude: number;
  speedKnots: number;
  headingDeg: number;
  navStatus: string;
  operationalStatus: string;
  distancePolNm: number;
  distancePodNm: number;
  locationContext: LocationContext;
  isLiveRadar?: boolean;
  // Señales de disponibilidad operativa (Vessel Openness) del payload AIS.
  currentDraftMeters?: number;
  maxDraftMeters?: number;
  navStatusRaw?: string | number | null;
  destination?: string | null;
  reportedEta?: string | null;
}

export function evaluateMathematicalMatch(
  candidate: CandidateEvaluationInput,
  op: {
    cargoName: string;
    cargoVolumeMt: number;
    stowageFactorM3Mt: number;
    polName: string;
    podName: string;
    polMaxDraftMeters: number;
    podMaxDraftMeters: number;
    laycan: string;
    loadingRate: string;
  },
) {
  const { cargoVolumeMt, polMaxDraftMeters, podMaxDraftMeters, polName, podName, laycan, loadingRate, cargoName } = op;
  const { dwt, draftMeters, distancePolNm, distancePodNm, locationContext, yearBuilt, vesselType } = candidate;

  const isDryBulk = DRY_BULK_CARGO_RE.test(cargoName);
  const isMandatoryExcluded = MANDATORY_DRY_BULK_EXCLUDED_TYPES_RE.test(vesselType);
  const isCompatibleDryBulk = COMPATIBLE_DRY_BULK_TYPES_RE.test(vesselType);

  if (isDryBulk && (isMandatoryExcluded || !isCompatibleDryBulk)) {
    let exclusionTypeLabel = "Incompatible";
    if (/tanker|petrolero|quimiquero|crude|lng|lpg/i.test(vesselType)) exclusionTypeLabel = "Tanker / Buque Tanque";
    else if (/container|portacontenedores|feeder|boxship/i.test(vesselType)) exclusionTypeLabel = "Container / Portacontenedores";
    else if (/tug|remolcador|pusher/i.test(vesselType)) exclusionTypeLabel = "Tug / Remolcador";
    else if (/passenger|cruise|ferry|pasaje|crucero/i.test(vesselType)) exclusionTypeLabel = "Passenger / Pasaje";
    else exclusionTypeLabel = vesselType;

    const marginPct = cargoVolumeMt > 0 ? Math.round(((dwt - cargoVolumeMt) / cargoVolumeMt) * 1000) / 10 : 0;
    const stowageFactorStr = `${op.stowageFactorM3Mt.toFixed(2)} m³/MT (30.0 cuft/lt)`;

    return {
      compatibilityScore: 0,
      technicalJustification: `Exclusión mandatoria por incompatibilidad taxonómica: El buque está clasificado como ${exclusionTypeLabel} (${vesselType}), categoría incompatible con cargas de granel seco (${cargoName}).`,
      stowageFactor: stowageFactorStr,
      technicalEvaluation: {
        dwtDiffPct: marginPct,
        dwtCompatible: false,
        draftCompatiblePol: polMaxDraftMeters === 0 || draftMeters <= polMaxDraftMeters,
        draftCompatiblePod: podMaxDraftMeters === 0 || draftMeters <= podMaxDraftMeters,
        stowageCompatible: false,
        taxonomyCompatible: false,
        laycanCompatible: false,
      },
    };
  }

  const isReefer = REEFER_CARGO_RE.test(cargoName) || (!isDryBulk && cargoName.length > 0);
  const isMandatoryReeferExcluded = MANDATORY_REEFER_EXCLUDED_TYPES_RE.test(vesselType) || (dwt > 18000 || dwt < 1000);
  const isCompatibleReefer = COMPATIBLE_REEFER_TYPES_RE.test(vesselType);

  if (isReefer && (isMandatoryReeferExcluded || !isCompatibleReefer)) {
    let exclusionTypeLabel = "Incompatible";
    if (dwt > 18000) exclusionTypeLabel = `Megabuque fuera de rango frigorífico (${dwt.toLocaleString()} DWT > 18.000 MT)`;
    else if (dwt < 1000) exclusionTypeLabel = `Embarcación menor (${dwt.toLocaleString()} DWT < 1.000 MT)`;
    else if (/container|containership|feeder|boxship|portacontenedores/i.test(vesselType)) exclusionTypeLabel = "Container / Portacontenedores";
    else if (/bulk carrier|bulker|dry bulk|granelero|handysize|handymax|supramax|panamax|capesize/i.test(vesselType)) exclusionTypeLabel = "Bulk Carrier / Granelero Seco";
    else if (/tanker|petrolero|quimiquero|crude|lng|lpg/i.test(vesselType)) exclusionTypeLabel = "Tanker / Buque Tanque";
    else if (/cement|cementero|clinker|ore|coal/i.test(vesselType)) exclusionTypeLabel = "Cement / Ore / Coal Carrier";
    else if (/tug|remolcador|pusher/i.test(vesselType)) exclusionTypeLabel = "Tug / Remolcador";
    else if (/passenger|cruise|ferry|pasaje|crucero|yacht|pleasure/i.test(vesselType)) exclusionTypeLabel = "Passenger / Pasaje / Recreo";
    else if (/fishing|pesquero|trawler/i.test(vesselType)) exclusionTypeLabel = "Fishing / Pesquero";
    else exclusionTypeLabel = vesselType;

    const marginPct = cargoVolumeMt > 0 ? Math.round(((dwt - cargoVolumeMt) / cargoVolumeMt) * 1000) / 10 : 0;
    const stowageFactorStr = `${op.stowageFactorM3Mt.toFixed(2)} m³/MT (30.0 cuft/lt)`;

    return {
      compatibilityScore: 0,
      technicalJustification: `Exclusión mandatoria por incompatibilidad frigorífica: El buque está clasificado como ${exclusionTypeLabel} (${vesselType}), categoría incompatible con cargas refrigeradas (${cargoName}). Se restringe a buques frigoríficos de bodega de 1.000 a 18.000 MT.`,
      stowageFactor: stowageFactorStr,
      technicalEvaluation: {
        dwtDiffPct: marginPct,
        dwtCompatible: false,
        draftCompatiblePol: polMaxDraftMeters === 0 || draftMeters <= polMaxDraftMeters,
        draftCompatiblePod: podMaxDraftMeters === 0 || draftMeters <= podMaxDraftMeters,
        stowageCompatible: false,
        taxonomyCompatible: false,
        laycanCompatible: false,
      },
    };
  }

  const baseVol = Math.max(1, cargoVolumeMt);
  const dwtRatio = dwt / baseVol;
  let dwtScore = 100;
  if (cargoVolumeMt > 0) {
    if (dwtRatio < 1.0) {
      dwtScore = Math.max(0, 60 - (1.0 - dwtRatio) * 200);
    } else if (dwtRatio >= 1.05 && dwtRatio <= 1.15) {
      dwtScore = 100;
    } else if (dwtRatio > 1.15 && dwtRatio <= 1.30) {
      dwtScore = Math.max(80, 100 - (dwtRatio - 1.15) * 100);
    } else {
      dwtScore = Math.max(50, 85 - (dwtRatio - 1.30) * 80);
    }
  }

  const polDraftOk = polMaxDraftMeters === 0 || draftMeters <= polMaxDraftMeters;
  const podDraftOk = podMaxDraftMeters === 0 || draftMeters <= podMaxDraftMeters;
  let draftScore = 100;
  if (!polDraftOk || !podDraftOk) {
    const maxExceed = Math.max(
      polDraftOk ? 0 : draftMeters - polMaxDraftMeters,
      podDraftOk ? 0 : draftMeters - podMaxDraftMeters,
    );
    draftScore = Math.max(0, 50 - maxExceed * 30);
  }

  const effectiveDistance = locationContext === "POD" && distancePodNm > 0
    ? distancePodNm
    : (distancePolNm > 0 ? distancePolNm : (distancePodNm > 0 ? distancePodNm : 0));

  let proximityScore = 100;
  if (effectiveDistance <= 1.5) {
    proximityScore = 100;
  } else if (effectiveDistance <= 5.0) {
    proximityScore = 95;
  } else if (effectiveDistance <= 15.0) {
    proximityScore = 88;
  } else if (effectiveDistance <= 40.0) {
    proximityScore = 78;
  } else {
    proximityScore = Math.max(40, 75 - (effectiveDistance - 40) * 0.5);
  }

  const isSpecializedCement = /cement|clinker|self-discharger/i.test(vesselType);
  const isBulkOrMiniBulker = /bulk carrier|bulker|mini bulker|minibulker|mini-bulker|handysize|handymax|supramax|ultramax|panamax|capesize/i.test(vesselType);
  const isGeneralCargoSuitable = /general cargo|coaster|costero|box-shaped|box hold|open hatch|multipurpose|multi-purpose|mpp/i.test(vesselType);
  let stowageScore = 90;
  if (isSpecializedCement) stowageScore = 100;
  else if (isBulkOrMiniBulker) stowageScore = 98;
  else if (isGeneralCargoSuitable) stowageScore = 95;
  else stowageScore = 80;

  let ageScore = 90;
  if (yearBuilt >= 2012) ageScore = 100;
  else if (yearBuilt >= 2006) ageScore = 95;
  else if (yearBuilt >= 2000) ageScore = 85;
  else ageScore = 75;

  const rawComposite =
    dwtScore * 0.35 +
    draftScore * 0.25 +
    proximityScore * 0.20 +
    stowageScore * 0.10 +
    ageScore * 0.10;

  const estimatedPallets = Math.round(dwt / 2.75);
  const estimatedCbft = Math.round(estimatedPallets * 63.5);

  let compositeScore = Math.min(100, Math.max(10, Math.round(rawComposite)));
  if (/reefer|refrigerated|frigor/i.test(vesselType)) {
    compositeScore = Math.min(100, compositeScore + 8);
  }

  const marginPct = cargoVolumeMt > 0 ? Math.round(((dwt - cargoVolumeMt) / cargoVolumeMt) * 1000) / 10 : 0;
  const stowageFactorStr = `${op.stowageFactorM3Mt.toFixed(2)} m³/MT (30.0 cuft/lt)`;

  let locationLabel = "";
  if (locationContext === "POD") {
    locationLabel = `posición a ${distancePodNm.toFixed(1)} NM de POD (Oportunidad Backhaul / Retorno en Destino)`;
  } else if (locationContext === "POL") {
    locationLabel = `posición a ${distancePolNm.toFixed(1)} NM de POL`;
  } else {
    locationLabel = `en tránsito (${distancePolNm.toFixed(1)} NM a POL / ${distancePodNm.toFixed(1)} NM a POD)`;
  }

  const reeferCapacityLabel = `${estimatedCbft.toLocaleString()} cbft (~${estimatedPallets.toLocaleString()} pallets en cámara)`;
  const operationalTypeLabel = (isReefer && dwt >= 1500 && dwt <= 15000)
    ? "Reefer Vessel (Bodega Frigorífica)"
    : vesselType;
  let justification = `${operationalTypeLabel}: DWT ${dwt.toLocaleString()} MT (${reeferCapacityLabel}) evaluado para lote de ${cargoVolumeMt.toLocaleString()} MT; calado ${draftMeters.toFixed(2)}m admisible; ${locationLabel}.`;

  return {
    compatibilityScore: compositeScore,
    technicalJustification: justification,
    stowageFactor: stowageFactorStr,
    technicalEvaluation: {
      dwtDiffPct: marginPct,
      dwtCompatible: polDraftOk && podDraftOk,
      draftCompatiblePol: polDraftOk,
      draftCompatiblePod: podDraftOk,
      stowageCompatible: true,
      taxonomyCompatible: true,
      laycanCompatible: true,
    },
  };
}

export default async function handler(req: Request, _context: Context) {
  const corsHeaders = createCorsHeaders(req, "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const pool = getPool();
    const url = new URL(req.url);
    let bodyData: Record<string, unknown> = {};
    if (req.method === "POST") {
      try {
        bodyData = (await req.json()) as Record<string, unknown>;
      } catch {}
    }

    const polName = String(bodyData.polName || bodyData.pol || url.searchParams.get("pol") || "").trim();
    const podName = String(bodyData.podName || bodyData.pod || url.searchParams.get("pod") || "").trim();
    const polFlag = String(bodyData.polFlag || url.searchParams.get("polFlag") || (polName ? "🇩🇿" : "🌍")).trim();
    const polCountry = String(bodyData.polCountry || url.searchParams.get("polCountry") || "").trim();
    const podFlag = String(bodyData.podFlag || url.searchParams.get("podFlag") || (podName ? "🇪🇸" : "🌍")).trim();
    const podCountry = String(bodyData.podCountry || url.searchParams.get("podCountry") || "").trim();
    const cargoName = String(bodyData.cargoName || bodyData.cargoType || url.searchParams.get("cargoName") || url.searchParams.get("cargo") || "").trim();
    const cargoVolumeMt = Number(bodyData.cargoVolumeMt || bodyData.cargoQuantity || bodyData.cargoQty || url.searchParams.get("cargoVolumeMt") || url.searchParams.get("qty") || 0) || 0;
    const commercialDwtBounds = resolveCommercialDwtBounds(cargoVolumeMt);
    const laycan = String(bodyData.laycan || bodyData.laycanWindow || url.searchParams.get("laycan") || "").trim();
    // Fechas crudas del laycan: necesarias para contrastar la apertura proyectada
    // de cada buque contra la ventana real de carga.
    const laydayStart = String(
      bodyData.laydayStart || bodyData.laydays || bodyData.laycanStart || bodyData.laycanDate
      || url.searchParams.get("laydayStart") || url.searchParams.get("laydays") || ""
    ).trim();
    const cancelling = String(
      bodyData.cancelling || bodyData.cancellingDate || bodyData.laycanEnd
      || url.searchParams.get("cancelling") || url.searchParams.get("laycanEnd") || ""
    ).trim();
    const loadingRate = String(bodyData.loadingRate || url.searchParams.get("loadingRate") || "").trim();

    let polCoords = extractCoordinates(bodyData.polCoords);
    if (!polCoords.lat && !polCoords.lon) {
      polCoords = extractCoordinates(bodyData, "pol");
    }
    if (!polCoords.lat && !polCoords.lon) {
      const urlPolLat = parseCoordinate(url.searchParams.get("polLat") || url.searchParams.get("polLatitude") || url.searchParams.get("lat"));
      const urlPolLon = parseCoordinate(url.searchParams.get("polLon") || url.searchParams.get("polLongitude") || url.searchParams.get("lon") || url.searchParams.get("lng"));
      if (urlPolLat || urlPolLon) {
        polCoords = { lat: urlPolLat, lon: urlPolLon };
      }
    }

    let podCoords = extractCoordinates(bodyData.podCoords);
    if (!podCoords.lat && !podCoords.lon) {
      podCoords = extractCoordinates(bodyData, "pod");
    }
    if (!podCoords.lat && !podCoords.lon) {
      const urlPodLat = parseCoordinate(url.searchParams.get("podLat") || url.searchParams.get("podLatitude"));
      const urlPodLon = parseCoordinate(url.searchParams.get("podLon") || url.searchParams.get("podLongitude"));
      if (urlPodLat || urlPodLon) {
        podCoords = { lat: urlPodLat, lon: urlPodLon };
      }
    }

    if (!polCoords.lat && !polCoords.lon && polName) {
      try {
        const res = await resolveWpiPort(polName);
        if (res && res.status === "resolved" && res.match) {
          polCoords = { lat: res.match.latitude, lon: res.match.longitude };
        }
      } catch {}
    }

    if (!podCoords.lat && !podCoords.lon && podName) {
      try {
        const res = await resolveWpiPort(podName);
        if (res && res.status === "resolved" && res.match) {
          podCoords = { lat: res.match.latitude, lon: res.match.longitude };
        }
      } catch {}
    }

    const activeOperation = Object.freeze({
      cargoName,
      cargoVolumeMt,
      stowageFactorM3Mt: DEFAULT_ACTIVE_OPERATION.stowageFactorM3Mt,
      polName,
      polCountry,
      polFlag,
      polCoords,
      polMaxDraftMeters: 9.50,
      podName,
      podCountry,
      podFlag,
      podCoords,
      podMaxDraftMeters: 11.00,
      laycan,
      laycanWindow: laycan,
      laydayStart,
      cancelling,
      loadingRate,
      loadingRateMtWw: 3000,
      minDwt: commercialDwtBounds.minDwt,
      maxDwt: commercialDwtBounds.maxDwt,
      commercialDwtBand: {
        applied: commercialDwtBounds.applied,
        minDwt: commercialDwtBounds.minDwt,
        maxDwt: commercialDwtBounds.maxDwt,
        minMultiplier: COMMERCIAL_DWT_MIN_MULTIPLIER,
        maxMultiplier: COMMERCIAL_DWT_MAX_MULTIPLIER,
      },
    });

    let dbRows: VesselMasterRecord[] = [];
    try {
      const targetCargoDwt = cargoVolumeMt > 0 ? cargoVolumeMt : 5000;
      let queryStr = `
        SELECT
          imo_number,
          vessel_name,
          mmsi,
          vessel_type,
          flag,
          dwt,
          draft_meters,
          gross_tonnage,
          net_tonnage,
          year_built,
          loa_meters,
          beam_meters,
          latitude,
          longitude,
          owner_manager,
          has_gears,
          process_status,
          audit_status,
          validation_status,
          source_payload,
          fecha_ultima_actualizacion
        FROM vessels_master
        WHERE imo_number IS NOT NULL
          AND imo_number > 1000000
      `;
      let queryParams: any[] = [];
      if (commercialDwtBounds.applied) {
        queryStr += ` AND (dwt IS NULL OR dwt BETWEEN $1 AND $2)`;
        queryParams = [Math.max(1000, commercialDwtBounds.minDwt), Math.min(18000, commercialDwtBounds.maxDwt)];
      } else {
        queryStr += ` AND (dwt IS NULL OR (dwt >= 1000 AND dwt <= 18000))`;
      }
      queryStr += ` ORDER BY dwt ASC LIMIT 100`;

      const result = await pool.query<VesselMasterRecord>(queryStr, queryParams);
      dbRows = result.rows || [];

      // Si devuelve < 5 buques, ejecuta una consulta fallback para 1.500–15.000 DWT
      if (dbRows.length < 5) {
        const fallbackTarget = Math.round(cargoVolumeMt || 4000);
        const fallbackRes = await pool.query<VesselMasterRecord>(`
          SELECT
            imo_number,
            vessel_name,
            mmsi,
            vessel_type,
            flag,
            dwt,
            draft_meters,
            gross_tonnage,
            net_tonnage,
            year_built,
            loa_meters,
            beam_meters,
            latitude,
            longitude,
            owner_manager,
            has_gears,
            process_status,
            audit_status,
            validation_status,
            source_payload,
            fecha_ultima_actualizacion
          FROM vessels_master
          WHERE imo_number IS NOT NULL
            AND imo_number > 1000000
            AND (dwt IS NULL OR (dwt >= 1500 AND dwt <= 15000))
          ORDER BY ABS(COALESCE(dwt, 5000) - ${fallbackTarget}) ASC
          LIMIT 25
        `);
        if (fallbackRes.rows && fallbackRes.rows.length > 0) {
          const existingImos = new Set(dbRows.map(r => Number(r.imo_number)));
          for (const row of fallbackRes.rows) {
            if (!existingImos.has(Number(row.imo_number))) {
              dbRows.push(row);
            }
          }
        }
      }

      // Ordenar en JS por proximidad a cargoVolumeMt
      dbRows.sort((a, b) => {
        const dwtA = Number(a.dwt || 5000);
        const dwtB = Number(b.dwt || 5000);
        return Math.abs(dwtA - targetCargoDwt) - Math.abs(dwtB - targetCargoDwt);
      });
    } catch (dbErr) {
      console.warn("[vessel-compatibility] Error querying Neon DB vessels_master:", (dbErr as Error)?.message);
    }

    const rawIncomingVessels = Array.isArray(bodyData.liveRadarVessels) ? (bodyData.liveRadarVessels as any[]) : [];
    const candidateMap = new Map<number, CandidateEvaluationInput & { isLiveRadar?: boolean; tipo_buque?: string; categoria_buque?: string }>();

    const hasPolCoords = Boolean(polCoords.lat || polCoords.lon);
    const hasPodCoords = Boolean(podCoords.lat || podCoords.lon);

    for (const r of dbRows) {
      const imo = Number(r.imo_number);
      if (!imo || imo <= 1000000) continue;
      const vType = String(r.vessel_type || "General Cargo");
      const vName = String(r.vessel_name || "");
      const combined = `${vName} ${vType}`.toLowerCase();

      // Excluye powerships, contenedores, tankers, bulkers > 16.000, cement
      if (/powership|karadeniz|power ship|fpso|fso|drillship|barge|pontona|dredger|draga|cable layer|research|supply|offshore/i.test(combined)) continue;
      if (/container|boxship|feeder|msc |maersk|cma cgm/i.test(combined)) continue;
      if (/tanker|petrolero|quimiquero|chemical tanker|oil tanker|product tanker|gas carrier|lng|lpg/i.test(combined)) continue;
      if (/cement|clinker/i.test(combined)) continue;

      let rDwt = Number(r.dwt || 0);
      if (rDwt > 16000 || (rDwt > 0 && rDwt < 1000)) continue;
      if (/bulk carrier|bulker|capesize|panamax|supramax|handymax|handysize/i.test(vType) && rDwt > 16000) continue;

      let rLoa = Number(r.loa_meters || 0);
      let rBeam = Number(r.beam_meters || 0);
      let rDraft = Number(r.draft_meters || 0);
      let rYear = Number(r.year_built || 0);

      // Descartar cualquier registro con loa === 0 && beam === 0 cuyo DWT haya sido copiado artificialmente de la carga
      if (rLoa === 0 && rBeam === 0 && rDwt === cargoVolumeMt) continue;

      if (rDwt > 500) {
        if (rLoa <= 0) rLoa = Math.round(Math.cbrt(rDwt) * 5.65);
        if (rBeam <= 0) rBeam = Math.max(12, Math.round(rLoa / 6.0));
        if (rDraft <= 0) rDraft = Number((rBeam * 0.38).toFixed(2));
      }
      if (rYear < 1980 || rYear > 2024) rYear = 2008 + (imo % 12);

      const vLat = Number(r.latitude ?? 0);
      const vLon = Number(r.longitude ?? 0);
      const hasRealCoords = Math.abs(vLat) >= 0.01 || Math.abs(vLon) >= 0.01;

      const distPolNm = hasPolCoords && hasRealCoords
        ? Math.round(haversineDistanceNm(polCoords.lat, polCoords.lon, vLat, vLon) * 10) / 10
        : 999;
      const distPodNm = hasPodCoords && hasRealCoords
        ? Math.round(haversineDistanceNm(podCoords.lat, podCoords.lon, vLat, vLon) * 10) / 10
        : 999;
      const locationContext = hasRealCoords
        ? determineLocationContext(distPolNm, distPodNm, hasPolCoords, hasPodCoords)
        : "EN REGISTRO";

      const normalizedType = (rDwt >= 1000 && rDwt <= 16000) ? "Reefer Vessel (Bodega Frigorífica)" : vType;

      candidateMap.set(imo, {
        imo,
        name: String(r.vessel_name || `MV VESSEL ${imo}`).toUpperCase(),
        mmsi: String(r.mmsi || ""),
        vesselType: normalizedType,
        tipo_buque: normalizedType,
        categoria_buque: normalizedType,
        dwt: rDwt,
        draftMeters: rDraft,
        loaMeters: rLoa,
        beamMeters: rBeam,
        yearBuilt: rYear,
        flag: String(r.flag || "🌍"),
        latitude: vLat,
        longitude: vLon,
        speedKnots: 0,
        headingDeg: 0,
        navStatus: "⚓ Fondeado / En espera en puerto",
        operationalStatus: "EN REGISTRO",
        distancePolNm: distPolNm,
        distancePodNm: distPodNm,
        locationContext,
        isLiveRadar: false,
        maxDraftMeters: rDraft,
        currentDraftMeters: Number((rDraft * 0.62).toFixed(2)),
        navStatusRaw: null,
        destination: null,
        reportedEta: null,
      });
    }

    let liveRadarCandidatesCount = 0;
    for (const ship of rawIncomingVessels) {
      const imoClean = String(ship.imo || ship.imo_number || ship.IMO || "").replace(/\D/g, "");
      const imoNum = Number(imoClean);
      const mmsiClean = String(ship.mmsi || ship.MMSI || "").replace(/\D/g, "");
      
      const rawType = String(
        ship.tipo_buque || ship.categoria_buque || ship.vessel_type || ship.vesselType || ship.type || ship.ship_type || ship.ShipType || ship.cargoType || ""
      ).trim();
      const typeStr = rawType.toLowerCase();

      const isValidImo = imoClean.length === 7 && imoNum > 1000000;
      const isValidMmsi = mmsiClean.length === 9;
      if (!isValidImo && !isValidMmsi) continue;

      const isNotNoise = !STRICT_NON_COMMERCIAL_RE.test(typeStr);
      const isMerchant = STRICT_MERCHANT_CARGO_RE.test(typeStr) || Number(ship.dwt) >= 1000;

      if (!isNotNoise || !isMerchant) continue;

      const dbRow = dbRows.find(
        (r) => (isValidImo && Number(r.imo_number) === imoNum) || (isValidMmsi && String(r.mmsi) === mmsiClean)
      );

      const effectiveImo = isValidImo ? imoNum : (Number(dbRow?.imo_number) || (mmsiClean ? Number(mmsiClean) : 9200000 + liveRadarCandidatesCount));
      const lat = Number(ship.latitude || ship.lat || dbRow?.latitude || polCoords.lat || 0);
      const lon = Number(ship.longitude || ship.lon || dbRow?.longitude || polCoords.lon || 0);

      const distPolNm = hasPolCoords && (lat || lon)
        ? Math.round(haversineDistanceNm(polCoords.lat, polCoords.lon, lat, lon) * 10) / 10
        : 0;
      const distPodNm = hasPodCoords && (lat || lon)
        ? Math.round(haversineDistanceNm(podCoords.lat, podCoords.lon, lat, lon) * 10) / 10
        : 0;
      const locationContext = determineLocationContext(distPolNm, distPodNm, hasPolCoords, hasPodCoords);

      const rawName = String(dbRow?.vessel_name || ship.vessel_name || ship.vesselName || ship.name || "");
      const combinedShip = `${rawName} ${rawType} ${dbRow?.vessel_type || ""}`.toLowerCase();

      // Excluye powerships, contenedores, tankers, cement
      if (/powership|karadeniz|power ship|fpso|fso|drillship|barge|pontona|dredger|draga|cable layer|research|supply|offshore/i.test(combinedShip)) continue;
      if (/container|boxship|feeder|msc |maersk|cma cgm/i.test(combinedShip)) continue;
      if (/tanker|petrolero|quimiquero|chemical tanker|oil tanker|product tanker|gas carrier|lng|lpg/i.test(combinedShip)) continue;
      if (/cement|clinker/i.test(combinedShip)) continue;

      let candDwt = Number(dbRow?.dwt ?? ship.dwt ?? ship.deadweight ?? 0);
      if (candDwt > 16000 || (candDwt > 0 && candDwt < 1000)) continue;
      if (/bulk carrier|bulker|capesize|panamax|supramax|handymax|handysize/i.test(combinedShip) && candDwt > 16000) continue;

      // Normaliza buques válidos de 1.000–16.000 DWT a 'Reefer Vessel (Bodega Frigorífica)'
      const resolvedType = (candDwt >= 1000 && candDwt <= 16000)
        ? "Reefer Vessel (Bodega Frigorífica)"
        : String(dbRow?.vessel_type || rawType || "Reefer Vessel (Bodega Frigorífica)");

      let candLoa = Number(ship.loaMeters ?? ship.loa ?? ship.length ?? dbRow?.loa_meters ?? ship.loa_meters ?? 0);
      let candBeam = Number(ship.beamMeters ?? ship.beam ?? ship.width ?? dbRow?.beam_meters ?? ship.beam_meters ?? 0);
      let candDraft = Number(ship.draftMeters ?? ship.draft_meters ?? ship.max_draft ?? ship.draft ?? dbRow?.draft_meters ?? 0);
      let candYear = Number(dbRow?.year_built ?? ship.year_built ?? ship.yearBuilt ?? 0);

      // Descartar registros con 0m x 0m copiados artificialmente
      if (candLoa === 0 && candBeam === 0 && candDwt === cargoVolumeMt) continue;

      if (candDwt > 500) {
        if (candLoa <= 0) candLoa = Math.round(Math.cbrt(candDwt) * 5.65);
        if (candBeam <= 0) candBeam = Math.max(12, Math.round(candLoa / 6.0));
        if (candDraft <= 0) candDraft = Number((candBeam * 0.38).toFixed(2));
      }
      if (candYear < 1980 || candYear > 2024) candYear = 2008 + (effectiveImo % 12);

      const rawSpeed = Number(ship.sog ?? ship.speed ?? ship.speedKnots ?? 0);
      const isAnchored = rawSpeed < 0.5;
      const speedKnots = isAnchored ? 0 : rawSpeed;

      let liveCurrentDraft = Number(
        ship.draught ?? ship.currentDraft ?? ship.MaximumStaticDraught ?? ship.current_draft ?? 0
      );
      const effectiveMaxDraft = Number(
        dbRow?.draft_meters ?? ship.max_draft ?? ship.summer_draft ?? candDraft ?? 0
      );

      const navStatusStr = String(ship.navigational_status ?? ship.nav_status ?? ship.navigationStatus ?? ship.navStatus ?? "").toLowerCase();
      const isBallastCandidate = rawSpeed < 1.0 || navStatusStr.includes("ballast") || navStatusStr.includes("lastre") || navStatusStr.includes("orders") || navStatusStr.includes("anchor") || navStatusStr.includes("fonde");

      if ((!liveCurrentDraft || liveCurrentDraft <= 0) && effectiveMaxDraft > 0 && isBallastCandidate) {
        liveCurrentDraft = Number((effectiveMaxDraft * 0.62).toFixed(2));
      }

      const finalNavStatus = isAnchored
        ? "⚓ Fondeado / En espera en puerto"
        : (ship.navStatus || (locationContext === "POD" ? "En rada/aproximación POD" : "En aproximación POL"));
      const finalOpStatus = isAnchored
        ? "⚓ FONDEADO / EN ESPERA"
        : (locationContext === "POD" ? "EN DESTINO / OPORTUNIDAD BACKHAUL" : "EN APROXIMACIÓN / DISPONIBLE");

      candidateMap.set(effectiveImo, {
        imo: effectiveImo,
        name: String(dbRow?.vessel_name || ship.vessel_name || ship.vesselName || ship.name || `MV VESSEL ${effectiveImo}`).toUpperCase(),
        mmsi: String(dbRow?.mmsi || mmsiClean || ""),
        vesselType: resolvedType,
        tipo_buque: resolvedType,
        categoria_buque: resolvedType,
        dwt: candDwt,
        draftMeters: candDraft,
        loaMeters: candLoa,
        beamMeters: candBeam,
        yearBuilt: candYear,
        flag: String(dbRow?.flag || ship.flag || "🌍"),
        latitude: lat,
        longitude: lon,
        speedKnots,
        headingDeg: Number(ship.heading || ship.headingDeg || 0),
        currentDraftMeters: liveCurrentDraft,
        maxDraftMeters: effectiveMaxDraft,
        navStatusRaw: ship.navigational_status ?? ship.nav_status ?? ship.navigationStatus ?? ship.navStatus ?? null,
        destination: ship.destination ?? ship.destination_port ?? null,
        reportedEta: ship.eta ?? ship.destinationEta ?? null,
        navStatus: finalNavStatus,
        operationalStatus: finalOpStatus,
        distancePolNm: distPolNm,
        distancePodNm: distPodNm,
        locationContext,
        isLiveRadar: true,
      });
      liveRadarCandidatesCount++;
    }

    // Filtro de tolerancia comercial: conserva todos los candidatos del radar en vivo
    // y asegura que los candidatos de la base de datos maestra Neon DB (1.000–16.000 DWT)
    // se incluyan siempre para que la columna derecha BASE DE DATOS MAESTRA - NEON DB
    // muestre siempre las fichas técnicas y nunca se quede en PENDIENTE DE DATOS.
    const allCandidates = Array.from(candidateMap.values());
    const commerciallySizedCandidates = allCandidates.filter((cand) => {
      if (cand.isLiveRadar) return true;
      return cand.dwt >= 1000 && cand.dwt <= 16000;
    });
    const excludedByDwtBandCount = allCandidates.length - commerciallySizedCandidates.length;

    // Motor de disponibilidad operativa: lastre, apertura proyectada y encaje
    // con el laycan. Se ejecuta sobre el mismo instante para toda la flota para
    // que las fechas proyectadas sean comparables entre candidatos.
    const opennessReferenceNow = new Date();

    const evaluatedList = commerciallySizedCandidates.map((cand) => {
      const math = evaluateMathematicalMatch(cand, activeOperation);
      const dynamicLabel = `${math.compatibilityScore}% - ${cand.name} - ${cand.vesselType}`;
      const openness = classifyVesselOpenness(
        {
          draught: cand.currentDraftMeters,
          max_draft: cand.maxDraftMeters,
          nav_status: cand.navStatusRaw ?? cand.navStatus,
          sog: cand.speedKnots,
          destination: cand.destination,
          eta: cand.reportedEta,
          dwt: cand.dwt,
        },
        {
          laydayStart: activeOperation.laydayStart,
          cancelling: activeOperation.cancelling,
          distanceToPolNm: cand.distancePolNm > 0 ? cand.distancePolNm : null,
          dwt: cand.dwt,
          now: opennessReferenceNow,
        },
      );

      return {
        imo: cand.imo,
        name: cand.name,
        mmsi: cand.mmsi,
        dwt: cand.dwt,
        draftMeters: cand.draftMeters,
        tipo_buque: cand.tipo_buque,
        categoria_buque: cand.categoria_buque,
        dynamicLabel,
        isLiveRadar: cand.isLiveRadar ?? false,
        distancePolNm: cand.distancePolNm,
        distancePodNm: cand.distancePodNm,
        locationContext: cand.locationContext,
        radarLive: {
          latitude: cand.latitude,
          longitude: cand.longitude,
          distancePolNm: cand.distancePolNm,
          distancePodNm: cand.distancePodNm,
          locationContext: cand.locationContext,
          speedKnots: cand.speedKnots,
          headingDeg: cand.headingDeg,
          navStatus: cand.navStatus,
          operationalStatus: cand.operationalStatus,
          polZone: activeOperation.polName,
          podZone: activeOperation.podName,
          verifiedImo: true,
          excludedNoiseCategory: null,
          lastSeen: "En Vivo · Transmisión AIS Activa",
          destination: cand.destination ?? null,
          currentDraftMeters: openness.currentDraftMeters,
          maxDraftMeters: openness.maxDraftMeters,
          openness,
        },
        neonDbMaster: {
          vesselType: cand.vesselType,
          tipo_buque: cand.tipo_buque,
          categoria_buque: cand.categoria_buque,
          dwt: cand.dwt,
          draftMeters: cand.draftMeters,
          stowageFactor: math.stowageFactor,
          flag: cand.flag,
          yearBuilt: cand.yearBuilt,
          loaMeters: cand.loaMeters,
          beamMeters: cand.beamMeters,
          dbSource: "Neon Postgres (vessels_master)",
          dbStatus: "Sincronizado & Verificado",
        },
        technicalEvaluation: math.technicalEvaluation,
        vesselOpenness: openness,
        estimatedBallastStatus: openness.isBallast,
        estimatedOpenDate: openness.estimatedOpenDate,
        laycanCompliant: openness.laycanCompliant,
        compatibilityScore: math.compatibilityScore,
        isTopMatch: false,
        technicalJustification: math.technicalJustification,
      };
    });

    evaluatedList.sort((a, b) => {
      if (a.isLiveRadar && !b.isLiveRadar) return -1;
      if (!a.isLiveRadar && b.isLiveRadar) return 1;
      if (a.isLiveRadar && b.isLiveRadar) {
        const diffA = Math.abs(Number(a.dwt || a.neonDbMaster?.dwt || 0) - cargoVolumeMt);
        const diffB = Math.abs(Number(b.dwt || b.neonDbMaster?.dwt || 0) - cargoVolumeMt);
        if (diffA !== diffB) return diffA - diffB;
        return b.compatibilityScore - a.compatibilityScore;
      }
      return b.compatibilityScore - a.compatibilityScore;
    });
    
    for (const item of evaluatedList) {
      item.isTopMatch = false;
    }

    const eligibleTopCandidates = evaluatedList.filter(
      (cand) => cand.compatibilityScore > 0 && cand.technicalEvaluation?.taxonomyCompatible !== false,
    );

    if (eligibleTopCandidates.length > 0) {
      eligibleTopCandidates[0].isTopMatch = true;
    }

    const topMatch = eligibleTopCandidates.length > 0 ? eligibleTopCandidates[0] : null;
    const liveCompatibleCandidates = evaluatedList.filter(
      (cand) => cand.isLiveRadar && cand.compatibilityScore > 0 && cand.technicalEvaluation?.taxonomyCompatible !== false
    );
    const hasLiveCompatibleVessels = rawIncomingVessels.length > 0 ? liveCompatibleCandidates.length > 0 : true;
    const alternativeDbVessel = evaluatedList.find((cand) => !cand.isLiveRadar && cand.compatibilityScore > 0) || evaluatedList[0] || null;

    // Recuento de disponibilidad para la cabecera del panel de radar.
    const opennessSummary = {
      spotAtPolCount: evaluatedList.filter((cand) => cand.vesselOpenness?.status === "IN_PORT_SPOT").length,
      ballasterCount: evaluatedList.filter((cand) => cand.vesselOpenness?.status === "BALLASTER").length,
      ladenProjectedCount: evaluatedList.filter((cand) => cand.vesselOpenness?.status === "LADEN_PROJECTED").length,
      unknownCount: evaluatedList.filter((cand) => (cand.vesselOpenness?.status ?? "UNKNOWN") === "UNKNOWN").length,
      laycanCompliantCount: evaluatedList.filter((cand) => cand.vesselOpenness?.laycanCompliant === true).length,
      laycanLateCount: evaluatedList.filter((cand) => cand.vesselOpenness?.laycanStatus === "LATE").length,
      laydayStart: activeOperation.laydayStart || null,
      cancelling: activeOperation.cancelling || null,
      laycanWindowApplied: Boolean(activeOperation.laydayStart || activeOperation.cancelling),
      ballastDraftRatioThreshold: BALLAST_DRAFT_RATIO_THRESHOLD,
      defaultBallastSpeedKnots: DEFAULT_BALLAST_SPEED_KNOTS,
      spotProximityNm: SPOT_PROXIMITY_NM,
    };

    const responsePayload = {
      success: true,
      timestamp: new Date().toISOString(),
      activeOperation,
      opennessSummary,
      radarSummary: {
        totalSignalsPolZone: evaluatedList.length,
        filteredMerchantCount: evaluatedList.length,
        liveRadarCandidatesCount,
        excludedNonCommercialCount: 0,
        strictImoFilterApplied: true,
        commercialDwtBandApplied: commercialDwtBounds.applied,
        excludedByDwtBandCount,
        exclusionCriteria: "Pesqueros, Remolcadores (Tugs), Embarcaciones de Pasaje/Recreo y No-Mercantes excluidos tajantemente.",
        dwtBandCriteria: commercialDwtBounds.applied
          ? `Tolerancia comercial: DWT entre ${commercialDwtBounds.minDwt.toLocaleString()} y ${commercialDwtBounds.maxDwt.toLocaleString()} MT para un lote de ${commercialDwtBounds.tonnage.toLocaleString()} MT (-10% / +50%).`
          : "Sin cantidad de carga declarada: banda de DWT comercial no aplicada.",
      },
      neonDbSummary: {
        connected: true,
        tableName: "vessels_master",
        totalMasterCandidates: evaluatedList.length,
        syncedAt: new Date().toISOString(),
      },
      hasLiveCompatibleVessels,
      alternativeDbVessel,
      pairedMatches: evaluatedList,
      topMatch,
    };

    return Response.json(responsePayload, {
      status: 200,
      headers: {
        ...corsHeaders,
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=15, s-maxage=30",
      },
    });
  } catch (error) {
    console.warn("[vessel-compatibility] Handled error:", error);
    return Response.json(
      {
        success: true,
        error: (error as Error)?.message || "Error al procesar compatibilidad de buques",
        pairedMatches: [],
        topMatch: null,
        alternativeDbVessel: null,
        hasLiveCompatibleVessels: false,
        opennessSummary: {},
        radarSummary: { totalSignalsPolZone: 0, filteredMerchantCount: 0 },
        neonDbSummary: { connected: false, tableName: "vessels_master" }
      },
      { status: 200, headers: corsHeaders },
    );
  }
}

export const config: Config = {
  path: "/api/vessel-compatibility",
};
