import { useCallback } from "react";
import { colorTokenFor } from "../rendering/colorResolver";
import { paintElement } from "../rendering/elementPainter";
import { enclosedRegionRings } from "./regionFill";
import { generateElementId, withSchemaV2Fields } from "../state/boardHelpers";
import { viewportWorldBounds } from "../camera/camera";
import { isClosedShape } from "../../../../../shared/canvas/geometry/shapeGeometry.js";

const MAX_PICTURE_SIDE = 2400;
const SEARCH_GROWTH = 3;

// Renders one window of the board in its true ink onto a throwaway canvas and
// returns what the region search needs from it.
const renderBoardWindow = (entries, elements, window) => {
    const worldWidth = window.maxX - window.minX;
    const worldHeight = window.maxY - window.minY;
    const scale = Math.min(window.scale, MAX_PICTURE_SIDE / Math.max(worldWidth, worldHeight));
    const width = Math.ceil(worldWidth * scale);
    const height = Math.ceil(worldHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.setTransform(scale, 0, 0, scale, -window.minX * scale, -window.minY * scale);
    entries.forEach(([, element]) => paintElement(context, element, { elements, zoom: scale, onImageLoad: null }));
    const { data } = context.getImageData(0, 0, width, height);
    const alpha = new Uint8Array(width * height);
    for (let i = 0; i < alpha.length; i += 1) alpha[i] = data[i * 4 + 3];
    return { alpha, width, height, scale };
};

export const useBucketFill = (board) => {
    const {
        applyElementUpdates,
        addElement,
        cameraRef,
        color,
        drawStyle,
        elements,
        getElementAtPoint,
        getSelectionTolerance,
        paintOrder,
        showToast,
        spatialIndexRef,
        viewportSizeRef,
    } = board;

    const fillPatch = useCallback(
        () => ({ fillColor: color, fillColorToken: colorTokenFor(color) ?? null, fillStyle: drawStyle.fillStyle === "solid" ? "solid" : drawStyle.fillStyle }),
        [color, drawStyle],
    );

    // A shape gets its fill directly. Anywhere else, whatever lines happen to
    // close around the point become a new shape of their own beneath them.
    const fillEnclosedArea = useCallback(
        (x, y) => {
            const camera = cameraRef.current;
            const { width: viewWidth, height: viewHeight } = viewportSizeRef.current;
            const visible = viewportWorldBounds(camera, viewWidth, viewHeight);
            const extent = spatialIndexRef.current.getFullExtent();
            if (!extent) return false;
            const windows = [
                { ...visible, scale: camera.zoom },
                {
                    minX: x - (visible.maxX - visible.minX) * SEARCH_GROWTH,
                    minY: y - (visible.maxY - visible.minY) * SEARCH_GROWTH,
                    maxX: x + (visible.maxX - visible.minX) * SEARCH_GROWTH,
                    maxY: y + (visible.maxY - visible.minY) * SEARCH_GROWTH,
                    scale: camera.zoom,
                },
            ];
            for (const window of windows) {
                const ids = spatialIndexRef.current.queryRect(window);
                const entries = paintOrder.entriesFor(elements, ids);
                const { alpha, width, height, scale } = renderBoardWindow(entries, elements, window);
                const rings = enclosedRegionRings(alpha, width, height, Math.floor((x - window.minX) * scale), Math.floor((y - window.minY) * scale));
                if (!rings) continue;
                const pixelXs = rings.flatMap((ring) => ring.map((point) => point.x));
                const pixelYs = rings.flatMap((ring) => ring.map((point) => point.y));
                const minPixelX = Math.min(...pixelXs);
                const minPixelY = Math.min(...pixelYs);
                const spanX = Math.max(...pixelXs) - minPixelX || 1;
                const spanY = Math.max(...pixelYs) - minPixelY || 1;
                const lowestZ = entries.length ? (entries[0][1].zIndex ?? 0) : 0;
                const region = withSchemaV2Fields(
                    {
                        type: "shape",
                        shapeType: "Region",
                        startX: window.minX + minPixelX / scale,
                        startY: window.minY + minPixelY / scale,
                        endX: window.minX + (minPixelX + spanX) / scale,
                        endY: window.minY + (minPixelY + spanY) / scale,
                        rings: rings.map((ring) => ring.map((point) => ({ x: (point.x - minPixelX) / spanX, y: (point.y - minPixelY) / spanY }))),
                        color,
                        size: 0,
                        opacity: 100,
                        ...fillPatch(),
                    },
                    elements,
                );
                region.zIndex = lowestZ - 1;
                addElement(generateElementId(), region);
                return true;
            }
            return false;
        },
        [cameraRef, viewportSizeRef, spatialIndexRef, paintOrder, elements, color, fillPatch, addElement],
    );

    const handleBucketClick = useCallback(
        (x, y) => {
            const hitId = getElementAtPoint(x, y, getSelectionTolerance);
            const hit = hitId ? elements[hitId] : null;
            if (hit?.locked) return;
            if (isClosedShape(hit) || hit?.type === "sticky" || hit?.type === "frame") {
                applyElementUpdates({ [hitId]: { ...hit, ...fillPatch() } });
                return;
            }
            if (hit && hit.type !== "image" && hit.type !== "embed" && hit.type !== "table" && hit.type !== "stamp") {
                applyElementUpdates({ [hitId]: { ...hit, color, colorToken: colorTokenFor(color) ?? null } });
                return;
            }
            if (!fillEnclosedArea(x, y)) {
                showToast?.info("Nothing to fill here", "Click a shape, or a space fully enclosed by lines.");
            }
        },
        [getElementAtPoint, getSelectionTolerance, elements, applyElementUpdates, fillPatch, color, fillEnclosedArea, showToast],
    );

    return { handleBucketClick };
};
