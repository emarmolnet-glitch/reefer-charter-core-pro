import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("1. Frontend captura el canvas del globo en generateExecutiveReport con try/catch seguro", () => {
  const indexContent = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");

  assert.match(indexContent, /function generateExecutiveReport\(\)\s*\{[\s\S]*?let\s+mapImageBase64\s*=\s*null;/);
  assert.match(indexContent, /const\s+globeCanvas\s*=\s*document\.querySelector\(['"]canvas['"]\);/);
  assert.match(indexContent, /globeCanvas\.toDataURL\(['"]image\/jpeg['"],\s*0\.8\);/);
  assert.match(indexContent, /State\.mapImageBase64\s*=\s*mapImageBase64;/);
});

test("2. VoyageExecutiveReportModal renderiza condicionalmente mapImageBase64 en la UI del reporte", () => {
  const modalContent = fs.readFileSync(path.join(process.cwd(), "src/components/VoyageExecutiveReportModal.jsx"), "utf8");

  assert.match(modalContent, /mapImageBase64/);
  assert.match(modalContent, /w-full flex justify-center my-6 p-4 bg-slate-800\/50 rounded-xl border border-slate-700/);
  assert.match(modalContent, /<img[\s\S]*?src=\{mapImageBase64\}[\s\S]*?alt="Ruta del Viaje"[\s\S]*?max-w-full h-auto max-h-\[400px\] object-contain rounded-lg shadow-lg/);
});

test("3. Template HTML del Reporte Ejecutivo del Viaje incluye la imagen del mapa condicionalmente", () => {
  const indexContent = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");

  assert.match(indexContent, /\$\{State\.mapImageBase64\s*\?\s*`<div style="text-align:center; margin:15px 0;"><img src="\$\{State\.mapImageBase64\}"/);
});

test("4. Fixture Recap PDF captura e inyecta la imagen condicionalmente en index.html y decisiones.html", () => {
  const indexContent = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");
  const decisionesContent = fs.readFileSync(path.join(process.cwd(), "decisiones.html"), "utf8");

  for (const content of [indexContent, decisionesContent]) {
    assert.match(content, /async function generateFixtureRecapPDF\(\)\s*\{[\s\S]*?document\.querySelector\(['"]canvas['"]\)/);
    assert.match(content, /\$\{state\.mapImageBase64\s*\?\s*`<div style="text-align:center; margin:15px 0;"><img src="\$\{state\.mapImageBase64\}"/);
  }
});

test("5. Market Report permanece intacto sin código residual de mapImageBase64", () => {
  const marketTemplate = fs.readFileSync(path.join(process.cwd(), "db/market-report-template.ts"), "utf8");
  const marketFunc = fs.readFileSync(path.join(process.cwd(), "netlify/functions/rodahmar-market-report.ts"), "utf8");

  assert.doesNotMatch(marketTemplate, /mapImageBase64/);
  assert.doesNotMatch(marketFunc, /mapImageBase64/);
});
