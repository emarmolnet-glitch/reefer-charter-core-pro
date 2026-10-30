import React, { useEffect, useRef, useState } from 'react';
import { HashRouter, HashRouter as BrowserRouter } from 'react-router-dom';
import { ForwarderWorkspace } from './components/ForwarderWorkspace.jsx';
import { getApiUrl } from './utils/apiConfig.js';

/**
 * Normalizes reference identifiers for cross-module session matching.
 */
export function normalizeSessionRef(value) {
  return String(value || '').trim().toUpperCase();
}

/**
 * Extracts active contract reference from window/storage state.
 */
export function getActiveSessionReference() {
  if (typeof window === 'undefined') return '';
  return normalizeSessionRef(
    window.ContractRefManager?.getActiveContractRef?.() ||
    window.ContractReference?.getActiveContractRef?.() ||
    window.getActiveContractRef?.() ||
    (typeof window.sessionStorage !== 'undefined' ? window.sessionStorage.getItem('active_contract_ref') : null) ||
    (typeof window.localStorage !== 'undefined' ? window.localStorage.getItem('active_contract_ref') : null) ||
    ''
  );
}

/**
 * Checks if target reference matches the active session.
 */
export function matchesActiveSession(targetRef) {
  const currentRef = getActiveSessionReference();
  const normalizedTarget = normalizeSessionRef(targetRef);
  if (!normalizedTarget) return true; // No target restriction means current session
  if (!currentRef) return true;
  return normalizedTarget === currentRef;
}

/**
 * Extracts IMO and optional target reference from heterogeneous payloads.
 */
export function extractImoAndReference(data) {
  if (!data) return null;

  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (/^\d{7}$/.test(trimmed)) {
      return { imo: trimmed, reference: '' };
    }
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return extractImoAndReference(parsed);
      } catch (_) {}
    }
    return null;
  }

  if (typeof data !== 'object') return null;

  const targetRef = normalizeSessionRef(
    data.reference ||
    data.target_session_id ||
    data.targetSessionId ||
    data.target_session ||
    data.contractRef ||
    data.contract_ref ||
    data.session_id ||
    data.sessionId ||
    data.ref ||
    data.payload?.reference ||
    data.payload?.target_session_id ||
    ''
  );

  const imoCandidate = String(
    data.imo ||
    data.imo_number ||
    data.imoNumber ||
    data.pending_imo ||
    data.core_pro_pending_imo ||
    data.value ||
    data.vessel?.imo ||
    data.vessel?.imo_number ||
    data.payload?.imo ||
    data.payload?.vessel?.imo ||
    ''
  ).trim();

  if (imoCandidate && /^\d{7}$/.test(imoCandidate)) {
    return { imo: imoCandidate, reference: targetRef };
  }

  if (data.value && typeof data.value === 'object') {
    return extractImoAndReference(data.value);
  }
  if (typeof data.value === 'string' && data.value.trim().startsWith('{')) {
    try {
      return extractImoAndReference(JSON.parse(data.value));
    } catch (_) {}
  }

  return null;
}

/**
 * Reusable IMO hydration engine: updates React state, VoyageStore, GlobalStore and triggers fetchVesselByImo/fetchVesselSpecs.
 */
export function executeImoHydration(imoValue) {
  const cleanImo = String(imoValue || '').trim();
  if (!cleanImo || !/^\d{7}$/.test(cleanImo)) return false;

  const referenceManager = typeof window !== 'undefined'
    ? (window.ContractReference || window.ContractRefManager)
    : null;

  referenceManager?.setInjectionLock?.(true);

  try {
    // 1. Actualización nativa de estado en el input de Section 2 si existe
    const imoInput = typeof document !== 'undefined'
      ? (document.getElementById?.('vessel-identity-imo') ||
         document.getElementById?.('imo') ||
         (typeof document.querySelector === 'function' ? (document.querySelector('input[name="imo"]') || document.querySelector('input[name="imo_number"]') || document.querySelector('input[name="vessel_imo"]')) : null))
      : null;

    if (imoInput) {
      imoInput.value = cleanImo;
    }

    const altImoInput = typeof document !== 'undefined' && document.getElementById?.('imo') && document.getElementById?.('imo') !== imoInput
      ? document.getElementById?.('imo')
      : null;
    if (altImoInput) {
      altImoInput.value = cleanImo;
    }

    if (typeof window !== 'undefined' && typeof window.handleManualVesselUpdate === 'function') {
      window.handleManualVesselUpdate('imo', cleanImo);
    }

    const vesselData = { imo: cleanImo, imo_number: cleanImo, imoNumber: cleanImo };

    // 2. Sincronización en Contexto Global / Zustand / VoyageStore
    if (typeof window !== 'undefined' && typeof window.patchSection2Vessel === 'function') {
      window.patchSection2Vessel(vesselData);
    }

    if (typeof window !== 'undefined') {
      try {
        const vStore = window.VoyageStore?.getState?.() || window.useVoyageStore?.getState?.();
        vStore?.patchSection2Vessel?.(vesselData);
      } catch (_) {}
      if (window.GlobalStore) {
        window.GlobalStore.activeVessel = { ...(window.GlobalStore.activeVessel || {}), ...vesselData };
        window.GlobalStore.calculatorVessel = { ...(window.GlobalStore.calculatorVessel || {}), ...vesselData };
      }
    }

    // 3. Ejecutar la función o abrir el VesselDetailDrawer para revisión del fletador
    if (typeof window !== 'undefined') {
      if (typeof window.openVesselDetailDrawer === 'function') {
        // Consultar ficha y abrir drawer para revisión intermedia
        void fetch(getApiUrl(`/api/vessel/${encodeURIComponent(cleanImo)}`))
          .then((res) => res.json())
          .then((payload) => {
            if (payload?.success && payload.vessel) {
              window.openVesselDetailDrawer(payload.vessel, 'Data Bridge (Neon DB)');
            } else {
              window.openVesselDetailDrawer({ imo: cleanImo, imo_number: cleanImo }, 'Data Bridge (Broadcast)');
            }
          })
          .catch(() => {
            window.openVesselDetailDrawer({ imo: cleanImo, imo_number: cleanImo }, 'Data Bridge (Broadcast)');
          });
      } else {
        const fetchFn = (window.fetchVesselSpecs || window.fetchVesselByImo);
        if (typeof fetchFn === 'function') {
          void fetchFn(cleanImo);
        } else if (typeof fetch === 'function') {
          void fetch(getApiUrl(`/api/vessel/${encodeURIComponent(cleanImo)}`))
            .then((res) => res.json())
            .then((payload) => {
              if (payload?.success && payload.vessel) {
                const fullVessel = payload.vessel;
                try {
                  const vStore = window.VoyageStore?.getState?.() || window.useVoyageStore?.getState?.();
                  vStore?.patchSection2Vessel?.(fullVessel);
                } catch (_) {}
                if (window.GlobalStore) {
                  window.GlobalStore.activeVessel = { ...(window.GlobalStore.activeVessel || {}), ...fullVessel };
                  window.GlobalStore.calculatorVessel = { ...(window.GlobalStore.calculatorVessel || {}), ...fullVessel };
                }
                if (typeof window.applyDataBridgeHydrationToCalculator === 'function') {
                  window.applyDataBridgeHydrationToCalculator(fullVessel, { imo: cleanImo, imo_number: cleanImo });
                }
              }
            })
            .catch(() => {});
        }
      }
    }

    return true;
  } finally {
    if (referenceManager?.setInjectionLock) {
      setTimeout(() => referenceManager.setInjectionLock?.(false), 250);
    }
  }
}

/**
 * Global BroadcastChannel synchronization hook for SeaCharter Core PRO.
 * Listens for PING_SESSION events from Data Bridge or other tabs/windows
 * and responds with the active voyage/contract session reference.
 */
export function useSeaCharterSync() {
  const lastPersistedRef = useRef('');
  const isSavingRef = useRef(false);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.BroadcastChannel !== 'function') {
      return;
    }

    const channel = new BroadcastChannel('seacharter_sync_channel');
    console.log('[Core PRO] Canal de sincronización abierto');

    const persistActiveSessionToBackend = (ref, immediate = false) => {
      const normalized = String(ref || '').trim().toUpperCase();
      if (!normalized || typeof fetch !== 'function') return;

      // Only trigger if reference actually changed
      if (normalized === lastPersistedRef.current) return;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      const executeSave = () => {
        if (isSavingRef.current) return;
        isSavingRef.current = true;

        if (typeof window.ContractRefManager?.persistSessionToDatabase === 'function') {
          window.ContractRefManager.persistSessionToDatabase(normalized, null, true)
            .then((data) => {
              if (data) {
                lastPersistedRef.current = normalized;
              }
            })
            .catch(() => {})
            .finally(() => { isSavingRef.current = false; });
        } else {
          fetch(getApiUrl('/api/app-state'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              id: 'current_session',
              key: 'current_session',
              session_ref: normalized,
              currentSessionRef: normalized,
              reference: normalized,
              timestamp: Date.now(),
            }),
          })
            .then((res) => {
              if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
              }
              return res.json();
            })
            .then((data) => {
              lastPersistedRef.current = normalized;
              console.log('[Core PRO] Sesión activa guardada en Neon:', normalized);
            })
            .catch((err) => {
              console.warn('[Core PRO] No se pudo persistir la sesión activa en backend:', err?.message || err);
            })
            .finally(() => { isSavingRef.current = false; });
        }
      };

      if (immediate) {
        executeSave();
      } else {
        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          executeSave();
        }, 500);
      }
    };

    // 2. DETENER ESCRITURA AUTOMÁTICA EN NEON (GUARDADO PREMATURO):
    // La aplicación SOLO debe hacer el POST/UPSERT a Neon cuando el usuario pulse explícitamente
    // el botón de "Calcular ruta" o "Guardar", no por el simple hecho de generar un ID aleatorio o montar el componente.
    channel.onmessage = (event) => {
      const data = event?.data;
      if (data?.type === 'PING_SESSION' || data === 'PING_SESSION') {
        const currentSessionRef = getActiveSessionReference();

        console.log('[Core PRO] PING recibido, respondiendo con:', currentSessionRef);
        channel.postMessage({
          type: 'CORE_SESSION_ACTIVE',
          reference: currentSessionRef,
        });
      }
    };

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      channel.close();
    };
  }, []);
}

/**
 * Hook for URL IMO parameter injection and automatic database vessel lookup.
 */
export function useUrlImoAutoLookup() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.location?.search) return;

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const imoValue = searchParams.get('imo')?.trim() || '';

      if (imoValue && /^\d{7}$/.test(imoValue)) {
        // 2. INYECCIÓN DE ESTADO: Inyectar inmediatamente en Section 2
        const imoInput = document.getElementById('vessel-identity-imo');
        if (imoInput) {
          imoInput.value = imoValue;
        }

        if (typeof window.handleManualVesselUpdate === 'function') {
          window.handleManualVesselUpdate('imo', imoValue);
        }

        if (typeof window.patchSection2Vessel === 'function') {
          window.patchSection2Vessel({ imo: imoValue });
        }

        // 3. AUTO-DISPARO DE BÚSQUEDA: Ejecutar consulta existente en base de datos
        if (typeof window.fetchVesselByImo === 'function') {
          void window.fetchVesselByImo(imoValue);
        }

        // 4. LIMPIEZA DE URL: Limpiar parámetro imo para evitar repetición al recargar
        if (window.history?.replaceState && window.location?.href) {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('imo');
          const nextSearch = cleanUrl.searchParams.toString();
          const nextUrl = `${cleanUrl.pathname}${nextSearch ? `?${nextSearch}` : ''}${cleanUrl.hash}`;
          window.history.replaceState(window.history.state, '', nextUrl);
        }
      }
    } catch (_) {}
  }, []);
}

/**
 * Hook for background IMO injection via BroadcastChannels ('core_pro_channel', 'seacharter_sync_channel'),
 * localStorage ('core_pro_pending_imo'), and Neon DB polling.
 */
export function usePendingImoSync() {
  const processedKeysRef = useRef(new Set());
  const isPollingRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Helper to discard and clean up pending IMO from storage and Neon
    const cleanupPendingImo = () => {
      try {
        if (typeof window.localStorage !== 'undefined') {
          window.localStorage.removeItem('core_pro_pending_imo');
          window.localStorage.removeItem('selected_imo');
          window.localStorage.removeItem('pending_imo');
          window.localStorage.removeItem('seacharter_pending_imo');
        }
      } catch (_) {}

      if (typeof fetch === 'function') {
        fetch(getApiUrl('/api/app-state?key=core_pro_pending_imo'), {
          method: 'DELETE',
          headers: { 'Accept': 'application/json' },
        }).catch(() => {});

        fetch(getApiUrl('/api/app-state?key=selected_imo'), {
          method: 'DELETE',
          headers: { 'Accept': 'application/json' },
        }).catch(() => {});

        fetch(getApiUrl('/api/app-state'), {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ key: 'core_pro_pending_imo' }),
        }).catch(() => {});
      }
    };

    // Helper to process candidate message / item
    const processCandidate = (candidate, sourceKey = '') => {
      const extracted = extractImoAndReference(candidate);
      if (!extracted || !extracted.imo) return false;

      if (!matchesActiveSession(extracted.reference)) {
        return false;
      }

      const currentActiveRef = getActiveSessionReference();
      const dedupKey = `${currentActiveRef || 'ALL'}:${extracted.imo}:${sourceKey}`;

      if (processedKeysRef.current.has(dedupKey)) {
        return false;
      }

      processedKeysRef.current.add(dedupKey);

      // Inyectar en Sección 2 y disparar búsqueda en base de datos
      const hydrated = executeImoHydration(extracted.imo);
      if (hydrated) {
        cleanupPendingImo();
      }
      return hydrated;
    };

    // 1. Initial check from localStorage
    try {
      const storedImo = window.localStorage?.getItem('core_pro_pending_imo') ||
                        window.localStorage?.getItem('pending_imo') ||
                        window.localStorage?.getItem('seacharter_pending_imo');
      if (storedImo) {
        processCandidate(storedImo, 'localStorage:init');
      }
    } catch (_) {}

    // 2. Storage event listener for cross-tab localStorage changes
    const handleStorage = (event) => {
      if (!event) return;
      if (event.key === 'core_pro_pending_imo' || event.key === 'pending_imo' || event.key === 'seacharter_pending_imo') {
        if (event.newValue) {
          processCandidate(event.newValue, `storage:${event.key}`);
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. BroadcastChannels listeners ('cross_app_sync', 'core_pro_channel', 'seacharter_sync_channel')
    let crossAppChannel = null;
    let coreProChannel = null;
    let seacharterSyncChannel = null;

    if (typeof window.BroadcastChannel === 'function') {
      try {
        crossAppChannel = new window.BroadcastChannel('cross_app_sync');
        crossAppChannel.onmessage = (event) => {
          const data = event?.data;
          if (data && (data.type === 'LOAD_IMO' || data.imo || data.selected_imo)) {
            processCandidate(data, 'bc:cross_app_sync');
          }
        };
      } catch (_) {}

      try {
        coreProChannel = new window.BroadcastChannel('core_pro_channel');
        coreProChannel.onmessage = (event) => {
          const data = event?.data;
          if (data) {
            processCandidate(data, 'bc:core_pro_channel');
          }
        };
      } catch (_) {}

      try {
        seacharterSyncChannel = new window.BroadcastChannel('seacharter_sync_channel');
        seacharterSyncChannel.onmessage = (event) => {
          const data = event?.data;
          if (data) {
            processCandidate(data, 'bc:seacharter_sync_channel');
          }
        };
      } catch (_) {}
    }

    // 4. Polling to Neon DB for 'core_pro_pending_imo' / 'selected_imo'
    const pollNeonPendingImo = async () => {
      if (isPollingRef.current || typeof fetch !== 'function') return;
      isPollingRef.current = true;
      try {
        const res = await fetch(getApiUrl('/api/app-state?key=core_pro_pending_imo'), {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          console.log('[Core PRO] Polling check, IMO recibido:', data);
          if (data?.success && (data.value || data.imo || data.selected_imo || data.pending_imo)) {
            processCandidate(data, 'neon:poll');
          }
        }
      } catch (pollErr) {
        console.warn('[Core PRO] Error en polling de estado:', pollErr);
      } finally {
        isPollingRef.current = false;
      }
    };

    // Run immediate check and periodic interval
    void pollNeonPendingImo();
    const pollInterval = setInterval(pollNeonPendingImo, 3000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      crossAppChannel?.close();
      coreProChannel?.close();
      seacharterSyncChannel?.close();
      clearInterval(pollInterval);
    };
  }, []);
}

/**
 * Storage key for persistent header visibility preference.
 */
export const HEADER_STORAGE_KEY = 'seacharter_header_visible';

/**
 * Returns stored header visibility preference or true by default.
 * Blindaje: El estado permanente de la cabecera superior es forzado a true.
 */
export function getStoredHeaderVisibility(defaultVisible = true) {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage?.getItem(HEADER_STORAGE_KEY);
    if (stored !== null && stored !== undefined) {
      return true;
    }
  } catch (_) {}
  return true;
}

/**
 * Persists header visibility preference to localStorage and emits an event.
 * Blindaje: Siempre persiste true para garantizar que la cabecera nunca se colapse.
 */
export function setStoredHeaderVisibility(visible) {
  const boolVal = true;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.setItem(HEADER_STORAGE_KEY, String(boolVal));
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('header:visibility-change', {
        detail: { isHeaderVisible: boolVal, visible: boolVal }
      }));
    } catch (_) {}
  }
  return boolVal;
}

/**
 * Global Header Visibility management hook for SeaCharter Core PRO.
 * Keeps state in sync with localStorage, DOM layout, and window resize events.
 * Fuerza que el estado inicial y permanente sea true, deshabilitando cualquier listener externo que intente colapsar la cabecera.
 */
export function useHeaderVisibility(defaultVisible = true) {
  const [isHeaderVisible, setIsHeaderVisible] = useState(() => getStoredHeaderVisibility(defaultVisible) && true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Apply visibility class and ARIA states to DOM elements
    const syncDom = (visible = true) => {
      const forcedVisible = true;
      if (typeof document !== 'undefined') {
        if (document.body) {
          document.body.classList.toggle('header-collapsed', !visible);
          document.body.dataset.headerVisible = String(forcedVisible);
        }
        const appHeader = document.querySelector('header.app-header');
        if (appHeader) {
          appHeader.classList.toggle('header-collapsed', !visible);
          appHeader.setAttribute('aria-hidden', String(!forcedVisible));
        }
        const collapseBtn = document.getElementById('btn-collapse-header');
        if (collapseBtn) {
          collapseBtn.setAttribute('aria-expanded', String(forcedVisible));
        }
        const expandBtn = document.getElementById('btn-expand-header');
        if (expandBtn) {
          expandBtn.setAttribute('aria-expanded', String(forcedVisible));
        }
      }
      window.dispatchEvent(new Event('resize'));
    };

    syncDom(true);

    const handleVisibilityEvent = (event) => {
      // Bloquea cualquier intento externo o de cálculos de colapsar la barra superior
      const nextVal = event?.detail?.isHeaderVisible ?? event?.detail?.visible;
      if (nextVal === false) {
        return;
      }
      setIsHeaderVisible(true);
    };

    const handleToggleEvent = () => {
      // Deshabilitado: La barra de navegación superior permanece permanentemente visible
      setIsHeaderVisible(true);
      setStoredHeaderVisibility(true);
    };

    window.addEventListener('header:visibility-change', handleVisibilityEvent);
    window.addEventListener('header:toggle', handleToggleEvent);

    window.isHeaderVisible = true;
    window.setHeaderVisibility = (val) => {
      const next = true;
      setStoredHeaderVisibility(next);
      setIsHeaderVisible(next);
    };
    window.toggleHeaderVisibility = () => {
      const next = true;
      setStoredHeaderVisibility(next);
      setIsHeaderVisible(next);
    };

    return () => {
      window.removeEventListener('header:visibility-change', handleVisibilityEvent);
      window.removeEventListener('header:toggle', handleToggleEvent);
    };
  }, [isHeaderVisible]);

  const toggleHeader = () => {
    const next = true;
    setStoredHeaderVisibility(next);
    setIsHeaderVisible(next);
  };

  return { isHeaderVisible: true, setIsHeaderVisible, toggleHeader };
}

import { ProjectProvider, ProjectContext, useProject, useProjectRef, generateRandomProjectRef } from './context/ProjectContext.jsx';
import { useReeferAutoSizing } from './hooks/useReeferAutoSizing.js';
import { GlobalMadreDrawer, MadrePanel, buildMotherExecutiveScript, playNeuralMotherVoice, detectActiveModule, scanActiveModule, buildUniversalScanPrompt, buildLocalZeroHallucinationAudit } from './components/GlobalMadreDrawer.jsx';

export function AppLayout({ children }) {
  const [currentView, setCurrentView] = useState(() => (typeof window !== 'undefined' ? window.currentView || '' : ''));
  const { isHeaderVisible, toggleHeader } = useHeaderVisibility();
  const [isMadreOpen, setIsMadreOpen] = useState(false);

  useSeaCharterSync();
  useUrlImoAutoLookup();
  usePendingImoSync();
  useReeferAutoSizing();

  useEffect(() => {
    const handleViewChange = (event) => {
      const nextView = event?.detail?.view || window.currentView || '';
      setCurrentView(nextView);
    };
    window.addEventListener('navigation:view-change', handleViewChange);
    return () => window.removeEventListener('navigation:view-change', handleViewChange);
  }, []);

  useEffect(() => {
    const handleMadreToggle = () => setIsMadreOpen((prev) => !prev);
    const handleMadreOpen = () => setIsMadreOpen(true);
    const handleMadreClose = () => setIsMadreOpen(false);
    window.addEventListener('madre:toggle', handleMadreToggle);
    window.addEventListener('madre:open', handleMadreOpen);
    window.addEventListener('madre:close', handleMadreClose);
    return () => {
      window.removeEventListener('madre:toggle', handleMadreToggle);
      window.removeEventListener('madre:open', handleMadreOpen);
      window.removeEventListener('madre:close', handleMadreClose);
    };
  }, []);

  return (
    <div
      className={`seacharter-core-pro-app ${isHeaderVisible ? 'header-visible' : 'header-collapsed'}`}
      data-header-visible={isHeaderVisible}
    >
      <button
        id="react-header-toggle-btn"
        className="hidden"
        style={{ display: 'none' }}
        onClick={toggleHeader}
        aria-expanded={isHeaderVisible}
      />
      {currentView === 'FORWARDERS' ? (
        <ForwarderWorkspace />
      ) : (
        children
      )}
      <GlobalMadreDrawer showTrigger={false} isMadreOpen={isMadreOpen} setIsMadreOpen={setIsMadreOpen} />
    </div>
  );
}

export default function App(props) {
  return (
    <HashRouter>
      <ProjectProvider>
        <AppLayout {...props} />
      </ProjectProvider>
    </HashRouter>
  );
}

/**
 * Top Navigation Bar (TopNav) component displaying corporate branding,
 * vessel search input, and the active project reference input.
 */
export function TopNav() {
  const [isMadreOpen, setIsMadreOpen] = useState(false);
  const { activeProjectRef, setActiveProjectRef } = useProject();

  const handleRefChange = (e) => {
    setActiveProjectRef(e.target.value);
  };

  return (
    <header
      className="app-header bg-white border-b border-slate-200 px-4 py-2 md:px-6 flex items-center justify-end md:justify-between shadow-md shrink-0 no-print z-50"
      role="banner"
      aria-label="Cabecera principal de navegación"
    >
      {/* IZQUIERDA: LOGO CORPORATIVO */}
      <div className="header-left hidden md:flex items-center gap-3 shrink-0">
        <div className="bg-blue-600 p-0.5 rounded-lg text-white shadow-md flex items-center justify-center w-8 h-8 overflow-hidden">
          <img src="./assets/reefer-logo.jpg" alt="Reefer Charter Core PRO Logo" className="w-full h-full object-cover rounded-md" />
        </div>
        <div>
          <h1 className="text-xs md:text-sm font-bold text-slate-900 tracking-tight flex items-center whitespace-nowrap">
            <span>Reefer Charter Core PRO</span>
            <span className="text-[9px] md:text-[10px] bg-blue-500/10 text-blue-700 px-1.5 py-0.5 rounded border border-blue-500/20 ml-1.5 md:ml-2 font-mono font-bold tracking-wider">REEFER ENGINE</span>
          </h1>
        </div>
      </div>

      {/* CENTRO: STATUS BRIDGE, BUSCADOR IMO, VOYAGE REF */}
      <div className="header-center hidden md:flex items-center gap-2 md:gap-3 flex-1 justify-center max-w-3xl mx-2 md:mx-4">
        <div id="connection-status-root" className="shrink-0"></div>

        {/* BUSCADOR DIRECTO DE BUQUES */}
        <div id="header-vessel-search-container" className="relative hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 text-slate-700 text-xs shadow-2xs flex-1 min-w-[160px] focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-sky-500 transition-all">
          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            id="header-vessel-search-input"
            className="bg-transparent font-sans text-xs font-semibold text-slate-800 focus:outline-none w-full placeholder:text-slate-400"
            placeholder="Buscar buque por nombre o IMO..."
            aria-label="Buscar buque en base de datos"
          />
        </div>

        {/* SELECTOR REFERENCIA DE VIAJE / EXPEDIENTE ACTIVO */}
        <div id="header-voyage-ref-container" className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50/90 border border-blue-300 text-blue-900 text-xs font-mono shadow-xs shrink-0 transition-all hover:border-blue-400" title="Expediente Activo (project_ref)">
          <i className="fa-solid fa-folder-closed text-xs text-blue-600"></i>
          <span className="text-blue-800 font-sans text-[10px] uppercase font-black tracking-wider bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200">Expediente:</span>
          <input
            type="text"
            id="quick-ref"
            value={activeProjectRef || ''}
            onChange={handleRefChange}
            className="bg-transparent font-mono text-xs font-bold text-blue-950 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 w-28 sm:w-36 transition-all uppercase placeholder-blue-300"
            placeholder="RDM/2026-..."
            title="Referencia Única del Expediente (project_ref)"
          />
        </div>
      </div>

      {/* DERECHA: CONTENEDOR ÚNICO DE BOTONES DE ACCIÓN (MADRE, FAQ, OWN/CHR, COLAPSAR) */}
      <div className="header-actions-right !flex items-center gap-1.5 shrink-0">
        {/* DISPARADOR SUPERIOR MADRE (TOPBAR TRIGGER) */}
        <button
          id="madre-topbar-button"
          type="button"
          onClick={() => {
            setIsMadreOpen(!isMadreOpen);
            if (window.MadrePanelUI?.toggle) {
              window.MadrePanelUI.toggle();
            } else {
              window.dispatchEvent(new CustomEvent('madre:toggle', { detail: { userInitiated: true } }));
            }
          }}
          aria-label="Abrir panel MADRE"
          title="Cerebro Central MADRE"
          aria-expanded={isMadreOpen ? "true" : "false"}
          className="madre-topbar-btn relative group flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full border-2 border-slate-800 bg-slate-900 hover:scale-110 transition-transform duration-200 shadow-md cursor-pointer shrink-0"
        >
          <div
            id="madre-topbar-glow"
            className="madre-topbar-glow absolute inset-0 rounded-full animate-pulse bg-cyan-500 blur-md opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ display: isMadreOpen ? 'block' : 'none' }}
            aria-hidden="true"
          />
          <img
            id="madre-topbar-img"
            src="/MADRE.png"
            alt="MADRE"
            className="madre-topbar-img w-full h-full rounded-full object-cover relative z-10 pointer-events-none transition-all duration-300 grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100"
          />
          <span className="sr-only"><span className="tracking-wide">MADRE</span></span>
        </button>

        {/* Botón FAQ / Manual */}
        <button
          id="btn-open-faq-modal"
          type="button"
          onClick={() => {
            if (typeof window.openFaqModal === 'function') {
              window.openFaqModal();
            }
          }}
          className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2 py-1 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer h-8 shrink-0"
          title="Manual de Usuario y Referencia Técnica (FAQ)"
          aria-label="Abrir Manual de Usuario y FAQ"
        >
          <svg className="w-3.5 h-3.5 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>FAQ</span>
        </button>

        {/* OWN / CHR Switch */}
        <div id="global-view-mode-switch" className="relative z-20 inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-slate-300 bg-slate-100 p-0.5 shadow-2xs h-8" role="group" aria-label="Perspectiva de negocio">
          <button
            type="button"
            id="btn-view-mode-owner"
            className="inline-flex w-8 sm:w-9 items-center justify-center rounded-md py-1 leading-none text-slate-700 font-bold"
            onClick={() => {
              if (typeof window.setGlobalViewMode === 'function') {
                window.setGlobalViewMode('owner');
              }
            }}
            aria-pressed="true"
            title="Vista Armador (Shipowner)"
          >
            <span aria-hidden="true" className="text-[10px] font-bold tracking-wider uppercase">OWN</span>
            <span className="sr-only">Vista Armador</span>
          </button>
          <button
            type="button"
            id="btn-view-mode-charterer"
            className="inline-flex w-8 sm:w-9 items-center justify-center rounded-md py-1 leading-none text-slate-700 font-bold"
            onClick={() => {
              if (typeof window.setGlobalViewMode === 'function') {
                window.setGlobalViewMode('charterer');
              }
            }}
            aria-pressed="false"
            title="Vista Fletador (Charterer)"
          >
            <span aria-hidden="true" className="text-[10px] font-bold tracking-wider uppercase">CHR</span>
            <span className="sr-only">Vista Fletador</span>
          </button>
        </div>

        {/* Botón Colapsar Cabecera de Navegación */}
        <button
          type="button"
          id="btn-collapse-header"
          className="header-toggle-collapse-btn inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 shadow-2xs cursor-pointer transition-all shrink-0 focus:outline-none"
          onClick={() => {
            if (typeof window.toggleHeaderVisibility === 'function') {
              window.toggleHeaderVisibility();
            }
          }}
          title="Ocultar barra de navegación (Alt+H)"
          aria-label="Ocultar barra de navegación"
          aria-expanded="true"
        >
          <i className="fa-solid fa-chevron-up text-xs" aria-hidden="true"></i>
          <span className="sr-only">Ocultar navegación</span>
        </button>
      </div>
    </header>
  );
}

export { HashRouter, HashRouter as BrowserRouter };
export { ProjectProvider, ProjectContext, useProject, useProjectRef, generateRandomProjectRef };
export { default as VoyageExecutiveReportModal, buildVoyageStowagePlan } from './components/VoyageExecutiveReportModal.jsx';
export { GlobalMadreDrawer, MadrePanel, buildMotherExecutiveScript, playNeuralMotherVoice, detectActiveModule, scanActiveModule, buildUniversalScanPrompt, buildLocalZeroHallucinationAudit };

