// The one bounds computation the board, the grounding layer and the MCP server all use.

import { plainText } from "../elements/richText.js";

export const LINE_HEIGHT_RATIO = 1.3;
export const STICKY_TEXT_PADDING = 16;
export const DEFAULT_TEXT_BOX_WIDTH = 220;
const DEFAULT_STICKY_FONT_SIZE = 14;
const AVG_CHAR_WIDTH_RATIO = 0.55;

// Approximates the renderer's greedy wrap with an average character width, which is
// close enough for a bounding box.
export const estimateWrappedLineCount = (text, width, fontSize) => {
    const charsPerLine = Math.max(1, Math.floor(width / (fontSize * AVG_CHAR_WIDTH_RATIO)));
    let lineCount = 0;
    (text || "").split("\n").forEach((paragraph) => {
        if (paragraph === "") {
            lineCount += 1;
            return;
        }
        lineCount += Math.max(1, Math.ceil(paragraph.length / charsPerLine));
    });
    return Math.max(1, lineCount);
};

// The height a sticky needs to hold its text at its current width.
export const stickyHeightForText = (sticky) => {
    const fontSize = sticky.size || DEFAULT_STICKY_FONT_SIZE;
    const lineCount = estimateWrappedLineCount(sticky.text, sticky.width - STICKY_TEXT_PADDING * 2, fontSize);
    return Math.ceil(lineCount * fontSize * LINE_HEIGHT_RATIO + STICKY_TEXT_PADDING * 2);
};

const START_END_BOX_TYPES = ["shape", "frame", "connector", "image", "embed", "table", "stamp"];

// Paths get a true min/max bounding box over their points; everything else
// draws inside its own start/end corners.
export const getElementBounds = (element) => {
    if (!element) return null;
    if (element.type === "path") {
        if (!element.points || element.points.length === 0) return null;
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        for (const point of element.points) {
            if (point.x < minX) minX = point.x;
            if (point.y < minY) minY = point.y;
            if (point.x > maxX) maxX = point.x;
            if (point.y > maxY) maxY = point.y;
        }
        const padding = (element.size || 1) / 2;
        return { minX: minX - padding, minY: minY - padding, maxX: maxX + padding, maxY: maxY + padding };
    }
    if (START_END_BOX_TYPES.includes(element.type)) {
        const xs = [element.startX, element.endX];
        const ys = [element.startY, element.endY];
        (element.waypoints || []).forEach((point) => {
            xs.push(point.x);
            ys.push(point.y);
        });
        return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
    }
    if (element.type === "text") {
        // Height derives from the wrapped line count, so it can't go stale as the text changes.
        const fontSize = element.size || 16;
        const width = element.width || DEFAULT_TEXT_BOX_WIDTH;
        const lineCount = element.autoWidth ? (element.text || "").split("\n").length : estimateWrappedLineCount(plainText(element.text), width, fontSize);
        const height = lineCount * fontSize * LINE_HEIGHT_RATIO;
        return { minX: element.x, minY: element.y, maxX: element.x + width, maxY: element.y + height };
    }
    if (element.type === "sticky") {
        return { minX: element.x, minY: element.y, maxX: element.x + element.width, maxY: element.y + element.height };
    }
    return null;
};

// The box around every given box, skipping nulls; null when there are none.
export const unionBounds = (boundsList) =>
    boundsList.reduce((union, bounds) => {
        if (!bounds) return union;
        if (!union) return { ...bounds };
        return {
            minX: Math.min(union.minX, bounds.minX),
            minY: Math.min(union.minY, bounds.minY),
            maxX: Math.max(union.maxX, bounds.maxX),
            maxY: Math.max(union.maxY, bounds.maxY),
        };
    }, null);

export const getUnionBounds = (elementsList) => unionBounds(elementsList.map(getElementBounds));

export const boundsCenter = (bounds) => ({ x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 });

export const boundsIntersect = (a, b) => a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;

export const boundsContains = (outer, inner) => inner.minX >= outer.minX && inner.minY >= outer.minY && inner.maxX <= outer.maxX && inner.maxY <= outer.maxY;
