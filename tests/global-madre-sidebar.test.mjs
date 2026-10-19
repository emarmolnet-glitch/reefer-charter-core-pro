import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const globalMadreDrawerSource = readFileSync(new URL('../src/components/GlobalMadreDrawer.jsx', import.meta.url), 'utf8');
const appJsxSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const indexHtmlSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const madrePanelCssSource = readFileSync(new URL('../assets/css/madre-panel.css', import.meta.url), 'utf8');
const customStylesCssSource = readFileSync(new URL('../custom_styles.css', import.meta.url), 'utf8');
const netlifyTomlSource = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');
const headersSource = readFileSync(new URL('../_headers', import.meta.url), 'utf8');
const masterStatsSource = readFileSync(new URL('../netlify/functions/databridge-master-stats.ts', import.meta.url), 'utf8');
const stowageBuilderSource = readFileSync(new URL('../src/voyage-stowage-builder.mjs', import.meta.url), 'utf8');
const autoSizingSource = readFileSync(new URL('../src/hooks/useReeferAutoSizing.js', import.meta.url), 'utf8');
const tceWorkspaceSource = readFileSync(new URL('../TceCalculatorWorkspace.tsx', import.meta.url), 'utf8');

test('1. MADRE Logo image asset is saved in public directory and served correctly', () => {
  assert.ok(existsSync(new URL('../public/MADRE.png', import.meta.url)), 'public/MADRE.png must exist');
  assert.ok(existsSync(new URL('../assets/MADRE.png', import.meta.url)), 'assets/MADRE.png must exist');
});

test('2. GlobalMadreDrawer component implements isolated dark classes and wider max-w-lg layout', () => {
  // Check export
  assert.match(globalMadreDrawerSource, /export\s+function\s+MadrePanel/);
  assert.match(globalMadreDrawerSource, /export\s+const\s+GlobalMadreDrawer/);

  // Check IDs from blueprint
  assert.match(globalMadreDrawerSource, /id="madre-topbar-button"/);
  assert.match(globalMadreDrawerSource, /id="madre-backdrop"/);
  assert.match(globalMadreDrawerSource, /id="madre-drawer-panel"/);
  assert.match(globalMadreDrawerSource, /id="madre-messages-container"/);
  assert.match(globalMadreDrawerSource, /id="madre-mic-button"/);
  assert.match(globalMadreDrawerSource, /id="madre-chat-input"/);
  assert.match(globalMadreDrawerSource, /id="madre-send-button"/);
  assert.match(globalMadreDrawerSource, /id="madre-mute-button"/);
  assert.match(globalMadreDrawerSource, /id="madre-close-button"/);

  // Check wider drawer container & dark styling
  assert.match(globalMadreDrawerSource, /max-w-lg/);
  assert.match(globalMadreDrawerSource, /bg-slate-900/);
  assert.match(globalMadreDrawerSource, /text-slate-100/);

  // Check container dark backgrounds
  assert.match(globalMadreDrawerSource, /bg-slate-950[^"]*border-slate-800/); // header
  assert.match(globalMadreDrawerSource, /bg-slate-900[^"]*text-slate-100/); // messages
  assert.match(globalMadreDrawerSource, /madre-drawer-footer[^"]*bg-slate-950/); // footer

  // Check <img> src paths
  const imgMatches = globalMadreDrawerSource.match(/src="\/MADRE\.png"/g);
  assert.ok(imgMatches && imgMatches.length >= 2, 'All <img> tags must point to /MADRE.png');

  // Verify strict isolation: Main App layout is NOT forced into dark mode
  assert.doesNotMatch(appJsxSource, /seacharter-core-pro-app[^"]*dark/);
  assert.doesNotMatch(appJsxSource, /seacharter-core-pro-app[^"]*bg-slate-900/);
});

test('3. Global CSS styles include custom properties, keyframes, and custom classes from blueprint', () => {
  [madrePanelCssSource, customStylesCssSource].forEach((cssSource) => {
    assert.match(cssSource, /--madre-bg-dark:\s*#090d16/);
    assert.match(cssSource, /--madre-panel-bg:\s*#0f172a/);
    assert.match(cssSource, /--madre-surface:\s*#1e293b/);
    assert.match(cssSource, /--madre-border:\s*#334155/);
    assert.match(cssSource, /--madre-cyan:\s*#06b6d4/);
    assert.match(cssSource, /@keyframes\s+madre-pulse/);
    assert.match(cssSource, /@keyframes\s+madre-slide-in/);
    assert.match(cssSource, /\.madre-topbar-btn/);
    assert.match(cssSource, /\.madre-topbar-glow/);
    assert.match(cssSource, /\.madre-backdrop/);
    assert.match(cssSource, /\.madre-drawer/);
    assert.match(cssSource, /\.madre-quick-btn/);
    assert.match(cssSource, /\.madre-send-btn/);
  });
});

test('4. Header Integration: Topbar trigger button is injected into header in index.html and App.jsx', () => {
  // index.html header
  assert.match(indexHtmlSource, /<header[^>]*class="app-header/);
  assert.match(indexHtmlSource, /id="madre-topbar-button"/);
  assert.match(indexHtmlSource, /id="madre-topbar-glow"/);
  assert.match(indexHtmlSource, /id="madre-topbar-img"/);
  assert.match(indexHtmlSource, /src="\/MADRE\.png"/);

  // App.jsx TopNav
  assert.match(appJsxSource, /export\s+function\s+TopNav/);
  assert.match(appJsxSource, /id="madre-topbar-button"/);
  assert.match(appJsxSource, /id="madre-topbar-glow"/);
  assert.match(appJsxSource, /src="\/MADRE\.png"/);
});

test('5. State Connection: GlobalMadreDrawer is mounted in AppLayout at highest layout level', () => {
  assert.match(appJsxSource, /import\s*\{[^}]*GlobalMadreDrawer[^}]*\}\s*from\s*['"]\.\/components\/GlobalMadreDrawer\.jsx['"]/);
  assert.match(appJsxSource, /<GlobalMadreDrawer/);
  assert.match(globalMadreDrawerSource, /window\.MadrePanelUI\s*=/);
  assert.match(globalMadreDrawerSource, /window\.addEventListener\(["']madre:toggle["']/);
});

test('6. CORS Policy: Globally appends Access-Control headers and OPTIONS preflight returns 200 OK', () => {
  assert.match(masterStatsSource, /"Access-Control-Allow-Origin":\s*"\*"/);
  assert.match(masterStatsSource, /"Access-Control-Allow-Headers":\s*"Content-Type,\s*Authorization"/);
  assert.match(masterStatsSource, /"Access-Control-Allow-Methods":\s*"GET,\s*POST,\s*OPTIONS"/);
  assert.match(masterStatsSource, /req\.method\s*===\s*"OPTIONS"/);
  assert.match(masterStatsSource, /status:\s*200/);

  // netlify.toml and _headers
  assert.match(netlifyTomlSource, /Access-Control-Allow-Origin\s*=\s*"\*"/);
  assert.match(netlifyTomlSource, /Access-Control-Allow-Headers\s*=\s*"Content-Type,\s*Authorization"/);
  assert.match(netlifyTomlSource, /Access-Control-Allow-Methods\s*=\s*"GET,\s*POST,\s*OPTIONS"/);
  assert.match(headersSource, /Access-Control-Allow-Origin:\s*\*/);
});

test('7. 504 Gateway Timeout Handling: Graceful retry in frontend and timeout error handling', () => {
  assert.match(indexHtmlSource, /504\s*Gateway\s*Timeout/);
  assert.match(indexHtmlSource, /GATEWAY_TIMEOUT_504/);
  assert.match(indexHtmlSource, /Reintentar\s*Auditoría/);
});

test('8. Zero-Click Auto-Sizing: Empty vessel name evaluates as TBN and overrides capacity', () => {
  assert.match(autoSizingSource, /isTbnVessel\(vessel\)\s*\{[\s\S]*?vessel\s*===\s*''/);
  assert.match(tceWorkspaceSource, /useReeferAutoSizing\(\{\s*vessel:\s*currentVesselNameState/);
  assert.match(stowageBuilderSource, /normalizedVesselName\s*===\s*''/);
  assert.match(stowageBuilderSource, /effectiveCubicCapacity\s*=\s*isTbn/);
});

test('9. MADRE UI Polish: Z-index 2147483647, left-slide, header text text-white, ml-auto buttons with shrink-0, SVG close, and bubbles max-w-[95%] text-white', () => {
  // Left-slide layout
  assert.match(globalMadreDrawerSource, /left-0/);
  assert.match(globalMadreDrawerSource, /border-r/);
  assert.match(madrePanelCssSource, /left:\s*0/);
  assert.match(madrePanelCssSource, /border-right/);
  assert.match(madrePanelCssSource, /translateX\(-100%\)/);

  // Absolute max Z-Index
  assert.match(globalMadreDrawerSource, /z-\[2147483647\]/);
  assert.match(globalMadreDrawerSource, /zIndex:\s*2147483647/);
  assert.match(madrePanelCssSource, /z-index:\s*2147483647\s*!important/);
  assert.match(madrePanelCssSource, /z-index:\s*2147483646\s*!important/);

  // Header Text
  const headerContent = globalMadreDrawerSource.slice(
    globalMadreDrawerSource.indexOf('<header'),
    globalMadreDrawerSource.indexOf('</header>')
  );
  assert.match(globalMadreDrawerSource, /<span[^>]*text-white[^>]*>MADRE<\/span>/);
  assert.match(globalMadreDrawerSource, /Cerebro Central/);
  assert.doesNotMatch(headerContent, /#REF-MADRE/);
  assert.doesNotMatch(headerContent, /MADRE Core/);

  // Header Buttons with ml-auto gap-3 container and shrink-0
  assert.match(globalMadreDrawerSource, /ml-auto/);
  assert.match(globalMadreDrawerSource, /gap-3/);
  assert.match(globalMadreDrawerSource, /id="madre-mute-button"[^>]*shrink-0/);
  assert.match(globalMadreDrawerSource, /id="madre-reset-button"[^>]*shrink-0/);
  assert.match(globalMadreDrawerSource, /id="madre-close-button"[^>]*shrink-0/);
  assert.match(globalMadreDrawerSource, /id="madre-close-button"[\s\S]*?<svg/);

  // Chat Bubbles width & white text enforcement
  assert.match(globalMadreDrawerSource, /max-w-\[95%\]/);
  assert.match(madrePanelCssSource, /min-width:\s*150px/);
  assert.match(madrePanelCssSource, /width:\s*max-content/);
  assert.match(madrePanelCssSource, /color:\s*#ffffff\s*!important/);
});

test('10. DWT Calculator Sync: DWT input strictly bound to optimalDwt when auto-sized, crisp badge rendered, and vanilla DOM synced', () => {
  assert.match(tceWorkspaceSource, /value=\{\s*isAutoSized\s*&&\s*optimalDwt\s*>\s*0\s*\?\s*optimalDwt\s*:\s*localDwt\s*\}/);
  assert.match(tceWorkspaceSource, /readOnly=\{\s*Boolean\(isAutoSized\s*&&\s*optimalDwt\s*>\s*0\)\s*\}/);
  assert.match(tceWorkspaceSource, /id="tbn-auto-sizing-badge-router"/);
  assert.doesNotMatch(tceWorkspaceSource, /id="tbn-auto-sizing-badge-router"[^>]*\.hidden/);
  assert.match(autoSizingSource, /dwtInput\.value\s*=\s*calculatedDwt/);

  // Crisp Badge classes
  assert.match(indexHtmlSource, /id="tbn-auto-sizing-badge"[^>]*text-teal-300[^>]*bg-slate-900[^>]*border-teal-500/);
  assert.match(tceWorkspaceSource, /id="tbn-auto-sizing-badge-router"[^>]*text-teal-300[^>]*bg-slate-900[^>]*border-teal-500/);

  // Aggressive vanilla sync in index.html
  assert.match(indexHtmlSource, /Aggressive DOM Sync for TBN Auto-Sizing/);
  assert.match(indexHtmlSource, /setInterval\(\(\)\s*=>\s*\{[\s\S]*?dwtInput\.value\s*=\s*optimal/);
});

test('11. Global MADRE connected to Data Bridge AI API endpoint with handleSubmit, error handling, and auto-scroll', () => {
  assert.match(globalMadreDrawerSource, /https:\/\/neon-seachartercorepro-4ce09d\.netlify\.app\/\.netlify\/functions\/madre-chat/);
  assert.match(globalMadreDrawerSource, /handleSubmit/);
  assert.match(globalMadreDrawerSource, /messagesEndRef\.current\?\.scrollIntoView/);
  assert.match(globalMadreDrawerSource, /Reefer Charter Core PRO/);
  assert.match(globalMadreDrawerSource, /RDM\/2026-TBN/);
  assert.match(globalMadreDrawerSource, /Error de conexión con el Cerebro Central en Data Bridge\. Verifica los permisos CORS o reintenta\./);
});
