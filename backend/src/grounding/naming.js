// Names every object by a fixed precedence and disambiguates collisions the way a person would
// ("TODO in Sprint frame"), never with a bare number.
import { boundsCenter } from "../../../shared/canvas/geometry/bounds.js";

const MAX_NAME_LENGTH = 60;
const truncate = (text) => (text.length > MAX_NAME_LENGTH ? `${text.slice(0, MAX_NAME_LENGTH - 1)}…` : text);

// Merged label groups are named already; this covers a label near an object but not merged into it.
const attachedLabelText = (object, canonicalScene, relations) => {
    const nearestLabel = relations.find(([subject, relation]) => subject === object.ref && relation === "nearest-label");
    if (!nearestLabel) return null;
    const labelObject = canonicalScene.objects.find((candidate) => candidate.ref === nearestLabel[2]);
    return labelObject?.name || null;
};

const ownText = (object) => (object.type === "text" || object.type === "sticky" ? object.name : null);

const frameName = (object, allObjects) => {
    if (!object.frameId) return null;
    const frame = allObjects.find((candidate) => candidate.ref === object.frameId);
    return frame?.name || null;
};

const TYPE_LABELS = {
    shape: "shape",
    path: "freehand drawing",
    text: "text",
    sticky: "sticky note",
    frame: "frame",
    connector: "connector",
    image: "image",
    group: "drawing",
};

// A group of structured elements is named by what it holds ("group of 4
// sticky notes"); one with freehand strokes falls through to its position.
const groupComposition = (object, canonicalScene) => {
    if (object.type !== "group") return null;
    const members = object.memberRefs.map((memberRef) => canonicalScene.objects.find((candidate) => candidate.ref === memberRef));
    if (members.some((member) => !member || member.type === "path")) return null;

    const counts = new Map();
    members.forEach((member) => {
        const label = TYPE_LABELS[member.type] || member.type;
        counts.set(label, (counts.get(label) || 0) + 1);
    });
    const parts = [...counts].map(([label, count]) => `${count} ${label}${count === 1 ? "" : "s"}`);
    return `group of ${parts.join(" and ")}`;
};

const positionLabel = (bounds, boardBounds) => {
    const center = boundsCenter(bounds);
    const boardWidth = boardBounds.maxX - boardBounds.minX || 1;
    const boardHeight = boardBounds.maxY - boardBounds.minY || 1;
    const fx = (center.x - boardBounds.minX) / boardWidth;
    const fy = (center.y - boardBounds.minY) / boardHeight;

    const col = fx < 1 / 3 ? "left" : fx > 2 / 3 ? "right" : "center";
    const row = fy < 1 / 3 ? "top" : fy > 2 / 3 ? "bottom" : "middle";
    return row === "middle" && col === "center" ? "center" : `${row} ${col}`;
};

const fallbackName = (object, boardBounds) => {
    const typeLabel = object.shapeType ? object.shapeType.toLowerCase() : TYPE_LABELS[object.type] || object.type;
    return `${typeLabel}, ${positionLabel(object.bounds, boardBounds)}`;
};

// Precedence: attached label text, own text, group composition, frame name,
// then the type-and-position fallback: the first non-empty source wins.
export const nameObjects = (objects, canonicalScene, relations, boardBounds) => {
    const named = objects.map((object) => {
        if (object.name) return object; // already named by a merge (e.g. the sole member of a solo text/sticky group)

        const source =
            attachedLabelText(object, canonicalScene, relations) ||
            ownText(object) ||
            groupComposition(object, canonicalScene) ||
            frameName(object, objects) ||
            fallbackName(object, boardBounds);

        return { ...object, name: truncate(source), fullText: source.length > MAX_NAME_LENGTH ? source : undefined };
    });

    return disambiguateCollisions(named, boardBounds);
};

// A duplicate name gains its frame, else its position.
const disambiguateCollisions = (objects, boardBounds) => {
    const byName = new Map();
    objects.forEach((object) => {
        if (!byName.has(object.name)) byName.set(object.name, []);
        byName.get(object.name).push(object);
    });

    return objects.map((object) => {
        const siblings = byName.get(object.name);
        if (siblings.length === 1) return object;

        // A child named after its own frame already says "in <frame>", so only position disambiguates it.
        const frame = object.frameId ? objects.find((candidate) => candidate.ref === object.frameId) : null;
        const qualifier = frame?.name && frame.name !== object.name ? `in ${frame.name}` : positionLabel(object.bounds, boardBounds);
        return { ...object, name: truncate(`${object.name} (${qualifier})`) };
    });
};
