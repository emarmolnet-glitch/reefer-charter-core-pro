const indexFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

let latestSnapshot = null;
let lastObservedVesselType = '';

function formatDate(value) {
  if (!value) return 'Fecha no disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date);
}

function getSelectedVesselClass() {
  const vesselType = String(document.getElementById('vessel-badge')?.textContent || '').trim().toLowerCase();
  if (vesselType.includes('small')) return 'Small Reefer';
  if (vesselType.includes('medium')) return 'Medium Reefer';
  if (vesselType.includes('large')) return 'Large Reefer';
  if (vesselType.includes('mega')) return 'Mega Reefer';
  return 'Medium Reefer'; // Valor por defecto para reefers
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
  return element;
}

function statusTone(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized.includes('LIVE') || normalized.includes('READY') || normalized.includes('AUTO')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (normalized.includes('MANUAL') || normalized.includes('STALE') || normalized.includes('DEGRA')) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-slate-200 bg-slate-100 text-slate-500';
}

function renderStatus(id, label, layoutClass = '') {
  const element = setText(id, label || 'No disponible');
  if (element) {
    element.className = `${layoutClass} rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wide ${statusTone(label)}`.trim();
  }
}

function renderReeferIndex(snapshot) {
  const seasonalIdx = snapshot?.reeferSeasonalIndex ?? 108;
  setText('baltic-spot-index', 'Reefer Seasonal Index');
  setText('baltic-spot-value', `${indexFormatter.format(seasonalIdx)} pts`);
  setText('baltic-spot-updated', 'Campaña Activa Hemisferio Sur/Med');
  setText('baltic-spot-variation', 'Drewry / Desk Benchmark');
  renderStatus('baltic-spot-status', 'LIVE', 'mt-2 inline-flex');
}

function renderTceSpot(snapshot) {
  const vesselClass = getSelectedVesselClass();
  const tceSpot = snapshot?.tceSpotByClass?.[vesselClass] || snapshot?.tceSpotByClass?.['Medium Reefer'];
  
  setText('tce-spot-theoretical-class', vesselClass || 'Bulk Reefer Convencional');
  setText(
    'tce-spot-theoretical-value',
    tceSpot?.theoreticalSpotTce === null || tceSpot?.theoreticalSpotTce === undefined
      ? '—'
      : `${currencyFormatter.format(tceSpot.theoreticalSpotTce)}/día`,
  );
  setText('tce-spot-theoretical-updated', formatDate(tceSpot?.updatedAt));
  setText('tce-spot-theoretical-fuel', tceSpot?.fuelLabel || 'VLSFO + MGO (Planta Frío AE)');

  const spreadParts = [];
  if (tceSpot?.spreadUsd !== null && tceSpot?.spreadUsd !== undefined) {
    spreadParts.push(`${tceSpot.spreadUsd >= 0 ? '+' : '-'}${currencyFormatter.format(Math.abs(tceSpot.spreadUsd))}`);
  }
  if (tceSpot?.spreadPct !== null && tceSpot?.spreadPct !== undefined) {
    spreadParts.push(`${tceSpot.spreadPct >= 0 ? '+' : ''}${indexFormatter.format(tceSpot.spreadPct)}%`);
  }
  const spreadElement = setText(
    'tce-spot-theoretical-spread',
    spreadParts.length ? `Brecha T/C: ${spreadParts.join(' · ')}` : 'Brecha no disponible',
  );
  if (spreadElement) {
    const direction = tceSpot?.spreadUsd ?? tceSpot?.spreadPct;
    spreadElement.className = `text-[10px] font-black ${
      direction === null || direction === undefined
        ? 'text-slate-500'
        : direction >= 0 ? 'text-emerald-700' : 'text-rose-700'
    }`;
  }

  renderStatus(
    'tce-spot-theoretical-status',
    tceSpot?.status || 'LIVE',
  );

  if (typeof window !== 'undefined') {
    if (window.State) {
      window.State.marketSnapshot = snapshot;
      if (Number.isFinite(Number(tceSpot?.theoreticalSpotTce)) && Number(tceSpot.theoreticalSpotTce) > 0) {
        window.State.theoreticalSpotTce = Number(tceSpot.theoreticalSpotTce);
      }
    }
    if (Number.isFinite(Number(tceSpot?.theoreticalSpotTce)) && Number(tceSpot.theoreticalSpotTce) > 0 && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('MARKET_REFERENCE_UPDATED', {
        detail: {
          tce: Number(tceSpot.theoreticalSpotTce),
          mode: 'live',
          vesselClass,
          status: tceSpot.status || 'LIVE',
        },
      }));
    }
  }
}

function renderSnapshot(snapshot) {
  latestSnapshot = snapshot || null;
  renderReeferIndex(latestSnapshot);
  renderTceSpot(latestSnapshot);
}

function refreshWhenVesselTypeChanges() {
  const vesselType = String(document.getElementById('vessel-badge')?.textContent || '').trim();
  if (vesselType === lastObservedVesselType) return;
  lastObservedVesselType = vesselType;
  renderTceSpot(latestSnapshot);
}

function initializeReeferSpotReference() {
  const hydration = window.MarketIntelligenceHydration;
  const vesselBadge = document.getElementById('vessel-badge');

  if (vesselBadge) {
    new MutationObserver(refreshWhenVesselTypeChanges).observe(vesselBadge, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  window.addEventListener('CALCULATION_EVENT', refreshWhenVesselTypeChanges);
  window.refreshBalticSpotReference = () => hydration?.refresh({ force: true });
  lastObservedVesselType = String(vesselBadge?.textContent || '').trim();

  if (!hydration) {
    renderSnapshot(null);
    return;
  }

  hydration.subscribe(state => renderSnapshot(state.snapshot));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeReeferSpotReference, { once: true });
} else {
  initializeReeferSpotReference();
}
