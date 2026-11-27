// SVG forms of the looks shapeEffects.js paints on canvas, for export.
import { iconTransform, LINE_CAPS, LINE_JOINS } from "../../../../../shared/canvas/elements/iconPaths.js";

const colourId = (value) => String(value).replace(/[^a-zA-Z0-9]/g, "");

const SHADOW_FILTERS = {
    soft: (colour) => `<feDropShadow dx="0" dy="6" stdDeviation="9" flood-color="${colour ?? "#0f172a"}" flood-opacity="${colour ? 1 : 0.18}" />`,
    hard: (colour, ink) => `<feDropShadow dx="5" dy="5" stdDeviation="0" flood-color="${colour ?? ink}" flood-opacity="1" />`,
    glow: (colour, ink) => `<feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="${colour ?? ink}" flood-opacity="0.9" />`,
    long: (colour) => `<feDropShadow dx="10" dy="10" stdDeviation="0" flood-color="${colour ?? "#0f172a"}" flood-opacity="0.16" />`,
};

// A filter definition and the attribute that applies it, or nothing.
export const svgShadow = (element, ink) => {
    const make = SHADOW_FILTERS[element.shadow];
    if (!make) return { defs: "", attribute: "" };
    const id = `shadow-${element.shadow}-${colourId(element.shadowColor ?? ink ?? "none")}`;
    return {
        defs: `<defs><filter id="${id}" x="-30%" y="-30%" width="160%" height="160%">${make(element.shadowColor, ink ?? "#000000")}</filter></defs>`,
        attribute: ` filter="url(#${id})"`,
    };
};

const PATTERN_SIZES = { grid: 16, lines: 6, tiles: 13 };

export const isExtraPattern = (fillStyle) => Boolean(PATTERN_SIZES[fillStyle]);

export const svgExtraPattern = (fillStyle, fill) => {
    const size = PATTERN_SIZES[fillStyle];
    const id = `fill-${fillStyle}-${colourId(fill)}`;
    const marks = {
        grid: `<path d="M0 ${size} H${size} M${size} 0 V${size}" stroke="${fill}" stroke-width="1" fill="none" />`,
        lines: `<path d="M0 ${size} H${size}" stroke="${fill}" stroke-width="1" />`,
        tiles: `<rect x="2" y="2" width="11" height="11" fill="${fill}" />`,
    }[fillStyle];
    return { id, defs: `<defs><pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">${marks}</pattern></defs>` };
};

const escapePathData = (d) => d.replace(/[^MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]/g, "");

export const iconToSvg = (element, ink, opacity) => {
    if (!element.icon?.paths?.length) return "";
    const box = {
        minX: Math.min(element.startX, element.endX),
        maxX: Math.max(element.startX, element.endX),
        minY: Math.min(element.startY, element.endY),
        maxY: Math.max(element.startY, element.endY),
    };
    const { scale, x, y } = iconTransform(element.icon, box);
    const paint = (value) => (value === "ink" ? ink : value && value !== "none" && /^#[0-9a-f]{3,6}$/i.test(value) ? value : "none");
    const paths = element.icon.paths
        .map((path) => {
            // Checked again here: an export is a file people open elsewhere, so nothing unchecked reaches its markup.
            const cap = LINE_CAPS.includes(path.cap) ? ` stroke-linecap="${path.cap}"` : "";
            const join = LINE_JOINS.includes(path.join) ? ` stroke-linejoin="${path.join}"` : "";
            const width = Number.isFinite(Number(path.width)) ? Number(path.width) : 1;
            const rule = path.evenOdd ? ' fill-rule="evenodd"' : "";
            return `<path d="${escapePathData(path.d)}" fill="${paint(path.fill)}" stroke="${paint(path.stroke)}" stroke-width="${width}"${cap}${join}${rule} />`;
        })
        .join("");
    return `<g transform="translate(${x} ${y}) scale(${scale})" opacity="${opacity}">${paths}</g>`;
};

// A route with rounded bends as an SVG path, matching traceConnectorPath.
export const roundedRoutePath = (points, cornerRadius) => {
    const parts = [`M${points[0].x} ${points[0].y}`];
    for (let i = 1; i < points.length; i += 1) {
        const point = points[i];
        const next = points[i + 1];
        if (!next || !cornerRadius) {
            parts.push(`L${point.x} ${point.y}`);
            continue;
        }
        const previous = points[i - 1];
        const radius = Math.min(cornerRadius, Math.hypot(point.x - previous.x, point.y - previous.y) / 2, Math.hypot(next.x - point.x, next.y - point.y) / 2);
        const toward = (other, distance) => {
            const length = Math.hypot(other.x - point.x, other.y - point.y) || 1;
            return { x: point.x + ((other.x - point.x) / length) * distance, y: point.y + ((other.y - point.y) / length) * distance };
        };
        const entry = toward(previous, radius);
        const exit = toward(next, radius);
        parts.push(`L${entry.x} ${entry.y}`, `Q${point.x} ${point.y} ${exit.x} ${exit.y}`);
    }
    return parts.join(" ");
};
