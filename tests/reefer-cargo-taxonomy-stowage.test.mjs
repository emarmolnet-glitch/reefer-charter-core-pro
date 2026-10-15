import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CARGO_TAXONOMY,
  DEFAULT_CARGO_TYPE_ID,
  resolveCargoTaxonomyId,
  getCargoTaxonomyItem,
} from '../cargo-taxonomy.mjs';
import {
  CARGO_CATEGORIES,
  CARGO_PRODUCT_TREE,
  CARGO_SPECIFICATIONS,
  CARGO_SPECIFICATION_IDS,
} from '../shared/cargo-mapper.mjs';

const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('1. index.html defines the 5 Reefer main cargo categories in cargo-type select', () => {
  const cargoTypeSelectMatch = indexSource.match(/<select id="cargo-type"[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(cargoTypeSelectMatch, 'cargo-type select must exist');
  const selectContent = cargoTypeSelectMatch[1];

  const expectedCategories = [
    'Frutas Cítricas',
    'Frutas Tropicales y Exóticas',
    'Fruta de Hueso y Pepita',
    'Carnes y Pescados Congelados',
    'Productos Farmacéuticos',
  ];

  for (const cat of expectedCategories) {
    assert.match(
      selectContent,
      new RegExp(`<option value="${cat}">\\s*${cat}\\s*<\\/option>`),
      `Category ${cat} must be present in cargo-type dropdown`
    );
  }
});

test('2. index.html defines the 3 numeric cargo specifications (10, 20, 30) in cargo-type-manual', () => {
  const manualSelectMatch = indexSource.match(/<select id="cargo-type-manual"[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(manualSelectMatch, 'cargo-type-manual select must exist');
  const selectContent = manualSelectMatch[1];

  assert.match(selectContent, /<option value="10"[^>]*>10 - Frutas Frescas \(Temperatura >0°C\)<\/option>/);
  assert.match(selectContent, /<option value="20">20 - Congelados \(Temperatura (?:<|&lt;)0°C\)<\/option>/);
  assert.match(selectContent, /<option value="30">30 - Productos Farmacéuticos y Sensibles<\/option>/);
});

test('3. cargoDictionary in index.html defines specific products and stowage factors for each category', () => {
  assert.match(indexSource, /const cargoDictionary = \{/);

  // Frutas Cítricas: Naranjas (0.85), Limones (0.88), Mandarinas (0.83)
  assert.match(indexSource, /"Frutas Cítricas":\s*\[/);
  assert.match(indexSource, /\{ nombre:\s*"Naranjas",\s*sf:\s*0\.85/);
  assert.match(indexSource, /\{ nombre:\s*"Limones",\s*sf:\s*0\.88/);
  assert.match(indexSource, /\{ nombre:\s*"Mandarinas",\s*sf:\s*0\.83/);

  // Frutas Tropicales y Exóticas: Bananas/Plátanos (0.75 - requiere 13°C), Piñas (0.80), Aguacates (0.78), Mangos (0.82)
  assert.match(indexSource, /"Frutas Tropicales y Exóticas":\s*\[/);
  assert.match(indexSource, /\{ nombre:\s*"Bananas\/Plátanos \(requiere 13°C\)",\s*sf:\s*0\.75/);
  assert.match(indexSource, /\{ nombre:\s*"Piñas",\s*sf:\s*0\.80/);
  assert.match(indexSource, /\{ nombre:\s*"Aguacates",\s*sf:\s*0\.78/);
  assert.match(indexSource, /\{ nombre:\s*"Mangos",\s*sf:\s*0\.82/);

  // Fruta de Hueso y Pepita: Manzanas (0.85 - alto etileno), Peras (0.84), Uvas/Arándanos (0.90), Melocotones/Ciruelas (0.86)
  assert.match(indexSource, /"Fruta de Hueso y Pepita":\s*\[/);
  assert.match(indexSource, /\{ nombre:\s*"Manzanas \(alto etileno\)",\s*sf:\s*0\.85/);
  assert.match(indexSource, /\{ nombre:\s*"Peras",\s*sf:\s*0\.84/);
  assert.match(indexSource, /\{ nombre:\s*"Uvas\/Arándanos",\s*sf:\s*0\.90/);
  assert.match(indexSource, /\{ nombre:\s*"Melocotones\/Ciruelas",\s*sf:\s*0\.86/);

  // Carnes y Pescados: Pescado Congelado (0.65), Pollo Congelado (0.60), Carne de Res Congelada (0.62)
  assert.match(indexSource, /"Carnes y Pescados Congelados":\s*\[/);
  assert.match(indexSource, /\{ nombre:\s*"Pescado Congelado",\s*sf:\s*0\.65/);
  assert.match(indexSource, /\{ nombre:\s*"Pollo Congelado",\s*sf:\s*0\.60/);
  assert.match(indexSource, /\{ nombre:\s*"Carne de Res Congelada",\s*sf:\s*0\.62/);

  // Productos Farmacéuticos: Vacunas/Medicinas (1.20 - alto valor, estiba ligera)
  assert.match(indexSource, /"Productos Farmacéuticos":\s*\[/);
  assert.match(indexSource, /\{ nombre:\s*"Vacunas\/Medicinas \(alto valor, estiba ligera\)",\s*sf:\s*1\.20/);
});

test('4. cargo-taxonomy.mjs specifies Reefer codes 10, 20, 30 and handles resolution', () => {
  assert.equal(CARGO_TAXONOMY.length, 3);
  assert.equal(DEFAULT_CARGO_TYPE_ID, '10');

  assert.equal(CARGO_TAXONOMY[0].id, '10');
  assert.equal(CARGO_TAXONOMY[0].label, 'Frutas Frescas (Temperatura >0°C)');

  assert.equal(CARGO_TAXONOMY[1].id, '20');
  assert.equal(CARGO_TAXONOMY[1].label, 'Congelados (Temperatura <0°C)');

  assert.equal(CARGO_TAXONOMY[2].id, '30');
  assert.equal(CARGO_TAXONOMY[2].label, 'Productos Farmacéuticos y Sensibles');

  assert.equal(resolveCargoTaxonomyId('10'), '10');
  assert.equal(resolveCargoTaxonomyId('20'), '20');
  assert.equal(resolveCargoTaxonomyId('30'), '30');
  assert.equal(resolveCargoTaxonomyId('Naranjas'), '10');
  assert.equal(resolveCargoTaxonomyId('Pescado Congelado'), '20');
  assert.equal(resolveCargoTaxonomyId('Vacunas/Medicinas'), '30');

  assert.equal(getCargoTaxonomyItem('10').label, 'Frutas Frescas (Temperatura >0°C)');
  assert.equal(getCargoTaxonomyItem('20').label, 'Congelados (Temperatura <0°C)');
  assert.equal(getCargoTaxonomyItem('30').label, 'Productos Farmacéuticos y Sensibles');
});

test('5. shared/cargo-mapper.mjs includes Reefer taxonomy structures', () => {
  assert.ok(CARGO_CATEGORIES.includes('Frutas Cítricas'));
  assert.ok(CARGO_CATEGORIES.includes('Frutas Tropicales y Exóticas'));
  assert.ok(CARGO_CATEGORIES.includes('Fruta de Hueso y Pepita'));
  assert.ok(CARGO_CATEGORIES.includes('Carnes y Pescados Congelados'));
  assert.ok(CARGO_CATEGORIES.includes('Productos Farmacéuticos'));

  assert.equal(CARGO_SPECIFICATIONS['10'], '10 - Frutas Frescas (Temperatura >0°C)');
  assert.equal(CARGO_SPECIFICATIONS['20'], '20 - Congelados (Temperatura <0°C)');
  assert.equal(CARGO_SPECIFICATIONS['30'], '30 - Productos Farmacéuticos y Sensibles');

  assert.deepEqual(CARGO_PRODUCT_TREE['Frutas Cítricas'], ['Naranjas', 'Limones', 'Mandarinas']);
  assert.deepEqual(CARGO_PRODUCT_TREE['Carnes y Pescados Congelados'], ['Pescado Congelado', 'Pollo Congelado', 'Carne de Res Congelada']);
});
