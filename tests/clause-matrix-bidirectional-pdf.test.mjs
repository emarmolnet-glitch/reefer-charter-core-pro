import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    CLAUSE_MATRIX,
    resolveCargoKey,
    resolveCommercialRole,
    getClauseSectionTitle,
    getOperationalClauses
} from '../clause-matrix.mjs';

test('1. Matriz de Cláusulas: Contiene términos bidireccionales exactos para Bananas / Tropical Fruits', () => {
    assert.ok(CLAUSE_MATRIX['Bananas / Tropical Fruits'], 'Bananas / Tropical Fruits debe estar en la matriz');

    const { owner_terms, charterer_terms } = CLAUSE_MATRIX['Bananas / Tropical Fruits'];

    assert.equal(owner_terms.length, 3, 'owner_terms debe contener 3 cláusulas');
    assert.equal(
        owner_terms[0],
        "Loading rates strictly guaranteed at 1,500 MT/WWD and discharging at 2,000 MT/WWD. All port and stevedoring overtime for Charterers' account."
    );
    assert.equal(
        owner_terms[1],
        "Pallets strictly limited to a maximum height of 2.20m. Charterers/Shippers are entirely responsible for safe handling, compact stowage with dunnage, and leaving gratings unobstructed."
    );
    assert.equal(
        owner_terms[2],
        "All loading and discharging operations are at Charterers' risk and expense."
    );

    assert.equal(charterer_terms.length, 3, 'charterer_terms debe contener 3 cláusulas');
    assert.equal(
        charterer_terms[0],
        "Prior to NOR, holds must be pre-cooled to 13.5ºC, completely clean, dry, and absolutely free of taint, subject to independent surveyor approval."
    );
    assert.equal(
        charterer_terms[1],
        "Owners fully guarantee constant carrying temperature of 13.5ºC and required fresh air exchanges to prevent ethylene buildup."
    );
    assert.equal(
        charterer_terms[2],
        "Master to provide full temperature datalogs upon completion of discharge."
    );
});

test('2. Matriz de Cláusulas: Contiene soporte para Citrus, Frozen y General Cargo', () => {
    ['Citrus Fruits', 'Frozen Fish / Meat', 'General Cargo'].forEach(category => {
        assert.ok(CLAUSE_MATRIX[category], `${category} debe existir en CLAUSE_MATRIX`);
        assert.ok(Array.isArray(CLAUSE_MATRIX[category].owner_terms), `${category} debe tener owner_terms`);
        assert.ok(Array.isArray(CLAUSE_MATRIX[category].charterer_terms), `${category} debe tener charterer_terms`);
        assert.ok(CLAUSE_MATRIX[category].owner_terms.length >= 3);
        assert.ok(CLAUSE_MATRIX[category].charterer_terms.length >= 3);
    });
});

test('3. Resolución de Carga (resolveCargoKey): Normaliza nombres, códigos y sinónimos', () => {
    assert.equal(resolveCargoKey('Bananas / Tropical Fruits'), 'Bananas / Tropical Fruits');
    assert.equal(resolveCargoKey('Plátanos'), 'Bananas / Tropical Fruits');
    assert.equal(resolveCargoKey('Bananas/Plátanos (requiere 13°C)'), 'Bananas / Tropical Fruits');
    assert.equal(resolveCargoKey('Frutas Tropicales y Exóticas'), 'Bananas / Tropical Fruits');
    assert.equal(resolveCargoKey('10'), 'Bananas / Tropical Fruits');
    assert.equal(resolveCargoKey({ product: 'Bananas/Plátanos' }), 'Bananas / Tropical Fruits');

    assert.equal(resolveCargoKey('Frutas Cítricas'), 'Citrus Fruits');
    assert.equal(resolveCargoKey('Naranjas Valencia'), 'Citrus Fruits');

    assert.equal(resolveCargoKey('Carnes y Pescados Congelados'), 'Frozen Fish / Meat');
    assert.equal(resolveCargoKey('Frozen Fish'), 'Frozen Fish / Meat');

    assert.equal(resolveCargoKey('Carga General'), 'General Cargo');
    assert.equal(resolveCargoKey('Acero y Metales'), 'General Cargo');
});

test('4. Resolución de Rol Comercial (resolveCommercialRole): Discrimina Owner vs Charterer', () => {
    // Strings directos
    assert.equal(resolveCommercialRole('owner'), 'owner');
    assert.equal(resolveCommercialRole('armador'), 'owner');
    assert.equal(resolveCommercialRole('charterer'), 'charterer');
    assert.equal(resolveCommercialRole('fletador'), 'charterer');

    // Objetos con propiedades de rol o perspectiva
    assert.equal(resolveCommercialRole({ role: 'charterer' }), 'charterer');
    assert.equal(resolveCommercialRole({ perspective: 'fletador' }), 'charterer');
    assert.equal(resolveCommercialRole({ commercialRole: 'owner' }), 'owner');
    assert.equal(resolveCommercialRole({ viewMode: 'charterer' }), 'charterer');

    // Por margen aplicado
    assert.equal(resolveCommercialRole({ activeMargin: 'charterer' }), 'charterer');
    assert.equal(resolveCommercialRole({ chartererMarginPercent: 12, ownerMarginPercent: 0 }), 'charterer');
    assert.equal(resolveCommercialRole({ activeMargin: 'owner' }), 'owner');

    // Fallback por defecto
    assert.equal(resolveCommercialRole({}), 'owner');
    assert.equal(resolveCommercialRole(null), 'owner');
});

test('5. Título dinámico de sección (getClauseSectionTitle)', () => {
    assert.equal(
        getClauseSectionTitle('owner'),
        "STIPULATED OPERATIONAL CLAUSES (OWNERS' TERMS)"
    );
    assert.equal(
        getClauseSectionTitle('armador'),
        "STIPULATED OPERATIONAL CLAUSES (OWNERS' TERMS)"
    );
    assert.equal(
        getClauseSectionTitle('charterer'),
        "STIPULATED OPERATIONAL CLAUSES (CHARTERERS' TERMS)"
    );
    assert.equal(
        getClauseSectionTitle('fletador'),
        "STIPULATED OPERATIONAL CLAUSES (CHARTERERS' TERMS)"
    );
});

test('6. getOperationalClauses: Genera el paquete dinámico según perspectiva y carga', () => {
    // Perspectiva Armador (Owner) con Bananas
    const ownerResult = getOperationalClauses({
        cargo: 'Bananas / Tropical Fruits',
        role: 'owner'
    });
    assert.equal(ownerResult.title, "STIPULATED OPERATIONAL CLAUSES (OWNERS' TERMS)");
    assert.equal(ownerResult.role, 'owner');
    assert.equal(ownerResult.clauses.length, 3);
    assert.match(ownerResult.clauses[0], /Loading rates strictly guaranteed at 1,500 MT\/WWD/);
    assert.match(ownerResult.clauses[1], /Pallets strictly limited to a maximum height of 2\.20m/);
    assert.match(ownerResult.clauses[2], /All loading and discharging operations are at Charterers' risk and expense/);

    // Perspectiva Fletador (Charterer) con Plátanos
    const chartererResult = getOperationalClauses({
        cargo: 'Plátanos en bodega',
        role: 'charterer'
    });
    assert.equal(chartererResult.title, "STIPULATED OPERATIONAL CLAUSES (CHARTERERS' TERMS)");
    assert.equal(chartererResult.role, 'charterer');
    assert.equal(chartererResult.clauses.length, 3);
    assert.match(chartererResult.clauses[0], /holds must be pre-cooled to 13\.5ºC/);
    assert.match(chartererResult.clauses[1], /constant carrying temperature of 13\.5ºC and required fresh air exchanges/);
    assert.match(chartererResult.clauses[2], /Master to provide full temperature datalogs/);
});

test('7. Renderizado en PDF (exportCommercialRecapPdf): Inyecta título dinámico y cláusulas con viñetas', async () => {
    const { exportCommercialRecapPdf } = await import('../pdf-export-service.mjs');

    // Test caso 1: Owner
    const ownerMockData = {
        role: 'owner',
        cargo: {
            tonnage: 12000,
            tolerance: 5,
            product: 'Bananas / Tropical Fruits'
        },
        route: { loadPort: 'Guayaquil', dischargePort: 'Rotterdam' },
        laycan: { startDate: '2026-11-01', endDate: '2026-11-05' },
        trading: { fobPrice: 450, cifPrice: 620 },
        chartering: { fairFreight: 170 },
        result: { netMargin: 25 },
        skipSave: true
    };

    const ownerDoc = exportCommercialRecapPdf(ownerMockData);
    assert.ok(ownerDoc, 'Debe devolver la instancia del documento PDF');

    // Test caso 2: Charterer
    const chartererMockData = {
        role: 'charterer',
        cargo: {
            tonnage: 12000,
            tolerance: 5,
            product: 'Bananas/Plátanos (requiere 13°C)'
        },
        route: { loadPort: 'Santa Marta', dischargePort: 'Antwerp' },
        laycan: { startDate: '2026-11-10', endDate: '2026-11-15' },
        trading: { fobPrice: 420, cifPrice: 590 },
        chartering: { fairFreight: 160 },
        result: { netMargin: 30 },
        skipSave: true
    };

    const chartererDoc = exportCommercialRecapPdf(chartererMockData);
    assert.ok(chartererDoc, 'Debe devolver la instancia del documento PDF para Charterer');
});

test('8. Integración Dual Trading & Chartering: el snapshot exportado transfiere rol y carga', async () => {
    const viewCode = await readFile(new URL('../dual-trading-chartering-view.js', import.meta.url), 'utf8');
    assert.match(viewCode, /role:\s*exportContext\.role\s*\|\|\s*globalMode/, 'Captura el rol de exportación');
    assert.match(viewCode, /perspective:\s*exportContext\.perspective\s*\|\|\s*globalMode/, 'Captura la perspectiva');
    assert.match(viewCode, /product:\s*cargoProduct/, 'Transfiere el producto de carga');
});

test('9. Integración en index.html y decisiones.html: plantilla Fixture Recap incluye Sección 5 dinámica', async () => {
    const indexCode = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const decisionesCode = await readFile(new URL('../decisiones.html', import.meta.url), 'utf8');

    // index.html
    assert.match(indexCode, /5\.\s*\$\{opClausesData\.title\}/, 'index.html incluye cabecera dinámica de Sección 5');
    assert.match(indexCode, /STIPULATED OPERATIONAL CLAUSES \(OWNERS' TERMS\)/);
    assert.match(indexCode, /STIPULATED OPERATIONAL CLAUSES \(CHARTERERS' TERMS\)/);
    assert.match(indexCode, /Loading rates strictly guaranteed at 1,500 MT\/WWD/);
    assert.match(indexCode, /holds must be pre-cooled to 13\.5ºC/);

    // decisiones.html
    assert.match(decisionesCode, /5\.\s*\$\{opClausesData\.title\}/, 'decisiones.html incluye cabecera dinámica de Sección 5');
    assert.match(decisionesCode, /STIPULATED OPERATIONAL CLAUSES \(OWNERS' TERMS\)/);
    assert.match(decisionesCode, /STIPULATED OPERATIONAL CLAUSES \(CHARTERERS' TERMS\)/);
});
