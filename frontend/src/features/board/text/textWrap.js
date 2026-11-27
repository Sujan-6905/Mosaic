// Wraps with the canvas's real measurements; shared/canvas/geometry/bounds.js estimates without a canvas.
import { FONT_FAMILIES } from "../../../../../shared/canvas/elements/fontSources.js";
import { baseStyleOf, fontOfStyle, layoutRichText } from "./richTextLayout";

// Greedy word-wrap against a real canvas context. A word wider than the box on
// its own is broken between characters, so nothing can run past the edge.
export const wrapTextForRender = (context, text, maxWidth) => {
    const lines = [];
    (text || "").split("\n").forEach((paragraph) => {
        if (paragraph === "") {
            lines.push("");
            return;
        }
        let current = "";
        paragraph.split(" ").forEach((word) => {
            const candidate = current ? `${current} ${word}` : word;
            if (context.measureText(candidate).width <= maxWidth) {
                current = candidate;
                return;
            }
            if (current) lines.push(current);
            current = "";
            for (const character of word) {
                if (current && context.measureText(current + character).width > maxWidth) {
                    lines.push(current);
                    current = character;
                } else {
                    current += character;
                }
            }
        });
        lines.push(current);
    });
    return lines;
};

const wrappedLinesCache = new WeakMap();

// Wrapping needs real glyph metrics, which are too slow to re-measure on every repaint.
export const getWrappedLines = (context, element, maxWidth) => {
    const base = baseStyleOf(element, element.size || 16, element.fontFamily || FONT_FAMILIES[0]);
    const font = fontOfStyle(base);
    const cached = wrappedLinesCache.get(element);
    if (cached && cached.font === font && cached.maxWidth === maxWidth) return cached.lines;
    const lines = layoutRichText(context, element.text || "", maxWidth, base);
    wrappedLinesCache.set(element, { font, maxWidth, lines });
    return lines;
};
