// A shape's look beyond outline and fill: shadows, washes, patterns and icons. sceneExport.js writes the SVG.
import { resolveElementColor } from "./colorResolver";
import { iconTransform } from "../../../../../shared/canvas/elements/iconPaths.js";

const GRID_GAP = 16;
const LINE_GAP = 6;
const TILE = 11;
const TILE_GAP = 2;
const LONG_SHADOW_STEPS = 10;

const SHADOW_DEFAULTS = {
    soft: { blur: 18, x: 0, y: 6, color: "rgba(15, 23, 42, 0.18)" },
    hard: { blur: 0, x: 5, y: 5, color: null },
    glow: { blur: 16, x: 0, y: 0, color: null },
};

// Runs `draw` with the element's shadow set, so the lift follows its outline.
// A long shadow repeats the silhouette along the diagonal behind it instead.
export const withShapeShadow = (context, element, ink, draw) => {
    if (!element.shadow) {
        draw();
        return;
    }
    const colour = element.shadowColor || null;
    if (element.shadow === "long") {
        context.save();
        context.fillStyle = colour || "rgba(15, 23, 42, 0.16)";
        context.strokeStyle = "transparent";
        for (let step = LONG_SHADOW_STEPS; step > 0; step -= 1) {
            context.save();
            context.translate(step * 1.4, step * 1.4);
            draw({ silhouetteOnly: true });
            context.restore();
        }
        context.restore();
        draw();
        return;
    }
    const settings = SHADOW_DEFAULTS[element.shadow];
    if (!settings) {
        draw();
        return;
    }
    context.save();
    context.shadowColor = colour || settings.color || ink || "#000000";
    context.shadowBlur = settings.blur;
    context.shadowOffsetX = settings.x;
    context.shadowOffsetY = settings.y;
    draw();
    context.restore();
};

const boundsOf = (element) => ({
    minX: Math.min(element.startX, element.endX),
    maxX: Math.max(element.startX, element.endX),
    minY: Math.min(element.startY, element.endY),
    maxY: Math.max(element.startY, element.endY),
});

// A watercolour fill: the colour bleeds past its edge, then a lighter body.
export const paintWash = (context, fill, trace) => {
    context.save();
    context.shadowColor = fill;
    context.shadowBlur = 14;
    context.globalAlpha *= 0.55;
    context.fillStyle = fill;
    trace();
    context.fill();
    context.globalAlpha /= 0.55;
    context.globalAlpha *= 0.7;
    context.shadowBlur = 0;
    trace();
    context.fill();
    context.restore();
};

const tileShade = (x, y) => 0.72 + (((Math.round(x / TILE) * 31 + Math.round(y / TILE) * 17) % 7) / 7) * 0.28;

// Patterns the hachure painter doesn't draw: a squared grid, scanlines and mosaic tiles.
export const paintExtraPattern = (context, element, fillStyle, color) => {
    const { minX, maxX, minY, maxY } = boundsOf(element);
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 1;
    if (fillStyle === "tiles") {
        const base = context.globalAlpha;
        for (let y = minY + TILE_GAP; y < maxY; y += TILE + TILE_GAP) {
            for (let x = minX + TILE_GAP; x < maxX; x += TILE + TILE_GAP) {
                context.globalAlpha = base * tileShade(x, y);
                context.fillRect(x, y, TILE, TILE);
            }
        }
        context.globalAlpha = base;
        return true;
    }
    if (fillStyle !== "grid" && fillStyle !== "lines") return false;
    const gap = fillStyle === "grid" ? GRID_GAP : LINE_GAP;
    context.beginPath();
    for (let y = minY + gap; y < maxY; y += gap) {
        context.moveTo(minX, y);
        context.lineTo(maxX, y);
    }
    if (fillStyle === "grid") {
        for (let x = minX + gap; x < maxX; x += gap) {
            context.moveTo(x, minY);
            context.lineTo(x, maxY);
        }
    }
    context.stroke();
    return true;
};

const pathCache = new WeakMap();
const pathsOf = (icon) => {
    if (!pathCache.has(icon))
        pathCache.set(
            icon,
            icon.paths.map((path) => ({ ...path, path2d: new Path2D(path.d) })),
        );
    return pathCache.get(icon);
};

// An icon's paths scaled into its box; "ink" paints in the element's colour.
export const paintIcon = (context, element) => {
    if (!element.icon?.paths?.length) return;
    const ink = resolveElementColor(element.colorToken, element.color) || "#000000";
    const { scale, x, y } = iconTransform(element.icon, boundsOf(element));
    context.save();
    context.globalAlpha = (element.opacity ?? 100) / 100;
    context.translate(x, y);
    context.scale(scale, scale);
    pathsOf(element.icon).forEach((path) => {
        if (path.fill && path.fill !== "none") {
            context.fillStyle = path.fill === "ink" ? ink : path.fill;
            context.fill(path.path2d, path.evenOdd ? "evenodd" : "nonzero");
        }
        if (path.stroke && path.stroke !== "none") {
            context.strokeStyle = path.stroke === "ink" ? ink : path.stroke;
            context.lineWidth = path.width ?? 1;
            context.lineCap = path.cap ?? "butt";
            context.lineJoin = path.join ?? "miter";
            context.stroke(path.path2d);
        }
    });
    context.restore();
};
