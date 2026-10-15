const SPLASH_EXIT_DELAY_MS = 360;
const STARTUP_TIMEOUT_MS = 3000; // Reducido a 3 segundos para que nunca se quede colgado
const MAP_CONTAINER_ID = 'map-container';

function getSplashElements() {
    return {
        splash: document.getElementById('global-splash-screen'),
        status: document.getElementById('global-splash-status'),
        mapContainer: document.getElementById(MAP_CONTAINER_ID)
    };
}

function revealApplication(reason) {
    const { splash } = getSplashElements();
    if (!splash || document.body?.dataset.appReady === 'true') return;

    document.body.dataset.appReady = 'true';
    document.body.dataset.appReadyReason = reason;
    document.body.setAttribute('aria-busy', 'false');
    splash.setAttribute('aria-hidden', 'true');
    splash.classList.add('is-exiting');

    window.setTimeout(() => {
        splash.hidden = true;
    }, SPLASH_EXIT_DELAY_MS);

    window.dispatchEvent(new CustomEvent('seacharter:app-ready', { detail: { reason } }));
}

function startGlobalSplashController() {
    const { splash } = getSplashElements();
    if (!splash) {
        revealApplication('splash-unavailable');
        return;
    }

    let completed = false;

    const complete = (reason) => {
        if (completed) return;
        completed = true;
        revealApplication(reason);
    };

    // Forzar la revelación de la app de forma segura tras un breve lapso o carga del DOM
    window.setTimeout(() => {
        complete('forced-safety-reveal');
    }, STARTUP_TIMEOUT_MS);

    if (typeof window.ensureRouteMapReady === 'function') {
        try { window.ensureRouteMapReady('map-host'); } catch (e) {}
    } else if (typeof window.initMap === 'function') {
        try { window.initMap(); } catch (e) {}
    }

    // Seguridad adicional por evento load
    window.addEventListener('load', () => complete('window-loaded'), { once: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGlobalSplashController, { once: true });
} else {
    startGlobalSplashController();
}
