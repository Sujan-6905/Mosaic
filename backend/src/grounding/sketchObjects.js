// A sketch is talked about whole ("the dog") and in parts ("the ear"), so each part's strokes
// form one object and the whole sketch gets one more.
import { unionBounds } from "../../../shared/canvas/geometry/bounds.js";
const SKETCH_REF_PREFIX = "sketch_";

const sketchElementOf = (object, elements) => {
    const element = elements[object.memberElementIds[0]];
    return object.memberElementIds.length === 1 && element?.type === "path" && element.label ? element : null;
};

export const mergeSketchParts = (objects, elements) => {
    const merged = [];
    const partByKey = new Map();
    objects.forEach((object) => {
        const element = sketchElementOf(object, elements);
        if (!element) {
            merged.push(object);
            return;
        }
        const key = `${element.sketchId ?? ""}:${element.label.toLowerCase()}`;
        const part = partByKey.get(key);
        if (!part) {
            const first = { ...object, name: element.label };
            partByKey.set(key, first);
            merged.push(first);
            return;
        }
        part.memberRefs = [...part.memberRefs, ...object.memberRefs];
        part.memberElementIds = [...part.memberElementIds, ...object.memberElementIds];
        part.bounds = unionBounds([part.bounds, object.bounds]);
        part.locked = Boolean(part.locked || object.locked);
    });
    return merged;
};

export const wholeSketchObjects = (objects, elements) => {
    const partsBySketch = new Map();
    objects.forEach((object) => {
        const { sketchId } = elements[object.memberElementIds[0]] ?? {};
        if (!sketchId) return;
        partsBySketch.set(sketchId, [...(partsBySketch.get(sketchId) ?? []), object]);
    });

    return [...partsBySketch].map(([sketchId, parts]) => ({
        ref: `${SKETCH_REF_PREFIX}${sketchId.slice(0, 8)}`,
        type: "sketch",
        shapeType: null,
        bounds: unionBounds(parts.map((part) => part.bounds)),
        name: elements[parts[0].memberElementIds[0]].sketchTitle ?? "a sketch",
        frameId: null,
        groupId: null,
        zIndex: Math.max(...parts.map((part) => part.zIndex ?? 0)),
        locked: parts.some((part) => part.locked),
        memberRefs: parts.flatMap((part) => part.memberRefs),
        memberElementIds: parts.flatMap((part) => part.memberElementIds),
        partRefs: parts.map((part) => part.ref),
        signals: [],
        confidence: 1,
        wholeSketch: true,
    }));
};
