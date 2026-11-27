import { hasInvertedHeader, TABLE_CELL_PADDING } from "../../../../../shared/canvas/elements/table.js";
import { resolveElementColor } from "./colorResolver";
import { isTextLegible } from "./lod";
import { lineStartX, paintRichLine, richLineToSvg } from "../text/richTextLayout";
import { tableLayout } from "../text/tableLayout";

const GRID_ALPHA = 0.35;
const HEADER_TINT_ALPHA = 0.08;
const STRIPE_ALPHA = 0.06;

const colorsOf = (table) => ({
    ink: resolveElementColor(table.colorToken, table.color) || "#1f2937",
    fill: resolveElementColor(table.fillColorToken, table.fillColor) || resolveElementColor("bg-surface", "#ffffff"),
});

// Each cell's lines with where they sit, shared by the board and SVG export.
const placedCellLines = (table, layout) =>
    layout.cellLines.flatMap((lines, index) => {
        const row = Math.floor(index / table.cols);
        const box = { x: layout.left + (index % table.cols) * layout.colWidth + TABLE_CELL_PADDING, width: layout.colWidth - TABLE_CELL_PADDING * 2 };
        return lines.map((line, i) => ({
            line,
            row,
            x: lineStartX(table.align || "left", box, line.width),
            baselineY: layout.rowTops[row] + TABLE_CELL_PADDING + (i + 1) * layout.lineHeight - layout.lineHeight * 0.25,
        }));
    });

// What a table's style draws besides its words: tinted row bands, inner rules and whether it has a frame.
const tableDecor = (table, layout) => {
    const style = table.tableStyle ?? "grid";
    const firstBodyRow = table.headerRow ? 1 : 0;
    const right = layout.left + layout.width;
    const bottom = layout.top + layout.height;
    const band = (row, alpha) => ({ y: layout.rowTops[row], height: layout.rowHeights[row], alpha });
    const stripes = layout.rowTops.flatMap((_, row) =>
        style === "striped" && row > firstBodyRow && (row - firstBodyRow) % 2 === 1 ? [band(row, STRIPE_ALPHA)] : [],
    );
    const rowRules = layout.rowTops.slice(1).map((y) => [layout.left, y, right, y]);
    const colRules = Array.from({ length: table.cols - 1 }, (_, col) => layout.left + (col + 1) * layout.colWidth).map((x) => [x, layout.top, x, bottom]);
    const rulesByStyle = {
        grid: [...rowRules, ...colRules],
        striped: rowRules,
        lines: [[layout.left, layout.top, right, layout.top], ...rowRules, [layout.left, bottom, right, bottom]],
        bold: [...rowRules, ...colRules],
    };
    return {
        bands: [...(table.headerRow ? [band(0, hasInvertedHeader(table) ? 1 : HEADER_TINT_ALPHA)] : []), ...stripes],
        rules: rulesByStyle[style] ?? rulesByStyle.grid,
        framed: style !== "lines",
    };
};

const wordColor = (table, row, { ink, fill }) => (row === 0 && hasInvertedHeader(table) ? fill : ink);

export const paintTable = (context, table, zoom) => {
    const layout = tableLayout(table);
    const colors = colorsOf(table);
    const decor = tableDecor(table, layout);
    context.save();
    if (table.rotation) {
        const cx = layout.left + layout.width / 2;
        const cy = layout.top + layout.height / 2;
        context.translate(cx, cy);
        context.rotate((table.rotation * Math.PI) / 180);
        context.translate(-cx, -cy);
    }
    context.globalAlpha = (table.opacity ?? 100) / 100;
    context.fillStyle = colors.fill;
    context.fillRect(layout.left, layout.top, layout.width, layout.height);
    context.fillStyle = colors.ink;
    decor.bands.forEach(({ y, height, alpha }) => {
        context.save();
        context.globalAlpha *= alpha;
        context.fillRect(layout.left, y, layout.width, height);
        context.restore();
    });
    context.strokeStyle = colors.ink;
    context.lineWidth = 1;
    context.save();
    context.globalAlpha *= GRID_ALPHA;
    context.beginPath();
    decor.rules.forEach(([x1, y1, x2, y2]) => {
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
    });
    context.stroke();
    context.restore();
    if (decor.framed) context.strokeRect(layout.left, layout.top, layout.width, layout.height);
    if (isTextLegible({ size: layout.size }, zoom)) {
        context.textBaseline = "alphabetic";
        placedCellLines(table, layout).forEach(({ line, row, x, baselineY }) => {
            context.fillStyle = wordColor(table, row, colors);
            paintRichLine(context, line, x, baselineY, layout.size);
        });
    }
    context.restore();
};

export const tableToSvg = (table) => {
    const layout = tableLayout(table);
    const colors = colorsOf(table);
    const { ink, fill } = colors;
    const decor = tableDecor(table, layout);
    const bands = decor.bands
        .map(({ y, height, alpha }) => `<rect x="${layout.left}" y="${y}" width="${layout.width}" height="${height}" fill="${ink}" fill-opacity="${alpha}" />`)
        .join("");
    const rules = decor.rules
        .map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-opacity="${GRID_ALPHA}" />`)
        .join("");
    const frame = decor.framed
        ? `<rect x="${layout.left}" y="${layout.top}" width="${layout.width}" height="${layout.height}" fill="none" stroke="${ink}" />`
        : "";
    const words = placedCellLines(table, layout)
        .map(({ line, row, x, baselineY }) =>
            richLineToSvg(line, x, baselineY, { family: layout.family, size: layout.size, fill: wordColor(table, row, colors) }),
        )
        .join("");
    const opacity = (table.opacity ?? 100) / 100;
    return `<g opacity="${opacity}"><rect x="${layout.left}" y="${layout.top}" width="${layout.width}" height="${layout.height}" fill="${fill}" />${bands}${rules}${frame}${words}</g>`;
};
