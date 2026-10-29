import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const drawerSource = readFileSync(new URL('../src/components/GlobalMadreDrawer.jsx', import.meta.url), 'utf8');
const madrePanelJsSource = readFileSync(new URL('../assets/js/madre-panel.js', import.meta.url), 'utf8');

test('1. REEFER_DOM_DICTIONARY declaration and module keys', async () => {
  assert.match(drawerSource, /export\s+const\s+REEFER_DOM_DICTIONARY/, 'GlobalMadreDrawer must export REEFER_DOM_DICTIONARY');
  assert.match(madrePanelJsSource, /export\s+const\s+REEFER_DOM_DICTIONARY/, 'madre-panel.js must export REEFER_DOM_DICTIONARY');

  const requiredModules = ['mapa', 'calculadora', 'dossiers', 'decisiones', 'compatibilidad', 'tracking', 'densidad', 'auditoria'];
  for (const mod of requiredModules) {
    assert.match(drawerSource, new RegExp(`${mod}:\\s*\\{`), `GlobalMadreDrawer dictionary must include ${mod}`);
    assert.match(madrePanelJsSource, new RegExp(`${mod}:\\s*\\{`), `madre-panel.js dictionary must include ${mod}`);
  }
});

test('2. Prioritized extraction and dictionary matching in capturarDomModuloActivo', async () => {
  assert.match(madrePanelJsSource, /REEFER_DOM_DICTIONARY\[dictKey\]/);
  assert.match(drawerSource, /REEFER_DOM_DICTIONARY\[dictKey\]/);
  assert.match(madrePanelJsSource, /metricasClaveVisibles/);
  assert.match(drawerSource, /metricasClaveVisibles/);
  assert.match(madrePanelJsSource, /\[Métricas Clave\]:/);
  assert.match(drawerSource, /\[Métricas Clave\]:/);
});

test('3. Simulated execution of capturarDomModuloActivo with DOM mock via data URL', async () => {
  const dataUrl = `data:text/javascript;base64,${Buffer.from(madrePanelJsSource).toString('base64')}`;
  const { capturarDomModuloActivo, REEFER_DOM_DICTIONARY } = await import(dataUrl);

  assert.ok(REEFER_DOM_DICTIONARY.mapa);
  assert.ok(REEFER_DOM_DICTIONARY.calculadora);

  const fakeDoc = {
    querySelector: (selector) => {
      if (selector === '#map-port-pol') return { value: 'Valencia', tagName: 'INPUT', type: 'text', id: 'map-port-pol' };
      if (selector === '#map-port-pod') return { value: 'Miami', tagName: 'INPUT', type: 'text', id: 'map-port-pod' };
      if (selector === '#sync-miles-label') return { innerText: '4,150 NM', tagName: 'SPAN', id: 'sync-miles-label' };
      if (selector === '#pallet-quantity') return { value: '2500', tagName: 'INPUT', type: 'number', id: 'pallet-quantity' };
      if (selector === '#exec-tce') return { textContent: '$18,500 / día', tagName: 'SPAN', id: 'exec-tce' };
      return null;
    },
    querySelectorAll: () => [],
    getElementById: () => null,
  };

  const mapResult = capturarDomModuloActivo(fakeDoc, { id: 'map', displayName: 'Mapa y Rutas Frigoríficas', container: fakeDoc });
  assert.equal(mapResult.modulo_actual, 'Mapa y Rutas Frigoríficas');
  assert.ok(mapResult.datos_formulario['#map-port-pol'] === 'Valencia' || Object.values(mapResult.datos_formulario).includes('Valencia'));
  assert.match(mapResult.elementos_visibles, /\[Métricas Clave\]:/);
  assert.match(mapResult.elementos_visibles, /4,150 NM/);

  const calcResult = capturarDomModuloActivo(fakeDoc, { id: 'estimator', displayName: 'Calculadora de Viaje Frigorífica (Estimador)', container: fakeDoc });
  assert.ok(calcResult.datos_formulario['#pallet-quantity'] === '2500' || Object.values(calcResult.datos_formulario).includes('2500'));
  assert.match(calcResult.elementos_visibles, /\[Métricas Clave\]:/);
  assert.match(calcResult.elementos_visibles, /\$18,500 \/ día/);
});
