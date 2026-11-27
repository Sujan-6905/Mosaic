// PNG, SVG with real editable shapes, and PDF from the PNG render with a page per frame when asked.
// All three use the live board's geometry and colour helpers, so an export never drifts from the board.
import { getElementBounds, getUnionBounds, LINE_HEIGHT_RATIO, STICKY_TEXT_PADDING } from "../../../../../shared/canvas/geometry/bounds.js";
import { getStrokeOutline, strokeOutlineOptions } from "../rendering/strokeRenderer";
import { resolveElementColor } from "../rendering/colorResolver";
import { connectorLabelPoint, resolveConnectorPolyline } from "../../../../../shared/canvas/elements/connectors";
import { connectorGeometry, roughConnectorPaths, strokeDashFor } from "../rendering/connectorPainter";
import { roughShapeParts } from "../rendering/elementPainter";
import { measureContext, shapeTextLayout, stickyTextLayout } from "../text/textFit";
import { baseStyleOf, layoutRichText, lineStartX, richLineToSvg } from "../text/richTextLayout";
import { tableToSvg } from "../rendering/tablePainter";
import { stampToSvg } from "../rendering/stampPainter";
import { shapeTextBox, shapeToSvgPath } from "../../../../../shared/canvas/geometry/shapeGeometry.js";
import { iconToSvg, isExtraPattern, roundedRoutePath, svgExtraPattern, svgShadow } from "./svgShapeEffects";
import { FONT_FAMILIES, isValidFontFamilyName, isValidFontSource } from "../../../../../shared/canvas/elements/fontSources.js";

const EXPORT_PADDING = 40;

// `scope` is board, selection or frame; a frame exports its own bounds and its members.
export const resolveExportScope = (elements, scope, { selectionIds = [], frameId = null } = {}) => {
    if (scope === "selection") {
        const picked = Object.fromEntries(selectionIds.filter((id) => elements[id]).map((id) => [id, elements[id]]));
        return { elements: picked, bounds: getUnionBounds(Object.values(picked)) };
    }
    if (scope === "frame" && frameId && elements[frameId]) {
        const frame = elements[frameId];
        const members = Object.fromEntries(Object.entries(elements).filter(([id, el]) => id === frameId || el.frameId === frameId));
        return { elements: members, bounds: getElementBounds(frame) };
    }
    return { elements, bounds: getUnionBounds(Object.values(elements)) };
};

// Every frame on the board, each paired with just its own member elements -
// the "one page per frame" PDF option iterates this list directly.
export const listFramePages = (elements) =>
    Object.entries(elements)
        .filter(([, el]) => el.type === "frame")
        .map(([frameId, frame]) => ({
            frameId,
            name: frame.name || "Frame",
            ...resolveExportScope(elements, "frame", { frameId }),
        }));

const escapeXml = (text) => String(text ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch]);

const svgTransformFor = (element) => {
    if (!element.rotation) return null;
    const bounds = getElementBounds(element);
    if (!bounds) return null;
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    return `rotate(${element.rotation} ${cx} ${cy})`;
};

const svgWrap = (element, inner) => {
    const transform = svgTransformFor(element);
    return transform ? `<g transform="${transform}">${inner}</g>` : inner;
};

// A wrapped block of centred text inside a shape, matching the canvas layout.
const shapeTextToSvg = (element, color) => {
    if (!element.text && !element.subtext) return "";
    const box = shapeTextBox(element);
    const family = element.fontFamily || FONT_FAMILIES[0];
    const { lines, height } = shapeTextLayout(element);
    let y = box.y + (box.height - height) / 2;
    const align = element.align || "center";
    return lines
        .map((line) => {
            const baseline = y + line.size * LINE_HEIGHT_RATIO * 0.76;
            y += line.size * LINE_HEIGHT_RATIO;
            const fill = line.isTitle ? color : element.subtextColor || color;
            return richLineToSvg(line, lineStartX(align, box, line.width), baseline, { family, size: line.size, fill });
        })
        .join("");
};

const SVG_PATTERN_SIZE = { hachure: 9, crosshatch: 9, dots: 10 };

const svgPatternFill = (element, fill) => {
    const size = SVG_PATTERN_SIZE[element.fillStyle];
    const id = `fill-${element.fillStyle}-${fill.replace(/[^a-zA-Z0-9]/g, "")}`;
    const marks = {
        hachure: `<path d="M0 ${size} L${size} 0" stroke="${fill}" stroke-width="1.2" />`,
        crosshatch: `<path d="M0 ${size} L${size} 0 M0 0 L${size} ${size}" stroke="${fill}" stroke-width="1.2" />`,
        dots: `<circle cx="${size / 2}" cy="${size / 2}" r="1.4" fill="${fill}" />`,
    }[element.fillStyle];
    return { id, defs: `<defs><pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">${marks}</pattern></defs>` };
};

const shapeToSvg = (element, color, opacity) => {
    if (element.shapeType === "Icon") return iconToSvg(element, color || "#000000", opacity);
    const fill = element.fillColor ? resolveElementColor(element.fillColorToken, element.fillColor) : null;
    const pattern =
        fill && !element.roughness
            ? SVG_PATTERN_SIZE[element.fillStyle]
                ? svgPatternFill(element, fill)
                : isExtraPattern(element.fillStyle)
                  ? svgExtraPattern(element.fillStyle, fill)
                  : null
            : null;
    const shadow = svgShadow(element, color);
    const washed = element.fillStyle === "wash" ? ' fill-opacity="0.7"' : "";
    const fillAttr = pattern ? `url(#${pattern.id})` : fill || "none";
    const stroke = color && element.size > 0 ? color : "none";
    const dash = strokeDashFor(element.strokeStyle, element.size);
    const dashAttr = dash.length ? ` stroke-dasharray="${dash.join(" ")}" stroke-linecap="round"` : "";
    const rule = element.shapeType === "Region" ? ' fill-rule="evenodd"' : "";
    const d = shapeToSvgPath(element);
    let body;
    if (element.roughness) {
        const parts = roughShapeParts(element);
        body = [
            ...parts.fillAreas.map((part) => `<path d="${part}" fill="${fill}" stroke="none" opacity="${opacity}" />`),
            ...parts.fillMarks.map((part) => `<path d="${part}" fill="none" stroke="${fill}" stroke-width="1.2" opacity="${opacity}" />`),
            ...parts.outline.map(
                (part) => `<path d="${part}" fill="none" stroke="${stroke}" stroke-width="${element.size}" opacity="${opacity}"${dashAttr} />`,
            ),
        ].join("");
    } else {
        body = `<path d="${d}" fill="${fillAttr}"${rule}${washed} stroke="${stroke}" stroke-width="${element.size}" stroke-linejoin="round" opacity="${opacity}"${dashAttr}${shadow.attribute} />`;
    }
    return `${pattern?.defs ?? ""}${shadow.defs}${body}${shapeTextToSvg(element, resolveElementColor(element.textColorToken, element.textColor) || color || "#000000")}`;
};

const withSvgLink = (element, markup) => (element.link ? `<a href="${escapeXml(element.link)}" target="_blank">${markup}</a>` : markup);

const elementToSvg = (element, elementsMap) => {
    const color = resolveElementColor(element.colorToken, element.color);
    const opacity = (element.opacity ?? 100) / 100;

    if (element.type === "path") {
        const outline = getStrokeOutline(element.points, strokeOutlineOptions(element));
        if (outline.length < 3) return "";
        const points = outline.map((p) => `${p.x},${p.y}`).join(" ");
        const interior = element.fillColor
            ? `<polygon points="${element.points.map((p) => `${p.x},${p.y}`).join(" ")}" fill="${element.fillColor}" opacity="${opacity}" />`
            : "";
        return svgWrap(element, `${interior}<polygon points="${points}" fill="${color}" opacity="${opacity}" />`);
    }

    if (element.type === "shape") return svgWrap(element, shapeToSvg(element, color, opacity));

    if (element.type === "text" || element.type === "sticky") {
        const isSticky = element.type === "sticky";
        const padding = isSticky ? STICKY_TEXT_PADDING : 0;
        const box = { x: element.x + padding, y: element.y + padding, width: (isSticky ? element.width : element.width || 220) - padding * 2 };
        const family = element.fontFamily || FONT_FAMILIES[0];
        const layout = isSticky
            ? stickyTextLayout(element)
            : {
                  fontSize: element.size || 16,
                  lines: layoutRichText(
                      measureContext(),
                      element.text || "",
                      element.autoWidth ? Infinity : box.width,
                      baseStyleOf(element, element.size || 16, family),
                  ),
              };
        const lineHeight = layout.fontSize * LINE_HEIGHT_RATIO;
        const textFill = resolveElementColor(element.colorToken, element.color) || "#000000";
        const textEls = layout.lines
            .map((line, i) =>
                richLineToSvg(line, lineStartX(element.align || "left", box, line.width), box.y + (i + 1) * lineHeight - lineHeight * 0.25, {
                    family,
                    size: layout.fontSize,
                    fill: textFill,
                }),
            )
            .join("");
        const background = isSticky
            ? `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" fill="${resolveElementColor(element.fillColorToken, element.fillColor)}" />`
            : "";
        return svgWrap(element, background + textEls);
    }

    if (element.type === "table") return svgWrap(element, tableToSvg(element));
    if (element.type === "stamp") return svgWrap(element, stampToSvg(element));

    if (element.type === "frame") {
        const bounds = getElementBounds(element);
        if (!bounds) return "";
        const frameColor = color || "#94a3b8";
        return (
            `<rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.maxX - bounds.minX}" height="${bounds.maxY - bounds.minY}" fill="none" stroke="${frameColor}" stroke-width="1.5" />` +
            `<text x="${bounds.minX}" y="${bounds.minY - 6}" font-size="13" font-weight="600" fill="${frameColor}">${escapeXml(element.name || "Frame")}</text>`
        );
    }

    if (element.type === "image") {
        const bounds = getElementBounds(element);
        if (!bounds) return "";
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        return svgWrap(
            element,
            `<image href="${escapeXml(element.src)}" x="${bounds.minX}" y="${bounds.minY}" width="${width}" height="${height}" opacity="${opacity}" />`,
        );
    }

    if (element.type === "embed") {
        const bounds = getElementBounds(element);
        if (!bounds) return "";
        const fill = resolveElementColor("bg-surface", "#ffffff");
        const ink = resolveElementColor("text-primary", "#18181b");
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        return svgWrap(
            element,
            `<rect x="${bounds.minX}" y="${bounds.minY}" width="${width}" height="${height}" rx="10" fill="${fill}" stroke="${resolveElementColor("border-subtle", "#d4d4d8")}" />` +
                `<text x="${bounds.minX + width / 2}" y="${bounds.minY + height / 2}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="${ink}">${escapeXml(element.title || element.url)}</text>`,
        );
    }

    if (element.type === "connector") {
        const polyline = resolveConnectorPolyline(element, elementsMap);
        const stroke = color || "#000000";
        const ground = resolveElementColor("bg-canvas", "#ffffff");
        const { line, heads } = connectorGeometry(element, polyline);
        const dash = strokeDashFor(element.strokeStyle, element.size);
        const dashAttr = dash.length ? ` stroke-dasharray="${dash.join(" ")}" stroke-linecap="round"` : "";
        const toPoints = (points) => points.map((p) => `${p.x},${p.y}`).join(" ");
        const route = element.roughness
            ? roughConnectorPaths(element, line)
                  .map(
                      (d) =>
                          `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${element.size || 2}" stroke-linecap="round" opacity="${opacity}"${dashAttr} />`,
                  )
                  .join("")
            : element.cornerRadius
              ? `<path d="${roundedRoutePath(line, element.cornerRadius)}" fill="none" stroke="${stroke}" stroke-width="${element.size || 2}" opacity="${opacity}"${dashAttr} />`
              : `<polyline points="${toPoints(line)}" fill="none" stroke="${stroke}" stroke-width="${element.size || 2}" stroke-linejoin="round" opacity="${opacity}"${dashAttr} />`;
        const headMarkup = heads
            .map(({ points, closed, fill }) => {
                const paint = fill === "ink" ? stroke : fill === "ground" ? ground : "none";
                const tag = closed ? "polygon" : "polyline";
                return `<${tag} points="${toPoints(points)}" fill="${paint}" stroke="${stroke}" stroke-width="${element.size || 2}" stroke-linejoin="round" stroke-linecap="round" opacity="${opacity}" />`;
            })
            .join("");
        let label = "";
        if (element.text) {
            const center = connectorLabelPoint(element, polyline);
            const fontSize = element.fontSize || 13;
            const backing =
                element.labelStyle === "pill" || element.labelStyle === "tag" || element.labelFill
                    ? (() => {
                          const context = measureContext();
                          context.font = `${fontSize}px ${element.fontFamily || FONT_FAMILIES[0]}`;
                          const width = context.measureText(element.text).width + 20;
                          const height = fontSize + 8;
                          const outline = element.labelStyle ? ` stroke="${stroke}" stroke-width="1"` : "";
                          return `<rect x="${center.x - width / 2}" y="${center.y - height / 2}" width="${width}" height="${height}" rx="${element.labelStyle ? height / 2 : 0}" fill="${element.labelFill || ground}"${outline} />`;
                      })()
                    : "";
            label = `${backing}<text x="${center.x}" y="${center.y}" text-anchor="middle" dominant-baseline="middle" font-family="${escapeXml(element.labelStyle === "tag" ? "'Courier New', monospace" : element.fontFamily || FONT_FAMILIES[0])}" font-size="${fontSize}" fill="${stroke}" stroke="${element.labelFill || ground}" stroke-width="4" paint-order="stroke">${escapeXml(element.text)}</text>`;
        }
        return route + headMarkup + label;
    }

    return "";
};

// Board fonts the exported text uses, declared so the file renders them
// wherever it opens with a network connection.
const boardFontStyles = (entries) => {
    const rules = new Map();
    entries.forEach(([, element]) => {
        const source = element.fontSource;
        const family = (element.fontFamily || "").split(",")[0].replace(/['"]/g, "").trim();
        // Both go into CSS inside the file, so only values the board would load itself.
        if (!isValidFontSource(source) || !isValidFontFamilyName(family) || rules.has(source.url)) return;
        rules.set(
            source.url,
            source.kind === "google"
                ? `@import url("${escapeXml(source.url)}");`
                : `@font-face { font-family: "${escapeXml(family)}"; src: url("${escapeXml(source.url)}"); }`,
        );
    });
    if (rules.size === 0) return "";
    const ordered = [...rules.values()].sort((a, b) => Number(b.startsWith("@import")) - Number(a.startsWith("@import")));
    return `<defs><style>${ordered.join("\n")}</style></defs>`;
};

// A standalone SVG document in which every element is a real SVG shape.
export const buildSvgDocument = (elements, background, bounds, { transparent = false } = {}) => {
    const minX = bounds.minX - EXPORT_PADDING;
    const minY = bounds.minY - EXPORT_PADDING;
    const width = bounds.maxX - bounds.minX + EXPORT_PADDING * 2;
    const height = bounds.maxY - bounds.minY + EXPORT_PADDING * 2;

    const backgroundRect = transparent
        ? ""
        : `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${resolveElementColor("bg-canvas", "#ffffff")}" />`;

    const entries = Object.entries(elements).sort(([, a], [, b]) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const body = entries.map(([, element]) => withSvgLink(element, elementToSvg(element, elements))).join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">
${boardFontStyles(entries)}
${backgroundRect}
${body}
</svg>`;
};
