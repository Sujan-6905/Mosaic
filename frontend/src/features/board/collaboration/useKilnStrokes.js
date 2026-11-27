import { useCallback, useRef } from "react";
import { DEFAULT_DRAW_STYLE, LINE_STYLES } from "../tools/toolSettings";
import { generateElementId, withSchemaV2Fields } from "../state/boardHelpers";

const KILN_GOLD = "#c07d1c";
// The pad is wider than most drawings on a board; this keeps the sketch at a comfortable size.
const PAD_TO_SCREEN = 0.7;

// Lays strokes drawn on the cold-start pad onto the board, centred in view at the current zoom.
export const useKilnStrokes = (board) => {
    const latest = useRef(board);
    latest.current = board;

    return useCallback((strokes) => {
        const { addElement, cameraRef, elements, hasEditAccess, showToast, viewportCenter } = latest.current;
        if (!hasEditAccess || strokes.length === 0) return;
        const all = strokes.flat();
        const midX = (Math.min(...all.map((p) => p.x)) + Math.max(...all.map((p) => p.x))) / 2;
        const midY = (Math.min(...all.map((p) => p.y)) + Math.max(...all.map((p) => p.y))) / 2;
        const center = viewportCenter();
        const scale = PAD_TO_SCREEN / (cameraRef.current?.zoom || 1);
        const placed = { ...elements };
        for (const stroke of strokes) {
            const elementId = generateElementId();
            const element = withSchemaV2Fields(
                {
                    type: "path",
                    points: stroke.map((p) => ({
                        x: Math.round((center.x + (p.x - midX) * scale) * 100) / 100,
                        y: Math.round((center.y + (p.y - midY) * scale) * 100) / 100,
                    })),
                    color: KILN_GOLD,
                    size: 4,
                    opacity: 100,
                    style: LINE_STYLES.PENCIL,
                    pressure: DEFAULT_DRAW_STYLE.pressure,
                    steadying: DEFAULT_DRAW_STYLE.steadying,
                    timestamp: Date.now(),
                },
                placed,
            );
            placed[elementId] = element;
            addElement(elementId, element);
        }
        showToast?.success("Kept from the wait", strokes.length === 1 ? "Your sketch is on the board." : `Your ${strokes.length} strokes are on the board.`);
    }, []);
};
