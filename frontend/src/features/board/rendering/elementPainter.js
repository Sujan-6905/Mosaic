// Draws one element in world coordinates, for both the live board and the read-only renderer.
import rough from "roughjs";
import { resolveElementColor } from "./colorResolver";
import { getElementBounds, DEFAULT_TEXT_BOX_WIDTH, LINE_HEIGHT_RATIO, STICKY_TEXT_PADDING } from "../../../../../shared/canvas/geometry/bounds.js";
import { getCachedElementBounds } from "./boundsCache";
import { paintConnector, strokeDashFor } from "./connectorPainter";
import { traceShape, shapeTextBox, shapeToSvgPath } from "../../../../../shared/canvas/geometry/shapeGeometry.js";
import { getCachedImage } from "./imageCache";
import { getStrokePaths, paintStrokePaths } from "./strokeRenderer";
import { getWrappedLines } from "../text/textWrap";
import { shapeTextLayout, stickyTextLayout } from "../text/textFit";
import { lineStartX, paintRichLine } from "../text/richTextLayout";
import { paintTable } from "./tablePainter";
import { paintStamp } from "./stampPainter";
import { isSpeck, isTextLegible, MIN_STICKY_SHADOW_PX, simplifyToleranceFor } from "./lod";
import { paintExtraPattern, paintIcon, paintWash, withShapeShadow } from "./shapeEffects";

const HACHURE_GAP = 9;
const DOT_GAP = 10;
const LINK_BADGE_PX = 16;
const EMBED_CARD_RADIUS = 10;

const withRotation = (context, element, paint) => {
    const rotation = element.rotation || 0;
    const bounds = rotation ? getElementBounds(element) : null;
    if (!bounds) {
        paint();
        return;
    }
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    context.save();
    context.translate(cx, cy);
    context.rotate((rotation * Math.PI) / 180);
    context.translate(-cx, -cy);
    paint();
    context.restore();
};

const paintLines = (context, element, lines, box, fontSize) => {
    const align = element.align || "left";
    const lineHeight = fontSize * LINE_HEIGHT_RATIO;
    lines.forEach((line, i) => {
        paintRichLine(context, line, lineStartX(align, box, line.width), box.y + (i + 1) * lineHeight - lineHeight * 0.25, fontSize);
    });
};

const paintWrappedText = (context, element, box) => {
    context.fillStyle = resolveElementColor(element.colorToken, element.color) || "#000000";
    context.textBaseline = "alphabetic";
    const wrapWidth = element.autoWidth ? Infinity : box.width;
    paintLines(context, element, getWrappedLines(context, element, wrapWidth), box, element.size || 16);
};

// A shape's own title and subtitle, centred in the room its outline leaves.
const paintShapeText = (context, element, zoom) => {
    if (!element.text && !element.subtext) return;
    if (!isTextLegible({ size: element.fontSize || 16 }, zoom)) return;
    const box = shapeTextBox(element);
    const { lines, height: totalHeight } = shapeTextLayout(element);
    const verticalAlign = element.verticalAlign || "middle";
    let y = verticalAlign === "top" ? box.y : verticalAlign === "bottom" ? box.y + box.height - totalHeight : box.y + (box.height - totalHeight) / 2;
    const align = element.align || "center";
    const ink = resolveElementColor(element.textColorToken, element.textColor) || resolveElementColor(element.colorToken, element.color) || "#000000";
    const subInk = resolveElementColor(null, element.subtextColor) || ink;
    context.textBaseline = "alphabetic";
    lines.forEach((line) => {
        const lineHeight = line.size * LINE_HEIGHT_RATIO;
        context.fillStyle = line.isTitle ? ink : subInk;
        paintRichLine(context, line, lineStartX(align, box, line.width), y + lineHeight * 0.76, line.size);
        y += lineHeight;
    });
};

const paintPattern = (context, element, fillStyle, color) => {
    const minX = Math.min(element.startX, element.endX);
    const maxX = Math.max(element.startX, element.endX);
    const minY = Math.min(element.startY, element.endY);
    const maxY = Math.max(element.startY, element.endY);
    context.save();
    context.clip(element.shapeType === "Region" ? "evenodd" : "nonzero");
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 1.2;
    context.setLineDash([]);
    if (paintExtraPattern(context, element, fillStyle, color)) {
        context.restore();
        return;
    }
    if (fillStyle === "dots") {
        for (let y = minY + DOT_GAP / 2; y < maxY; y += DOT_GAP) {
            for (let x = minX + DOT_GAP / 2; x < maxX; x += DOT_GAP) {
                context.beginPath();
                context.arc(x, y, 1.4, 0, 2 * Math.PI);
                context.fill();
            }
        }
    } else {
        const span = maxX - minX + maxY - minY;
        context.beginPath();
        for (let offset = 0; offset < span; offset += HACHURE_GAP) {
            context.moveTo(minX + offset, minY);
            context.lineTo(minX, minY + offset);
            if (fillStyle === "crosshatch") {
                context.moveTo(maxX - offset, minY);
                context.lineTo(maxX, minY + offset);
            }
        }
        context.stroke();
    }
    context.restore();
};

const roughGenerator = rough.generator();
const roughPartsCache = new WeakMap();
const ROUGH_FILL_STYLES = { solid: "solid", hachure: "hachure", crosshatch: "cross-hatch", dots: "dots" };
// Sentinels only: rough reports each part's role through the colour it was given.
const ROUGH_INK = "#000";
const ROUGH_PAPER = "#fff";

// The outline and its fill redrawn with a hand's wobble. Seeded from something
// that doesn't change when the element moves, so it doesn't shimmer as it's dragged.
export const roughShapeParts = (element) => {
    const cached = roughPartsCache.get(element);
    if (cached) return cached;
    const drawable = roughGenerator.path(shapeToSvgPath(element), {
        roughness: element.roughness,
        bowing: element.roughness,
        seed: Math.abs(Math.floor((element.zIndex ?? 1) * 1000)) % 2147483647 || 1,
        strokeWidth: element.size,
        stroke: ROUGH_INK,
        ...(element.fillColor
            ? { fill: ROUGH_PAPER, fillStyle: ROUGH_FILL_STYLES[element.fillStyle] || "solid", fillWeight: 1.2, hachureGap: HACHURE_GAP, dotSize: 2 }
            : {}),
        // Two passes of a dashed line land out of step and read as scribble.
        disableMultiStroke: Boolean(element.strokeStyle && element.strokeStyle !== "solid"),
    });
    const parts = { outline: [], fillAreas: [], fillMarks: [] };
    roughGenerator.toPaths(drawable).forEach((part) => {
        if (part.stroke === ROUGH_INK) parts.outline.push(part.d);
        else if (part.stroke === ROUGH_PAPER) parts.fillMarks.push(part.d);
        else parts.fillAreas.push(part.d);
    });
    roughPartsCache.set(element, parts);
    return parts;
};

const paintRoughShape = (context, element, color, fill) => {
    const parts = roughShapeParts(element);
    if (fill) {
        context.fillStyle = fill;
        parts.fillAreas.forEach((d) => context.fill(new Path2D(d)));
        context.save();
        context.strokeStyle = fill;
        context.lineWidth = 1.2;
        parts.fillMarks.forEach((d) => context.stroke(new Path2D(d)));
        context.restore();
    }
    if (color && element.size > 0) {
        context.strokeStyle = color;
        context.setLineDash(strokeDashFor(element.strokeStyle, element.size));
        parts.outline.forEach((d) => context.stroke(new Path2D(d)));
        context.setLineDash([]);
    }
};

const fillRuleOf = (element) => (element.shapeType === "Region" ? "evenodd" : "nonzero");

const paintShapeBody = (context, element, color, fill, { silhouetteOnly = false } = {}) => {
    const trace = () => {
        context.beginPath();
        traceShape(context, element);
    };
    if (silhouetteOnly) {
        trace();
        context.fill(fillRuleOf(element));
        return;
    }
    trace();
    if (fill) {
        if (!element.fillStyle || element.fillStyle === "solid") {
            context.fillStyle = fill;
            context.fill(fillRuleOf(element));
        } else if (element.fillStyle === "wash") {
            paintWash(context, fill, trace);
            trace();
        } else {
            paintPattern(context, element, element.fillStyle, fill);
            trace();
        }
    }
    if (color && element.size > 0) {
        // A shadow follows the fill; stroking again under it would draw a second, offset outline.
        if (fill) context.shadowColor = "transparent";
        context.strokeStyle = color;
        context.setLineDash(strokeDashFor(element.strokeStyle, element.size));
        context.stroke();
        context.setLineDash([]);
    }
};

const paintShape = (context, element, env) => {
    const color = resolveElementColor(element.colorToken, element.color);
    const fill = element.fillColor && !env.hideFineDetail ? resolveElementColor(element.fillColorToken, element.fillColor) : null;
    withRotation(context, element, () => {
        if (element.shapeType === "Icon") {
            paintIcon(context, element);
            return;
        }
        context.save();
        context.lineWidth = element.size;
        context.globalAlpha = (element.opacity ?? 100) / 100;
        context.lineCap = "round";
        context.lineJoin = "round";
        withShapeShadow(context, element, color, (options) => {
            if (element.roughness && !options?.silhouetteOnly) paintRoughShape(context, element, color, fill);
            else paintShapeBody(context, element, color, fill, options);
        });
        paintShapeText(context, element, env.zoom);
        context.restore();
    });
};

const paintTextElement = (context, element, zoom) => {
    withRotation(context, element, () => {
        context.save();
        context.globalAlpha = (element.opacity ?? 100) / 100;
        // Below the legibility floor a flat bar costs one fillRect instead of
        // font metrics and glyph rasterization, and looks the same.
        if (!isTextLegible(element, zoom)) {
            const bounds = getElementBounds(element);
            if (bounds) {
                context.fillStyle = resolveElementColor(element.colorToken, element.color) || "#000000";
                context.globalAlpha *= 0.6;
                context.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
            }
        } else {
            paintWrappedText(context, element, { x: element.x, y: element.y, width: element.width || DEFAULT_TEXT_BOX_WIDTH });
        }
        context.restore();
    });
};

const paintSticky = (context, element, zoom) => {
    withRotation(context, element, () => {
        context.save();
        context.globalAlpha = (element.opacity ?? 100) / 100;
        context.fillStyle = resolveElementColor(element.fillColorToken, element.fillColor) || "#fef08a";
        if (element.width * zoom >= MIN_STICKY_SHADOW_PX) {
            context.shadowColor = "rgba(0, 0, 0, 0.18)";
            context.shadowBlur = 8;
            context.shadowOffsetY = 3;
        }
        context.fillRect(element.x, element.y, element.width, element.height);
        context.shadowColor = "transparent";
        context.shadowBlur = 0;
        if (isTextLegible(element, zoom) && element.text) {
            const { fontSize, lines } = stickyTextLayout(element);
            context.fillStyle = resolveElementColor(element.colorToken, element.color) || "#000000";
            context.textBaseline = "alphabetic";
            paintLines(
                context,
                element,
                lines,
                { x: element.x + STICKY_TEXT_PADDING, y: element.y + STICKY_TEXT_PADDING, width: element.width - STICKY_TEXT_PADDING * 2 },
                fontSize,
            );
        }
        context.restore();
    });
};

const paintFrame = (context, element, zoom) => {
    const bounds = getElementBounds(element);
    if (!bounds) return;
    context.save();
    const color = resolveElementColor(element.colorToken, element.color) || "#94a3b8";
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    if (element.fillColor) {
        context.fillStyle = resolveElementColor(element.fillColorToken, element.fillColor);
        context.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    }
    context.setLineDash(strokeDashFor(element.strokeStyle, 1.5));
    context.strokeRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    context.setLineDash([]);
    if (isTextLegible({ size: 14 }, zoom)) {
        context.font = "600 13px sans-serif";
        context.fillStyle = color;
        context.textBaseline = "alphabetic";
        context.fillText(element.name || "Frame", bounds.minX, bounds.minY - 6);
    }
    context.restore();
};

const paintImage = (context, element, env) => {
    const bounds = getElementBounds(element);
    if (!bounds) return;
    withRotation(context, element, () => {
        context.save();
        context.globalAlpha = (element.opacity ?? 100) / 100;
        const { image, status } = getCachedImage(element.src, env.onImageLoad);
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        if (image && status === "loaded") {
            context.drawImage(image, bounds.minX, bounds.minY, width, height);
        } else {
            context.fillStyle = "rgba(148, 163, 184, 0.25)";
            context.fillRect(bounds.minX, bounds.minY, width, height);
            context.strokeStyle = "rgba(148, 163, 184, 0.6)";
            context.strokeRect(bounds.minX, bounds.minY, width, height);
        }
        context.restore();
    });
};

const hostOf = (url) => {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
};

// What an embed looks like when its live page isn't showing: while panning, in
// an export, in a replay. The page itself is a DOM layer above the canvas.
const paintEmbedCard = (context, element, zoom) => {
    const bounds = getElementBounds(element);
    if (!bounds) return;
    withRotation(context, element, () => {
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        context.save();
        context.fillStyle = resolveElementColor("bg-surface", "#ffffff");
        context.strokeStyle = resolveElementColor("border-subtle", "#d4d4d8");
        context.lineWidth = 1;
        context.beginPath();
        context.roundRect(bounds.minX, bounds.minY, width, height, EMBED_CARD_RADIUS);
        context.fill();
        context.stroke();
        if (isTextLegible({ size: 14 }, zoom)) {
            context.fillStyle = resolveElementColor("text-primary", "#18181b");
            context.font = "600 14px Arial, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(element.title || hostOf(element.url), bounds.minX + width / 2, bounds.minY + height / 2 - 10, width - 24);
            context.fillStyle = resolveElementColor("text-muted", "#71717a");
            context.font = "12px Arial, sans-serif";
            context.fillText(hostOf(element.url), bounds.minX + width / 2, bounds.minY + height / 2 + 10, width - 24);
        }
        context.restore();
    });
};

// A chain mark on a linked element, fixed on screen however far it's zoomed.
const paintLinkBadge = (context, element, zoom) => {
    const bounds = getCachedElementBounds(element);
    if (!bounds) return;
    const size = LINK_BADGE_PX / zoom;
    const x = bounds.maxX - size * 0.4;
    const y = bounds.minY - size * 0.6;
    context.save();
    context.globalAlpha = 1;
    context.fillStyle = resolveElementColor("brand-fill", "#e8b04b");
    context.beginPath();
    context.arc(x, y, size / 2, 0, 2 * Math.PI);
    context.fill();
    context.strokeStyle = "#ffffff";
    context.lineWidth = 1.5 / zoom;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(x - size * 0.2, y + size * 0.2);
    context.lineTo(x + size * 0.2, y - size * 0.2);
    context.moveTo(x - size * 0.06, y - size * 0.22);
    context.lineTo(x + size * 0.2, y - size * 0.2);
    context.lineTo(x + size * 0.22, y + size * 0.06);
    context.stroke();
    context.restore();
};

// `env`: { elements, zoom, hideFineDetail, onImageLoad }.
export const paintElement = (context, element, env) => {
    if (!element) return;
    const { zoom } = env;
    if (element.type === "path" || element.type === "shape") {
        const bounds = getCachedElementBounds(element);
        if (bounds && isSpeck(bounds, zoom)) {
            context.globalAlpha = (element.opacity ?? 100) / 100;
            context.fillStyle = resolveElementColor(element.colorToken, element.color) || "#000000";
            context.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
            context.globalAlpha = 1;
            return;
        }
    }
    if (element.type === "path") {
        if (!element.points || element.points.length < 2) return;
        const paths = getStrokePaths(element, simplifyToleranceFor(zoom));
        withRotation(context, element, () => {
            context.save();
            context.globalAlpha = (element.opacity ?? 100) / 100;
            paintStrokePaths(context, paths, resolveElementColor(element.colorToken, element.color), element.fillColor);
            context.restore();
        });
    } else if (element.type === "shape") paintShape(context, element, env);
    else if (element.type === "text") paintTextElement(context, element, zoom);
    else if (element.type === "sticky") paintSticky(context, element, zoom);
    else if (element.type === "frame") paintFrame(context, element, zoom);
    else if (element.type === "image") paintImage(context, element, env);
    else if (element.type === "embed") paintEmbedCard(context, element, zoom);
    else if (element.type === "table") paintTable(context, element, zoom);
    else if (element.type === "stamp") paintStamp(context, element);
    else if (element.type === "connector") paintConnector(context, element, env.elements);
    if (element.link && element.type !== "embed") paintLinkBadge(context, element, zoom);
};
