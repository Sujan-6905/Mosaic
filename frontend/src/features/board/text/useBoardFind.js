import { useCallback, useEffect, useMemo, useState } from "react";
import { MENU_ITEMS } from "../tools/toolSettings";
import { menuItemClick } from "@/store/menuSlice";
import { getElementBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { findOnBoard } from "./boardFind";

export const useBoardFind = (board) => {
    const { cameraRef, dispatch, elements, recenterCameraOn, setSelectedElementIds, showWorldBounds, viewportSize } = board;
    const [findOpen, setFindOpen] = useState(false);
    const [findQuery, setFindQuery] = useState("");
    const [findIndex, setFindIndex] = useState(0);

    const findMatches = useMemo(() => (findOpen ? findOnBoard(elements, findQuery) : []), [findOpen, elements, findQuery]);

    // Keeps the current match in view at the zoom the person chose, zooming out only when it can't fit.
    const showMatch = useCallback(
        (elementId) => {
            const bounds = getElementBounds(elements[elementId]);
            if (!bounds) return;
            dispatch(menuItemClick(MENU_ITEMS.SELECT));
            setSelectedElementIds([elementId]);
            const zoom = cameraRef.current.zoom;
            const fits = (bounds.maxX - bounds.minX) * zoom < viewportSize.width - 160 && (bounds.maxY - bounds.minY) * zoom < viewportSize.height - 160;
            if (fits) recenterCameraOn((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
            else showWorldBounds(bounds);
        },
        [elements, dispatch, setSelectedElementIds, cameraRef, viewportSize, recenterCameraOn, showWorldBounds],
    );

    const stepFind = useCallback(
        (direction) => {
            if (findMatches.length === 0) return;
            const next = (findIndex + direction + findMatches.length) % findMatches.length;
            setFindIndex(next);
            showMatch(findMatches[next]);
        },
        [findMatches, findIndex, showMatch],
    );

    const changeFindQuery = useCallback(
        (query) => {
            setFindQuery(query);
            setFindIndex(0);
            const first = findOnBoard(elements, query)[0];
            if (first) showMatch(first);
        },
        [elements, showMatch],
    );

    // An edit can remove matches, so the position never points past the end.
    useEffect(() => {
        if (findIndex >= findMatches.length && findMatches.length > 0) setFindIndex(findMatches.length - 1);
    }, [findIndex, findMatches.length]);

    return { changeFindQuery, findIndex, findMatches, findOpen, findQuery, setFindOpen, stepFind };
};
