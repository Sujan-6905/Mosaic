// Read-only scenes for replay and the branch diff, drawn with the live board's own painter.
import { getElementBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { paintElement } from "./elementPainter";
import { getLodLevel } from "./lod";
import { paintBackground } from "./backgroundRenderer";

export const drawStaticElement = (context, element, elementsMap, zoom, lod) =>
    paintElement(context, element, { elements: elementsMap, zoom, hideFineDetail: lod?.hideFineDetail });

// Draws `elements` and `background` framed by `camera`, in zIndex order like the live board.
export const drawSceneStatic = (context, elements, background, camera, viewportWidth, viewportHeight) => {
    context.setTransform(camera.zoom, 0, 0, camera.zoom, -camera.x * camera.zoom, -camera.y * camera.zoom);
    paintBackground(context, camera, viewportWidth, viewportHeight, background);

    const entries = Object.entries(elements).sort(([, a], [, b]) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const lod = getLodLevel(camera.zoom, entries.length);
    entries.forEach(([, element]) => drawStaticElement(context, element, elements, camera.zoom, lod));
};

// A coloured box around a changed element: solid for one present, dashed for a ghost of one gone.
export const drawDiffMarker = (context, element, color, { dashed = false } = {}) => {
    const bounds = getElementBounds(element);
    if (!bounds) return;
    context.save();
    context.strokeStyle = color;
    context.lineWidth = 2;
    if (dashed) context.setLineDash([6, 4]);
    context.strokeRect(bounds.minX - 4, bounds.minY - 4, bounds.maxX - bounds.minX + 8, bounds.maxY - bounds.minY + 8);
    context.restore();
};
