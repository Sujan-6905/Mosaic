// Merges `source` into `target` from their common `base`, like git. Only the same field of
// the same element changed differently on both sides is a conflict for a person to settle.
import { getElementBounds } from "../geometry/bounds.js";

// Stamped by the server on every write, so they differ without anyone changing anything.
const IGNORED_FIELDS = new Set(["version", "updatedBy", "updatedAt"]);

// Fields that only make sense together: half of one move and half of another
// would put an element somewhere neither person put it.
const FIELD_GROUPS = {
    position: ["x", "y", "width", "height", "startX", "startY", "endX", "endY", "points", "rings", "waypoints", "autoHeightBase"],
    attachment: ["startElementId", "endElementId", "startAnchor", "endAnchor"],
    label: ["labelT", "labelOffset"],
};
const GROUP_OF = Object.fromEntries(Object.entries(FIELD_GROUPS).flatMap(([group, fields]) => fields.map((field) => [field, group])));

// Key order differs between a value read back from the database and one a
// browser built, so equality can't rest on plain JSON.stringify.
const stable = (value) => {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.keys(value)
            .filter((key) => value[key] !== undefined && !IGNORED_FIELDS.has(key))
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
            .join(",")}}`;
    }
    return JSON.stringify(value ?? null);
};
const same = (a, b) => stable(a) === stable(b);

const partsOf = (element) => {
    const parts = {};
    Object.keys(element || {}).forEach((field) => {
        if (IGNORED_FIELDS.has(field)) return;
        const key = GROUP_OF[field] ?? field;
        parts[key] ??= {};
        parts[key][field] = element[field];
    });
    return parts;
};

const withPart = (element, part, values) => {
    const next = { ...element };
    (FIELD_GROUPS[part] ?? [part]).forEach((field) => delete next[field]);
    return { ...next, ...values };
};

// Field by field: each side's change survives unless both changed the same part.
const mergeElement = (base, target, source) => {
    const [baseParts, targetParts, sourceParts] = [partsOf(base), partsOf(target), partsOf(source)];
    const keys = new Set([...Object.keys(baseParts), ...Object.keys(targetParts), ...Object.keys(sourceParts)]);
    let merged = target;
    const clashes = [];
    keys.forEach((key) => {
        const [b, t, s] = [baseParts[key], targetParts[key], sourceParts[key]];
        if (same(s, b) || same(t, s)) return;
        if (same(t, b)) merged = withPart(merged, key, s ?? {});
        else clashes.push(key);
    });
    return { merged, clashes };
};

const label = (element) => (element?.text || element?.name || element?.shapeType || element?.type || "element").toString().slice(0, 60);

// Everything the merge would do, before anyone has chosen anything:
// `ops` that apply cleanly and `conflicts` that need a choice.
export const planMerge = ({ base, target, source }) => {
    const ops = [];
    const conflicts = [];
    const ids = new Set([...Object.keys(base), ...Object.keys(target), ...Object.keys(source)]);
    ids.forEach((elementId) => {
        const [b, t, s] = [base[elementId], target[elementId], source[elementId]];
        if (same(b, s) || same(t, s)) return;
        if (same(b, t)) {
            ops.push({ elementId, before: t ?? null, after: s ?? null });
            return;
        }
        if (!t || !s || !b) {
            const kind = !b ? "both-added" : !s ? "removed-there" : "removed-here";
            conflicts.push({ id: elementId, elementId, kind, parts: [], label: label(s ?? t), keep: t ?? null, take: s ?? null });
            return;
        }
        const { merged, clashes } = mergeElement(b, t, s);
        if (clashes.length === 0) {
            ops.push({ elementId, before: t, after: merged });
            return;
        }
        const take = clashes.reduce((element, part) => withPart(element, part, partsOf(s)[part] ?? {}), merged);
        conflicts.push({ id: elementId, elementId, kind: "both-changed", parts: clashes, label: label(t), keep: merged, take });
    });
    return { ops, conflicts };
};

// The plan with each conflict settled: "take" uses the source's version, anything else keeps the target's.
export const resolveMerge = ({ ops, conflicts }, choices, target) => {
    const settled = [...ops];
    conflicts.forEach((conflict) => {
        const after = choices[conflict.id] === "take" ? conflict.take : conflict.keep;
        const before = target[conflict.elementId] ?? null;
        if (!same(before, after)) settled.push({ elementId: conflict.elementId, before, after });
    });
    // An arrow can't stay attached to something the merge removes or never brings over.
    const result = { ...target };
    settled.forEach(({ elementId, after }) => {
        if (after) result[elementId] = after;
        else delete result[elementId];
    });
    const loose = [];
    Object.entries(result).forEach(([elementId, element]) => {
        if (element.type !== "connector") return;
        const dropStart = element.startElementId && !result[element.startElementId];
        const dropEnd = element.endElementId && !result[element.endElementId];
        if (!dropStart && !dropEnd) return;
        loose.push({
            elementId,
            after: {
                ...element,
                ...(dropStart ? { startElementId: null, startAnchor: null } : {}),
                ...(dropEnd ? { endElementId: null, endAnchor: null } : {}),
            },
        });
    });
    loose.forEach(({ elementId, after }) => {
        const existing = settled.find((op) => op.elementId === elementId);
        if (existing) existing.after = after;
        else settled.push({ elementId, before: target[elementId] ?? null, after });
    });
    return settled;
};

const overlaps = (a, b) => a && b && a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;

// Places where the two sides' new or moved elements now sit on top of each
// other: not a conflict either side made, but worth a look before merging.
export const findOverlaps = ({ base, target, source }) => {
    const movedOrNew = (side) =>
        Object.entries(side)
            .filter(
                ([id, element]) =>
                    element.type !== "connector" &&
                    element.type !== "frame" &&
                    !same(base[id], element) &&
                    (!base[id] || !same(getElementBounds(base[id]), getElementBounds(element))),
            )
            .map(([id, element]) => ({ id, element, bounds: getElementBounds(element) }));
    const ours = movedOrNew(target);
    const theirs = movedOrNew(source).filter(({ id }) => !target[id] || !same(target[id], source[id]));
    const found = [];
    theirs.forEach((incoming) => {
        ours.forEach((existing) => {
            if (incoming.id !== existing.id && overlaps(incoming.bounds, existing.bounds))
                found.push({ sourceId: incoming.id, targetId: existing.id, label: `${label(incoming.element)} lands on ${label(existing.element)}` });
        });
    });
    return found;
};

export const mergeCounts = (ops) => ({
    added: ops.filter((op) => !op.before && op.after).length,
    changed: ops.filter((op) => op.before && op.after).length,
    removed: ops.filter((op) => op.before && !op.after).length,
});
