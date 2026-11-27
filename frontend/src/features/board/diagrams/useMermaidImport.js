import { useCallback } from "react";
import { FONT_FAMILIES } from "../../../../../shared/canvas/elements/fontSources.js";
import { colorTokenFor } from "../rendering/colorResolver";
import { createCanvasTextMetrics } from "../rendering/canvasTextMetrics";
import { buildMermaidElements } from "../../../../../shared/canvas/mermaid/buildMermaidElements.js";
import { generateElementId } from "../state/boardHelpers";

// Converted Mermaid follows the pointer like an AI drawing until it's placed, and
// takes the board's current ink so it reads in either theme.
export const useMermaidImport = (board) => {
    const { color, setAiPlacement } = board;

    const buildMermaid = useCallback(
        (parsed) => {
            const colorToken = colorTokenFor(color) ?? null;
            return buildMermaidElements(parsed, { metrics: createCanvasTextMetrics(FONT_FAMILIES[0]), color, generateElementId }).map(
                ({ elementId, element }) => ({
                    elementId,
                    element: element.color === color ? { ...element, colorToken } : element,
                }),
            );
        },
        [color],
    );

    const placeMermaid = useCallback((parsed) => setAiPlacement({ mapped: buildMermaid(parsed) }), [buildMermaid, setAiPlacement]);

    return { buildMermaid, placeMermaid };
};
