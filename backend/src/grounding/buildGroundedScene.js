// Canonical scene, then grouping, label attachment, relations and naming: relations and names
// reason over grouped objects, and naming reads the label relations.
import { buildCanonicalScene } from "./canonicalScene.js";
import { buildGroupedObjects } from "./objectGrouping.js";
import { buildRelationGraph } from "./relationGraph.js";
import { attachNearestLabels } from "./labelAttachment.js";
import { nameObjects } from "./naming.js";
import { isLayerEnabled, LAYER_KEYS } from "./flags.js";
import { mergeSketchParts, wholeSketchObjects } from "./sketchObjects.js";
import { unionBounds } from "../../../shared/canvas/geometry/bounds.js";

// Selected element ids become refs; a merged object counts as selected when any member is.
export const mapElementIdsToRefs = (groundedScene, elementIds) => {
    const idSet = new Set(elementIds);
    if (idSet.size === 0) return [];

    const refs = new Set();
    for (const object of groundedScene.objects) {
        if (object.wholeSketch) continue;
        const members = object.memberElementIds ?? [object.elementId];
        if (members.some((elementId) => idSet.has(elementId))) refs.add(object.ref);
    }
    return [...refs];
};

export const buildGroundedScene = async (shareId, elements) => {
    const canonicalScene = buildCanonicalScene(elements);
    const objects = mergeSketchParts(await buildGroupedObjects(shareId, canonicalScene), elements);

    if (objects.length === 0) return { objects: [], relations: [], canonicalScene };

    const boardBounds = unionBounds(objects.map((object) => object.bounds));

    if (!isLayerEnabled(LAYER_KEYS.RELATIONS)) {
        const unnamed = nameObjects(objects, canonicalScene, [], boardBounds);
        return { objects: [...unnamed, ...wholeSketchObjects(unnamed, elements)], relations: [], canonicalScene };
    }

    const labelRelations = attachNearestLabels(objects);
    const relations = [...buildRelationGraph(objects), ...labelRelations];
    const named = nameObjects(objects, canonicalScene, relations, boardBounds);

    return { objects: [...named, ...wholeSketchObjects(named, elements)], relations, canonicalScene };
};
