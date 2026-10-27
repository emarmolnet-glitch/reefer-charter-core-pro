import { jsPDF } from 'jspdf';
import { getOperationalClauses } from './clause-matrix.mjs';

export { CLAUSE_MATRIX, getOperationalClauses, resolveCommercialRole, resolveCargoKey, getClauseSectionTitle } from './clause-matrix.mjs';

const COLORS = Object.freeze({
    navy: [15, 39, 64],
    teal: [37, 161, 142],
    ink: [30, 41, 59],
    muted: [100, 116, 139],
    line: [226, 232, 240],
    surface: [248, 250, 252],
    white: [255, 255, 255],
});

const PAGE = Object.freeze({
    margin: 16,
    width: 210,
});

function textValue(value, fallback = 'No disponible') {
    const normalizedValue = String(value ?? '').trim();
    return normalizedValue || fallback;
}

function numberValue(value) {
    if (value === '' || value === null || value === undefined) return null;
    const normalizedValue = Number(value);
    return Number.isFinite(normalizedValue) ? normalizedValue : null;
}

function formatNumber(value, suffix = '') {
    const normalizedValue = numberValue(value);
    if (normalizedValue === null) return 'No disponible';
    const formattedValue = normalizedValue.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
    return `${formattedValue}${suffix}`;
}

function formatCurrencyPerTonne(value) {
    const normalizedValue = numberValue(value);
    if (normalizedValue === null) return 'No disponible';
    return `$ ${normalizedValue.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })} / TM`;
}

function formatDate(value) {
    const normalizedValue = textValue(value, '');
    const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedValue);
    return dateParts ? `${dateParts[3]}/${dateParts[2]}/${dateParts[1]}` : normalizedValue;
}

function formatDateTime(date, time) {
    const formattedDate = formatDate(date);
    const formattedTime = textValue(time, '');
    return [formattedDate, formattedTime].filter(Boolean).join(' ') || 'No disponible';
}

function drawSectionTitle(document, title, y) {
    document.setDrawColor(...COLORS.line);
    document.setLineWidth(0.35);
    document.line(PAGE.margin, y + 4, PAGE.width - PAGE.margin, y + 4);
    document.setFillColor(...COLORS.white);
    const upperTitle = title.toUpperCase();
    const textWidth = typeof document.getTextWidth === 'function'
        ? document.getTextWidth(upperTitle)
        : upperTitle.length * 2.2;
    document.rect(PAGE.margin, y - 1, Math.max(49, textWidth + 6), 8, 'F');
    document.setTextColor(...COLORS.navy);
    document.setFont('helvetica', 'bold');
    document.setFontSize(8.5);
    document.text(upperTitle, PAGE.margin, y + 4);
}

function drawField(document, { label, value, x, y, width }) {
    document.setTextColor(...COLORS.muted);
    document.setFont('helvetica', 'bold');
    document.setFontSize(7);
    document.text(label.toUpperCase(), x, y);
    document.setTextColor(...COLORS.ink);
    document.setFont('helvetica', 'normal');
    document.setFontSize(10);
    const lines = document.splitTextToSize(textValue(value), width);
    document.text(lines, x, y + 6);
}

function drawMetric(document, { label, value, x, y, width, height = 24, accent = false }) {
    document.setFillColor(...(accent ? COLORS.navy : COLORS.surface));
    document.setDrawColor(...(accent ? COLORS.navy : COLORS.line));
    document.roundedRect(x, y, width, height, 2.5, 2.5, 'FD');
    document.setTextColor(...(accent ? [153, 246, 228] : COLORS.muted));
    document.setFont('helvetica', 'bold');
    document.setFontSize(7);
    document.text(label.toUpperCase(), x + 5, y + 7);
    document.setTextColor(...(accent ? COLORS.white : COLORS.navy));
    document.setFontSize(accent ? 13 : 10.5);
    document.text(textValue(value), x + 5, y + 17, { maxWidth: width - 10 });
}

function createFileName() {
    const date = new Date().toISOString().slice(0, 10);
    return `Commercial-Recap-${date}.pdf`;
}

export function exportCommercialRecapPdf(rawData = {}) {
    const document = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    const route = rawData.route ?? {};
    const laycan = rawData.laycan ?? {};
    const cargo = rawData.cargo ?? {};
    const trading = rawData.trading ?? {};
    const chartering = rawData.chartering ?? {};
    const result = rawData.result ?? {};

    document.setFillColor(...COLORS.navy);
    document.rect(0, 0, PAGE.width, 42, 'F');
    document.setFillColor(...COLORS.teal);
    document.rect(0, 42, PAGE.width, 2, 'F');
    document.setTextColor(...COLORS.white);
    document.setFont('helvetica', 'bold');
    document.setFontSize(9);
    document.text('SEACHARTER CORE PRO · BIMCO REEFERCON 94', PAGE.margin, 15);
    document.setFontSize(22);
    document.text('Fixture Recap (REEFERCON 94)', PAGE.margin, 27);
    document.setFont('helvetica', 'normal');
    document.setFontSize(8);
    document.setTextColor(203, 213, 225);
    document.text(`Snapshot comercial · BIMCO REEFERCON 94 · ${new Date().toLocaleString('es-ES')}`, PAGE.margin, 35);

    drawSectionTitle(document, 'Viaje y carga', 50);
    drawField(document, {
        label: 'Puerto de carga',
        value: route.loadPort,
        x: PAGE.margin,
        y: 62,
        width: 52,
    });
    drawField(document, {
        label: 'Puerto de descarga',
        value: route.dischargePort,
        x: 76,
        y: 62,
        width: 52,
    });
    drawField(document, {
        label: 'Laycan',
        value: `${formatDateTime(laycan.startDate, laycan.startTime)} — ${formatDateTime(laycan.endDate, laycan.endTime)}`,
        x: 136,
        y: 62,
        width: 58,
    });
    drawMetric(document, {
        label: 'Tonelaje',
        value: formatNumber(cargo.tonnage, ' TM'),
        x: PAGE.margin,
        y: 80,
        width: 86,
        height: 22,
    });
    drawMetric(document, {
        label: 'Tolerancia MOLOO / MOLCO',
        value: formatNumber(cargo.tolerance, ' %'),
        x: 108,
        y: 80,
        width: 86,
        height: 22,
    });

    drawSectionTitle(document, 'Trading y fletamento', 110);
    drawMetric(document, {
        label: 'Precio FOB',
        value: formatCurrencyPerTonne(trading.fobPrice),
        x: PAGE.margin,
        y: 120,
        width: 56,
        height: 22,
    });
    drawMetric(document, {
        label: 'Precio CIF',
        value: formatCurrencyPerTonne(trading.cifPrice),
        x: 77,
        y: 120,
        width: 56,
        height: 22,
    });
    drawMetric(document, {
        label: 'Flete Justo',
        value: formatCurrencyPerTonne(chartering.fairFreight),
        x: 138,
        y: 120,
        width: 56,
        height: 22,
    });

    drawSectionTitle(document, 'Resultado', 150);
    drawMetric(document, {
        label: 'Margen neto final',
        value: formatCurrencyPerTonne(result.netMargin),
        x: PAGE.margin,
        y: 160,
        width: PAGE.width - (PAGE.margin * 2),
        height: 20,
        accent: true,
    });

    // Sección final: Matriz Bidireccional de Cláusulas Operativas Estipuladas
    const operationalData = getOperationalClauses({
        cargo: cargo.product || cargo.type || cargo.commodity || rawData.commodity || rawData.cargoType || rawData.cargoProduct || cargo,
        role: rawData.role || rawData.perspective || rawData.commercialRole || rawData.mode || rawData.activeMargin,
        commodity: rawData.commodity,
        cargoType: rawData.cargoType,
        cargoProduct: rawData.cargoProduct,
    });

    drawSectionTitle(document, operationalData.title, 188);

    let currentY = 198;
    const bulletX = PAGE.margin;
    const textX = PAGE.margin + 4;
    const maxTextWidth = PAGE.width - PAGE.margin - textX;

    document.setFont('helvetica', 'normal');
    document.setFontSize(7.2);

    for (const clause of operationalData.clauses) {
        if (currentY > 260) {
            document.addPage();
            currentY = 20;
        }

        document.setFillColor(...COLORS.teal);
        document.circle(bulletX + 1.2, currentY - 1, 0.75, 'F');

        document.setTextColor(...COLORS.ink);
        const lines = document.splitTextToSize(clause, maxTextWidth);
        document.text(lines, textX, currentY);
        currentY += (lines.length * 3.3) + 2.2;
    }

    document.setDrawColor(...COLORS.line);
    document.line(PAGE.margin, 272, PAGE.width - PAGE.margin, 272);
    document.setTextColor(...COLORS.muted);
    document.setFont('helvetica', 'normal');
    document.setFontSize(7);
    document.text('Documento generado bajo proforma BIMCO REEFERCON 94 desde la sesión activa.', PAGE.margin, 279);
    document.text('SeaCharter Core PRO', PAGE.width - PAGE.margin, 279, { align: 'right' });

    if (rawData.save !== false && rawData.skipSave !== true && typeof document.save === 'function') {
        document.save(createFileName());
    }
    return document;
}
