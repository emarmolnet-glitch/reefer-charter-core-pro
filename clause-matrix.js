/**
 * Matriz Bidireccional de Cláusulas Operativas y Legales (Owner vs Charterer)
 *
 * Proporciona cláusulas estipuladas dinámicas en función del tipo de carga (ej. Plátanos / Bananas)
 * y de la perspectiva comercial asumida (Armador / Owner vs Fletador / Charterer).
 */

export const DEFAULT_CHARTER_PARTY = "BIMCO REEFERCON 94";

export const CLAUSE_MATRIX = Object.freeze({
    "Bananas / Tropical Fruits": Object.freeze({
        owner_terms: Object.freeze([
            "Loading rates strictly guaranteed at 1,500 MT/WWD and discharging at 2,000 MT/WWD. All port and stevedoring overtime for Charterers' account.",
            "Pallets strictly limited to a maximum height of 2.20m. Charterers/Shippers are entirely responsible for safe handling, compact stowage with dunnage, and leaving gratings unobstructed.",
            "All loading and discharging operations are at Charterers' risk and expense."
        ]),
        charterer_terms: Object.freeze([
            "Prior to NOR, holds must be pre-cooled to 13.5ºC, completely clean, dry, and absolutely free of taint, subject to independent surveyor approval.",
            "Owners fully guarantee constant carrying temperature of 13.5ºC and required fresh air exchanges to prevent ethylene buildup.",
            "Master to provide full temperature datalogs upon completion of discharge."
        ])
    }),
    "Citrus Fruits": Object.freeze({
        owner_terms: Object.freeze([
            "Loading and discharging under WWD SHINC terms. Temperature maintenance range +4.0ºC to +6.0ºC.",
            "Shippers to ensure proper carton venting and pallet securing prior to loading.",
            "All dunnage, lashing, and shore cranes at Charterers' expense."
        ]),
        charterer_terms: Object.freeze([
            "Vessel holds to be thoroughly pre-cooled to +4.0ºC and certified clean by surveyor prior to NOR.",
            "Continuous cold treatment (CT) logging maintained by vessel and submitted daily to Charterers.",
            "Owners to replace any cartons damaged by improper crew handling or mechanical failure."
        ])
    }),
    "Frozen Fish / Meat": Object.freeze({
        owner_terms: Object.freeze([
            "Deep freeze carriage guaranteed at -20.0ºC. Loading rates subject to port cold storage throughput.",
            "Cargo to be delivered in sound frozen condition; Master may reject thawed packages.",
            "Stevedoring damage and refrigeration delays at berth for Charterers' account unless vessel equipment breakdown."
        ]),
        charterer_terms: Object.freeze([
            "Holds to be pre-cooled to -22.0ºC prior to loading commencement and inspected for cleanliness.",
            "Owners guarantee temperature maintenance at -20.0ºC or below throughout voyage without fluctuation exceeding 1.5ºC.",
            "Full thermograph charts and datalogger records to be handed over immediately at discharge port."
        ])
    }),
    "General Cargo": Object.freeze({
        owner_terms: Object.freeze([
            "Loading and discharging under FIOST terms. All stevedoring and lashing for Charterers' account.",
            "Cargo to be presented in seaworthy packing suitable for ocean carriage.",
            "Demurrage payable at agreed daily rate pro rata for any time lost at ports."
        ]),
        charterer_terms: Object.freeze([
            "Vessel's holds to be swept clean, dry, and odor-free, ready in all respects to receive cargo.",
            "Vessel's gear to be fully operational with valid test certificates provided before loading.",
            "Owners guarantee seaworthiness and cargo care in accordance with Hague-Visby rules."
        ])
    })
});

/**
 * Normaliza y resuelve la categoría de carga en base a nombre, descripción o código.
 * @param {string|object} cargoInput
 * @returns {string} Clave canónica dentro de CLAUSE_MATRIX
 */
export function resolveCargoKey(cargoInput) {
    if (!cargoInput) return "Bananas / Tropical Fruits";

    let rawString = '';
    if (typeof cargoInput === 'string') {
        rawString = cargoInput;
    } else if (typeof cargoInput === 'object') {
        rawString = [
            cargoInput.product,
            cargoInput.type,
            cargoInput.commodity,
            cargoInput.name,
            cargoInput.category,
            cargoInput.cargoProduct,
            cargoInput.cargoType
        ].filter(Boolean).join(' ');
    }

    const normalized = rawString.toLowerCase().trim();

    // Frutas tropicales / Plátanos / Bananas
    if (
        normalized.includes("banana") ||
        normalized.includes("platano") ||
        normalized.includes("plátano") ||
        normalized.includes("tropical") ||
        normalized.includes("piña") ||
        normalized.includes("pina") ||
        normalized.includes("aguacate") ||
        normalized.includes("mango") ||
        normalized === "10"
    ) {
        return "Bananas / Tropical Fruits";
    }

    // Cítricos
    if (
        normalized.includes("citric") ||
        normalized.includes("cítric") ||
        normalized.includes("naranja") ||
        normalized.includes("limon") ||
        normalized.includes("limón") ||
        normalized.includes("mandarina")
    ) {
        return "Citrus Fruits";
    }

    // Congelados (Pescados / Carnes)
    if (
        normalized.includes("congelad") ||
        normalized.includes("pescad") ||
        normalized.includes("carne") ||
        normalized.includes("pollo") ||
        normalized.includes("frozen") ||
        normalized.includes("meat") ||
        normalized.includes("fish") ||
        normalized === "20"
    ) {
        return "Frozen Fish / Meat";
    }

    // Carga General / Siderúrgicos / Graneles
    if (
        normalized.includes("general") ||
        normalized.includes("granel") ||
        normalized.includes("siderurg") ||
        normalized.includes("acero") ||
        normalized.includes("bulk") ||
        normalized.includes("breakbulk")
    ) {
        return "General Cargo";
    }

    // Comprobación exacta con las claves declaradas
    for (const key of Object.keys(CLAUSE_MATRIX)) {
        if (key.toLowerCase() === normalized) return key;
    }

    return "Bananas / Tropical Fruits";
}

/**
 * Resuelve el rol comercial (Owner vs Charterer) evaluando el contexto, estado o margen.
 * @param {string|object} contextOrRole
 * @returns {'owner'|'charterer'}
 */
export function resolveCommercialRole(contextOrRole) {
    if (typeof contextOrRole === 'string') {
        const norm = contextOrRole.toLowerCase().trim();
        if (norm.includes('charterer') || norm.includes('fletador') || norm.includes('chr')) {
            return 'charterer';
        }
        if (norm.includes('owner') || norm.includes('armador') || norm.includes('own')) {
            return 'owner';
        }
    }

    if (contextOrRole && typeof contextOrRole === 'object') {
        const explicitRole = contextOrRole.role ||
            contextOrRole.perspective ||
            contextOrRole.commercialRole ||
            contextOrRole.viewMode ||
            contextOrRole.globalViewMode ||
            contextOrRole.mode;

        if (explicitRole) {
            const norm = String(explicitRole).toLowerCase().trim();
            if (norm.includes('charterer') || norm.includes('fletador') || norm.includes('chr')) {
                return 'charterer';
            }
            if (norm.includes('owner') || norm.includes('armador') || norm.includes('own')) {
                return 'owner';
            }
        }

        // Selección por margen aplicado
        if (contextOrRole.activeMargin === 'charterer' || contextOrRole.activeMargin === 'fletador') {
            return 'charterer';
        }
        if (contextOrRole.activeMargin === 'owner' || contextOrRole.activeMargin === 'armador') {
            return 'owner';
        }

        if (
            Number(contextOrRole.chartererMarginPercent) > 0 &&
            (!contextOrRole.ownerMarginPercent || Number(contextOrRole.ownerMarginPercent) === 0)
        ) {
            return 'charterer';
        }
    }

    // Lectura del estado global del cliente si está disponible en el DOM
    if (typeof window !== 'undefined') {
        if (typeof window.getGlobalViewMode === 'function') {
            const mode = window.getGlobalViewMode();
            if (mode === 'charterer') return 'charterer';
            if (mode === 'owner') return 'owner';
        }
        if (window.globalViewMode === 'charterer') return 'charterer';
        if (typeof document !== 'undefined') {
            if (document.body?.dataset?.globalViewMode === 'charterer') return 'charterer';
            const btnChr = document.getElementById('btn-view-mode-charterer');
            if (btnChr && btnChr.getAttribute('aria-pressed') === 'true') {
                return 'charterer';
            }
        }
    }

    return 'owner';
}

/**
 * Devuelve el título dinámico estipulado para la sección del PDF según el rol comercial.
 * @param {'owner'|'charterer'|string} role
 * @returns {string}
 */
export function getClauseSectionTitle(role) {
    const resolvedRole = resolveCommercialRole(role);
    return resolvedRole === 'charterer'
        ? "STIPULATED OPERATIONAL CLAUSES (CHARTERERS' TERMS)"
        : "STIPULATED OPERATIONAL CLAUSES (OWNERS' TERMS)";
}

/**
 * Obtiene el paquete completo de cláusulas operativas estipuladas y título dinámico.
 * @param {object} params
 * @param {string|object} [params.cargo]
 * @param {string} [params.commodity]
 * @param {string} [params.cargoType]
 * @param {string} [params.cargoProduct]
 * @param {'owner'|'charterer'|string} [params.role]
 * @param {string} [params.perspective]
 * @param {string} [params.mode]
 * @returns {{ title: string, role: 'owner'|'charterer', cargoKey: string, clauses: string[] }}
 */
export function getOperationalClauses(params = {}) {
    const cargoInput = params.cargo ?? params.cargoProduct ?? params.cargoType ?? params.commodity;
    const cargoKey = resolveCargoKey(cargoInput);
    const matrixEntry = CLAUSE_MATRIX[cargoKey] || CLAUSE_MATRIX["Bananas / Tropical Fruits"];

    const roleInput = params.role ?? params.perspective ?? params.mode ?? params.commercialRole ?? params;
    const resolvedRole = resolveCommercialRole(roleInput);

    const termsKey = resolvedRole === 'charterer' ? 'charterer_terms' : 'owner_terms';
    const rawClauses = matrixEntry[termsKey] || matrixEntry.owner_terms;

    return {
        title: getClauseSectionTitle(resolvedRole),
        role: resolvedRole,
        cargoKey,
        clauses: [...rawClauses]
    };
}

// Exponer en entorno global de navegador si está disponible
if (typeof window !== 'undefined') {
    window.DEFAULT_CHARTER_PARTY = DEFAULT_CHARTER_PARTY;
    window.CLAUSE_MATRIX = CLAUSE_MATRIX;
    window.resolveCargoKey = resolveCargoKey;
    window.resolveCommercialRole = resolveCommercialRole;
    window.getClauseSectionTitle = getClauseSectionTitle;
    window.getOperationalClauses = getOperationalClauses;
}
