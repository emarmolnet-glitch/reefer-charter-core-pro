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
  `;
  vm.runInNewContext(script, sandbox);
  return {
    buildMotherExecutiveScript: sandbox.out_buildMotherExecutiveScript,
    playNeuralMotherVoice: sandbox.out_playNeuralMotherVoice,
  };
}

test('Paso 1: buildMotherExecutiveScript evaluates Reefer carga en pallets with correct defaults and formulas', () => {
  const { buildMotherExecutiveScript } = getDrawerFunctions();
  assert.equal(typeof buildMotherExecutiveScript, 'function');

  // Test with default state
  const defaultScript = buildMotherExecutiveScript({});
  assert.match(defaultScript, /Escaneo frigorífico completado\./);
  assert.match(defaultScript, /28\.5 dólares por pallet/);
  assert.match(defaultScript, /4000 unidades/);
  assert.match(defaultScript, /Estacionalidad en valle, sin recargos PSS\./);
  assert.match(defaultScript, /108 dólares de gestión/);
  assert.match(defaultScript, /0 dólares/);
  assert.match(defaultScript, /Operación validada\./);

  // Test with custom active state
  const customScript = buildMotherExecutiveScript({
    pallets: 5500,
    breakEvenUnitario: 32.75,
    pssActivo: true,
    riesgosDetectados: true,
  });
  assert.match(customScript, /32\.75 dólares por pallet/);
  assert.match(customScript, /5500 unidades/);
  assert.match(customScript, /Se ha detectado un Peak Season Surcharge activo por estacionalidad\./);
  assert.match(customScript, /prevenido posibles fugas por valor de 2300 dólares/);
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
