// Semantic checks zod can't make on a schema-valid batch: refs that exist, colours matching a
// token, and contradicting ops.
import { colorTokenFor } from "../../../../shared/canvas/color/colorTokens.js";
import { batchRefIndex } from "./editLanguage.js";

const REF_FIELDS_BY_OP = {
    align: ["refs"],
    distribute: ["refs"],
    place: ["ref", "anchorRef"],
    resizeToFit: ["ref"],
    connect: ["refA", "refB"],
    disconnect: ["refA", "refB"],
    restyle: ["ref"],
    setText: ["ref"],
    group: ["refs"],
    ungroup: ["ref"],
    duplicate: ["ref", "anchorRef"],
    delete: ["refs"],
    reorder: ["ref"],
    moveToFrame: ["ref", "frameRef"],
    tidy: ["refs"],
    add: ["anchorRef"],
    cleanUp: ["refs"],
    resize: ["refs"],
    move: ["refs"],
    rotate: ["refs"],
    frame: ["refs"],
    lock: ["refs"],
};

const levenshtein = (a, b) => {
    const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j++) rows[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            rows[i][j] = a[i - 1] === b[j - 1] ? rows[i - 1][j - 1] : 1 + Math.min(rows[i - 1][j - 1], rows[i - 1][j], rows[i][j - 1]);
        }
    }
    return rows[a.length][b.length];
};

// An invented ref is usually a near-typo of a real one: repair only an unambiguous match, else drop.
const NEAREST_REF_MAX_DISTANCE = 2;

const repairRef = (ref, validRefs) => {
    if (validRefs.has(ref) || batchRefIndex(ref) !== null) return { ref, repaired: false };

    let nearest = null;
    let nearestDistance = Infinity;
    for (const candidate of validRefs) {
        const distance = levenshtein(ref, candidate);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = candidate;
        }
    }
    if (nearest && nearestDistance <= NEAREST_REF_MAX_DISTANCE) return { ref: nearest, repaired: true, original: ref };
    return { ref: null, repaired: false, original: ref };
};

const isHexColor = (value) => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);

const normalizeColorProps = (props, events) => {
    const normalized = { ...props };
    ["color", "fillColor"].forEach((field) => {
        if (!isHexColor(normalized[field])) return;
        const token = colorTokenFor(normalized[field]);
        if (token) {
            events.push({ type: "color-normalized", field, from: normalized[field], to: token });
            normalized[`${field}Token`] = token;
        }
    });
    return normalized;
};

const batchKey = (op) => {
    if (op.op === "restyle") return `restyle:${op.ref}`;
    if (op.op === "setText") return `setText:${op.ref}`;
    if (op.op === "moveToFrame") return `moveToFrame:${op.ref}`;
    return null; // only ops with a single unambiguous target are worth deduplicating
};

// Null drops the whole operation when a required ref can't be resolved.
const sanitizeOperation = (op, validRefs, events) => {
    const refFields = REF_FIELDS_BY_OP[op.op] || [];
    const sanitized = { ...op };

    for (const field of refFields) {
        const value = sanitized[field];
        if (value === null || value === undefined) continue; // moveToFrame's frameRef may be intentionally null, add's anchorRef optional

        if (Array.isArray(value)) {
            const repairedList = [];
            for (const ref of value) {
                const { ref: resolved, repaired, original } = repairRef(ref, validRefs);
                if (!resolved) {
                    events.push({ type: "ref-dropped", op: op.op, field, ref: original ?? ref });
                    continue;
                }
                if (repaired) events.push({ type: "ref-repaired", op: op.op, field, from: original, to: resolved });
                repairedList.push(resolved);
            }
            if (repairedList.length === 0) return null;
            sanitized[field] = repairedList;
        } else {
            const { ref: resolved, repaired, original } = repairRef(value, validRefs);
            if (!resolved) {
                events.push({ type: "op-dropped", op: op.op, field, ref: original ?? value });
                return null;
            }
            if (repaired) events.push({ type: "ref-repaired", op: op.op, field, from: original, to: resolved });
            sanitized[field] = resolved;
        }
    }

    if (sanitized.op === "restyle") sanitized.props = normalizeColorProps(sanitized.props, events);

    return sanitized;
};

// Fixes refs, maps hex to known tokens, and keeps the last of contradicting ops, reporting each
// change in `events` so a rising rate is visible.
export const sanitizeEditBatch = (ops, validRefs) => {
    const events = [];
    const sanitizedOps = [];
    const seenKeys = new Map(); // batchKey -> index into sanitizedOps

    for (const op of ops) {
        const sanitized = sanitizeOperation(op, validRefs, events);
        if (!sanitized) continue;

        const key = batchKey(sanitized);
        if (key && seenKeys.has(key)) {
            events.push({ type: "duplicate-op-dropped", op: sanitized.op, key });
            sanitizedOps[seenKeys.get(key)] = sanitized;
            continue;
        }
        if (key) seenKeys.set(key, sanitizedOps.length);
        sanitizedOps.push(sanitized);
    }

    return { ops: sanitizedOps, events };
};
