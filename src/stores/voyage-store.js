import { createStore } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';

const EMPTY_DRAFT = Object.freeze({
    pol: null,
    pod: null,
    laycan: { laydays: '', cancelling: '' },
    cargoVolumeCBM: 0,
    palletQuantity: 0,
    deckHeight: 2.2,
    targetTemperatureCelsius: 13.0,
    requiresControlledAtmosphere: false,
    auxiliaryGensetDailyCost: 0,
    cargo: { description: '' },
    projectCargo: {
        unitWeightMT: 0,
        pesoUnitario: 0,
        length: 0,
        largo: 0,
        width: 0,
        ancho: 0,
        height: 0,
        alto: 0,
        handlingMode: 'direct-lift',
        dimensions: {
            lengthM: 0,
            widthM: 0,
            heightM: 0,
        },
    },
    loadingRate: 0,
    dischargeRate: 0,
    loa_meters: null,
    beam_meters: null,
    draft_meters: null,
    fuel_consumption_laden: null,
    fuel_consumption_ballast: null,
    fuel_consumption_port: null,
    service_speed_knots: null,
    speed_laden: null,
    speed_ballast: null,
    year_built: null,
    owner_manager: '',
    vessel_class: '',
    flag: '',
    has_gears: null,
    has_scrubber: null,
    methodPOL: '',
    methodPOD: '',
    ratePOL: 0,
    ratePOD: 0,
    ballastDistanceNm: null,
    ballastDistanceSource: '',
    lastreCoordinates: [],
    distanceNm: null,
    routeGeometry: null,
    weather: null,
    vessel: null,
    cargoVolumeCBM: 0,
    palletQuantity: 0,
    deckHeight: 2.2,
    targetTemperatureCelsius: 13.0,
    requiresControlledAtmosphere: false,
    auxiliaryGensetDailyCost: 0,
    updatedAt: null,
    lastSource: '',
});

function cleanText(value) {
    return String(value ?? '').trim();
}

function cleanNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
}

function cleanNonNegativeNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
}

function cleanMethod(value) {
    if (value && typeof value === 'object') return cleanText(value.value || value.label);
    return cleanText(value);
}

function resolveCalculatorBallastDistance(state, draft) {
    const incomingDistance = cleanNonNegativeNumber(state?.distBallast);
    const retainedDistance = cleanNonNegativeNumber(draft?.ballastDistanceNm);
    if (incomingDistance === null) return retainedDistance;
    if (incomingDistance === 0 && retainedDistance > 0) return retainedDistance;
    return incomingDistance;
}

function normalizePort(port, fallbackName = '') {
    const source = port && typeof port === 'object' ? port : {};
    const name = cleanText(source.name || source.id || fallbackName);
    if (!name) return null;
    const lat = Number(source.lat ?? source.latitude);
    const lng = Number(source.lng ?? source.lon ?? source.longitude);
    return {
        ...source,
        name,
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
        ...(source.source === 'DATALASTIC' || source.source === 'Datalastic' ? {
            uuid: cleanText(source.uuid),
            unlocode: cleanText(source.unlocode).toUpperCase(),
            maxOperationalDraftMeters: Number(source.maxOperationalDraftMeters) || null,
            officialLabel: cleanText(source.officialLabel),
            countryCode: cleanText(source.countryCode).toUpperCase(),
            latitude: Number.isFinite(lat) ? lat : null,
            longitude: Number.isFinite(lng) ? lng : null,
            source: 'DATALASTIC',
        } : {}),
    };
}

function normalizeNlpPort(port, fallbackName = '') {
    const normalizedName = cleanText(port?.name || port?.id || fallbackName);
    if (/^(?:POL|POD)$/i.test(normalizedName)) return null;
    return normalizePort(port, fallbackName);
}

function normalizeVessel(vessel) {
    if (!vessel || typeof vessel !== 'object') return null;
    const imo = cleanText(vessel.imo || vessel.imoNumber || vessel.imo_number).replace(/\D/g, '');
    const name = cleanText(vessel.name || vessel.vesselName || vessel.vessel_name);
    if (!imo && !name) return null;
    const latitude = Number(vessel.latitude ?? vessel.lat ?? vessel.position?.latitude ?? vessel.position?.lat);
    const longitude = Number(vessel.longitude ?? vessel.lon ?? vessel.lng ?? vessel.position?.longitude ?? vessel.position?.lon ?? vessel.position?.lng);
    const speedKnots = cleanNonNegativeNumber(vessel.speedKnots ?? vessel.service_speed_knots ?? vessel.serviceSpeedKnots ?? vessel.speed_over_ground ?? vessel.speedOverGround ?? vessel.speed ?? vessel.spd_laden ?? vessel.spd_ballast ?? vessel.sog);
    const loaMeters = cleanNonNegativeNumber(vessel.loa_meters ?? vessel.loa ?? vessel.loaMeters ?? vessel.LOA);
    const beamMeters = cleanNonNegativeNumber(vessel.beam_meters ?? vessel.beam ?? vessel.beamMeters ?? vessel.Beam);
    const draftMeters = cleanNonNegativeNumber(vessel.draft_meters ?? vessel.draft ?? vessel.draftMeters ?? vessel.Draft);
    const fuelConsumptionLaden = cleanNonNegativeNumber(vessel.fuel_consumption_laden ?? vessel.cons_sea ?? vessel.consSea ?? vessel.fuelConsumptionLaden);
    const fuelConsumptionBallast = cleanNonNegativeNumber(vessel.fuel_consumption_ballast ?? vessel.cons_ballast ?? vessel.consBallast ?? vessel.fuelConsumptionBallast ?? fuelConsumptionLaden);
    const fuelConsumptionPort = cleanNonNegativeNumber(vessel.fuel_consumption_port ?? vessel.cons_port ?? vessel.consPort ?? vessel.fuelConsumptionPort);
    const speedLaden = cleanNonNegativeNumber(vessel.spd_laden ?? vessel.speed_laden ?? vessel.speedLaden ?? speedKnots);
    const speedBallast = cleanNonNegativeNumber(vessel.spd_ballast ?? vessel.speed_ballast ?? vessel.speedBallast ?? speedKnots);
    const ownerManager = cleanText(vessel.owner_manager ?? vessel.ownerManager ?? vessel.gestor ?? vessel.manager);
    const vesselClass = cleanText(vessel.vessel_class ?? vessel.vesselClass ?? vessel.commercial_class ?? vessel.commercialClass ?? vessel.vessel_type ?? vessel.vesselType);

    return {
        name,
        imo,
        mmsi: cleanText(vessel.mmsi).replace(/\D/g, ''),
        dwt: cleanNumber(vessel.dwt),
        loa: loaMeters,
        loa_meters: loaMeters,
        beam: beamMeters,
        beam_meters: beamMeters,
        draft: draftMeters,
        draft_meters: draftMeters,
        gt: cleanNumber(vessel.gt ?? vessel.grossTonnage ?? vessel.gross_tonnage),
        gross_tonnage: cleanNumber(vessel.gross_tonnage ?? vessel.grossTonnage ?? vessel.gt),
        net_tonnage: cleanNumber(vessel.net_tonnage ?? vessel.netTonnage ?? vessel.nt),
        flag: cleanText(vessel.flag),
        yearBuilt: cleanNumber(vessel.yearBuilt ?? vessel.year_built ?? vessel.builtYear ?? vessel.built_year),
        year_built: cleanNumber(vessel.year_built ?? vessel.yearBuilt ?? vessel.built_year ?? vessel.builtYear),
        service_speed_knots: speedKnots,
        speedKnots,
        speed_laden: speedLaden,
        spd_laden: speedLaden,
        speed_ballast: speedBallast,
        spd_ballast: speedBallast,
        fuel_consumption_laden: fuelConsumptionLaden,
        fuel_consumption_ballast: fuelConsumptionBallast,
        fuel_consumption_port: fuelConsumptionPort,
        cons_sea: fuelConsumptionLaden,
        cons_ballast: fuelConsumptionBallast,
        cons_port: fuelConsumptionPort,
        owner_manager: ownerManager,
        vessel_class: vesselClass,
        commercial_class: vesselClass,
        has_gears: vessel.has_gears ?? vessel.hasGears ?? null,
        has_scrubber: vessel.has_scrubber ?? vessel.hasScrubber ?? null,
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        positionUpdatedAt: cleanText(vessel.positionUpdatedAt || vessel.position_updated_at || vessel.timestamp || vessel.updatedAt) || null,
    };
}

function normalizeRouteCoordinates(coordinates) {
    return (Array.isArray(coordinates) ? coordinates : [])
        .map((point) => {
            const lat = Number(Array.isArray(point) ? point[0] : point?.lat ?? point?.latitude);
            const lng = Number(Array.isArray(point) ? point[1] : point?.lng ?? point?.lon ?? point?.longitude);
            return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
        })
        .filter(Boolean);
}

export function hasOperationalDraft(draft) {
    return Boolean(
        draft?.pol?.name
        && draft?.pod?.name
        && draft?.laycan?.laydays
        && draft?.laycan?.cancelling
        && (cleanNumber(draft?.palletQuantity) > 0 || cleanNumber(draft?.cargoVolumeCBM) > 0 || cleanNumber(draft?.cargo?.quantityMt) > 0)
    );
}

export const voyageStore = createStore(subscribeWithSelector((set, get) => ({
    cargoVolumeCBM: 0,
    palletQuantity: 0,
    deckHeight: 2.2,
    targetTemperatureCelsius: 13.0,
    requiresControlledAtmosphere: false,
    auxiliaryGensetDailyCost: 0,
    draft: { ...EMPTY_DRAFT, laycan: { ...EMPTY_DRAFT.laycan }, cargo: { ...EMPTY_DRAFT.cargo }, projectCargo: { ...EMPTY_DRAFT.projectCargo, dimensions: { ...EMPTY_DRAFT.projectCargo.dimensions } } },
    setCargoDetails: (details = {}) => set((current) => {
        const payload = details && typeof details === 'object' ? details : {};
        const cargoVolumeCBM = payload.cargoVolumeCBM !== undefined
            ? cleanNonNegativeNumber(payload.cargoVolumeCBM) ?? 0
            : (current.draft.cargoVolumeCBM ?? current.cargoVolumeCBM ?? 0);
        const palletQuantity = payload.palletQuantity !== undefined
            ? cleanNonNegativeNumber(payload.palletQuantity) ?? 0
            : (current.draft.palletQuantity ?? current.palletQuantity ?? 0);
        const deckHeight = payload.deckHeight !== undefined
            ? cleanNonNegativeNumber(payload.deckHeight) ?? 2.2
            : (current.draft.deckHeight ?? current.deckHeight ?? 2.2);
        const targetTemperatureCelsius = payload.targetTemperatureCelsius !== undefined
            ? (Number.isFinite(Number(payload.targetTemperatureCelsius)) ? Number(payload.targetTemperatureCelsius) : 13.0)
            : (current.draft.targetTemperatureCelsius ?? current.targetTemperatureCelsius ?? 13.0);
        const requiresControlledAtmosphere = payload.requiresControlledAtmosphere !== undefined
            ? Boolean(payload.requiresControlledAtmosphere)
            : Boolean(current.draft.requiresControlledAtmosphere ?? current.requiresControlledAtmosphere);
        const auxiliaryGensetDailyCost = payload.auxiliaryGensetDailyCost !== undefined
            ? cleanNonNegativeNumber(payload.auxiliaryGensetDailyCost) ?? 0
            : (current.draft.auxiliaryGensetDailyCost ?? current.auxiliaryGensetDailyCost ?? 0);

        const nextDraft = {
            ...current.draft,
            cargoVolumeCBM,
            palletQuantity,
            deckHeight,
            targetTemperatureCelsius,
            requiresControlledAtmosphere,
            auxiliaryGensetDailyCost,
            updatedAt: new Date().toISOString(),
            lastSource: 'setCargoDetails',
        };

        const currentComparable = { ...current.draft, updatedAt: null, lastSource: 'setCargoDetails' };
        const nextComparable = { ...nextDraft, updatedAt: null, lastSource: 'setCargoDetails' };
        if (JSON.stringify(currentComparable) === JSON.stringify(nextComparable)) {
            return current;
        }

        return {
            ...current,
            cargoVolumeCBM,
            palletQuantity,
            deckHeight,
            targetTemperatureCelsius,
            requiresControlledAtmosphere,
            auxiliaryGensetDailyCost,
            draft: nextDraft,
        };
    }),
    applyNlpScenario: (scenario = {}) => set((current) => {
        const payload = scenario?.payload && typeof scenario.payload === 'object' ? scenario.payload : scenario;
        const rawProjectCargo = payload.projectCargo || payload.project_cargo || scenario.projectCargo || scenario.project_cargo || {};
        const unitWeightMT = cleanNonNegativeNumber(rawProjectCargo.unitWeightMT ?? rawProjectCargo.unitWeight ?? rawProjectCargo.pesoUnitario ?? payload.unitWeightMT ?? payload.unitWeight ?? payload.pesoUnitario ?? scenario.unitWeightMT ?? scenario.unitWeight ?? scenario.pesoUnitario) ?? (current.draft.projectCargo?.unitWeightMT ?? 0);
        const length = cleanNonNegativeNumber(rawProjectCargo.dimensions?.lengthM ?? rawProjectCargo.dimensions?.length ?? rawProjectCargo.lengthM ?? rawProjectCargo.length ?? rawProjectCargo.largo ?? payload.dimensions?.lengthM ?? payload.dimensions?.length ?? payload.lengthM ?? payload.length ?? payload.largo ?? scenario.dimensions?.lengthM ?? scenario.dimensions?.length ?? scenario.lengthM ?? scenario.length ?? scenario.largo) ?? (current.draft.projectCargo?.length ?? 0);
        const width = cleanNonNegativeNumber(rawProjectCargo.dimensions?.widthM ?? rawProjectCargo.dimensions?.width ?? rawProjectCargo.widthM ?? rawProjectCargo.width ?? rawProjectCargo.ancho ?? payload.dimensions?.widthM ?? payload.dimensions?.width ?? payload.widthM ?? payload.width ?? payload.ancho ?? scenario.dimensions?.widthM ?? scenario.dimensions?.width ?? scenario.widthM ?? scenario.width ?? scenario.ancho) ?? (current.draft.projectCargo?.width ?? 0);
        const height = cleanNonNegativeNumber(rawProjectCargo.dimensions?.heightM ?? rawProjectCargo.dimensions?.height ?? rawProjectCargo.heightM ?? rawProjectCargo.height ?? rawProjectCargo.alto ?? payload.dimensions?.heightM ?? payload.dimensions?.height ?? payload.heightM ?? payload.height ?? payload.alto ?? scenario.dimensions?.heightM ?? scenario.dimensions?.height ?? scenario.heightM ?? scenario.height ?? scenario.alto) ?? (current.draft.projectCargo?.height ?? 0);
        const handlingMode = cleanText(rawProjectCargo.handlingMode ?? payload.handlingMode ?? scenario.handlingMode ?? rawProjectCargo.configuracionOperativa ?? payload.configuracionOperativa ?? scenario.configuracionOperativa) || current.draft.projectCargo?.handlingMode || 'direct-lift';

        const projectCargo = {
            unitWeightMT,
            pesoUnitario: unitWeightMT,
            length,
            largo: length,
            width,
            ancho: width,
            height,
            alto: height,
            handlingMode,
            dimensions: {
                lengthM: length,
                widthM: width,
                heightM: height,
            },
        };

        const rawPalletQuantity = payload.palletQuantity ?? payload.pallet_quantity ?? payload.pallets ?? scenario.palletQuantity ?? scenario.pallet_quantity ?? scenario.pallets;
        const palletQuantity = rawPalletQuantity !== undefined && rawPalletQuantity !== null
            ? cleanNonNegativeNumber(rawPalletQuantity) ?? (current.draft.palletQuantity ?? current.palletQuantity ?? 0)
            : (current.draft.palletQuantity ?? current.palletQuantity ?? 0);

        const rawCargoVolumeCBM = payload.cargoVolumeCBM ?? payload.cargo_volume_cbm ?? payload.cargoVolume ?? scenario.cargoVolumeCBM ?? scenario.cargo_volume_cbm ?? scenario.cargoVolume;
        const cargoVolumeCBM = rawCargoVolumeCBM !== undefined && rawCargoVolumeCBM !== null
            ? cleanNonNegativeNumber(rawCargoVolumeCBM) ?? (current.draft.cargoVolumeCBM ?? current.cargoVolumeCBM ?? 0)
            : (current.draft.cargoVolumeCBM ?? current.cargoVolumeCBM ?? 0);

        const rawDeckHeight = payload.deckHeight ?? payload.deck_height ?? scenario.deckHeight ?? scenario.deck_height;
        const deckHeight = rawDeckHeight !== undefined && rawDeckHeight !== null
            ? cleanNonNegativeNumber(rawDeckHeight) ?? (current.draft.deckHeight ?? current.deckHeight ?? 2.2)
            : (current.draft.deckHeight ?? current.deckHeight ?? 2.2);

        const rawTargetTemp = payload.targetTemperatureCelsius ?? payload.target_temperature_celsius ?? payload.target_temperature ?? payload.targetTemperature ?? scenario.targetTemperatureCelsius ?? scenario.target_temperature_celsius ?? scenario.target_temperature ?? scenario.targetTemperature;
        const targetTemperatureCelsius = rawTargetTemp !== undefined && rawTargetTemp !== null && !isNaN(Number(rawTargetTemp))
            ? Number(rawTargetTemp)
            : (current.draft.targetTemperatureCelsius ?? current.targetTemperatureCelsius ?? 13.0);

        const rawControlledAtmosphere = payload.requiresControlledAtmosphere ?? payload.requires_controlled_atmosphere ?? scenario.requiresControlledAtmosphere ?? scenario.requires_controlled_atmosphere;
        const requiresControlledAtmosphere = rawControlledAtmosphere !== undefined && rawControlledAtmosphere !== null
            ? Boolean(rawControlledAtmosphere)
            : Boolean(current.draft.requiresControlledAtmosphere ?? current.requiresControlledAtmosphere);

        const rawAuxGenset = payload.auxiliaryGensetDailyCost ?? payload.auxiliary_genset_daily_cost ?? payload.auxiliaryGensetCost ?? scenario.auxiliaryGensetDailyCost ?? scenario.auxiliary_genset_daily_cost ?? scenario.auxiliaryGensetCost;
        const auxiliaryGensetDailyCost = rawAuxGenset !== undefined && rawAuxGenset !== null
            ? cleanNonNegativeNumber(rawAuxGenset) ?? (current.draft.auxiliaryGensetDailyCost ?? current.auxiliaryGensetDailyCost ?? 0)
            : (current.draft.auxiliaryGensetDailyCost ?? current.auxiliaryGensetDailyCost ?? 0);

        const cargoTextToInspect = [
            scenario.cargo_type,
            scenario.cargoType,
            scenario.category,
            scenario.cargo_category,
            scenario.cargoCategory,
            scenario.categoriaCarga,
            scenario.product,
            scenario.cargo_product,
            scenario.cargoProduct,
            scenario.productoEspecifico,
            scenario.cargo?.description,
            payload.cargo_type,
            payload.cargoType,
            payload.category,
            payload.cargo_category,
            payload.cargoCategory,
            payload.categoriaCarga,
            payload.product,
            payload.cargo_product,
            payload.cargoProduct,
            payload.productoEspecifico,
            payload.cargo?.description,
        ].filter(Boolean).join(' ');

        const hasTargetTemp = rawTargetTemp !== undefined && rawTargetTemp !== null && rawTargetTemp !== '' && !isNaN(Number(rawTargetTemp));
        const hasReeferKeywords = /reefer|pl[aá]tano|fruta|citric|pescad|carn|congelad|farmac/i.test(cargoTextToInspect);

        const isReeferCargo = Boolean(
            palletQuantity > 0 ||
            cargoVolumeCBM > 0 ||
            requiresControlledAtmosphere ||
            hasTargetTemp ||
            hasReeferKeywords
        );

        // Reefer Speed Profiling: 17.5 knots default for temperature controlled cargo (vs 10-13 for dry bulk)
        const defaultReeferSpeed = isReeferCargo ? 17.5 : null;
        const speed_laden = isReeferCargo
            ? 17.5
            : (cleanNonNegativeNumber(scenario.speed_laden ?? scenario.speedLaden ?? payload.speed_laden ?? payload.speedLaden)
                ?? defaultReeferSpeed
                ?? current.draft.speed_laden);
        const speed_ballast = isReeferCargo
            ? 17.5
            : (cleanNonNegativeNumber(scenario.speed_ballast ?? scenario.speedBallast ?? payload.speed_ballast ?? payload.speedBallast)
                ?? defaultReeferSpeed
                ?? current.draft.speed_ballast);

        const reeferMethod = 'Paletizado - Grúa Portuaria';
        const methodPOL = isReeferCargo
            ? reeferMethod
            : (cleanMethod(scenario.methodPOL ?? scenario.loading_method ?? scenario.loadingMethod ?? scenario.loadMethod) || current.draft.methodPOL);
        const methodPOD = isReeferCargo
            ? reeferMethod
            : (cleanMethod(scenario.methodPOD ?? scenario.discharge_method ?? scenario.dischargeMethod) || current.draft.methodPOD);

        const normCat = String(payload.category || payload.cargo_category || payload.cargoCategory || scenario.category || scenario.cargo_category || '').toLowerCase();
        const normProd = String(payload.product || payload.cargo_product || payload.cargoProduct || scenario.product || scenario.cargo_product || '').toLowerCase();
        const isBackendReefer = normCat.includes('carga refrigerada') || normCat.includes('reefer') || normProd.includes('platano') || normProd.includes('banana');

        const resolvedCargoCategory = isBackendReefer
            ? 'Frutas Tropicales y Exóticas'
            : (payload.cargoCategory || payload.cargo_category || scenario.cargoCategory || scenario.cargo_category || current.draft.cargoCategory);
        const resolvedCargoProduct = isBackendReefer
            ? 'Bananas/Plátanos'
            : (payload.cargoProduct || payload.cargo_product || scenario.cargoProduct || scenario.cargo_product || current.draft.cargoProduct);
        const resolvedCargoDescription = isBackendReefer
            ? 'Bananas/Plátanos'
            : (cleanText(scenario.cargo_type || scenario.cargoType || payload.cargo_type || payload.cargoType) || current.draft.cargo.description);

        const nextDraft = {
            pol: normalizeNlpPort(scenario.pol_port || scenario.pol, cleanText(scenario.pol)) || current.draft.pol,
            pod: normalizeNlpPort(scenario.pod_port || scenario.pod, cleanText(scenario.pod)) || current.draft.pod,
            laycan: {
                laydays: cleanText(scenario.laydays) || current.draft.laycan.laydays,
                cancelling: cleanText(scenario.cancelling) || current.draft.laycan.cancelling,
            },
            cargo: {
                description: resolvedCargoDescription,
                quantityMt: scenario.cargo_qty !== undefined || scenario.cargoQty !== undefined
                    ? cleanNumber(scenario.cargo_qty ?? scenario.cargoQty) || current.draft.cargo.quantityMt
                    : current.draft.cargo.quantityMt,
            },
            cargoCategory: resolvedCargoCategory,
            cargoProduct: resolvedCargoProduct,
            categoriaCarga: resolvedCargoCategory,
            productoEspecifico: resolvedCargoProduct,
            projectCargo,
            cargoVolumeCBM,
            palletQuantity,
            deckHeight,
            targetTemperatureCelsius,
            requiresControlledAtmosphere,
            auxiliaryGensetDailyCost,
            speed_laden,
            speed_ballast,
            loadingRate: scenario.ratePOL !== undefined || scenario.loading_rate !== undefined || scenario.loadingRate !== undefined
                ? cleanNumber(scenario.ratePOL ?? scenario.loading_rate ?? scenario.loadingRate) || current.draft.loadingRate
                : current.draft.loadingRate,
            dischargeRate: scenario.ratePOD !== undefined || scenario.discharge_rate !== undefined || scenario.dischargeRate !== undefined
                ? cleanNumber(scenario.ratePOD ?? scenario.discharge_rate ?? scenario.dischargeRate) || current.draft.dischargeRate
                : current.draft.dischargeRate,
            dwt: cleanNumber(scenario.dwt ?? scenario.required_dwt ?? scenario.requiredDwt) || current.draft.dwt,
            methodPOL,
            methodPOD,
            ratePOL: cleanNumber(scenario.ratePOL ?? scenario.loading_rate ?? scenario.loadingRate) || current.draft.ratePOL,
            ratePOD: cleanNumber(scenario.ratePOD ?? scenario.discharge_rate ?? scenario.dischargeRate) || current.draft.ratePOD,
            ballastDistanceNm: current.draft.ballastDistanceNm,
            ballastDistanceSource: current.draft.ballastDistanceSource,
            lastreCoordinates: current.draft.lastreCoordinates,
            distanceNm: current.draft.distanceNm,
            routeGeometry: current.draft.routeGeometry,
            weather: current.draft.weather,
            vessel: current.draft.vessel,
            lastSource: 'assistant-nlp',
        };

        const currentComparable = { ...current.draft, updatedAt: null, lastSource: 'assistant-nlp' };
        const nextComparable = { ...nextDraft, updatedAt: null, lastSource: 'assistant-nlp' };
        if (JSON.stringify(currentComparable) === JSON.stringify(nextComparable)) {
            return current;
        }

        return {
            ...current,
            cargoVolumeCBM,
            palletQuantity,
            deckHeight,
            targetTemperatureCelsius,
            requiresControlledAtmosphere,
            auxiliaryGensetDailyCost,
            draft: {
                ...current.draft,
                ...nextDraft,
                updatedAt: new Date().toISOString(),
            },
        };
    }),
    updateFromCalculator: (state = {}) => set((current) => {
        const ballastDistanceNm = resolveCalculatorBallastDistance(state, current.draft);
        const ballastDistanceChanged = ballastDistanceNm !== current.draft.ballastDistanceNm;
        const laydays = cleanText(
            state.laydays
            || state.laycan?.laydays
            || state.laycan?.start
            || state.laycanDate
            || state.laycan_start
        ) || current.draft.laycan.laydays;
        const cancelling = cleanText(
            state.cancelling
            || state.laycan?.cancelling
            || state.laycan?.end
            || state.cancellingDate
            || state.laycan_end
        ) || current.draft.laycan.cancelling;

        const rawProjectCargo = state.projectCargo || state.project_cargo || {};
        const unitWeightMT = cleanNonNegativeNumber(rawProjectCargo.unitWeightMT ?? rawProjectCargo.unitWeight ?? rawProjectCargo.pesoUnitario ?? state.unitWeightMT ?? state.unitWeight ?? state.pesoUnitario) ?? (current.draft.projectCargo?.unitWeightMT ?? 0);
        const length = cleanNonNegativeNumber(rawProjectCargo.dimensions?.lengthM ?? rawProjectCargo.dimensions?.length ?? rawProjectCargo.lengthM ?? rawProjectCargo.length ?? rawProjectCargo.largo ?? state.dimensions?.lengthM ?? state.dimensions?.length ?? state.lengthM ?? state.length ?? state.largo) ?? (current.draft.projectCargo?.length ?? 0);
        const width = cleanNonNegativeNumber(rawProjectCargo.dimensions?.widthM ?? rawProjectCargo.dimensions?.width ?? rawProjectCargo.widthM ?? rawProjectCargo.width ?? rawProjectCargo.ancho ?? state.dimensions?.widthM ?? state.dimensions?.width ?? state.widthM ?? state.width ?? state.ancho) ?? (current.draft.projectCargo?.width ?? 0);
        const height = cleanNonNegativeNumber(rawProjectCargo.dimensions?.heightM ?? rawProjectCargo.dimensions?.height ?? rawProjectCargo.heightM ?? rawProjectCargo.height ?? rawProjectCargo.alto ?? state.dimensions?.heightM ?? state.dimensions?.height ?? state.heightM ?? state.height ?? state.alto) ?? (current.draft.projectCargo?.height ?? 0);
        const handlingMode = cleanText(rawProjectCargo.handlingMode ?? state.handlingMode ?? state.projectHandlingMode ?? rawProjectCargo.configuracionOperativa ?? state.configuracionOperativa) || current.draft.projectCargo?.handlingMode || 'direct-lift';

        const projectCargo = {
            unitWeightMT,
            pesoUnitario: unitWeightMT,
            length,
            largo: length,
            width,
            ancho: width,
            height,
            alto: height,
            handlingMode,
            dimensions: {
                lengthM: length,
                widthM: width,
                heightM: height,
            },
        };

        const cargoVolumeCBM = state.cargoVolumeCBM !== undefined
            ? cleanNonNegativeNumber(state.cargoVolumeCBM) ?? 0
            : (current.draft.cargoVolumeCBM ?? current.cargoVolumeCBM ?? 0);
        const palletQuantity = state.palletQuantity !== undefined
            ? cleanNonNegativeNumber(state.palletQuantity) ?? 0
            : (current.draft.palletQuantity ?? current.palletQuantity ?? 0);
        const deckHeight = state.deckHeight !== undefined
            ? cleanNonNegativeNumber(state.deckHeight) ?? 2.2
            : (current.draft.deckHeight ?? current.deckHeight ?? 2.2);
        const targetTemperatureCelsius = state.targetTemperatureCelsius !== undefined
            ? (Number.isFinite(Number(state.targetTemperatureCelsius)) ? Number(state.targetTemperatureCelsius) : 13.0)
            : (current.draft.targetTemperatureCelsius ?? current.targetTemperatureCelsius ?? 13.0);
        const requiresControlledAtmosphere = state.requiresControlledAtmosphere !== undefined
            ? Boolean(state.requiresControlledAtmosphere)
            : Boolean(current.draft.requiresControlledAtmosphere ?? current.requiresControlledAtmosphere);
        const auxiliaryGensetDailyCost = state.auxiliaryGensetDailyCost !== undefined
            ? cleanNonNegativeNumber(state.auxiliaryGensetDailyCost) ?? 0
            : (current.draft.auxiliaryGensetDailyCost ?? current.auxiliaryGensetDailyCost ?? 0);

        const nextDraft = {
            ...current.draft,
            cargoVolumeCBM,
            palletQuantity,
            deckHeight,
            targetTemperatureCelsius,
            requiresControlledAtmosphere,
            auxiliaryGensetDailyCost,
            pol: normalizePort(state.polCoordinates, state.pol) || current.draft.pol,
            pod: normalizePort(state.podCoordinates, state.pod) || current.draft.pod,
            laycan: {
                laydays,
                cancelling,
            },
            cargo: {
                description: cleanText(state.cargoProduct || state.cargoType || current.draft.cargo.description),
                quantityMt: cleanNumber(state.cargoQuantity || state.cargo),
            },
            projectCargo,
            loadingRate: cleanNumber(state.ratePOL ?? state.ritmoRealPol ?? state.loadRate) || current.draft.loadingRate,
            dischargeRate: cleanNumber(state.ratePOD ?? state.ritmoRealPod ?? state.dischargeRate ?? state.dischRate) || current.draft.dischargeRate,
            dwt: cleanNumber(state.dwt ?? state.vesselDwt) || current.draft.dwt,
            methodPOL: cleanMethod(state.methodPOL ?? state.loadMethod) || current.draft.methodPOL,
            methodPOD: cleanMethod(state.methodPOD ?? state.dischargeMethod) || current.draft.methodPOD,
            ratePOL: cleanNumber(state.ratePOL ?? state.ritmoRealPol ?? state.loadRate) || current.draft.ratePOL,
            ratePOD: cleanNumber(state.ratePOD ?? state.ritmoRealPod ?? state.dischargeRate ?? state.dischRate) || current.draft.ratePOD,
            ballastDistanceNm,
            ballastDistanceSource: ballastDistanceChanged
                ? 'calculator'
                : current.draft.ballastDistanceSource,
            distanceNm: cleanNumber(state.totalMiles ?? state.distanceNm) || current.draft.distanceNm,
            routeGeometry: state.routeGeometry || current.draft.routeGeometry,
            vessel: normalizeVessel({
                name: state.vesselName || state.vessel,
                imo: state.imo,
                dwt: state.dwt,
                gt: state.gt,
                flag: state.flag,
                yearBuilt: state.yearBuilt,
            }) || current.draft.vessel,
            lastSource: 'calculator',
        };

        const calculatorReeferText = [
            state.cargoProduct,
            state.cargoType,
            state.cargoDescription,
            state.category,
            state.cargoCategory,
            state.categoriaCarga,
            state.product,
            state.productoEspecifico,
        ].filter(Boolean).join(' ');
        const isCalculatorReefer = Boolean(
            palletQuantity > 0 ||
            cargoVolumeCBM > 0 ||
            requiresControlledAtmosphere ||
            (state.targetTemperatureCelsius !== undefined && state.targetTemperatureCelsius !== null && !isNaN(Number(state.targetTemperatureCelsius))) ||
            /reefer|pl[aá]tano|fruta/i.test(calculatorReeferText)
        );
        if (isCalculatorReefer) {
            nextDraft.speed_laden = 17.5;
            nextDraft.speed_ballast = 17.5;
            nextDraft.methodPOL = 'Paletizado - Grúa Portuaria';
            nextDraft.methodPOD = 'Paletizado - Grúa Portuaria';
        }

        const currentComparable = { ...current.draft, updatedAt: null, lastSource: 'calculator' };
        const nextComparable = { ...nextDraft, updatedAt: null, lastSource: 'calculator' };
        if (JSON.stringify(currentComparable) === JSON.stringify(nextComparable)) {
            return current;
        }

        return {
            ...current,
            cargoVolumeCBM: nextDraft.cargoVolumeCBM,
            palletQuantity: nextDraft.palletQuantity,
            deckHeight: nextDraft.deckHeight,
            targetTemperatureCelsius: nextDraft.targetTemperatureCelsius,
            requiresControlledAtmosphere: nextDraft.requiresControlledAtmosphere,
            auxiliaryGensetDailyCost: nextDraft.auxiliaryGensetDailyCost,
            draft: {
                ...nextDraft,
                updatedAt: new Date().toISOString(),
            },
        };
    }),
    patchSection2Vessel: (vesselData = {}) => set((current) => {
        const raw = vesselData && typeof vesselData === 'object' ? vesselData : {};
        const normalizedVessel = normalizeVessel(raw) || {};
        const existingVessel = current.draft.vessel || {};
        const updatedVessel = {
            ...existingVessel,
            name: normalizedVessel.name || existingVessel.name || cleanText(raw.vesselName || raw.vessel_name || raw.name || raw.nombre),
            imo: normalizedVessel.imo || existingVessel.imo || cleanText(raw.imo || raw.imoNumber || raw.imo_number).replace(/\D/g, ''),
            mmsi: normalizedVessel.mmsi || existingVessel.mmsi || cleanText(raw.mmsi).replace(/\D/g, ''),
            dwt: normalizedVessel.dwt || existingVessel.dwt || cleanNumber(raw.dwt || raw.vesselDwt),
            loa: cleanNonNegativeNumber(raw.loa || raw.loaMeters || raw.loa_meters) ?? (existingVessel.loa ?? null),
            loa_meters: cleanNonNegativeNumber(raw.loa_meters || raw.loa || raw.loaMeters) ?? (existingVessel.loa_meters ?? existingVessel.loa ?? null),
            beam: cleanNonNegativeNumber(raw.beam || raw.beamMeters || raw.beam_meters) ?? (existingVessel.beam ?? null),
            beam_meters: cleanNonNegativeNumber(raw.beam_meters || raw.beam || raw.beamMeters) ?? (existingVessel.beam_meters ?? existingVessel.beam ?? null),
            draft: cleanNonNegativeNumber(raw.draft || raw.draftMeters || raw.draft_meters) ?? (existingVessel.draft ?? null),
            draft_meters: cleanNonNegativeNumber(raw.draft_meters || raw.draft || raw.draftMeters) ?? (existingVessel.draft_meters ?? existingVessel.draft ?? null),
            speedKnots: normalizedVessel.speedKnots ?? existingVessel.speedKnots ?? cleanNonNegativeNumber(raw.speedKnots ?? raw.service_speed_knots ?? raw.serviceSpeedKnots ?? raw.speed ?? raw.speedBallast ?? raw.spd_ballast ?? raw.sog),
            service_speed_knots: cleanNonNegativeNumber(raw.service_speed_knots ?? raw.serviceSpeedKnots ?? raw.speedKnots ?? raw.speed) ?? (existingVessel.service_speed_knots ?? existingVessel.speedKnots ?? null),
            speed_laden: cleanNonNegativeNumber(raw.spd_laden ?? raw.speed_laden ?? raw.speedLaden ?? raw.service_speed_knots ?? raw.serviceSpeedKnots) ?? (existingVessel.speed_laden ?? null),
            speed_ballast: cleanNonNegativeNumber(raw.spd_ballast ?? raw.speed_ballast ?? raw.speedBallast ?? raw.service_speed_knots ?? raw.serviceSpeedKnots) ?? (existingVessel.speed_ballast ?? null),
            fuel_consumption_laden: cleanNonNegativeNumber(raw.fuel_consumption_laden ?? raw.cons_sea ?? raw.consSea ?? raw.fuelConsumptionLaden) ?? (existingVessel.fuel_consumption_laden ?? null),
            fuel_consumption_ballast: cleanNonNegativeNumber(raw.fuel_consumption_ballast ?? raw.cons_ballast ?? raw.consBallast ?? raw.fuelConsumptionBallast ?? raw.fuel_consumption_laden ?? raw.cons_sea ?? raw.consSea) ?? (existingVessel.fuel_consumption_ballast ?? null),
            fuel_consumption_port: cleanNonNegativeNumber(raw.fuel_consumption_port ?? raw.cons_port ?? raw.consPort ?? raw.fuelConsumptionPort) ?? (existingVessel.fuel_consumption_port ?? null),
            gt: normalizedVessel.gt || existingVessel.gt || cleanNumber(raw.gt ?? raw.grossTonnage ?? raw.gross_tonnage),
            gross_tonnage: cleanNumber(raw.gross_tonnage ?? raw.grossTonnage ?? raw.gt ?? existingVessel.gross_tonnage ?? existingVessel.gt),
            net_tonnage: cleanNumber(raw.net_tonnage ?? raw.netTonnage ?? raw.nt ?? existingVessel.net_tonnage),
            flag: normalizedVessel.flag || existingVessel.flag || cleanText(raw.flag),
            yearBuilt: normalizedVessel.yearBuilt || existingVessel.yearBuilt || cleanNumber(raw.yearBuilt ?? raw.year_built),
            year_built: cleanNumber(raw.year_built ?? raw.yearBuilt ?? raw.built_year ?? raw.builtYear ?? existingVessel.year_built ?? existingVessel.yearBuilt),
            owner_manager: cleanText(raw.owner_manager ?? raw.ownerManager ?? raw.gestor ?? raw.manager ?? existingVessel.owner_manager),
            vessel_class: cleanText(raw.vessel_class ?? raw.vesselClass ?? raw.commercial_class ?? raw.commercialClass ?? raw.vessel_type ?? raw.vesselType ?? existingVessel.vessel_class),
            has_gears: raw.has_gears ?? raw.hasGears ?? existingVessel.has_gears ?? null,
            has_scrubber: raw.has_scrubber ?? raw.hasScrubber ?? existingVessel.has_scrubber ?? null,
            latitude: normalizedVessel.latitude ?? existingVessel.latitude ?? null,
            longitude: normalizedVessel.longitude ?? existingVessel.longitude ?? null,
            positionUpdatedAt: normalizedVessel.positionUpdatedAt || existingVessel.positionUpdatedAt || new Date().toISOString(),
        };
        const nextDwt = updatedVessel.dwt || current.draft.dwt;
        const nextDraft = {
            ...current.draft,
            vessel: updatedVessel,
            dwt: nextDwt,
            loa_meters: updatedVessel.loa_meters ?? updatedVessel.loa ?? current.draft.loa_meters,
            beam_meters: updatedVessel.beam_meters ?? updatedVessel.beam ?? current.draft.beam_meters,
            draft_meters: updatedVessel.draft_meters ?? updatedVessel.draft ?? current.draft.draft_meters,
            fuel_consumption_laden: updatedVessel.fuel_consumption_laden ?? current.draft.fuel_consumption_laden,
            fuel_consumption_ballast: updatedVessel.fuel_consumption_ballast ?? current.draft.fuel_consumption_ballast,
            fuel_consumption_port: updatedVessel.fuel_consumption_port ?? current.draft.fuel_consumption_port,
            service_speed_knots: updatedVessel.service_speed_knots ?? updatedVessel.speedKnots ?? current.draft.service_speed_knots,
            speed_laden: updatedVessel.speed_laden ?? current.draft.speed_laden,
            speed_ballast: updatedVessel.speed_ballast ?? current.draft.speed_ballast,
            gross_tonnage: updatedVessel.gross_tonnage ?? updatedVessel.gt ?? current.draft.gross_tonnage,
            year_built: updatedVessel.year_built ?? updatedVessel.yearBuilt ?? current.draft.year_built,
            owner_manager: updatedVessel.owner_manager || current.draft.owner_manager,
            vessel_class: updatedVessel.vessel_class || current.draft.vessel_class,
            flag: updatedVessel.flag || current.draft.flag,
            has_gears: updatedVessel.has_gears ?? current.draft.has_gears,
            has_scrubber: updatedVessel.has_scrubber ?? current.draft.has_scrubber,
            lastSource: 'databridge-vessel-patch',
        };

        const currentComparable = { ...current.draft, updatedAt: null, lastSource: 'databridge-vessel-patch' };
        const nextComparable = { ...nextDraft, updatedAt: null, lastSource: 'databridge-vessel-patch' };
        if (JSON.stringify(currentComparable) === JSON.stringify(nextComparable)) {
            return current;
        }

        return {
            draft: {
                ...nextDraft,
                updatedAt: new Date().toISOString(),
            },
        };
    }),
    applyVesselRecord: (vesselData = {}) => get().patchSection2Vessel(vesselData),
    setBallastDistance: ({ ballastDistanceNm, source = 'calculator-manual' } = {}) => set((current) => {
        const normalizedDistance = cleanNonNegativeNumber(ballastDistanceNm);
        if (normalizedDistance === null) return current;
        const normalizedSource = cleanText(source) || 'calculator-manual';
        if (current.draft.ballastDistanceNm === normalizedDistance && current.draft.ballastDistanceSource === normalizedSource) {
            return current;
        }
        return {
            draft: {
                ...current.draft,
                ballastDistanceNm: normalizedDistance,
                ballastDistanceSource: normalizedSource,
                updatedAt: new Date().toISOString(),
                lastSource: normalizedSource,
            },
        };
    }),
    applyTrackingAudit: ({ ballastDistanceNm, lastreCoordinates, vessel } = {}) => set((current) => {
        const normalizedDistance = cleanNonNegativeNumber(ballastDistanceNm);
        const normalizedCoordinates = normalizeRouteCoordinates(lastreCoordinates);
        const nextDraft = {
            ...current.draft,
            ballastDistanceNm: normalizedDistance ?? current.draft.ballastDistanceNm,
            ballastDistanceSource: normalizedDistance !== null
                ? 'tracking-audit'
                : current.draft.ballastDistanceSource,
            lastreCoordinates: normalizedCoordinates.length >= 2 ? normalizedCoordinates : current.draft.lastreCoordinates,
            vessel: normalizeVessel(vessel) || current.draft.vessel,
            lastSource: 'tracking-audit',
        };

        const currentComparable = { ...current.draft, updatedAt: null, lastSource: 'tracking-audit' };
        const nextComparable = { ...nextDraft, updatedAt: null, lastSource: 'tracking-audit' };
        if (JSON.stringify(currentComparable) === JSON.stringify(nextComparable)) {
            return current;
        }

        return {
            draft: {
                ...nextDraft,
                updatedAt: new Date().toISOString(),
            },
        };
    }),
    applyMatchingCandidate: ({ ballastDistanceNm, lastreCoordinates, vessel } = {}) => set((current) => {
        const normalizedDistance = cleanNonNegativeNumber(ballastDistanceNm);
        const normalizedCoordinates = normalizeRouteCoordinates(lastreCoordinates);
        const nextDraft = {
            ...current.draft,
            ballastDistanceNm: normalizedDistance ?? current.draft.ballastDistanceNm,
            ballastDistanceSource: normalizedDistance !== null
                ? 'matching-neon-maritime'
                : current.draft.ballastDistanceSource,
            lastreCoordinates: normalizedCoordinates.length >= 2 ? normalizedCoordinates : current.draft.lastreCoordinates,
            vessel: normalizeVessel(vessel) || current.draft.vessel,
            lastSource: 'matching-neon-maritime',
        };

        const currentComparable = { ...current.draft, updatedAt: null, lastSource: 'matching-neon-maritime' };
        const nextComparable = { ...nextDraft, updatedAt: null, lastSource: 'matching-neon-maritime' };
        if (JSON.stringify(currentComparable) === JSON.stringify(nextComparable)) {
            return current;
        }

        return {
            draft: {
                ...nextDraft,
                updatedAt: new Date().toISOString(),
            },
        };
    }),
    applyTrackingRoute: ({ distanceNm, routeGeometry, ballastDistanceNm, lastreCoordinates } = {}) => set((current) => {
        const normalizedBallastDistance = cleanNonNegativeNumber(ballastDistanceNm);
        const normalizedCoordinates = normalizeRouteCoordinates(lastreCoordinates);
        const nextDraft = {
            ...current.draft,
            ballastDistanceNm: normalizedBallastDistance ?? current.draft.ballastDistanceNm,
            ballastDistanceSource: normalizedBallastDistance !== null
                ? 'tracking-route'
                : current.draft.ballastDistanceSource,
            lastreCoordinates: normalizedCoordinates.length >= 2 ? normalizedCoordinates : current.draft.lastreCoordinates,
            distanceNm: cleanNumber(distanceNm) || current.draft.distanceNm,
            routeGeometry: routeGeometry && typeof routeGeometry === 'object' ? routeGeometry : current.draft.routeGeometry,
            lastSource: 'tracking-route',
        };

        const currentComparable = { ...current.draft, updatedAt: null, lastSource: 'tracking-route' };
        const nextComparable = { ...nextDraft, updatedAt: null, lastSource: 'tracking-route' };
        if (JSON.stringify(currentComparable) === JSON.stringify(nextComparable)) {
            return current;
        }

        return {
            draft: {
                ...nextDraft,
                updatedAt: new Date().toISOString(),
            },
        };
    }),
    setWeatherSnapshot: (weather = null) => set((current) => {
        const normalizedWeather = weather && typeof weather === 'object' ? weather : null;
        if (JSON.stringify(current.draft.weather) === JSON.stringify(normalizedWeather)) return current;
        return {
            draft: {
                ...current.draft,
                weather: normalizedWeather,
                updatedAt: new Date().toISOString(),
            },
        };
    }),
    patchVesselData: (vesselData = {}) => get().patchSection2Vessel(vesselData),
    clearDraft: () => set({
        cargoVolumeCBM: 0,
        palletQuantity: 0,
        deckHeight: 2.2,
        targetTemperatureCelsius: 13.0,
        requiresControlledAtmosphere: false,
        auxiliaryGensetDailyCost: 0,
        draft: { ...EMPTY_DRAFT, laycan: { ...EMPTY_DRAFT.laycan }, cargo: { ...EMPTY_DRAFT.cargo }, projectCargo: { ...EMPTY_DRAFT.projectCargo, dimensions: { ...EMPTY_DRAFT.projectCargo.dimensions } } },
    }),
    hasOperationalDraft: () => hasOperationalDraft(get().draft),
})));

if (typeof window !== 'undefined') {
    window.voyageStore = voyageStore;
    window.VoyageStore = voyageStore;
    window.useVoyageStore = voyageStore;
}

export const useVoyageStore = voyageStore;
