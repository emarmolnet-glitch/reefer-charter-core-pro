import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const drawerSource = readFileSync(new URL('../src/components/GlobalMadreDrawer.jsx', import.meta.url), 'utf8');

function getDrawerFunctions() {
  const sandbox = {
    console,
    window: {},
  };
  const script = `
    ${drawerSource
      .replace(/import\s*[^;]+;?/g, '')
      .replace(/export\s+const\s+MADRE_API_ENDPOINT[^;]+;/g, '')
      .replace(/export\s+function\s+GlobalMadreDrawer[\s\S]*$/, '')
      .replace(/export\s+function/g, 'function')
      .replace(/export\s+const/g, 'const')}
    
    out_buildMotherExecutiveScript = buildMotherExecutiveScript;
    out_playNeuralMotherVoice = playNeuralMotherVoice;
    out_getMaxTransitDays = typeof getMaxTransitDays !== 'undefined' ? getMaxTransitDays : null;
  `;
  vm.runInNewContext(script, sandbox);
  return {
    buildMotherExecutiveScript: sandbox.out_buildMotherExecutiveScript,
    playNeuralMotherVoice: sandbox.out_playNeuralMotherVoice,
    getMaxTransitDays: sandbox.out_getMaxTransitDays,
  };
}

test('Paso 1: getMaxTransitDays and buildMotherExecutiveScript evaluate Shelf-Life and PSS', () => {
  const { buildMotherExecutiveScript, getMaxTransitDays } = getDrawerFunctions();
  assert.equal(typeof buildMotherExecutiveScript, 'function');
  assert.equal(typeof getMaxTransitDays, 'function');

  // Test Shelf-Life limits catalog
  assert.equal(getMaxTransitDays('Plátano de Canarias'), 26);
  assert.equal(getMaxTransitDays('Bananas Cavendish'), 26);
  assert.equal(getMaxTransitDays('Carne Fresca Porcina'), 18);
  assert.equal(getMaxTransitDays('Pescado Fresco'), 18);
  assert.equal(getMaxTransitDays('Verduras Variadas'), 21);
  assert.equal(getMaxTransitDays('Hortalizas'), 21);
  assert.equal(getMaxTransitDays('Pharma Vaccines'), 30);
  assert.equal(getMaxTransitDays('Cítricos / Naranjas'), 35);
  assert.equal(getMaxTransitDays('Pescado Congelado'), 60);
  assert.equal(getMaxTransitDays('Carga Genérica'), 40);

  // Test with default state
  const defaultScript = buildMotherExecutiveScript({});
  assert.match(defaultScript, /Escaneo analítico completado\./);
  assert.match(defaultScript, /El buque es óptimo para los requerimientos de cubicaje\./);
  assert.match(defaultScript, /0\.00 dólares por pallet/);
  assert.match(defaultScript, /Las condiciones operativas y térmicas proyectadas son favorables\./);
  assert.match(defaultScript, /se han ahorrado 90 dólares en horas de gestión/);
  assert.match(defaultScript, /prevenido exposiciones de riesgo por valor de 0 dólares/);

  // Test Shelf-Life critical alert (transit days > shelf life) + PSS alert
  const shelfLifeAlertScript = buildMotherExecutiveScript({
    producto: 'Bananas Frescas',
    diasTotales: 29.5,
    pallets: 5000,
    breakEven: 32.75,
    pdaInyectada: true,
    pssActivo: true,
  });
  assert.match(shelfLifeAlertScript, /32\.75 dólares por pallet/);
  assert.match(shelfLifeAlertScript, /¡ALERTA CRÍTICA DE SHELF-LIFE!/);
  assert.match(shelfLifeAlertScript, /29\.5 días supera el límite de caducidad comercial de 26 días/);
  assert.match(shelfLifeAlertScript, /Riesgo inminente de maduración prematura o pudrición total\./);
  assert.match(shelfLifeAlertScript, /Alerta financiera: Peak Season Surcharge \(PSS\) detectado\. Blindar recargos\./);
  assert.match(shelfLifeAlertScript, /se han ahorrado 203 dólares en horas de gestión/);
  // Fugas: 5000 pallets * $120 = $600,000
  assert.match(shelfLifeAlertScript, /prevenido exposiciones de riesgo por valor de 600000 dólares/);

  // Test with normal transit time but thermal stress deviations
  const stressScript = buildMotherExecutiveScript({
    producto: 'Bananas Frescas',
    diasTotales: 18.0,
    pallets: 4000,
    breakEven: 28.5,
    riesgosDetectados: true,
  });
  assert.match(stressScript, /Se detectan desviaciones térmicas en el Escenario Estrés\. Revise los márgenes de seguridad en puerto\./);
});

test('Paso 2: playNeuralMotherVoice bypasses CSP with Web Audio API without blob: URLs', async () => {
  const { playNeuralMotherVoice } = getDrawerFunctions();
  assert.equal(typeof playNeuralMotherVoice, 'function');
  const emptyRes = await playNeuralMotherVoice('');
  assert.equal(emptyRes, null);

  // Static analysis: verify no blob: URLs used
  assert.doesNotMatch(drawerSource, /URL\.createObjectURL/);
  assert.doesNotMatch(drawerSource, /blob:/);

  // Verify Web Audio API usage
  assert.match(drawerSource, /decodeAudioData/);
  assert.match(drawerSource, /createBufferSource/);
  assert.match(drawerSource, /audioCtx\.destination/);
  assert.match(drawerSource, /\.netlify\/functions\/madre-voice/);
});

test('Paso 3: handleSendMessage routes local commands, handles async state, and talks to LLM', () => {
  // Check async signature and loading state
  assert.match(drawerSource, /const handleSendMessage = async/);
  assert.match(drawerSource, /setIsLoading\(true\)/);
  assert.match(drawerSource, /setIsLoading\(false\)/);

  // Check local router for hola / madre
  assert.match(drawerSource, /lowerInput\.includes\(["']hola["']\)\s*\|\|\s*lowerInput\s*===\s*["']madre["']/);
  assert.match(drawerSource, /¡Hola! Aquí MADRE\. Los sistemas frigoríficos están en línea\./);

  // Check local router for escanear / audita / roi
  assert.match(drawerSource, /lowerInput\.includes\(["']escanear["']\)\s*\|\|\s*lowerInput\.includes\(["']audita["']\)\s*\|\|\s*lowerInput\.includes\(["']roi["']\)/);
  assert.match(drawerSource, /buildMotherExecutiveScript\(stateForVoice\)/);

  // Check LLM fallback and playNeuralMotherVoice call
  assert.match(drawerSource, /\.netlify\/functions\/madre-chat/);
  assert.match(drawerSource, /playNeuralMotherVoice\(replyText\)/);
});

test('Paso 4: SpeechRecognition callback has hands-free auto-send on isFinal', () => {
  assert.match(drawerSource, /recognition\.onresult = async \(/);
  assert.match(drawerSource, /const transcript = event\.results\[0\]\[0\]\.transcript;/);
  assert.match(drawerSource, /setInputValue\(transcript\);/);
  assert.match(drawerSource, /if \(event\.results\[0\]\.isFinal\)/);
  assert.match(drawerSource, /await handleSendMessage\(transcript\);/);
});
