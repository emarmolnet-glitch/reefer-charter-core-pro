const MARKET_DATA_ENDPOINT = '/api/get-market-data';
const MARKET_INTELLIGENCE_EVENT = 'seacharter:market-intelligence-hydrated';
const CACHE_KEY = 'seacharter_market_intelligence_snapshot_v1';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export const MARKET_VESSEL_CLASSES = Object.freeze([
  Object.freeze({ key: 'capesize', label: 'Capesize' }),
  Object.freeze({ key: 'panamax', label: 'Panamax' }),
  Object.freeze({ key: 'supramax', label: 'Supramax' }),
  Object.freeze({ key: 'handysize', label: 'Handysize' }),
  Object.freeze({ key: 'small_reefer', label: 'Small Reefer' }),
  Object.freeze({ key: 'medium_reefer', label: 'Medium Reefer' }),
  Object.freeze({ key: 'large_reefer', label: 'Large Reefer' }),
  Object.freeze({ key: 'mega_reefer', label: 'Mega Reefer' }),
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function asNumber(value, { positive = false } = {}) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/[$,%]/g, '').trim());
  if (!Number.isFinite(parsed)) return null;
  return positive && parsed <= 0 ? null : parsed;
}

function asText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function firstDefined(...values) {
  return values.find(value => value !== null && value !== undefined && value !== '');
}

function readPath(source, path) {
  return path.split('.').reduce((current, key) => current?.[key], source);
}

function firstPath(source, paths) {
  return firstDefined(...paths.map(path => readPath(source, path)));
}

function unwrapPayload(payload) {
  let current = payload;
  for (let depth = 0; depth < 4; depth += 1) {
    const object = asObject(current);
    if (!object) break;
    const nested = asObject(object.data) || asObject(object.market_data) || asObject(object.marketData) || asObject(object.snapshot) || asObject(object.market_intel_reefer);
    if (!nested) break;
    current = nested;
  }
  return asObject(current) || {};
}

function findClassRecord(record, key, label) {
  const containers = [
    record.predictive_v2?.metrics,
    record.predictiveV2?.metrics,
    record.predictive_v2,
    record.predictiveV2,
    record.tce_spot_by_class,
    record.tceSpotByClass,
    record.tce_spot,
    record.tceSpot,
    record.theoretical_spot_tce,
    record.theoreticalSpotTce,
    record.market_intelligence,
    record.marketIntelligence,
    record.freight_market,
    record.freightMarket,
    record.segments,
  ];

  for (const containerValue of containers) {
    if (Array.isArray(containerValue)) {
      const match = containerValue.find(entry => {
        const vesselClass = asText(entry?.vessel_class ?? entry?.vesselClass ?? entry?.class ?? entry?.name ?? entry?.key).toLowerCase();
        return vesselClass === key || vesselClass === label.toLowerCase() || vesselClass.includes(key);
      });
      if (match) return asObject(match);
      continue;
    }

    const container = asObject(containerValue);
    if (!container) continue;
    const match = asObject(container[key])
      || asObject(container[label])
      || asObject(container[label.toLowerCase()])
      || asObject(container[key.toUpperCase()]);
    if (match) return match;
  }

  return null;
}

function normalizeTceSpotClass(record, definition) {
  const { key, label } = definition;
  const classRecord = findClassRecord(record, key, label) || {};
  const predictiveMetric = record.predictive_v2?.metrics?.[key]
    || record.predictive_v2?.metrics?.[label]
    || record.predictive_v2?.metrics?.[label.toLowerCase()]
    || record.predictive_v2?.metrics?.[key.toUpperCase()]
    || record.predictiveV2?.metrics?.[key]
    || record.predictiveV2?.metrics?.[label]
    || record.predictiveV2?.metrics?.[label.toLowerCase()]
    || record.predictiveV2?.metrics?.[key.toUpperCase()]
    || record.predictive_v2?.[key]
    || record.predictive_v2?.[label]
    || record.predictiveV2?.[key]
    || record.predictiveV2?.[label];

  const theoreticalSpotTce = asNumber(firstDefined(
    predictiveMetric?.tceSpot,
    predictiveMetric?.tce_spot,
    predictiveMetric?.tcePredictiveUsd,
    predictiveMetric?.tce_predictive_usd,
    predictiveMetric?.tceSpotTeorico,
    predictiveMetric?.tce_spot_teorico,
    classRecord.tceSpot,
    classRecord.tce_spot,
    classRecord.tcePredictiveUsd,
    classRecord.tce_predictive_usd,
    classRecord.tceSpotTeorico,
    classRecord.tce_spot_teorico,
    classRecord.value,
    record[`${key}_tce_spot_teorico`],
    record[`${key}_tce_spot`],
    record[`${key}_tc`],
  ), { positive: true });

  const baseTc = asNumber(firstDefined(
    classRecord.rateCentsCbftMonth,
    classRecord.rate_cents_cbft_month,
    classRecord.base_tc,
    classRecord.baseTc,
    classRecord.tc,
    record[`${key}_tc`],
    predictiveMetric?.baseTc,
    predictiveMetric?.base_tc,
    theoreticalSpotTce,
  ), { positive: true });

  const baseTcChangePct = asNumber(firstDefined(
    predictiveMetric?.changePct,
    predictiveMetric?.change_pct,
    classRecord.base_tc_change_pct,
    classRecord.baseTcChangePct,
    classRecord.change_pct,
    classRecord.changePct,
    record[`${key}_change_pct`],
  ));

  const spreadUsd = asNumber(firstDefined(
    predictiveMetric?.spreadUsd,
    predictiveMetric?.spread_usd,
    classRecord.spread_usd,
    classRecord.spreadUsd,
    record[`${key}_spread_usd`],
  ));

  const spreadPct = asNumber(firstDefined(
    predictiveMetric?.spreadPct,
    predictiveMetric?.spread_pct,
    classRecord.spread_pct,
    classRecord.spreadPct,
    record[`${key}_spread_pct`],
  ));

  const updatedAt = asText(firstDefined(
    predictiveMetric?.updatedAt,
    predictiveMetric?.updated_at,
    classRecord.updated_at,
    classRecord.updatedAt,
    record.tc_updated_at,
    record.updated_at,
    record.created_at,
  ));

  const status = asText(firstDefined(
    predictiveMetric?.status,
    classRecord.status,
    theoreticalSpotTce !== null ? 'LIVE' : 'UNAVAILABLE',
  )).toUpperCase();

  return Object.freeze({
    vesselClass: label,
    baseTc,
    baseTcChangePct,
    theoreticalSpotTce,
    spreadUsd,
    spreadPct,
    status,
    updatedAt,
  });
}

function normalizeBdi(record) {
  const nested = asObject(record.bdi) || asObject(record.baltic_dry_index) || asObject(record.balticDryIndex) || {};
  const value = asNumber(firstDefined(
    nested.value,
    nested.index,
    nested.bdi_index,
    record.bdi_index,
    record.bdiIndex,
  ), { positive: true });
  const updatedAt = asText(firstDefined(
    nested.updated_at,
    nested.updatedAt,
    record.bdi_updated_at,
    record.updated_at,
    record.created_at,
    record.date,
  ));
  const status = asText(firstDefined(nested.status, record.bdi_status, value !== null ? 'LIVE' : 'UNAVAILABLE')).toUpperCase();
  return Object.freeze({ value, updatedAt, status });
}

function normalizeBunkers(record) {
  const nested = asObject(record.bunkers) || asObject(record.bunker) || asObject(record.fuels) || {};
  const vlsfo = asNumber(firstDefined(nested.vlsfo_usd_mt, nested.vlsfo, nested.VLSFO, record.vlsfo, record.bunker_price_vlsfo), { positive: true });
  const hsfo = asNumber(firstDefined(nested.hsfo_usd_mt, nested.hsfo, nested.HSFO, record.hsfo, record.bunker_price_hsfo), { positive: true });
  const mgo = asNumber(firstDefined(nested.mgo_usd_mt, nested.mgo, nested.MGO, record.mgo, record.bunker_price_mgo), { positive: true });
  const updatedAt = asText(firstDefined(
    nested.updated_at,
    nested.updatedAt,
    record.vlsfo_updated_at,
    record.updated_at,
    record.created_at,
    record.date,
  ));
  const status = asText(firstDefined(nested.status, record.bunker_status, vlsfo !== null ? 'LIVE' : 'UNAVAILABLE')).toUpperCase();
  return Object.freeze({ vlsfo, hsfo, mgo, updatedAt, status });
}

export function normalizeMarketIntelligencePayload(payload, receivedAt = new Date().toISOString()) {
  const record = unwrapPayload(payload);
  const tceSpotByClass = Object.freeze(Object.fromEntries(
    MARKET_VESSEL_CLASSES.map(definition => [definition.label, normalizeTceSpotClass(record, definition)]),
  ));
  const bdi = normalizeBdi(record);
  const bunkers = normalizeBunkers(record);

  // Parámetros específicos de Reefer absorbidos desde Data Bridge
  const reeferSeasonalIndex = asNumber(firstDefined(record.reefer_seasonal_index, record.reeferSeasonalIndex));
  const reeferAeConsumptionAvg = asNumber(firstDefined(record.reefer_ae_consumption_avg, record.reeferAeConsumptionAvg));

  const dataBridgeStatus = asText(firstDefined(
    record.status,
    record.data_bridge_status,
    payload?.status,
  )).toUpperCase();
  const sourceId = asText(firstPath(record, ['snapshot_id', 'snapshotId', 'id', 'version']));
  const snapshotId = sourceId || [bdi.updatedAt, bunkers.updatedAt, receivedAt].filter(Boolean).join('|');
  const hasTceSpot = Object.values(tceSpotByClass).some(entry => entry.theoreticalSpotTce !== null);
  const hasMarketData = hasTceSpot || bdi.value !== null || bunkers.vlsfo !== null;

  return Object.freeze({
    snapshotId,
    receivedAt,
    tceSpotByClass,
    bdi,
    bunkers,
    reeferSeasonalIndex,
    reeferAeConsumptionAvg,
    dataBridgeStatus,
    source: asText(firstDefined(record.source, payload?.source, 'Data Bridge')),
    status: hasMarketData ? 'ready' : 'partial',
  });
}

function freezeState(state) {
  return Object.freeze({ ...state });
}

export function createMarketIntelligenceHydration({
  fetchImpl = globalThis.fetch,
  storage = globalThis.localStorage,
  eventTarget = globalThis.window,
  endpoint = MARKET_DATA_ENDPOINT,
} = {}) {
  let state = freezeState({ status: 'idle', snapshot: null, error: null });
  let activeRequest = null;
  const subscribers = new Set();

  const publish = nextState => {
    state = freezeState(nextState);
    subscribers.forEach(subscriber => subscriber(state));
    eventTarget?.dispatchEvent?.(new CustomEvent(MARKET_INTELLIGENCE_EVENT, { detail: state }));
    return state;
  };

  const readCache = () => {
    if (!storage?.getItem) return null;
    try {
      const cached = JSON.parse(storage.getItem(CACHE_KEY) || 'null');
      return cached?.snapshot ? cached.snapshot : null;
    } catch {
      return null;
    }
  };

  const writeCache = snapshot => {
    if (!storage?.setItem) return;
    try {
      storage.setItem(CACHE_KEY, JSON.stringify({ snapshot }));
    } catch {
      return;
    }
  };

  const hydrateFromCache = () => {
    const cachedSnapshot = readCache();
    if (!cachedSnapshot) return null;
    const snapshot = Object.freeze({ ...cachedSnapshot, status: 'stale' });
    publish({ status: 'stale', snapshot, error: null });
    return snapshot;
  };

  const refresh = ({ force = false } = {}) => {
    if (activeRequest) return activeRequest;
    publish({ status: 'loading', snapshot: state.snapshot, error: null });
    activeRequest = Promise.resolve(fetchImpl(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    }))
      .then(async response => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || `Market Intelligence HTTP ${response.status}`);
        const snapshot = normalizeMarketIntelligencePayload(payload);
        writeCache(snapshot);
        publish({ status: snapshot.status, snapshot, error: null });

        if (typeof globalThis.window !== 'undefined') {
          globalThis.window.__marketIntelReeferSnapshot = snapshot;
          globalThis.window.dispatchEvent?.(new CustomEvent('market-intel-reefer:hydrated', { detail: snapshot }));
        }

        return snapshot;
      })
      .catch(error => {
        const fallbackStatus = state.snapshot ? 'stale' : 'error';
        publish({ status: fallbackStatus, snapshot: state.snapshot, error });
        throw error;
      })
      .finally(() => {
        activeRequest = null;
      });
    return activeRequest;
  };

  const subscribe = subscriber => {
    subscribers.add(subscriber);
    subscriber(state);
    return () => subscribers.delete(subscriber);
  };

  return Object.freeze({
    endpoint,
    eventName: MARKET_INTELLIGENCE_EVENT,
    getState: () => state,
    getSnapshot: () => state.snapshot,
    hydrateFromCache,
    refresh,
    subscribe,
  });
}

function initializeGlobalHydration() {
  const hydration = createMarketIntelligenceHydration();
  window.MarketIntelligenceHydration = hydration;
  hydration.hydrateFromCache();
  hydration.refresh().catch(() => {});
  window.setInterval(() => {
    if (document.visibilityState === 'visible') hydration.refresh().catch(() => {});
  }, REFRESH_INTERVAL_MS);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGlobalHydration, { once: true });
  } else {
    initializeGlobalHydration();
  }
}
