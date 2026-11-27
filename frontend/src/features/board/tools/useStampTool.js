import { useCallback } from "react";
import { useSelector } from "react-redux";
import { DEFAULT_STAMP_SCREEN_SIZE } from "../../../../../shared/canvas/elements/stamps.js";
import { generateElementId, withSchemaV2Fields } from "../state/boardHelpers";

// Each click drops the chosen stamp, the same size on screen at any zoom, and
// the tool stays picked so a person can stamp several things in a row.
export const useStampTool = (board) => {
    const { addElement, cameraRef, elements } = board;
    const stampKind = useSelector((state) => state.toolbox.stampKind);

    const placeStamp = useCallback(
        (x, y) => {
            const half = DEFAULT_STAMP_SCREEN_SIZE / cameraRef.current.zoom / 2;
            addElement(
                generateElementId(),
                withSchemaV2Fields(
                    { type: "stamp", startX: x - half, startY: y - half, endX: x + half, endY: y + half, kind: stampKind, opacity: 100 },
                    elements,
                ),
            );
        },
        [addElement, cameraRef, elements, stampKind],
    );

    return { placeStamp };
};
