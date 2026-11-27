import { translateElement } from "../../../../../shared/canvas/geometry/elementGeometry.js";
import { getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { endsMeet, sketchPartsToElements } from "../../../../../shared/canvas/strokes/sketchStrokes.js";
import { fontFieldsFor } from "../../../../../shared/canvas/elements/fontSources.js";
import { elementIdsForRefs, gapFor, generateEditElementId, nextZIndex, placementDelta } from "./common.js";

const FONT_FIELDS = ["fontFamily", "fontSource"];
const RESTYLABLE_FIELDS_BY_TYPE = {
    path: ["color", "fillColor", "opacity", "size"],
    shape: ["color", "fillColor", "opacity", "size", ...FONT_FIELDS],
    text: ["color", "opacity", ...FONT_FIELDS],
    sticky: ["color", "fillColor", "opacity", ...FONT_FIELDS],
    table: ["color", "fillColor", "opacity", ...FONT_FIELDS],
    connector: ["color", "opacity", "size"],
    frame: ["color"],
    image: ["opacity"],
};

// An open stroke has no inside: filling one paints a shape nobody drew across its
// open end, so the colour goes on its ink instead, which is what was meant.
const visibleStylePatch = (element, patch) => {
    if (element.type !== "path" || !patch.fillColor || endsMeet(element.points)) return patch;
    const { fillColor, fillColorToken, ...rest } = patch;
    return { ...rest, color: rest.color ?? fillColor, colorToken: rest.colorToken ?? fillColorToken ?? null };
};

// The fonts a person can name without picking one: hand-drawn, plain, bookish and typewriter.
const FONT_NAMES = { hand: "Caveat", sans: "Arial", serif: "Georgia", mono: "Courier New" };

const fieldsOf = ({ font, ...props }) => {
    if (!font) return props;
    const { fontFamily, fontSource } = fontFieldsFor(FONT_NAMES[font]);
    return { ...props, fontFamily, fontSource };
};

const executeRestyle = (elements, groupIndex, op) => {
    const memberIds = groupIndex.elementIdsForRef(op.ref);
    if (memberIds.length === 0) return { error: `unknown ref: ${op.ref}` };
    const props = fieldsOf(op.props);

    const updatedById = {};
    memberIds.forEach((id) => {
        const element = elements[id];
        if (!element) return;
        const applicable = RESTYLABLE_FIELDS_BY_TYPE[element.type] || [];
        const patch = visibleStylePatch(element, Object.fromEntries(Object.entries(props).filter(([key]) => applicable.includes(key))));
        if (Object.keys(patch).length > 0) updatedById[id] = { ...element, ...patch };
    });
    return Object.keys(updatedById).length === 0 ? { error: "no applicable style properties for this ref" } : { updatedById };
};

// A frame's words are its name; everything else that carries words keeps them in text.
const WORDED_TYPES = new Set(["text", "sticky", "shape", "connector", "frame"]);

const executeSetText = (elements, groupIndex, op) => {
    const memberIds = groupIndex.elementIdsForRef(op.ref).filter((id) => WORDED_TYPES.has(elements[id]?.type));
    // A shape labelled by a text element laid over it takes the new words on that label.
    const labelIds = memberIds.filter((id) => elements[id].type === "text");
    const targets = labelIds.length > 0 ? labelIds : memberIds;
    if (targets.length === 0) return { error: "setText needs an object that holds words" };
    return {
        updatedById: Object.fromEntries(
            targets.map((id) => [id, elements[id].type === "frame" ? { ...elements[id], name: op.text.slice(0, 100) } : { ...elements[id], text: op.text }]),
        ),
    };
};

const executeLock = (elements, groupIndex, op) => {
    const memberIds = elementIdsForRefs(groupIndex, op.refs).filter((id) => elements[id]);
    if (memberIds.length === 0) return { error: "no elements resolved for lock" };
    return { updatedById: Object.fromEntries(memberIds.map((id) => [id, { ...elements[id], locked: true }])) };
};

const executeGroup = (elements, groupIndex, op) => {
    const memberIds = op.refs.flatMap((ref) => groupIndex.elementIdsForRef(ref));
    if (memberIds.length < 2) return { error: "group requires at least two elements across the given refs" };
    const groupId = generateEditElementId();
    const updatedById = {};
    memberIds.forEach((id) => {
        if (elements[id]) updatedById[id] = { ...elements[id], groupId };
    });
    return { updatedById };
};

const executeUngroup = (elements, groupIndex, op) => {
    const memberIds = groupIndex.elementIdsForRef(op.ref);
    const updatedById = {};
    memberIds.forEach((id) => {
        if (elements[id]?.groupId) updatedById[id] = { ...elements[id], groupId: null };
    });
    return { updatedById };
};

const executeDuplicate = (elements, groupIndex, op) => {
    const memberIds = groupIndex.elementIdsForRef(op.ref);
    if (memberIds.length === 0) return { error: `unknown ref: ${op.ref}` };

    const idMap = new Map(memberIds.map((id) => [id, generateEditElementId()]));
    const newGroupId = memberIds.length > 1 ? generateEditElementId() : null;
    const newSketchId = generateEditElementId();
    const newElementsById = {};
    memberIds.forEach((id) => {
        const newId = idMap.get(id);
        newElementsById[newId] = {
            ...elements[id],
            groupId: newGroupId ?? elements[id].groupId ?? null,
            ...(elements[id].sketchId ? { sketchId: newSketchId } : {}),
        };
    });

    const anchorRef = op.anchorRef ?? op.ref;
    const anchorIds = op.anchorRef ? groupIndex.elementIdsForRef(op.anchorRef) : memberIds;
    const objectBounds = getUnionBounds(Object.values(newElementsById));
    const anchorBounds = getUnionBounds(anchorIds.map((id) => elements[id]));
    if (!objectBounds || !anchorBounds) return { error: `could not compute bounds for duplicate placement against ${anchorRef}` };

    const { dx, dy } = placementDelta(objectBounds, anchorBounds, op.relation, gapFor(op.relation));
    Object.keys(newElementsById).forEach((newId) => {
        newElementsById[newId] = translateElement(newElementsById[newId], dx, dy);
    });

    return { newElementsById };
};

const executeDelete = (elements, groupIndex, op) => {
    const deletedIds = op.refs.flatMap((ref) => groupIndex.elementIdsForRef(ref));
    return deletedIds.length === 0 ? { error: "no elements resolved for delete" } : { deletedIds };
};

const largestSideOf = (parts) => {
    const points = parts.flatMap((part) => part.strokes.flatMap((stroke) => stroke.points));
    const bounds = getUnionBounds([{ type: "path", points }]);
    return Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1);
};

const executeDrawParts = (elements, _groupIndex, op) => {
    const drawn = sketchPartsToElements({
        parts: op.parts,
        toBoard: ({ x, y }) => ({ x, y }),
        unit: largestSideOf(op.parts),
        color: op.color,
        zIndexBase: nextZIndex(elements),
        generateElementId: generateEditElementId,
        sketchId: generateEditElementId(),
        sketchTitle: op.title,
        extras: { colorToken: op.colorToken },
    });
    return { newElementsById: Object.fromEntries(drawn.map(({ elementId, element }) => [elementId, element])) };
};

export const CONTENT_EXECUTORS = {
    restyle: executeRestyle,
    setText: executeSetText,
    group: executeGroup,
    ungroup: executeUngroup,
    duplicate: executeDuplicate,
    delete: executeDelete,
    lock: executeLock,
    drawParts: executeDrawParts,
};
