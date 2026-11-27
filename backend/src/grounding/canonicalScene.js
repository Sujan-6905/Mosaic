// Every element as an object with normalised bounds and a ref hashed from its id, so a ref
// stays valid across rebuilds as other elements come and go.
import { getElementBounds } from "../../../shared/canvas/geometry/bounds.js";
import { hashToBase36 } from "./contentHash.js";
import { describeStroke } from "../../../shared/canvas/strokes/shapeRecognizer.js";
import { wordsOf } from "../../../shared/canvas/elements/elementWords.js";

// Disambiguates a hash collision (rare at real board sizes) with a salted
// rehash rather than letting two different elements silently share one ref.
const refForElementId = (elementId, claimedRefs) => {
    let salt = 0;
    let ref = `obj_${hashToBase36(elementId)}`;
    while (claimedRefs.has(ref)) {
        salt += 1;
        ref = `obj_${hashToBase36(`${elementId}:${salt}`)}`;
    }
    return ref;
};

const LINE_SHAPE_TYPES = new Set(["Line", "Arrow"]);
// A table is named by its first few cells, usually its header row.
const TABLE_NAME_CELLS = 4;

// A drawn line is the same thing to a reader whether it stayed a pen stroke or
// the recogniser straightened it into a shape.
const strokeOf = (element) => {
    if (element.type === "path") return describeStroke(element.points);
    if (element.type === "shape" && LINE_SHAPE_TYPES.has(element.shapeType)) {
        return { kind: "line", shapeType: "Line", start: { x: element.startX, y: element.startY }, end: { x: element.endX, y: element.endY } };
    }
    return null;
};

const objectName = (element) => {
    if (element.type === "frame") return element.name || null;
    if (element.type === "path") return element.label || null;
    if (element.type === "text" || element.type === "sticky") return element.text?.trim() || null;
    if ((element.type === "shape" || element.type === "connector") && element.text?.trim()) return element.text.trim();
    if (element.type === "table") return wordsOf(element).split("\n").slice(0, TABLE_NAME_CELLS).join(", ") || null;
    return null;
};

export const buildCanonicalScene = (elements) => {
    const refToId = new Map();
    const idToRef = new Map();
    const objects = [];

    for (const [elementId, element] of Object.entries(elements)) {
        const bounds = getElementBounds(element);
        // A path still being drawn has no bounds yet, so it's skipped, as the spatial index does.
        if (!bounds) continue;

        const ref = refForElementId(elementId, refToId);
        refToId.set(ref, elementId);
        idToRef.set(elementId, ref);

        objects.push({
            ref,
            elementId,
            type: element.type,
            shapeType: element.shapeType ?? null,
            bounds,
            name: objectName(element),
            frameId: element.frameId ?? null,
            groupId: element.groupId ?? null,
            zIndex: element.zIndex ?? 0,
            locked: element.locked ?? false,
            startElementId: element.startElementId ?? null,
            endElementId: element.endElementId ?? null,
            color: element.color ?? null,
            fillColor: element.fillColor ?? null,
            stroke: strokeOf(element),
        });
    }

    // Re-pointed at refs in a second pass, since a reference may name an element not yet visited.
    for (const object of objects) {
        if (object.frameId) object.frameId = idToRef.get(object.frameId) ?? null;
        if (object.startElementId) object.startElementId = idToRef.get(object.startElementId) ?? null;
        if (object.endElementId) object.endElementId = idToRef.get(object.endElementId) ?? null;
    }

    return { objects, idToRef };
};

export const elementIdToRef = (canonicalScene, elementId) => canonicalScene.idToRef.get(elementId) ?? null;
