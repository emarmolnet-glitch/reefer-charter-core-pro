import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildReeferScreenAuditReply } from '../netlify/functions/_shared/reefer-audit-builder.mjs';

const drawerSource = readFileSync(new URL('../src/components/GlobalMadreDrawer.jsx', import.meta.url), 'utf8');
const madreChatSource = readFileSync(new URL('../netlify/functions/madre-chat.ts', import.meta.url), 'utf8');
const chatAssistantSource = readFileSync(new URL('../netlify/functions/chat-assistant.js', import.meta.url), 'utf8');

test('1. Frontend: triggerLaserScanEffect implements ice blue #0EA5E9 laser with box-shadow and 1.2s transition', () => {
  assert.match(drawerSource, /export\s+function\s+triggerLaserScanEffect\s*\(\)/, 'Must export triggerLaserScanEffect');
  assert.match(drawerSource, /#0EA5E9/, 'Must use ice blue tone #0EA5E9 for reefer identity');
  assert.match(drawerSource, /0 0 20px #0EA5E9, 0 0 40px #0EA5E9/, 'Must have dual glow box-shadow matching template');
  assert.match(drawerSource, /position\s*=\s*["']fixed["']/, 'Laser must have fixed position');
  assert.match(drawerSource, /zIndex\s*=\s*["']999999["']/, 'Laser must have z-index 999999');
  assert.match(drawerSource, /height\s*=\s*["']4px["']/, 'Laser must have 4px height');
  assert.match(drawerSource, /top 1\.2s cubic-bezier\(0\.4,\s*0,\s*0\.2,\s*1\)/, 'Laser must drop from top to bottom in 1.2s');
  assert.match(drawerSource, /window\.triggerLaserScanEffect\s*=\s*triggerLaserScanEffect/, 'Must attach to window for global access');
});

test('2. Frontend: extractReeferScanData extracts the 4 structured Reefer blocks', () => {
  assert.match(drawerSource, /export\s+function\s+extractReeferScanData/, 'Must export extractReeferScanData');
  assert.match(drawerSource, /ruta_y_tiempos/, 'Must group Block 1: ruta_y_tiempos');
  assert.match(drawerSource, /dias_transito_critico/, 'Must extract dias_transito_critico in Block 1');
  assert.match(drawerSource, /mercancia_y_frio/, 'Must group Block 2: mercancia_y_frio');
  assert.match(drawerSource, /temperatura_objetivo_c/, 'Must extract temperatura_objetivo_c in Block 2');
  assert.match(drawerSource, /ventilacion_cbm_h/, 'Must extract ventilacion_cbm_h in Block 2');
  assert.match(drawerSource, /humedad_controlada/, 'Must extract humedad_controlada in Block 2');
  assert.match(drawerSource, /capacidad_y_estiba/, 'Must group Block 3: capacidad_y_estiba');
  assert.match(drawerSource, /pallets/, 'Must extract pallets in Block 3');
  assert.match(drawerSource, /cajas/, 'Must extract cajas in Block 3');
  assert.match(drawerSource, /cbft_bajo_cubierta/, 'Must extract cbft_bajo_cubierta in Block 3');
  assert.match(drawerSource, /reefer_plugs/, 'Must extract reefer_plugs in Block 3');
  assert.match(drawerSource, /costes_y_fletes/, 'Must group Block 4: costes_y_fletes');
  assert.match(drawerSource, /flete_pallet_caja/, 'Must extract flete_pallet_caja in Block 4');
  assert.match(drawerSource, /recargo_generadores_combustible/, 'Must extract recargo_generadores_combustible in Block 4');
  assert.match(drawerSource, /tce_proyectado/, 'Must extract tce_proyectado in Block 4');
});

test('3. Frontend: getReeferUIContext packages escaneo_estructurado into outgoing payload', () => {
  assert.match(drawerSource, /escaneo_estructurado:\s*escaneoEstructurado/, 'Must attach escaneo_estructurado');
  assert.match(drawerSource, /contexto_ui:\s*getReeferUIContext\(\)/, 'Drawer payload must pass contexto_ui with getReeferUIContext()');
  assert.match(drawerSource, /current_module:\s*["']reefer_charter["']/, 'Must maintain reefer_charter module name');
});

test('4. Backend: buildReeferScreenAuditReply generates formatted text starting with 🔍 **AUDITORÍA FRIGORÍFICA MADRE', () => {
  const mockEscaneo = {
    ruta_y_tiempos: { pol: 'Puerto Limón', pod: 'Vlissingen', dias_transito_critico: 11.5 },
    mercancia_y_frio: { tipo_producto: 'Bananas Frescas', temperatura_objetivo_c: 13.3, ventilacion_cbm_h: '25 CBM/h', humedad_controlada: '90% RH (CA Activa)' },
    capacidad_y_estiba: { pallets: 4800, cajas: 360000, cbft_bajo_cubierta: 304800, reefer_plugs: '120 plugs 440V' },
    costes_y_fletes: { flete_pallet_caja: 42.5, recargo_generadores_combustible: '$520/día', pda_pol: 31000, pda_pod: 29000, tce_proyectado: '$22,400 / día' },
  };

  const reply = buildReeferScreenAuditReply(mockEscaneo);
  assert.ok(reply.startsWith('🔍 **AUDITORÍA FRIGORÍFICA MADRE (ESCANEO DE PANTALLA EN TIEMPO REAL)**'), 'Header must start with AUDITORÍA FRIGORÍFICA MADRE');
  assert.ok(reply.includes('Puerto Limón'), 'Must include POL');
  assert.ok(reply.includes('Vlissingen'), 'Must include POD');
  assert.ok(reply.includes('11.5'), 'Must include critical transit days');
  assert.ok(reply.includes('Bananas Frescas'), 'Must include commodity');
  assert.ok(reply.includes('13.3°C'), 'Must include target temperature');
  assert.ok(reply.includes('25 CBM/h'), 'Must include ventilation');
  assert.ok(reply.includes('4.800') || reply.includes('4800'), 'Must include pallets');
  assert.ok(reply.includes('$42.5'), 'Must include freight per pallet/caja');
  assert.ok(reply.includes('$22,400'), 'Must include projected TCE');
  assert.ok(reply.includes('Bypass anti-timeout ejecutado con éxito'), 'Must confirm anti-timeout bypass');
});

test('5. Backend: madre-chat.ts architecture conforms exactly to master reference template', () => {
  assert.match(madreChatSource, /const\s+escaneo\s*=\s*contexto_ui\?\.escaneo_estructurado;/, 'Must extract escaneo from contexto_ui');
  assert.match(madreChatSource, /const\s+isScanOrScreenAudit\s*=\s*lower\.includes\(['"]escan['"]\)\s*\|\|\s*lower\.includes\(['"]scan['"]\)\s*\|\|\s*lower\.includes\(['"]pantalla['"]\)\s*\|\|\s*\(lower\.includes\(['"]auditor['"]\)\s*&&\s*Boolean\(escaneo\)\);/, 'Must implement master template condition');
  assert.match(madreChatSource, /if\s*\(isScanOrScreenAudit\s*&&\s*escaneo\)\s*\{/, 'Must guard on isScanOrScreenAudit and escaneo');
  assert.match(madreChatSource, /buildReeferScreenAuditReply\(escaneo\)/, 'Must call buildReeferScreenAuditReply with escaneo');
  assert.match(madreChatSource, /escaneo_procesado:\s*true/, 'Must flag escaneo_procesado: true');
  assert.match(madreChatSource, /new\s+Response\(JSON\.stringify\(\{[\s\S]*success:\s*true,[\s\S]*reply:\s*reply,[\s\S]*escaneo_procesado:\s*true[\s\S]*\}\),\s*\{\s*status:\s*200/, 'Must return immediate 200 response matching template');
  assert.match(madreChatSource, /Access-Control-Allow-Origin/, 'Must handle CORS headers');
});

test('6. Backend: chat-assistant.js also intercepts escaneo_estructurado anti-timeout bypass', () => {
  assert.match(chatAssistantSource, /escaneo_estructurado/, 'chat-assistant must check escaneo_estructurado');
  assert.match(chatAssistantSource, /buildReeferScreenAuditReply/, 'chat-assistant must import and invoke buildReeferScreenAuditReply');
  assert.match(chatAssistantSource, /escaneo_procesado:\s*true/, 'chat-assistant must return escaneo_procesado: true');
});
