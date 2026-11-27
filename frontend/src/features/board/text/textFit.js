// A note or shape keeps its text size while the words fit, shrinks to a floor as they grow, then grows taller.
import { FONT_FAMILIES } from "../../../../../shared/canvas/elements/fontSources.js";
import { baseStyleOf, layoutRichText } from "./richTextLayout";
import { shapeTextBox } from "../../../../../shared/canvas/geometry/shapeGeometry.js";
import { estimatedTextMetrics } from "../../../../../shared/canvas/layoutEngine.js";
import { LINE_HEIGHT_RATIO, STICKY_TEXT_PADDING } from "../../../../../shared/canvas/geometry/bounds.js";

const MIN_FITTED_FONT_SIZE = 11;
const SUBTEXT_RATIO = 0.8;

// Without a browser (a server drawing a board snapshot) words are measured by
// an average glyph width, the same estimate the layout engine uses.
const estimatingContext = () => ({
    font: "16px sans-serif",
    measureText(text) {
        const size = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 16);
        return { width: estimatedTextMetrics.textWidth(text, size) };
    },
});

let sharedContext = null;
export const measureContext = () => {
    sharedContext ??= (typeof document !== "undefined" && document.createElement("canvas").getContext("2d")) || estimatingContext();
    return sharedContext;
};

const lineBlock = (context, text, width, base) => layoutRichText(context, text, width, base).map((line) => ({ ...line, size: base.size }));

const blockHeight = (lines) => lines.reduce((sum, line) => sum + line.size * LINE_HEIGHT_RATIO, 0);

// The largest whole size whose layout fits, or the floor's layout when none does.
const largestFitting = (layoutAt, maxSize, heightLimit) => {
    const full = layoutAt(maxSize);
    if (full.height <= heightLimit) return full;
    const floor = Math.min(maxSize, MIN_FITTED_FONT_SIZE);
    const smallest = layoutAt(floor);
    if (smallest.height > heightLimit) return smallest;
    let fits = floor;
    let tooBig = Math.ceil(maxSize);
    let best = smallest;
    while (tooBig - fits > 1) {
        const middle = Math.floor((fits + tooBig) / 2);
        const layout = layoutAt(middle);
        if (layout.height <= heightLimit) {
            fits = middle;
            best = layout;
        } else {
            tooBig = middle;
        }
    }
    return best;
};

const stickyLayoutCache = new WeakMap();

// `{ fontSize, lines, height }` for a note's text, in world units.
export const stickyTextLayout = (element) => {
    const cached = stickyLayoutCache.get(element);
    if (cached) return cached;
    const context = measureContext();
    const box = { width: element.width - STICKY_TEXT_PADDING * 2, height: element.height - STICKY_TEXT_PADDING * 2 };
    const layoutAt = (fontSize) => {
        const lines = lineBlock(context, element.text || "", box.width, baseStyleOf(element, fontSize, element.fontFamily || FONT_FAMILIES[0]));
        return { fontSize, lines, height: blockHeight(lines) };
    };
    const layout = largestFitting(layoutAt, element.size || 16, box.height);
    stickyLayoutCache.set(element, layout);
    return layout;
};

const shapeLayoutCache = new WeakMap();

// `{ fontSize, lines, height }` for a shape's title and subtitle together.
export const shapeTextLayout = (element) => {
    const cached = shapeLayoutCache.get(element);
    if (cached) return cached;
    const context = measureContext();
    const box = shapeTextBox(element);
    const baseSize = element.fontSize || 16;
    const subRatio = element.subtextSize ? element.subtextSize / baseSize : SUBTEXT_RATIO;
    const family = element.fontFamily || FONT_FAMILIES[0];
    const layoutAt = (fontSize) => {
        const subSize = Math.max(MIN_FITTED_FONT_SIZE * SUBTEXT_RATIO, Math.round(fontSize * subRatio));
        const title = element.text ? lineBlock(context, element.text, box.width, baseStyleOf(element, fontSize, family)) : [];
        const subtitle = element.subtext ? lineBlock(context, element.subtext, box.width, { size: subSize, family }) : [];
        const lines = [...title.map((line) => ({ ...line, isTitle: true })), ...subtitle];
        return { fontSize, lines, height: blockHeight(lines) };
    };
    const layout = largestFitting(layoutAt, baseSize, box.height);
    shapeLayoutCache.set(element, layout);
    return layout;
};

// How tall a note must be to hold its text at the smallest size. Never below
// `baseHeight`, the height the note had before its text pushed it.
export const stickyHeightFor = (element, baseHeight) => {
    const atBase = stickyTextLayout({ ...element, height: baseHeight });
    return Math.max(baseHeight, Math.ceil(atBase.height + STICKY_TEXT_PADDING * 2));
};

// The same for a shape, allowing for how much of its box text is allowed to use.
export const shapeHeightFor = (element, baseHeight) => {
    const top = Math.min(element.startY, element.endY);
    const atBase = { ...element, startY: top, endY: top + baseHeight };
    const { height } = shapeTextLayout(atBase);
    const usable = shapeTextBox(atBase).height / baseHeight;
    return Math.max(baseHeight, Math.ceil(height / usable));
};
