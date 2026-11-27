import { worldPointToElement } from "../../../../../shared/canvas/geometry/elementGeometry.js";
import { isSafeLink } from "../../../../../shared/canvas/elements/links.js";
import { getWrappedLines } from "./textWrap";
import { lineStartX } from "./richTextLayout";
import { measureContext, stickyTextLayout } from "./textFit";
import { DEFAULT_TEXT_BOX_WIDTH, LINE_HEIGHT_RATIO, STICKY_TEXT_PADDING } from "../../../../../shared/canvas/geometry/bounds.js";

const textBlockOf = (element) => {
    if (element.type === "sticky") {
        const { fontSize, lines } = stickyTextLayout(element);
        return {
            box: { x: element.x + STICKY_TEXT_PADDING, y: element.y + STICKY_TEXT_PADDING, width: element.width - STICKY_TEXT_PADDING * 2 },
            fontSize,
            lines,
        };
    }
    if (element.type === "text") {
        const width = element.width || DEFAULT_TEXT_BOX_WIDTH;
        return {
            box: { x: element.x, y: element.y, width },
            fontSize: element.size || 16,
            lines: getWrappedLines(measureContext(), element, element.autoWidth ? Infinity : width),
        };
    }
    return null;
};

// The address of the link written in a text box or note under a world point, if any.
export const linkInTextAt = (element, worldPoint) => {
    const block = element && textBlockOf(element);
    if (!block) return null;
    const { x, y } = worldPointToElement(element, worldPoint);
    const lineHeight = block.fontSize * LINE_HEIGHT_RATIO;
    const line = block.lines[Math.floor((y - block.box.y) / lineHeight)];
    if (!line || y < block.box.y) return null;
    const left = lineStartX(element.align || "left", block.box, line.width);
    const segment = line.segments.find(
        (candidate) => candidate.link && x >= left + line.indent + candidate.x && x <= left + line.indent + candidate.x + candidate.width,
    );
    return segment && isSafeLink(segment.link) ? segment.link : null;
};
