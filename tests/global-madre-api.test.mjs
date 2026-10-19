import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const drawerSource = readFileSync(new URL('../src/components/GlobalMadreDrawer.jsx', import.meta.url), 'utf8');

test('1. Global MADRE defines the direct Data Bridge Netlify function endpoint', () => {
  assert.match(
    drawerSource,
    /const\s+MADRE_API_ENDPOINT\s*=\s*["']https:\/\/neon-seachartercorepro-4ce09d\.netlify\.app\/\.netlify\/functions\/madre-chat["']/,
    'Must define MADRE_API_ENDPOINT bypassing rewrite with direct .netlify/functions path'
  );
});

test('2. handleSubmit sends strict CORS POST request with clean headers and mensajeUsuario payload', () => {
  assert.match(drawerSource, /fetch\(\s*MADRE_API_ENDPOINT/);
  assert.match(drawerSource, /method:\s*["']POST["']/);
  assert.match(drawerSource, /mode:\s*["']cors["']/);
  assert.match(drawerSource, /"Content-Type":\s*["']application\/json["']/);
  assert.match(drawerSource, /"Accept":\s*["']application\/json["']/);
  assert.match(drawerSource, /mensajeUsuario:\s*texto/);
  assert.match(drawerSource, /origin:\s*["']Reefer Charter Core PRO["']/);
  assert.match(drawerSource, /projectRef:\s*referenciaMadre\s*\|\|\s*["']RDM\/2026-TBN["']/);
});

test('3. Message objects conform to specifications for user and assistant', () => {
  // User message object
  assert.match(drawerSource, /rol:\s*["']user["']/);
  assert.match(drawerSource, /autor:\s*["']Operador["']/);

  // Assistant message object
  assert.match(drawerSource, /rol:\s*["']assistant["']/);
  assert.match(drawerSource, /autor:\s*["']MADRE Core["']/);
  assert.match(drawerSource, /data\?\.reply\s*\|\|\s*data\?\.response\s*\|\|\s*data\?\.message/);
});

test('4. Error handling catches fetch/CORS failure and logs cleanly to console', () => {
  assert.match(drawerSource, /try\s*\{[\s\S]*fetch[\s\S]*\}\s*catch/);
  assert.match(drawerSource, /console\.error\(["']MADRE Connection Error:["'],\s*err\)/);
  assert.match(
    drawerSource,
    /Error de conexión con el Cerebro Central en Data Bridge\. Verifica los permisos CORS o reintenta\./
  );
});

test('5. Auto-scroll is wired to messagesEndRef upon mensajes update', () => {
  assert.match(drawerSource, /messagesEndRef\.current\?\.scrollIntoView\(\{\s*behavior:\s*["']smooth["']\s*\}\)/);
  assert.match(drawerSource, /useEffect\(\(\)\s*=>\s*\{[\s\S]*?messagesEndRef\.current\?\.scrollIntoView[\s\S]*?\}\s*,\s*\[mensajes\]\)/);
});

test('6. Form and quick commands are wired to handleSubmit', () => {
  assert.match(drawerSource, /<form[^>]*onSubmit=\{handleSubmit\}/);
  assert.match(drawerSource, /onClick=\{\(\)\s*=>\s*handleQuickCommandClick\(cmd\)\}/);
  assert.match(drawerSource, /handleSubmit\(null,\s*cmdText\)/);
});
