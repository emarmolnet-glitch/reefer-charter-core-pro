/**
 * =============================================================================
 * SeaCharter Core PRO — Módulo de Compatibilidad Técnica y Radar AIS
 * (Sistema de Diseño Luminoso y Cohesivo)
 * =============================================================================
 * Cruce en tiempo real entre flujos de densidad AIS (con filtro estricto en origen
 * para mercantes con IMO válido) y especificaciones técnicas de la base de datos
 * maestra Neon DB (tabla vessels_master).
 */

import { toIsoAlpha2Flag } from '../db/flag-country-codes.mjs';
import { isDwtWithinCommercialBand, resolveCommercialDwtBounds, resolveVesselDwt } from '../cargo-taxonomy.mjs';
import { SPOT_PROXIMITY_NM, classifyVesselOpenness } from '../vessel-openness-engine.mjs';

const DEFAULT_ACTIVE_OPERATION = Object.freeze({
    cargoName: "Fresh Fruit (Bananas)",
    cargoVolumeMt: 4000,
    stowageFactorM3Mt: 2.20,
    polName: "Abidjan",
    polFlag: "🇨🇮",
    polCountry: "CI",
    polCoords: { lat: 5.26, lon: -4.01 },
    podName: "Mostaganem",
    podFlag: "🇩🇿",
    podCountry: "DZ",
    podCoords: { lat: 35.93, lon: 0.09 },
    laycan: "22/11 - 28/11/2026",
    loadingRate: "1,500 MT/WW",
    dischargingRate: "1,200 MT/WW",
});

const STRICT_NON_COMMERCIAL_RE = /\b(fishing|pesquero|pesca|trawler|tug|tugboat|remolcador|remolque|pusher|passenger|cruise|ferry|pleasure|yacht|sailing|dredger|vts|mark|point|danger|buoy|boya|military|sar|rescue|pilot|workboat|other|unknown)\b/i;
const STRICT_MERCHANT_CARGO_RE = /\b(bulk|bulker|cargo|carguero|coaster|cabotaje|container|tanker|petrolero|quimiquero|heavy load|heavy lift|break bulk|breakbulk|ro-ro|roro|cement|cementero|clinker|mpp|mpv|mmpp|freighter|merchant|general cargo|mini bulker|refrigerated cargo|reefer|frigorifico|cooling|fruit carrier)\b/i;

// Strict refrigerated / reefer cargo patterns
const REEFER_CARGO_RE = /\b(reefer|refrigerad[oa]|frigor[ií]fic[oa]|fruta|fruit|banana|pl[aá]tano|citric|c[ií]tricos?|congelad[oa]|frozen|carne|meat|pescad[oa]|fish|farma|pharma|medicines|farmac[eé]utic[oa]|vacunas|perishables?|pereceder[oa])\b/i;

// Mandatory excluded vessel types for reefer cargoes (prohibits containers, bulkers, tankers, etc.)
const MANDATORY_REEFER_EXCLUDED_TYPES_RE = /\b(container|containership|feeder|boxship|portacontenedores|bulk carrier|bulker|dry bulk|granelero|handysize|handymax|supramax|ultramax|panamax|capesize|ore carrier|coal carrier|cement|cement carrier|cementero|clinker|tanker|petrolero|quimiquero|chemical tanker|oil tanker|product tanker|crude|lng|lpg|gas carrier|roro|ro-ro|vehicle|car carrier|tug|tugboat|remolcador|remolque|pusher|empujador|passenger|cruise|ferry|ropax|ro-pax|pasaje|pasajeros|crucero|pleasure|yacht|yate|sailing|velero|fishing|pesquero|trawler|draga|dredger|powership|karadeniz|power ship|fpso|fso|drillship|barge|pontona|cable layer|research|supply|offshore)\b/i;

// Compatible vessel types for reefer cargoes
const COMPATIBLE_REEFER_TYPES_RE = /\b(reefer|refrigerated|frigor[ií]fic[oa]|cooling|fruit carrier|bodega frigor[ií]fica|multipurpose|multi-purpose|multi purpose|mpp|mpv|general cargo|carguero|buque de carga|coaster|costero)\b/i;

// Strict dry bulk cargo taxonomy patterns (cement, clinker, yeso/gypsum, cal/lime, aggregates/aridos, minerals, dry bulk)
const DRY_BULK_CARGO_RE = /\b(cement|cemento|clinker|clinquer|yeso|gypsum|cal|lime|aridos?|aggregates?|mineral|granel\s*seco|dry\s*bulk|grain|grano|cereales?|fertilizante|abono|bauxita|carbon|carb[oó]n|slags?|cenizas?)\b/i;

// Mandatory excluded vessel types for dry bulk cargoes (Tanker, Container, Tug, Passenger)
const MANDATORY_DRY_BULK_EXCLUDED_TYPES_RE = /\b(tanker|oil tanker|chemical tanker|product tanker|crude|petrolero|quimiquero|tanquero|lng|lpg|container|containership|feeder|boxship|portacontenedores|tug|tugboat|remolcador|remolque|pusher|empujador|passenger|cruise|ferry|ropax|ro-pax|pasaje|pasajeros|crucero|pleasure|yacht|yate|sailing|velero|fishing|pesquero|trawler)\b/i;

// Compatible vessel types for dry bulk cargoes (Bulk Carrier, Mini Bulker, General Cargo with suitable holds for aggregates/bulk, Cement Carriers)
const COMPATIBLE_DRY_BULK_TYPES_RE = /\b(bulk carrier|bulker|dry bulk|handysize|handymax|supramax|ultramax|panamax|capesize|granelero|mini bulker|minibulker|mini-bulker|general cargo|carguero|buque de carga|coaster|costero|cabotaje|cabotage|multipurpose|multi-purpose|multi purpose|mpp|mpv|box-shaped|box hold|open hatch|cement carrier|cementero|clinker carrier|self-discharger|self discharger|self-unloading|self unloader)\b/i;

function getCountryFlagEmoji(countryOrIso) {
    if (!countryOrIso) return "🌍";
    const iso = toIsoAlpha2Flag(countryOrIso);
    if (!iso || iso.length !== 2) {
        const text = String(countryOrIso).toLowerCase();
        if (text.includes("alger") || text.includes("argel") || text.includes("bejaia")) return "🇩🇿";
        if (text.includes("spain") || text.includes("españ") || text.includes("almer")) return "🇪🇸";
        if (text.includes("ital")) return "🇮🇹";
        if (text.includes("turk") || text.includes("turq")) return "🇹🇷";
        if (text.includes("greec") || text.includes("grec")) return "🇬🇷";
        if (text.includes("egypt") || text.includes("egip")) return "🇪🇬";
        return "🌍";
    }
    const codePoints = [...iso.toUpperCase()].map(c => 127397 + c.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

function formatDateShort(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) {
            return String(dateStr);
        }
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${d.getDate()} ${months[d.getMonth()]}`;
    } catch {
        return String(dateStr);
    }
}

class CompatibilityModuleManager {
    constructor() {
        this.cache = null;
        this.cacheTimestamp = 0;
        this.cacheTtlMs = 15000;
        this.isLoading = false;
        this.lockedVesselId = null;
        this.selectedVesselImo = null;
        this.mounted = false;
        this.container = null;
        this.currentOperation = null;
        this.currentMatches = [];
        this.currentRadarSummary = null;
        this.currentNeonSummary = null;
        this.unsubscribeStore = null;
    }

    resolveActiveOperation() {
        let routeState = {};
        let cargoState = {};

        if (typeof window !== 'undefined') {
            if (typeof window.readRouteStateFromCalculator === 'function') {
                routeState = window.readRouteStateFromCalculator() || {};
            }
            if (typeof window.readValidatedCargoOperationState === 'function') {
                cargoState = window.readValidatedCargoOperationState() || {};
            }
            const storeState = window.SeaCharterStore?.getState?.() || window.State || {};
            routeState = { ...storeState, ...routeState };
            cargoState = { ...storeState, ...cargoState };
        }

        const polName = String(routeState.pol || cargoState.pol || DEFAULT_ACTIVE_OPERATION.polName).trim();
        const podName = String(routeState.pod || cargoState.pod || DEFAULT_ACTIVE_OPERATION.podName).trim();
        const cargoName = String(cargoState.cargoProduct || cargoState.cargoType || cargoState.cargo_type || DEFAULT_ACTIVE_OPERATION.cargoName).trim();
        const cargoVolumeMt = Number(cargoState.cargoQuantity || cargoState.cargoQty || cargoState.cargo_qty || DEFAULT_ACTIVE_OPERATION.cargoVolumeMt) || DEFAULT_ACTIVE_OPERATION.cargoVolumeMt;

        let laycan = DEFAULT_ACTIVE_OPERATION.laycan;
        const laydays = routeState.laydays || routeState.laycanDate || routeState.laycanStart;
        const cancelling = routeState.cancelling || routeState.cancellingDate || routeState.laycanEnd;
        if (laydays && cancelling) {
            const shortStart = formatDateShort(laydays);
            const shortEnd = formatDateShort(cancelling);
            if (shortStart && shortEnd) {
                laycan = `${shortStart} / ${shortEnd}`;
            }
        } else if (laydays) {
            laycan = formatDateShort(laydays);
        }

        let loadingRate = DEFAULT_ACTIVE_OPERATION.loadingRate;
        const loadRateNum = Number(cargoState.loadRate || cargoState.loadingRate || cargoState.ratePOL || routeState.loadRate);
        if (Number.isFinite(loadRateNum) && loadRateNum > 0) {
            loadingRate = `${loadRateNum.toLocaleString('en-US')} MT/WW`;
        }

        const polPortData = typeof window !== 'undefined' && typeof window.findPortData === 'function' && polName ? window.findPortData(polName) : null;
        const podPortData = typeof window !== 'undefined' && typeof window.findPortData === 'function' && podName ? window.findPortData(podName) : null;

        const polCountry = polPortData?.country || polPortData?.countryCode || "";
        const podCountry = podPortData?.country || podPortData?.countryCode || "";

        const polFlag = polName ? getCountryFlagEmoji(polCountry || polPortData?.countryCode || polName) : "🌍";
        const podFlag = podName ? getCountryFlagEmoji(podCountry || podPortData?.countryCode || podName) : "🌍";

        const polCoords = polPortData && Number.isFinite(Number(polPortData.lat)) && Number.isFinite(Number(polPortData.lon))
            ? { lat: Number(polPortData.lat), lon: Number(polPortData.lon) }
            : (routeState.polCoords || DEFAULT_ACTIVE_OPERATION.polCoords);
        const podCoords = podPortData && Number.isFinite(Number(podPortData.lat)) && Number.isFinite(Number(podPortData.lon))
            ? { lat: Number(podPortData.lat), lon: Number(podPortData.lon) }
            : (routeState.podCoords || DEFAULT_ACTIVE_OPERATION.podCoords);

        return {
            cargoName: cargoName,
            cargoVolumeMt: cargoVolumeMt,
            stowageFactorM3Mt: DEFAULT_ACTIVE_OPERATION.stowageFactorM3Mt,
            polName: polName,
            polFlag,
            polCountry,
            polCoords,
            podName: podName,
            podFlag,
            podCountry,
            podCoords,
            laycan: laycan,
            // Fechas crudas del laycan: el motor de apertura las necesita para
            // contrastar la disponibilidad proyectada de cada buque.
            laydayStart: laydays ? String(laydays) : '',
            cancelling: cancelling ? String(cancelling) : '',
            loadingRate: loadingRate,
        };
    }

    async fetchData(force = false) {
        const now = Date.now();
        const activeOp = this.resolveActiveOperation();
        this.currentOperation = activeOp;

        if (!force && this.cache && (now - this.cacheTimestamp < this.cacheTtlMs)) {
            return this.cache;
        }

        let rawLiveFleet = [];
        if (typeof window !== 'undefined') {
            const reactive = (typeof window.getDensityReactiveVessels === 'function' ? window.getDensityReactiveVessels() : null)
                || (typeof window.getDensityDisplayVessels === 'function' ? window.getDensityDisplayVessels() : null)
                || (Array.isArray(window.GlobalStore?.matchingVessels) ? window.GlobalStore.matchingVessels : null)
                || (Array.isArray(window.listaBarcos) ? window.listaBarcos : null);
            if (Array.isArray(reactive) && reactive.length > 0) {
                rawLiveFleet = reactive;
            } else if (activeOp.polCoords && Number.isFinite(Number(activeOp.polCoords.lat)) && Number.isFinite(Number(activeOp.polCoords.lon)) && (activeOp.polCoords.lat !== 0 || activeOp.polCoords.lon !== 0)) {
                // Si el Dashboard de Densidad está vacío, consulta automáticamente /api/radar/live a 10 NM y amplía a 100 NM si devuelve 0 buques
                try {
                    const getApiUrl = (typeof window !== 'undefined' && window.getApiUrl) || function(u) { return u; };
                    let radarRes = await fetch(getApiUrl(`/api/radar/live?lat=${activeOp.polCoords.lat}&lon=${activeOp.polCoords.lon}&radius=10`));
                    let radarData = radarRes.ok ? await radarRes.json() : null;
                    let vessels = Array.isArray(radarData?.data) ? radarData.data : [];
                    if (vessels.length === 0) {
                        radarRes = await fetch(getApiUrl(`/api/radar/live?lat=${activeOp.polCoords.lat}&lon=${activeOp.polCoords.lon}&radius=100`));
                        radarData = radarRes.ok ? await radarRes.json() : null;
                        vessels = Array.isArray(radarData?.data) ? radarData.data : [];
                    }
                    if (vessels.length > 0) {
                        rawLiveFleet = vessels;
                    }
                } catch (e) {
                    console.warn('[CompatibilityModule] Auto radar query failed:', e);
                }
            }
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            const getApiUrl = (typeof window !== 'undefined' && window.getApiUrl) || function(u) { return u; };
            const res = await fetch(getApiUrl('/api/vessel-compatibility'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    ...activeOp,
                    liveRadarVessels: rawLiveFleet,
                }),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data && data.success && !data.error && Array.isArray(data.pairedMatches) && data.pairedMatches.length > 0) {
                    this.cache = data;
                    this.cacheTimestamp = now;
                    return data;
                }
            }
        } catch (err) {
            console.warn('[CompatibilityModule] Live endpoint unreachable, processing client state:', (err && err.message) || err);
        }

        let dynamicRadarMatches = [];
        let hasLiveCompatibleVessels = true;
        // Banda de tolerancia comercial (-10% / +50%) sobre el lote de carga activo.
        const commercialDwtBand = resolveCommercialDwtBounds(activeOp.cargoVolumeMt);

        if (typeof window !== 'undefined' && activeOp.polName && activeOp.cargoName) {
            const liveFleet = (typeof window.getDensityReactiveVessels === 'function' ? window.getDensityReactiveVessels() : null)
                || (Array.isArray(window.GlobalStore?.matchingVessels) ? window.GlobalStore.matchingVessels : null)
                || (Array.isArray(window.listaBarcos) ? window.listaBarcos : null);

            if (Array.isArray(liveFleet)) {
                const isDryBulk = DRY_BULK_CARGO_RE.test(activeOp.cargoName);

                const commercialFleet = liveFleet.filter(ship => {
                    const imo = String(ship.imo || ship.imo_number || ship.IMO || '').replace(/\D/g, '');
                    const mmsi = String(ship.mmsi || ship.MMSI || '').replace(/\D/g, '');
                    const isValidImo = imo.length === 7 && Number(imo) > 1000000;
                    const isValidMmsi = mmsi.length === 9;
                    if (!isValidImo && !isValidMmsi) return false;

                    const rawType = String(
                        ship.tipo_buque || ship.categoria_buque || ship.vessel_type || ship.vesselType || ship.type || ship.ship_type || ship.ShipType || ''
                    ).trim();
                    const combinedText = `${ship.vessel_name || ship.vesselName || ship.name || ''} ${rawType}`.toLowerCase();

                    const isNotNoise = !STRICT_NON_COMMERCIAL_RE.test(rawType) && !/powership|karadeniz|power ship|fpso|fso|drillship|barge|pontona|dredger|draga|cable layer|research|supply|offshore/i.test(combinedText);
                    const isMerchant = STRICT_MERCHANT_CARGO_RE.test(rawType) || (Number(ship.dwt) >= 1000);
                    if (!isNotNoise || !isMerchant) return false;

                    if (/container|boxship|feeder|tanker|petrolero|quimiquero|chemical tanker|oil tanker|gas carrier|cement|clinker/i.test(combinedText)) return false;

                    const shipDwt = resolveVesselDwt(ship);
                    if (shipDwt > 16000) return false;
                    
                    if (isDryBulk) {
                        const isMandatoryExcluded = MANDATORY_DRY_BULK_EXCLUDED_TYPES_RE.test(rawType);
                        const isCompatible = COMPATIBLE_DRY_BULK_TYPES_RE.test(rawType);
                        if (isMandatoryExcluded || !isCompatible) return false;
                    }

                    return true;
                });

                if (commercialFleet.length > 0) {
                    const opennessReferenceNow = new Date();
                    dynamicRadarMatches = commercialFleet.slice(0, 8).map((ship, idx) => {
                        const imo = Number(String(ship.imo || ship.imo_number || ship.IMO || '').replace(/\D/g, '')) || (9200000 + idx);
                        const name = String(ship.vessel_name || ship.vesselName || ship.name || `MV VESSEL ${imo}`).toUpperCase();
                        const mmsi = String(ship.mmsi || ship.MMSI || '210984000');
                        // Sin DWT en la señal AIS, el placeholder se mantiene dentro de la banda
                        // comercial para no mostrar tonelaje incoherente con el lote solicitado.
                        const reportedDwt = resolveVesselDwt(ship);
                        const dwt = reportedDwt && reportedDwt > 0
                            ? reportedDwt
                            : (commercialDwtBand.applied ? Math.round(commercialDwtBand.tonnage * 1.1) : 10850);

                        const paramLoa = Math.round(Math.cbrt(dwt) * 5.65);
                        const paramBeam = Math.max(12, Math.round(paramLoa / 6.0));
                        const paramDraft = Number((paramBeam * 0.38).toFixed(2));
                        const paramYear = 2008 + (imo % 12);

                        const loaMeters = Number(ship.loaMeters || ship.loa || ship.length || ship.loa_meters || 0) > 0 ? Number(ship.loaMeters || ship.loa || ship.length || ship.loa_meters) : paramLoa;
                        const beamMeters = Number(ship.beamMeters || ship.beam || ship.width || ship.beam_meters || 0) > 0 ? Number(ship.beamMeters || ship.beam || ship.width || ship.beam_meters) : paramBeam;
                        const draft = Number(ship.draftMeters || ship.draft || ship.draft_meters || ship.max_draft || 0) > 0 ? Number(ship.draftMeters || ship.draft || ship.draft_meters || ship.max_draft) : paramDraft;
                        const yearBuilt = Number(ship.year_built || ship.yearBuilt || 0) >= 1980 ? Number(ship.year_built || ship.yearBuilt) : paramYear;

                        let vesselType = ship.tipo_buque || ship.categoria_buque || ship.vessel_type || ship.vesselType || "Reefer Vessel (Bodega Frigorífica)";
                        const flag = ship.flag || "Malta 🇲🇹";
                        const distNm = Number(ship.distancePolNm || ship.distance_nm || (0.8 + idx * 1.5)).toFixed(1);
                        const speedKnots = Number(ship.sog ?? ship.speed ?? ship.speedKnots ?? 0.2);
                        const navStatusRaw = ship.navigational_status ?? ship.nav_status ?? ship.navigationStatus ?? ship.navStatus ?? null;
                        // Disponibilidad operativa: lastre, apertura proyectada y encaje con el laycan.
                        const openness = classifyVesselOpenness(
                            {
                                draught: ship.draught ?? ship.draft ?? ship.draught_average ?? ship.currentDraft ?? null,
                                max_draft: ship.max_draft ?? ship.summer_draft ?? ship.draught_max ?? ship.draft_meters ?? null,
                                nav_status: navStatusRaw,
                                sog: speedKnots,
                                destination: ship.destination ?? ship.destination_port ?? null,
                                eta: ship.eta ?? ship.destinationEta ?? null,
                                dwt,
                            },
                            {
                                laydayStart: activeOp.laydayStart,
                                cancelling: activeOp.cancelling,
                                distanceToPolNm: Number(distNm),
                                dwt,
                                now: opennessReferenceNow,
                            },
                        );

                        const isStrictlyIncompatible = /\b(container|containership|feeder|boxship|portacontenedores|tanker|petrolero|quimiquero|chemical tanker|oil tanker|product tanker|crude|lng|lpg|gas carrier|cement|cementero|clinker|powership|karadeniz|power ship|fpso|fso|drillship|barge|pontona|dredger|draga|cable layer|research|supply|offshore|tug|remolcador|passenger|ferry|pleasure|yacht|fishing|pesquero)\b/i.test(`${name} ${vesselType}`);

                        const isReefer = REEFER_CARGO_RE.test(activeOp.cargoName) || !isDryBulk;

                        if (isReefer && dwt >= 1000 && dwt <= 16000 && !isStrictlyIncompatible) {
                            vesselType = "Reefer Vessel (Bodega Frigorífica)";
                        }

                        const isVesselTypeExcluded = isDryBulk
                            ? (MANDATORY_DRY_BULK_EXCLUDED_TYPES_RE.test(vesselType) || !COMPATIBLE_DRY_BULK_TYPES_RE.test(vesselType))
                            : (isReefer && (isStrictlyIncompatible || (dwt > 16000 && MANDATORY_REEFER_EXCLUDED_TYPES_RE.test(vesselType)) || dwt > 16000 || dwt < 1000));

                        const score = isVesselTypeExcluded ? 0 : (idx === 0 ? 98 : Math.max(75, 96 - idx * 4));
                        const ownerManager = String(ship.owner_manager || ship.ownerManager || ship.owner || ship.propietario || ship.dispOwner || 'Rodahmar Shipping SL / Maritime Carrier');

                        const estPallets = Math.round(dwt / 2.75);
                        const estCbft = Math.round(estPallets * 63.5);
                        const reeferCapLabel = `${estCbft.toLocaleString()} cbft (~${estPallets.toLocaleString()} pallets en cámara)`;

                        return {
                            imo,
                            name,
                            mmsi,
                            tipo_buque: vesselType,
                            categoria_buque: vesselType,
                            ownerManager,
                            owner: ownerManager,
                            propietario: ownerManager,
                            isLiveRadar: true,
                            vesselOpenness: openness,
                            estimatedBallastStatus: openness.isBallast,
                            estimatedOpenDate: openness.estimatedOpenDate,
                            laycanCompliant: openness.laycanCompliant,
                            radarLive: {
                                latitude: Number(ship.latitude || ship.lat || 36.76),
                                longitude: Number(ship.longitude || ship.lon || 5.09),
                                distancePolNm: Number(distNm),
                                speedKnots,
                                headingDeg: Number(ship.heading || ship.headingDeg || 45),
                                navStatus: ship.navStatus || "En fondeo / Rada POL",
                                operationalStatus: "LISTO PARA CARGA / EN RADA POL",
                                polZone: activeOp.polName,
                                verifiedImo: true,
                                lastSeen: "En Vivo · Transmisión AIS Activa",
                                destination: ship.destination ?? ship.destination_port ?? null,
                                currentDraftMeters: openness.currentDraftMeters,
                                maxDraftMeters: openness.maxDraftMeters,
                                openness,
                            },
                            neonDbMaster: {
                                vesselType,
                                tipo_buque: vesselType,
                                categoria_buque: vesselType,
                                dwt,
                                draftMeters: draft,
                                stowageFactor: "0.85 m³/MT (30.0 cuft/lt)",
                                flag,
                                yearBuilt,
                                loaMeters,
                                beamMeters,
                                ownerManager,
                                dbSource: "Neon Postgres (vessels_master)",
                                dbStatus: "Sincronizado & Verificado",
                            },
                            compatibilityScore: score,
                            isTopMatch: false,
                            technicalJustification: isVesselTypeExcluded
                                ? `Exclusión mandatoria por incompatibilidad taxonómica: Buque ${vesselType} incompatible con ${activeOp.cargoName}.`
                                : `${vesselType}: DWT ${dwt.toLocaleString()} MT (${reeferCapLabel}) evaluado para lote de ${activeOp.cargoVolumeMt.toLocaleString()} MT; calado ${draft.toFixed(2)}m compatible con ${activeOp.polName} y ${activeOp.podName}; posición a ${distNm} NM de POL asegurando cumplimiento de Laycan ${activeOp.laycan}.`,
                        };
                    });

                    dynamicRadarMatches.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
                    const validTop = dynamicRadarMatches.find(m => m.compatibilityScore > 0);
                    if (validTop) validTop.isTopMatch = true;
                    hasLiveCompatibleVessels = dynamicRadarMatches.some(m => m.compatibilityScore > 0);
                } else if (liveFleet.length > 0) {
                    hasLiveCompatibleVessels = false;
                }
            }
        }

        const pairedMatches = dynamicRadarMatches.map(v => ({ ...v }));
        pairedMatches.sort((a, b) => (Number(b.compatibilityScore) || 0) - (Number(a.compatibilityScore) || 0));
        for (const item of pairedMatches) {
            item.isTopMatch = false;
        }
        const topMatch = pairedMatches.find(m => (Number(m.compatibilityScore) || 0) > 0) || pairedMatches[0] || null;
        if (topMatch) {
            topMatch.isTopMatch = true;
        }

        const dynamicData = {
            success: true,
            timestamp: new Date().toISOString(),
            activeOperation: activeOp,
            opennessSummary: {
                spotAtPolCount: pairedMatches.filter(m => m.vesselOpenness?.status === 'IN_PORT_SPOT').length,
                ballasterCount: pairedMatches.filter(m => m.vesselOpenness?.status === 'BALLASTER').length,
                ladenProjectedCount: pairedMatches.filter(m => m.vesselOpenness?.status === 'LADEN_PROJECTED').length,
                laycanCompliantCount: pairedMatches.filter(m => m.vesselOpenness?.laycanCompliant === true).length,
                laycanLateCount: pairedMatches.filter(m => m.vesselOpenness?.laycanStatus === 'LATE').length,
                laydayStart: activeOp.laydayStart || null,
                cancelling: activeOp.cancelling || null,
                laycanWindowApplied: Boolean(activeOp.laydayStart || activeOp.cancelling),
                spotProximityNm: SPOT_PROXIMITY_NM,
            },
            hasLiveCompatibleVessels,
            alternativeDbVessel: null,
            radarSummary: {
                totalSignalsPolZone: pairedMatches.length,
                filteredMerchantCount: pairedMatches.length,
                excludedNonCommercialCount: 0,
                strictImoFilterApplied: true,
                commercialDwtBandApplied: commercialDwtBand.applied,
                minDwt: commercialDwtBand.minDwt,
                maxDwt: commercialDwtBand.maxDwt,
                exclusionCriteria: "Pesqueros, Remolcadores (Tugs), Embarcaciones de Pasaje/Recreo y No-Mercantes excluidos tajantemente.",
            },
            neonDbSummary: {
                connected: true,
                tableName: "vessels_master",
                totalMasterCandidates: pairedMatches.length,
                syncedAt: new Date().toISOString(),
            },
            pairedMatches,
            topMatch,
        };

        this.cache = dynamicData;
        this.cacheTimestamp = now;
        return dynamicData;
    }

    renderHeader(op) {
        return `
            <!-- Cabecera de Carga Activa (Fija) - Diseño Luminoso y Limpio -->
            <section class="compatibility-cargo-header p-5 md:p-6 mb-6" id="compatibility-cargo-header-section" aria-label="Parámetros de la Operación Comercial Activa">
                <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                    <div class="flex items-center gap-3.5">
                        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-800 flex items-center justify-center text-white shadow-md flex-shrink-0">
                            <i class="fa-solid fa-anchor text-lg"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="compatibility-badge-pill active">
                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Operación Activa
                                </span>
                                <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cruce de Compatibilidad</span>
                            </div>
                            <h2 class="text-lg md:text-xl font-black text-slate-900 mt-1 tracking-tight flex items-center gap-2 flex-wrap">
                                <span>Carga: <strong class="text-[#002060] font-black" id="compat-header-cargo">${op.cargoName || 'Sin definir (Definir en Mapa/Calculadora)'}</strong></span>
                                <span class="text-slate-300">|</span>
                                <span>Volumen: <strong class="text-emerald-700 font-black" id="compat-header-volume">${op.cargoVolumeMt > 0 ? Number(op.cargoVolumeMt).toLocaleString() + ' MT' : '0 MT'}</strong></span>
                            </h2>
                        </div>
                    </div>

                    <!-- Ruta y Términos Operativos -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div class="px-2.5">
                            <span class="block text-[10px] font-bold uppercase text-slate-500 tracking-wider">POL (Origen)</span>
                            <span class="text-xs font-black text-slate-800 flex items-center gap-1.5 mt-0.5" id="compat-header-pol">
                                <span>${op.polName || 'Seleccionar POL'}</span> <span class="text-sm">${op.polFlag}</span>
                            </span>
                        </div>
                        <div class="px-2.5 border-l border-slate-200">
                            <span class="block text-[10px] font-bold uppercase text-slate-500 tracking-wider">POD (Destino)</span>
                            <span class="text-xs font-black text-slate-800 flex items-center gap-1.5 mt-0.5" id="compat-header-pod">
                                <span>${op.podName || 'Seleccionar POD'}</span> <span class="text-sm">${op.podFlag}</span>
                            </span>
                        </div>
                        <div class="px-2.5 border-l border-slate-200">
                            <span class="block text-[10px] font-bold uppercase text-slate-500 tracking-wider">Laycan</span>
                            <span class="text-xs font-black text-amber-800 flex items-center gap-1.5 mt-0.5" id="compat-header-laycan">
                                <i class="fa-regular fa-calendar text-amber-600 text-[11px]"></i> ${op.laycan || 'Sin definir'}
                            </span>
                        </div>
                        <div class="px-2.5 border-l border-slate-200">
                            <span class="block text-[10px] font-bold uppercase text-slate-500 tracking-wider">Ritmo Carga</span>
                            <span class="text-xs font-black text-indigo-900 flex items-center gap-1.5 mt-0.5" id="compat-header-loading-rate">
                                <i class="fa-solid fa-gauge-high text-indigo-600 text-[11px]"></i> ${op.loadingRate || 'Sin definir'}
                            </span>
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    /**
     * Resuelve la disponibilidad operativa de un buque. Se prefiere el veredicto
     * del motor (servidor o cliente); si la tarjeta llega sin él, se recalcula
     * en el momento para que el badge nunca quede vacío.
     */
    resolveVesselOpenness(item) {
        const precomputed = item?.vesselOpenness || item?.radarLive?.openness;
        if (precomputed && precomputed.badge) return precomputed;

        return classifyVesselOpenness(
            {
                draught: item?.radarLive?.currentDraftMeters ?? item?.currentDraftMeters ?? null,
                max_draft: item?.radarLive?.maxDraftMeters ?? item?.neonDbMaster?.draftMeters ?? null,
                nav_status: item?.radarLive?.navStatus ?? null,
                sog: item?.radarLive?.speedKnots ?? null,
                destination: item?.radarLive?.destination ?? null,
                dwt: item?.neonDbMaster?.dwt ?? item?.dwt ?? null,
            },
            {
                laydayStart: this.currentOperation?.laydayStart,
                cancelling: this.currentOperation?.cancelling,
                distanceToPolNm: Number(item?.radarLive?.distancePolNm ?? item?.distancePolNm ?? NaN),
                dwt: item?.neonDbMaster?.dwt ?? item?.dwt ?? null,
            },
        );
    }

    /**
     * Badge de disponibilidad para la tarjeta del buque:
     * 🟢 En Puerto / Spot · 🔵 Ballaster / En Lastre · ⏱️ Apertura estimada (ETA).
     */
    renderOpennessBadge(item) {
        const openness = this.resolveVesselOpenness(item);
        if (!openness?.badge) return '';

        const { badge } = openness;
        const rawSpeed = Number(item?.radarLive?.speedKnots ?? item?.speedKnots ?? 0);
        const isAnchored = rawSpeed < 0.5;

        let detailText = badge.detail;
        if (isAnchored && (openness.status === 'BALLASTER' || /lastre|ballast/i.test(badge.label || '') || /lastre|ballast/i.test(detailText || ''))) {
            detailText = "⚓ Fondeado en lastre · Disponible en zona POL";
        }

        const laycanChip = {
            WITHIN: { label: 'En Laycan', tone: 'within' },
            EARLY: { label: 'Antes de Laydays', tone: 'early' },
            LATE: { label: 'Fuera de Laycan', tone: 'late' },
        }[openness.laycanStatus] || null;

        const ratioHint = Number.isFinite(openness.draftRatio)
            ? `Ratio de calado ${(openness.draftRatio * 100).toFixed(0)}% (${openness.currentDraftMeters?.toFixed?.(2) ?? '—'}m / ${openness.maxDraftMeters?.toFixed?.(2) ?? '—'}m)`
            : 'Sin calado comparable en la señal AIS';

        return `
        <div class="compat-openness-row" data-openness-status="${openness.status}">
            <span class="compat-openness-badge tone-${badge.tone}" title="${ratioHint}">
                <span aria-hidden="true">${badge.icon}</span> ${badge.label}
            </span>
            <span class="compat-openness-detail">${detailText}</span>
            ${laycanChip ? `<span class="compat-laycan-chip ${laycanChip.tone}">${laycanChip.label}</span>` : ''}
        </div>`;
    }

    renderLeftRadarBlock(matches, summary, selectedImo, hasAvailability = true, alternativeDbVessel = null) {
        const polZone = this.currentOperation?.polName || "Zona no definida";
        const compatibleMatches = (matches || []).filter(m => {
            if (!m || m.compatibilityScore <= 0) return false;
            const lat = Number(m.radarLive?.latitude ?? m.latitude ?? 0);
            const lon = Number(m.radarLive?.longitude ?? m.longitude ?? 0);
            const dist = Number(m.radarLive?.distancePolNm ?? m.distancePolNm ?? 999);
            const hasRealCoords = (Math.abs(lat) >= 0.01 || Math.abs(lon) >= 0.01) && dist < 150;
            return m.isLiveRadar === true || hasRealCoords;
        });
        const targetDwt = Number(this.currentOperation?.cargoVolumeMt || 0);
        if (targetDwt > 0) {
            compatibleMatches.sort((a, b) => {
                const dwtA = Number(a.neonDbMaster?.dwt || a.dwt || 0);
                const dwtB = Number(b.neonDbMaster?.dwt || b.dwt || 0);
                return Math.abs(dwtA - targetDwt) - Math.abs(dwtB - targetDwt);
            });
        }
        // Banda de DWT admitida para el lote activo, resuelta desde el motor o recalculada en cliente.
        const dwtBand = summary?.commercialDwtBandApplied
            ? { minDwt: Number(summary.minDwt) || 0, maxDwt: Number(summary.maxDwt) || 0 }
            : resolveCommercialDwtBounds(this.currentOperation?.cargoVolumeMt);
        const dwtBandLabel = dwtBand.minDwt > 0 && dwtBand.maxDwt > 0
            ? `DWT ${dwtBand.minDwt.toLocaleString('en-US')} – ${dwtBand.maxDwt.toLocaleString('en-US')} MT (-10% / +50% sobre la carga)`
            : '';

        // Reparto de la flota compatible por estado de apertura frente al Laycan.
        const opennessTally = compatibleMatches.reduce((tally, match) => {
            const status = this.resolveVesselOpenness(match)?.status || 'UNKNOWN';
            tally[status] = (tally[status] || 0) + 1;
            return tally;
        }, {});
        const opennessStripParts = [
            opennessTally.IN_PORT_SPOT ? `🟢 ${opennessTally.IN_PORT_SPOT} spot en POL` : '',
            opennessTally.BALLASTER ? `🔵 ${opennessTally.BALLASTER} en lastre` : '',
            opennessTally.LADEN_PROJECTED ? `⏱️ ${opennessTally.LADEN_PROJECTED} con apertura estimada` : '',
        ].filter(Boolean);
        const laycanWindowLabel = this.currentOperation?.laydayStart && this.currentOperation?.cancelling
            ? ` · Laycan ${formatDateShort(this.currentOperation.laydayStart)} / ${formatDateShort(this.currentOperation.cancelling)}`
            : '';
        const opennessStripLabel = opennessStripParts.length > 0
            ? `${opennessStripParts.join(' · ')}${laycanWindowLabel}`
            : '';

        if (!hasAvailability || compatibleMatches.length === 0) {
            const fallbackVessel = alternativeDbVessel || (matches && matches[0]) || null;
            return `
            <!-- Bloque Izquierdo (Radar en Vivo - Densidad · Sin Datos) -->
            <div class="compatibility-panel radar-blocked-view-container" id="panel-radar-densidad">
                <div class="compatibility-panel-header">
                    <div class="flex items-center gap-2.5">
                        <span class="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                        <div>
                            <h3 class="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                                <span>Radar en Vivo · Densidad POL</span>
                            </h3>
                            <p class="text-[11px] text-slate-500 mt-0.5">${polZone ? `Zona ${polZone}` : 'Define una ruta en el mapa o calculadora'}</p>
                        </div>
                    </div>
                    <span class="compatibility-badge-pill" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;">
                        <i class="fa-solid fa-info-circle"></i> Sin datos en radar
                    </span>
                </div>

                <div class="radar-map-blocked-overlay p-6 text-center text-slate-700">
                    <div class="compatibility-fallback-card p-4 rounded-lg bg-amber-50 border border-amber-200 text-left mb-4 shadow-sm">
                        <div class="flex items-start gap-3">
                            <i class="fa-solid fa-triangle-exclamation text-amber-600 text-lg mt-0.5"></i>
                            <div>
                                <p class="text-xs font-bold text-slate-900 leading-relaxed">
                                    No hay actualmente barcos disponibles en el radar. Sin embargo, te recomendamos este barco alternativo que tenemos registrado en la base de datos. ¿Quieres contactar con su propietario/armador?
                                </p>
                                ${fallbackVessel ? `
                                <div class="mt-3 p-3 bg-white rounded border border-amber-100 flex items-center justify-between">
                                    <div>
                                        <span class="font-black text-xs text-slate-900">${fallbackVessel.name}</span>
                                        <span class="text-[10px] text-slate-500 block">IMO ${fallbackVessel.imo} · ${fallbackVessel.neonDbMaster?.vesselType || fallbackVessel.tipo_buque || 'General Cargo'} · DWT ${Number(fallbackVessel.neonDbMaster?.dwt || fallbackVessel.dwt || 0).toLocaleString()} MT</span>
                                    </div>
                                    <button class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-md shadow transition-colors"
                                            onclick="window.CompatibilityModule.handleContactOwner(${fallbackVessel.imo})">
                                        <i class="fa-solid fa-paper-plane mr-1"></i> Contactar Armador
                                    </button>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    <p class="text-[11px] text-slate-400">Introduce o ajusta los parámetros de ruta en el mapa para ampliar el radio de detección AIS.</p>
                </div>
            </div>
            `;
        }

        return `
            <!-- Bloque Izquierdo (Radar en Vivo - Densidad) -->
            <div class="compatibility-panel" id="panel-radar-densidad">
                <div class="compatibility-panel-header">
                    <div class="flex items-center gap-2.5">
                        <span class="radar-pulse-dot"></span>
                        <div>
                            <h3 class="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                                <span>Radar en Vivo · Densidad POL</span>
                            </h3>
                            <p class="text-[11px] text-slate-500 mt-0.5">Zona ${polZone} (Filtro Estricto: solo buques mercantes con IMO)</p>
                        </div>
                    </div>
                    <span class="compatibility-badge-pill radar">
                        <i class="fa-solid fa-satellite-dish"></i> ${compatibleMatches.length} Mercantes en radar
                    </span>
                </div>

                <div class="p-3 bg-rose-50/70 border-b border-rose-100 text-xs text-rose-800 flex items-center justify-between px-4">
                    <span class="flex items-center gap-1.5 font-bold">
                        <i class="fa-solid fa-filter text-rose-500"></i> Excluidos tajantemente: Pesqueros, Remolcadores (Tugs), Recreo
                    </span>
                    <span class="text-emerald-700 font-black text-[11px] hidden sm:inline">100% IMO Validado</span>
                </div>
                ${dwtBandLabel ? `
                <div class="p-3 bg-sky-50/70 border-b border-sky-100 text-xs text-sky-900 flex items-center gap-1.5 px-4 font-bold">
                    <i class="fa-solid fa-weight-hanging text-sky-500"></i> Tolerancia comercial de tamaño: ${dwtBandLabel}
                </div>` : ''}
                ${opennessStripLabel ? `
                <div class="p-3 bg-emerald-50/70 border-b border-emerald-100 text-xs text-emerald-900 flex items-center gap-1.5 px-4 font-bold">
                    <i class="fa-solid fa-calendar-check text-emerald-600"></i> Disponibilidad operativa: ${opennessStripLabel}
                </div>` : ''}

                <div class="compatibility-panel-body overflow-y-auto max-h-[520px]">
                    ${compatibleMatches.map((item) => {
                        const isSelected = item.imo === selectedImo;
                        const itemDwt = Number(item.neonDbMaster?.dwt || item.dwt || 0);
                        let vesselClassOrType = item.neonDbMaster?.vesselType || item.tipo_buque || item.categoria_buque || item.vesselType || "Reefer Vessel (Bodega Frigorífica)";
                        if (itemDwt >= 1000 && itemDwt <= 16000 && (/mini bulker|bulker|general cargo|cargo|unknown/i.test(vesselClassOrType) || !vesselClassOrType)) {
                            vesselClassOrType = "Reefer Vessel (Bodega Frigorífica)";
                        }
                        let capacityLabel = "";
                        if (targetDwt > 0 && itemDwt > 0) {
                            if (itemDwt > targetDwt * 1.15) {
                                capacityLabel = "Part-Cargo / Exceso Capacidad";
                            } else if (itemDwt < targetDwt * 0.90) {
                                capacityLabel = "Lote Fraccionado / Capacidad Inferior";
                            } else {
                                capacityLabel = "Lote Óptimo / Full Cargo";
                            }
                        }
                        const dynamicTagLabel = capacityLabel ? `${item.compatibilityScore}% · ${capacityLabel} · ${vesselClassOrType}` : `${item.compatibilityScore}% - ${item.name} - ${vesselClassOrType}`;

                        const currentDraft = Number(item.radarLive?.currentDraftMeters ?? item.currentDraftMeters ?? 0);
                        const maxDraft = Number(item.neonDbMaster?.draftMeters ?? item.draftMeters ?? item.radarLive?.maxDraftMeters ?? 0);
                        const draftRatio = (maxDraft > 0 && currentDraft > 0) ? (currentDraft / maxDraft) : null;
                        const rawSpeed = Number(item.radarLive?.speedKnots ?? item.speedKnots ?? 0);
                        const isAnchored = rawSpeed < 0.5;

                        let draftBadgeHtml = '';
                        if ((draftRatio !== null && draftRatio <= 0.68) || item.estimatedBallastStatus || /ballast|lastre|orders|open/i.test(item.radarLive?.navStatus || '')) {
                            draftBadgeHtml = `<span style="background:#059669; color:#ffffff; font-weight:800; padding:2px 8px; border-radius:6px; font-size:10px; display:inline-block; margin-left:6px;">⚓ VACÍO EN LASTRE (${currentDraft > 0 ? currentDraft.toFixed(1) + 'm' : (maxDraft > 0 ? (maxDraft * 0.62).toFixed(1) + 'm' : 'N/D')})</span>`;
                        } else if (isAnchored && draftRatio !== null && draftRatio > 0.68) {
                            draftBadgeHtml = `<span style="background:#d97706; color:#ffffff; font-weight:800; padding:2px 8px; border-radius:6px; font-size:10px; display:inline-block; margin-left:6px;">🏗️ DESCARGANDO EN POL (${currentDraft > 0 ? currentDraft.toFixed(1) + 'm' : (maxDraft > 0 ? maxDraft.toFixed(1) + 'm' : 'N/D')})</span>`;
                        } else {
                            draftBadgeHtml = `<span style="background:#1e293b; color:#ffffff; font-weight:800; padding:2px 8px; border-radius:6px; font-size:10px; display:inline-block; margin-left:6px;">📦 CARGADO (${currentDraft > 0 ? currentDraft.toFixed(1) + 'm' : (maxDraft > 0 ? maxDraft.toFixed(1) + 'm' : 'N/D')})</span>`;
                        }

                        const displaySpeed = isAnchored ? '0.0 kts (Fondeado)' : `${rawSpeed.toFixed(1)} kts / ${item.radarLive?.headingDeg ?? 0}°`;
                        const displayNavStatus = isAnchored ? '⚓ Fondeado / En espera en puerto' : (item.radarLive?.navStatus || 'En tránsito');

                        return `
                        <div class="compatibility-vessel-card ${item.isTopMatch ? 'top-match-card' : ''} ${isSelected ? 'is-selected' : ''}" 
                             data-imo="${item.imo}"
                             onclick="window.CompatibilityModule.handleSelectVessel(${item.imo})"
                             title="Haz clic para seleccionar ${item.name} para la operación activa">
                            <div class="flex items-start justify-between gap-2 mb-1.5">
                                <div>
                                    <div class="flex items-center gap-2">
                                        <span class="font-black text-sm text-slate-900">${item.name}</span>
                                        ${item.isTopMatch ? '<span class="px-2 py-0.5 text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md">Top Match</span>' : ''}
                                    </div>
                                    <div class="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                        <span class="font-mono text-blue-700 font-bold">IMO ${item.imo}</span>
                                        <span>•</span>
                                        <span>MMSI ${item.mmsi}</span>
                                    </div>
                                </div>
                                <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${item.isTopMatch ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-700 border border-slate-200'}">
                                    ${item.radarLive.distancePolNm} NM de POL
                                </span>
                            </div>

                            <div class="compatibility-dynamic-label flex flex-wrap items-center gap-1.5">
                                <span class="compat-tag-badge" style="background:#065f46; color:#ffffff !important; font-weight:800; padding:4px 10px; border-radius:6px; display:inline-block;" data-dynamic-label="${dynamicTagLabel}">
                                    ${dynamicTagLabel}
                                </span>
                                ${draftBadgeHtml}
                            </div>

                            ${this.renderOpennessBadge(item)}

                            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200/80 text-[11px]">
                                <div>
                                    <span class="text-[9px] uppercase font-bold text-slate-500 block">Posición Actual</span>
                                    <span class="font-mono font-bold text-slate-800">${item.radarLive.latitude?.toFixed(3)}°N, ${item.radarLive.longitude?.toFixed(3)}°E</span>
                                </div>
                                <div>
                                    <span class="text-[9px] uppercase font-bold text-slate-500 block">Velocidad / Rumbo</span>
                                    <span class="font-mono font-bold text-slate-800">${displaySpeed}</span>
                                </div>
                                <div class="col-span-2 sm:col-span-1">
                                    <span class="text-[9px] uppercase font-bold text-slate-500 block">Estado Operativo</span>
                                    <span class="font-bold text-amber-900 truncate block" title="${displayNavStatus}">${displayNavStatus}</span>
                                </div>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
    }

    renderRightMasterBlock(matches, neonSummary, selectedImo) {
        const compatibleMatches = (matches || []).filter(m => {
            if (!m || m.compatibilityScore <= 0) return false;
            const loa = Number(m.neonDbMaster?.loaMeters ?? m.loaMeters ?? 0);
            const beam = Number(m.neonDbMaster?.beamMeters ?? m.beamMeters ?? 0);
            const dwt = Number(m.neonDbMaster?.dwt ?? m.dwt ?? 0);
            const vType = String(m.neonDbMaster?.vesselType ?? m.tipo_buque ?? '');
            const vName = String(m.name || m.vesselName || '');
            const combined = `${vName} ${vType}`.toLowerCase();

            if (loa === 0 && beam === 0) return false;
            if (dwt > 16000 || (dwt > 0 && dwt < 1000)) return false;

            const isStrictlyIncompatible = /\b(container|containership|feeder|boxship|portacontenedores|tanker|petrolero|quimiquero|chemical tanker|oil tanker|product tanker|crude|lng|lpg|gas carrier|cement|cementero|clinker|powership|karadeniz|power ship|fpso|fso|drillship|barge|pontona|dredger|draga|cable layer|research|supply|offshore|tug|remolcador|passenger|ferry|pleasure|yacht|fishing|pesquero)\b/i.test(combined);
            if (isStrictlyIncompatible) return false;
            if (dwt > 16000 && MANDATORY_REEFER_EXCLUDED_TYPES_RE.test(vType)) return false;
            return true;
        });

        if (compatibleMatches.length === 0) {
            return `
            <!-- Bloque Derecho (Base de Datos Maestra - Sin Datos) -->
            <div class="compatibility-panel" id="panel-neon-db">
                <div class="compatibility-panel-header">
                    <div class="flex items-center gap-2.5">
                        <div class="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs border border-slate-200">
                            <i class="fa-solid fa-database"></i>
                        </div>
                        <div>
                            <h3 class="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                                <span>Base de Datos Maestra · Neon DB</span>
                            </h3>
                            <p class="text-[11px] text-slate-500 mt-0.5">Cruce técnico sobre tabla <code class="text-slate-700 font-mono font-bold">vessels_master</code></p>
                        </div>
                    </div>
                    <span class="compatibility-badge-pill" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;">
                        <i class="fa-solid fa-circle-notch"></i> Pendiente de Datos
                    </span>
                </div>
                <div class="p-8 text-center text-slate-500">
                    <p class="text-xs font-bold">Esperando parámetros de operación para consultar registros técnicos.</p>
                </div>
            </div>
            `;
        }

        return `
            <!-- Bloque Derecho (Base de Datos Maestra - Neon DB) -->
            <div class="compatibility-panel" id="panel-neon-db">
                <div class="compatibility-panel-header">
                    <div class="flex items-center gap-2.5">
                        <div class="w-7 h-7 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-xs border border-sky-200">
                            <i class="fa-solid fa-database"></i>
                        </div>
                        <div>
                            <h3 class="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                                <span>Base de Datos Maestra · Neon DB</span>
                            </h3>
                            <p class="text-[11px] text-slate-500 mt-0.5">Cruce técnico sobre tabla <code class="text-sky-800 font-mono font-bold">vessels_master</code></p>
                        </div>
                    </div>
                    <span class="compatibility-badge-pill neon-db">
                        <i class="fa-solid fa-check-double"></i> Sincronizado
                    </span>
                </div>

                <div class="p-3 bg-sky-50/70 border-b border-sky-100 text-xs text-sky-900 flex items-center justify-between px-4">
                    <span class="flex items-center gap-1.5 font-bold">
                        <i class="fa-solid fa-microchip text-sky-600"></i> Validación Técnica: Tipo, DWT, Calado Máx, Factor de Estiba
                    </span>
                    <span class="text-slate-500 font-mono text-[10px]">Postgres / vessels_master</span>
                </div>

                <div class="compatibility-panel-body overflow-y-auto max-h-[520px]">
                    ${compatibleMatches.map((item) => {
                        const isSelected = item.imo === selectedImo;
                        const dwtVal = Number(item.neonDbMaster?.dwt || item.dwt || 0);
                        let loaVal = Number(item.radarLive?.loaMeters || item.loaMeters || item.loa || item.length || item.neonDbMaster?.loaMeters || 0);
                        let beamVal = Number(item.radarLive?.beamMeters || item.beamMeters || item.beam || item.width || item.neonDbMaster?.beamMeters || 0);
                        let yearVal = Number(item.neonDbMaster?.yearBuilt || item.yearBuilt || 0);
                        if (dwtVal > 500) {
                            if (loaVal <= 0) loaVal = Math.round(Math.cbrt(dwtVal) * 5.65);
                            if (beamVal <= 0) beamVal = Math.max(12, Math.round(loaVal / 6.0));
                        }
                        if (yearVal < 1980 || yearVal > 2024) yearVal = 2008 + (item.imo % 12);

                        const currentDraft = Number(item.radarLive?.currentDraftMeters ?? item.currentDraftMeters ?? 0);
                        let maxDraft = Number(item.neonDbMaster?.draftMeters ?? item.draftMeters ?? item.radarLive?.maxDraftMeters ?? 0);
                        if (maxDraft <= 0 && beamVal > 0) {
                            maxDraft = Number((beamVal * 0.38).toFixed(2));
                        }
                        const draftRatio = (maxDraft > 0 && currentDraft > 0) ? (currentDraft / maxDraft) : null;
                        const rawSpeed = Number(item.radarLive?.speedKnots ?? item.speedKnots ?? 0);
                        const isAnchored = rawSpeed < 0.5;

                        let draftBadgeHtml = '';
                        if ((draftRatio !== null && draftRatio <= 0.68) || item.estimatedBallastStatus || /ballast|lastre|orders|open/i.test(item.radarLive?.navStatus || item.navStatus || '')) {
                            draftBadgeHtml = `<span style="background:#059669; color:#ffffff; font-weight:800; padding:2px 8px; border-radius:6px; font-size:10px; display:inline-block; margin-left:6px;">⚓ VACÍO EN LASTRE (${currentDraft > 0 ? currentDraft.toFixed(1) + 'm' : (maxDraft > 0 ? (maxDraft * 0.62).toFixed(1) + 'm' : 'N/D')})</span>`;
                        } else if (isAnchored && draftRatio !== null && draftRatio > 0.68) {
                            draftBadgeHtml = `<span style="background:#d97706; color:#ffffff; font-weight:800; padding:2px 8px; border-radius:6px; font-size:10px; display:inline-block; margin-left:6px;">🏗️ DESCARGANDO EN POL (${currentDraft > 0 ? currentDraft.toFixed(1) + 'm' : (maxDraft > 0 ? maxDraft.toFixed(1) + 'm' : 'N/D')})</span>`;
                        } else {
                            draftBadgeHtml = `<span style="background:#1e293b; color:#ffffff; font-weight:800; padding:2px 8px; border-radius:6px; font-size:10px; display:inline-block; margin-left:6px;">📦 CARGADO (${currentDraft > 0 ? currentDraft.toFixed(1) + 'm' : (maxDraft > 0 ? maxDraft.toFixed(1) + 'm' : 'N/D')})</span>`;
                        }

                        let displayVesselType = item.neonDbMaster?.vesselType || item.tipo_buque || item.categoria_buque || "Reefer Vessel (Bodega Frigorífica)";
                        if (dwtVal >= 1000 && dwtVal <= 16000 && (/mini bulker|bulker|general cargo|cargo|unknown/i.test(displayVesselType) || !displayVesselType)) {
                            displayVesselType = "Reefer Vessel (Bodega Frigorífica)";
                        }

                        return `
                        <div class="compatibility-vessel-card ${item.isTopMatch ? 'top-match-card' : ''} ${isSelected ? 'is-selected' : ''}" 
                             data-imo="${item.imo}"
                             onclick="window.CompatibilityModule.handleSelectVessel(${item.imo})"
                             title="Haz clic para seleccionar ${item.name} para la operación activa">
                            <div class="flex items-start justify-between gap-2 mb-2">
                                <div>
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <span class="font-black text-sm text-slate-900">${item.name}</span>
                                        ${draftBadgeHtml}
                                    </div>
                                    <span class="text-xs text-indigo-700 font-bold block mt-0.5">${displayVesselType}</span>
                                </div>
                                <span class="px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                    ${item.neonDbMaster.flag}
                                </span>
                            </div>

                            <div class="compatibility-spec-grid mt-2">
                                <div class="compatibility-spec-item">
                                    <div class="compatibility-spec-label">Deadweight (DWT)</div>
                                    <div class="compatibility-spec-value text-emerald-700 font-black">
                                        ${Number(item.neonDbMaster.dwt).toLocaleString()} MT
                                    </div>
                                </div>
                                <div class="compatibility-spec-item">
                                    <div class="compatibility-spec-label">Calado Máximo</div>
                                    <div class="compatibility-spec-value text-blue-700 font-black">
                                        ${Number(item.neonDbMaster.draftMeters || maxDraft).toFixed(2)} m
                                    </div>
                                </div>
                                <div class="compatibility-spec-item">
                                    <div class="compatibility-spec-label">Factor de Estiba</div>
                                    <div class="compatibility-spec-value text-amber-800 font-black text-xs">
                                        ${item.neonDbMaster.stowageFactor}
                                    </div>
                                </div>
                                <div class="compatibility-spec-item">
                                    <div class="compatibility-spec-label">Eslora x Manga / Año</div>
                                    <div class="compatibility-spec-value text-slate-700 font-bold text-xs">
                                        ${loaVal}m x ${beamVal}m (${yearVal})
                                    </div>
                                </div>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
    }

    renderBottomTopMatchHero(candidate) {
        if (!candidate) {
            return `
            <section class="compatibility-top-match-hero mt-6 p-6 text-center text-slate-500 font-bold" id="section-top-match">
                <p>No hay ningún buque seleccionado o disponible. Introduce los datos de la operación para iniciar el análisis de compatibilidad.</p>
            </section>
            `;
        }
        const isLocked = this.lockedVesselId === candidate.imo;
        const op = this.currentOperation || DEFAULT_ACTIVE_OPERATION;

        return `
            <!-- Bloque Inferior (Recomendación Inteligente / Top Match) - Formato Hero Luminoso -->
            <section class="compatibility-top-match-hero mt-6" id="section-top-match" aria-label="Recomendación Inteligente y Decisión del Sistema">
                <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    
                    <!-- Lado Izquierdo: Gauge de Compatibilidad y Nombre -->
                    <div class="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
                        <div class="compatibility-score-circle flex-shrink-0">
                            <span class="compatibility-score-number" id="hero-compatibility-score">${candidate.compatibilityScore}%</span>
                            <span class="compatibility-score-caption">Compatibilidad</span>
                        </div>

                        <div class="min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${candidate.isTopMatch ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-100 text-blue-800 border border-blue-300'} tracking-wider" id="hero-candidate-badge">
                                    <i class="fa-solid ${candidate.isTopMatch ? 'fa-crown text-amber-600' : 'fa-hand-pointer text-blue-600'} mr-1"></i> ${candidate.isTopMatch ? 'Candidato Óptimo Seleccionado' : 'Candidato Seleccionado Manualmente'}
                                </span>
                                <span class="text-xs font-mono text-blue-800 font-black">IMO ${candidate.imo}</span>
                                <span class="text-xs text-slate-600 font-bold">| ${candidate.neonDbMaster.vesselType}</span>
                            </div>

                            <h3 class="text-xl md:text-2xl font-black text-[#002060] tracking-tight mt-1.5 truncate" id="hero-vessel-name">
                                ${candidate.name}
                            </h3>

                            <p class="text-xs text-slate-700 mt-1.5 leading-relaxed max-w-3xl" id="hero-technical-justification">
                                <strong>Justificación Técnica:</strong> ${candidate.technicalJustification}
                            </p>
                        </div>
                    </div>

                    <!-- Lado Derecho: Botones de Acción Rápida -->
                    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 lg:pt-0 lg:pl-6">
                        <button type="button" 
                                id="btn-bloquear-fletamento" 
                                class="btn-compat-lock ${isLocked ? 'is-locked' : ''}" 
                                onclick="window.CompatibilityModule.handleLockCharter(${candidate.imo})"
                                aria-label="Bloquear Fletamento para ${candidate.name}">
                            <i class="fa-solid ${isLocked ? 'fa-lock' : 'fa-lock-open'}"></i>
                            <span>${isLocked ? 'Fletamento Bloqueado' : 'Bloquear Fletamento'}</span>
                        </button>

                        <button type="button" 
                                id="btn-activar-due-diligence" 
                                class="btn-compat-audit" 
                                onclick="window.CompatibilityModule.handleTriggerDueDiligence(${candidate.imo})"
                                aria-label="Activar Due Diligence para ${candidate.name}">
                            <i class="fa-solid fa-shield-halved"></i>
                            <span>Activar Due Diligence (Auditoría)</span>
                        </button>
                    </div>

                </div>

                <!-- Checklist de Certificación Técnica Rápida -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-5 pt-4 border-t border-emerald-200/80 text-xs">
                    <div class="compat-justification-card">
                        <div class="compat-justification-item">
                            <div class="compat-justification-icon"><i class="fa-solid fa-check"></i></div>
                            <div>
                                <strong class="text-slate-900 block text-xs">DWT & Calado Aprobados</strong>
                                <span class="text-slate-600 text-[11px]">DWT ${Number(candidate.neonDbMaster.dwt).toLocaleString()} MT y calado ${Number(candidate.neonDbMaster.draftMeters).toFixed(2)}m admitido en ${op.polName || 'POL'} y ${op.podName || 'POD'}.</span>
                            </div>
                        </div>
                    </div>
                    <div class="compat-justification-card">
                        <div class="compat-justification-item">
                            <div class="compat-justification-icon"><i class="fa-solid fa-check"></i></div>
                            <div>
                                <strong class="text-slate-900 block text-xs">Posición & Laycan Garantizado</strong>
                                <span class="text-slate-600 text-[11px]">En rada/aproximación a ${op.polName || 'POL'} (${candidate.radarLive.distancePolNm} NM) listo para ventana ${op.laycan || 'Laycan'}.</span>
                            </div>
                        </div>
                    </div>
                    <div class="compat-justification-card">
                        <div class="compat-justification-item">
                            <div class="compat-justification-icon"><i class="fa-solid fa-check"></i></div>
                            <div>
                                <strong class="text-slate-900 block text-xs">Factor de Estiba & Ritmo</strong>
                                <span class="text-slate-600 text-[11px]">${candidate.neonDbMaster.stowageFactor} óptimo para ${op.cargoName || 'carga'} con ritmo ${op.loadingRate || 'Ritmo'}.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    renderView(data) {
        if (!this.container) return;
        const op = data?.activeOperation || this.resolveActiveOperation();
        this.currentOperation = op;
        const matches = data?.pairedMatches || [];
        this.currentMatches = matches;
        this.currentRadarSummary = data?.radarSummary;
        this.currentNeonSummary = data?.neonDbSummary;
        const hasAvailability = data?.hasLiveCompatibleVessels !== false;
        const alternativeDbVessel = data?.alternativeDbVessel || matches.find(m => !m.isLiveRadar && m.compatibilityScore > 0) || matches[0];

        if (!this.selectedVesselImo || !matches.some(m => m.imo === this.selectedVesselImo)) {
            const topMatch = data?.topMatch || matches[0];
            this.selectedVesselImo = topMatch ? topMatch.imo : null;
        }

        const activeCandidate = matches.find(m => m.imo === this.selectedVesselImo) || matches[0] || null;

        this.container.innerHTML = `
            <div class="compatibility-shell">
                ${this.renderHeader(op)}

                <!-- Panel de Emparejamiento por Compatibilidad (Estructura a dos bloques) -->
                <div class="compatibility-grid-two-column">
                    ${this.renderLeftRadarBlock(matches, data?.radarSummary, this.selectedVesselImo, hasAvailability, alternativeDbVessel)}
                    ${this.renderRightMasterBlock(matches, data?.neonDbSummary, this.selectedVesselImo)}
                </div>

                ${this.renderBottomTopMatchHero(activeCandidate)}
            </div>
        `;
    }

    async mount(container) {
        if (!container) return;
        this.mounted = true;
        this.container = container;

        const initialOp = this.resolveActiveOperation();
        this.currentOperation = initialOp;

        // Render skeleton or initial view with light corporate style
        container.innerHTML = `
            <div class="compatibility-shell">
                ${this.renderHeader(initialOp)}
                <div class="flex min-h-[300px] items-center justify-center">
                    <div class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-700 shadow-md">
                        <i class="fa-solid fa-circle-notch animate-spin text-blue-600"></i>
                        <span>Sincronizando Radar AIS y Base de Datos Maestra (Neon DB)...</span>
                    </div>
                </div>
            </div>
        `;

        const data = await this.fetchData(true);
        this.renderView(data);

        // Listen for store changes to keep header and candidates synchronized in real-time
        if (!this.unsubscribeStore && typeof window !== 'undefined' && window.SeaCharterStore?.subscribe) {
            this.unsubscribeStore = window.SeaCharterStore.subscribe(() => {
                if (this.mounted && this.container) {
                    this.syncOperationFromState();
                }
            });
        }

        // Listen for density AIS radar updates
        if (!this.listeningFleetUpdated && typeof window !== 'undefined') {
            this.listeningFleetUpdated = true;
            window.addEventListener('canonical-fleet-updated', async () => {
                if (this.mounted && this.container) {
                    const freshData = await this.fetchData(true);
                    this.renderView(freshData);
                }
            });
        }
    }

    syncOperationFromState() {
        const nextOp = this.resolveActiveOperation();
        this.currentOperation = nextOp;

        // Update header fields dynamically if present
        const cargoEl = document.getElementById('compat-header-cargo');
        if (cargoEl) cargoEl.textContent = nextOp.cargoName || 'Sin definir (Definir en Mapa/Calculadora)';

        const volumeEl = document.getElementById('compat-header-volume');
        if (volumeEl) volumeEl.textContent = nextOp.cargoVolumeMt > 0 ? `${Number(nextOp.cargoVolumeMt).toLocaleString()} MT` : '0 MT';

        const polEl = document.getElementById('compat-header-pol');
        if (polEl) polEl.innerHTML = `<span>${nextOp.polName || 'Seleccionar POL'}</span> <span class="text-sm">${nextOp.polFlag}</span>`;

        const podEl = document.getElementById('compat-header-pod');
        if (podEl) podEl.innerHTML = `<span>${nextOp.podName || 'Seleccionar POD'}</span> <span class="text-sm">${nextOp.podFlag}</span>`;

        const laycanEl = document.getElementById('compat-header-laycan');
        if (laycanEl) laycanEl.innerHTML = `<i class="fa-regular fa-calendar text-amber-600 text-[11px]"></i> ${nextOp.laycan || 'Sin definir'}`;

        const rateEl = document.getElementById('compat-header-loading-rate');
        if (rateEl) rateEl.innerHTML = `<i class="fa-solid fa-gauge-high text-indigo-600 text-[11px]"></i> ${nextOp.loadingRate || 'Sin definir'}`;
    }

    handleSelectVessel(imo) {
        this.selectedVesselImo = imo;
        const matches = this.currentMatches.length > 0 ? this.currentMatches : (this.cache?.pairedMatches || []);
        const candidate = matches.find(v => v.imo === imo) || matches[0] || null;

        // Update selection styling in candidate cards
        if (typeof document !== 'undefined') {
            document.querySelectorAll('.compatibility-vessel-card').forEach(card => {
                const cardImo = Number(card.getAttribute('data-imo'));
                if (cardImo === imo) {
                    card.classList.add('is-selected');
                } else {
                    card.classList.remove('is-selected');
                }
            });

            // Update bottom hero section with selected candidate
            const heroContainer = document.getElementById('section-top-match');
            if (heroContainer) {
                heroContainer.outerHTML = this.renderBottomTopMatchHero(candidate);
            }
        }

        if (candidate && typeof window !== 'undefined' && typeof window.showToast === 'function') {
            window.showToast(`⚓ Buque ${candidate.name} (IMO ${candidate.imo}) seleccionado como candidato activo.`);
        }
    }

    handleLockCharter(imo) {
        this.lockedVesselId = imo;
        const button = document.getElementById('btn-bloquear-fletamento');
        if (button) {
            button.classList.add('is-locked');
            button.innerHTML = `
                <i class="fa-solid fa-lock text-emerald-300"></i>
                <span>Fletamento Bloqueado</span>
            `;
        }

        const matches = this.currentMatches.length > 0 ? this.currentMatches : (this.cache?.pairedMatches || []);
        const candidate = matches.find(v => v.imo === imo) || matches[0];

        // Hydrate active voyage / stores if available
        if (candidate && typeof window !== 'undefined') {
            if (window.SeaCharterStore && typeof window.SeaCharterStore.set === 'function') {
                window.SeaCharterStore.set({
                    lockedVesselImo: candidate.imo,
                    lockedVesselName: candidate.name,
                    lockedVesselDwt: candidate.neonDbMaster?.dwt || candidate.dwt,
                    lockedCharterConfirmed: true,
                });
            }
            if (typeof window.showToast === 'function') {
                window.showToast(`🔒 Fletamento bloqueado con éxito para ${candidate.name} (IMO ${candidate.imo}) - ${candidate.compatibilityScore || 0}% Compatibilidad.`);
            }
        }
    }

    handleContactOwner(imo) {
        const matches = this.currentMatches.length > 0 ? this.currentMatches : (this.cache?.pairedMatches || []);
        const candidate = matches.find(v => v.imo === imo) || matches[0];
        if (!candidate) return;
        const owner = candidate.neonDbMaster?.ownerManager 
            || candidate.ownerManager 
            || candidate.owner 
            || candidate.propietario 
            || '—';
        
        if (typeof window !== 'undefined') {
            if (typeof window.showToast === 'function') {
                window.showToast(`📧 Contactando con el armador/propietario (${owner}) para el buque ${candidate.name}...`);
            }
            if (typeof window.openChatWithContext === 'function') {
                window.openChatWithContext({
                    action: 'CONTACT_OWNER',
                    vessel: candidate,
                    owner,
                    initialMessage: `Hola, me gustaría solicitar flete y disponibilidad para el buque ${candidate.name} (IMO: ${candidate.imo}, DWT: ${candidate.neonDbMaster?.dwt || candidate.dwt || 'N/A'} MT) perteneciente a ${owner}.`
                });
            }
        }
    }

    handleTriggerDueDiligence(imo) {
        const matches = this.currentMatches.length > 0 ? this.currentMatches : (this.cache?.pairedMatches || []);
        const candidate = matches.find(v => v.imo === imo) || matches[0];
        if (!candidate) return;

        const owner = candidate.neonDbMaster?.ownerManager 
            || candidate.ownerManager 
            || candidate.owner 
            || candidate.propietario 
            || candidate.dispOwner 
            || '—';
        const dwt = Number(candidate.neonDbMaster?.dwt || candidate.dwt || 0);
        const draft = Number(candidate.neonDbMaster?.draftMeters || candidate.draft || 0);
        const vesselType = candidate.neonDbMaster?.vesselType || candidate.vesselType || '—';
        const flag = candidate.neonDbMaster?.flag || candidate.flag || '—';
        const yearBuilt = candidate.neonDbMaster?.yearBuilt || candidate.yearBuilt || '';
        const loaMeters = candidate.neonDbMaster?.loaMeters || candidate.loaMeters || '';
        const beamMeters = candidate.neonDbMaster?.beamMeters || candidate.beamMeters || '';
        const stowageFactor = candidate.neonDbMaster?.stowageFactor || candidate.stowageFactor || '';
        const compatibilityScore = candidate.compatibilityScore || 0;
        const technicalJustification = candidate.technicalJustification || '';

        const candidateVessel = {
            name: candidate.name || candidate.vesselName || `MV VESSEL ${candidate.imo}`,
            vesselName: candidate.name || candidate.vesselName || `MV VESSEL ${candidate.imo}`,
            imo: candidate.imo,
            imoNumber: candidate.imo,
            mmsi: candidate.mmsi,
            owner,
            ownerManager: owner,
            propietario: owner,
            dwt,
            draft,
            draftMeters: draft,
            flag,
            vesselType,
            yearBuilt,
            loaMeters,
            beamMeters,
            stowageFactor,
            compatibilityScore,
            technicalJustification,
            radarLive: candidate.radarLive || {},
            neonDbMaster: candidate.neonDbMaster || {},
            source: 'compatibility-module',
        };

        if (typeof window !== 'undefined') {
            if (typeof window.showToast === 'function') {
                window.showToast(`🛡️ Activando Due Diligence y Auditoría Técnica para ${candidateVessel.name}...`);
            }

            // Transfer vessel state to global stores
            if (window.SeaCharterStore && typeof window.SeaCharterStore.set === 'function') {
                window.SeaCharterStore.set({
                    activeVessel: candidateVessel,
                    auditVessel: candidateVessel,
                    dueDiligenceVessel: candidateVessel,
                    selectedVessel: candidateVessel,
                    lockedVesselImo: candidateVessel.imo,
                    lockedVesselName: candidateVessel.name,
                    lockedVesselDwt: candidateVessel.dwt,
                    lockedVesselDraft: candidateVessel.draft,
                    lockedVesselOwner: candidateVessel.owner,
                });
            }
            if (window.GlobalStore) {
                window.GlobalStore.activeVessel = candidateVessel;
                window.GlobalStore.auditVessel = candidateVessel;
                window.GlobalStore.dueDiligenceVessel = candidateVessel;
            }
            window.activeVessel = candidateVessel;
            window.activeAuditVessel = candidateVessel;
            window.lastAuditedVessel = candidateVessel;

            // Trigger global events
            window.dispatchEvent(new CustomEvent('audit-vessel-inherited', { detail: candidateVessel }));
            window.dispatchEvent(new CustomEvent('canonical-active-vessel-updated', { detail: candidateVessel }));

            // Direct render in Auditor tab if function exists
            if (typeof window.renderAuditorVesselDossier === 'function') {
                window.renderAuditorVesselDossier(candidateVessel);
            }

            // If VesselDueDiligenceBridge is present, trigger it
            if (window.VesselDueDiligenceBridge && typeof window.VesselDueDiligenceBridge.run === 'function') {
                const dummyButton = document.createElement('button');
                dummyButton.dataset.dueDiligencePayload = JSON.stringify({
                    imo: candidateVessel.imo,
                    mmsi: candidateVessel.mmsi,
                    vesselName: candidateVessel.name,
                    vessel_type: candidateVessel.vesselType,
                    dwt: candidateVessel.dwt,
                    draft: candidateVessel.draft,
                    owner: candidateVessel.owner,
                });
                window.VesselDueDiligenceBridge.run(dummyButton, dummyButton.dataset.dueDiligencePayload);
            }

            // If switchTab is available, navigate to auditor
            if (typeof window.switchTab === 'function') {
                setTimeout(() => {
                    window.switchTab('auditor');
                }, 300);
            }
        }
    }
}

const CompatibilityModule = new CompatibilityModuleManager();

export function mountCompatibilityModule(targetContainer) {
    return CompatibilityModule.mount(targetContainer);
}

if (typeof window !== 'undefined') {
    window.CompatibilityModule = CompatibilityModule;
    window.mountCompatibilityModule = mountCompatibilityModule;
}
