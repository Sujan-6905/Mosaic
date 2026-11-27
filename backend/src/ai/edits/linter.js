// New overlaps, frame escapes, dangling connectors, low contrast, off-canvas content, broken
// alignment and text overflow. With `previousElements`, only what an edit broke is a regression.
import { getElementBounds, boundsCenter, boundsIntersect, boundsContains, stickyHeightForText } from "../../../../shared/canvas/geometry/bounds.js";
import { contrastRatio, WCAG_AA_NORMAL_TEXT } from "../../../../shared/canvas/color/contrast.js";

// The same tolerance the relation graph calls "aligned".
const ALIGNMENT_TOLERANCE_PX = 12;
const OFF_CANVAS_ABSOLUTE_BOUND_PX = 100_000;
const OFF_CANVAS_RELATIVE_FACTOR = 6;

const isPositionable = (element) => element.type !== "connector";

const pairwiseOverlaps = (elements) => {
    const ids = Object.keys(elements).filter((id) => isPositionable(elements[id]));
    const overlapping = new Set();
    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            const a = getElementBounds(elements[ids[i]]);
            const b = getElementBounds(elements[ids[j]]);
            if (a && b && boundsIntersect(a, b)) overlapping.add([ids[i], ids[j]].sort().join("|"));
        }
    }
    return overlapping;
};

const pairwiseAligned = (elements) => {
    const ids = Object.keys(elements).filter((id) => isPositionable(elements[id]));
    const aligned = new Set();
    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            const a = getElementBounds(elements[ids[i]]);
            const b = getElementBounds(elements[ids[j]]);
            if (!a || !b) continue;
            const centerA = boundsCenter(a);
            const centerB = boundsCenter(b);
            if (Math.abs(centerA.x - centerB.x) <= ALIGNMENT_TOLERANCE_PX || Math.abs(centerA.y - centerB.y) <= ALIGNMENT_TOLERANCE_PX) {
                aligned.add([ids[i], ids[j]].sort().join("|"));
            }
        }
    }
    return aligned;
};

const lintOverlapRegression = (elements, previousElements, lints) => {
    if (!previousElements) return;
    const before = pairwiseOverlaps(previousElements);
    const after = pairwiseOverlaps(elements);
    after.forEach((pairKey) => {
        if (before.has(pairKey)) return;
        const [a, b] = pairKey.split("|");
        // Only something that already existed and moved into an overlap counts.
        if (!previousElements[a] || !previousElements[b]) return;
        lints.push({
            severity: "warning",
            rule: "overlap-regression",
            elementIds: [a, b],
            message: `${a} and ${b} now overlap and didn't before this edit`,
            suggestedRepair: "nudge-apart",
        });
    });
};

const lintOutsideFrame = (elements, lints) => {
    Object.entries(elements).forEach(([id, element]) => {
        if (!element.frameId || !elements[element.frameId]) return;
        const bounds = getElementBounds(element);
        const frameBounds = getElementBounds(elements[element.frameId]);
        if (bounds && frameBounds && !boundsContains(frameBounds, bounds)) {
            lints.push({
                severity: "warning",
                rule: "outside-frame",
                elementIds: [id],
                message: `${id} claims membership in ${element.frameId} but sits outside its bounds`,
                suggestedRepair: "re-derive-frame-membership",
            });
        }
    });
};

const lintDanglingConnectors = (elements, lints) => {
    Object.entries(elements).forEach(([id, element]) => {
        if (element.type !== "connector") return;
        [element.startElementId, element.endElementId].forEach((boundId) => {
            if (boundId && !elements[boundId]) {
                lints.push({
                    severity: "error",
                    rule: "dangling-connector",
                    elementIds: [id],
                    message: `${id} is bound to ${boundId}, which no longer exists`,
                    suggestedRepair: "unbind-dangling-endpoint",
                });
            }
        });
    });
};

// Only literal hex on literal hex can be checked; a theme token's contrast depends on the theme.
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const inkOf = (element) => (element.type === "sticky" ? element.color : (element.textColor ?? element.color));
const carriesWords = (element) => element.type === "sticky" || (element.type === "shape" && !!element.text);
const usesThemeColors = (element) => element.colorToken || element.fillColorToken || element.textColorToken;

// Repaired only when this edit set the colours: a pairing someone chose before is theirs to keep.
const lintContrast = (elements, previousElements, lints) => {
    Object.entries(elements).forEach(([id, element]) => {
        if (!carriesWords(element) || usesThemeColors(element)) return;
        const ink = inkOf(element);
        if (!HEX_COLOR.test(ink ?? "") || !HEX_COLOR.test(element.fillColor ?? "")) return;
        const ratio = contrastRatio(ink, element.fillColor);
        if (ratio >= WCAG_AA_NORMAL_TEXT) return;
        const before = previousElements?.[id];
        const recolouredByThisEdit = !!before && (before.fillColor !== element.fillColor || inkOf(before) !== ink);
        lints.push({
            severity: "warning",
            rule: "low-contrast",
            elementIds: [id],
            message: `${id}'s text contrast (${ratio.toFixed(2)}:1) is below the WCAG AA floor of ${WCAG_AA_NORMAL_TEXT}:1`,
            suggestedRepair: recolouredByThisEdit ? "readable-ink" : null,
        });
    });
};

const lintOffCanvas = (elements, lints) => {
    const allBounds = Object.values(elements).map(getElementBounds).filter(Boolean);
    if (allBounds.length === 0) return;
    const centroidX = allBounds.reduce((sum, bounds) => sum + boundsCenter(bounds).x, 0) / allBounds.length;
    const centroidY = allBounds.reduce((sum, bounds) => sum + boundsCenter(bounds).y, 0) / allBounds.length;
    const spread = Math.max(...allBounds.map((bounds) => Math.hypot(boundsCenter(bounds).x - centroidX, boundsCenter(bounds).y - centroidY)), 1);

    Object.entries(elements).forEach(([id, element]) => {
        const bounds = getElementBounds(element);
        if (!bounds) return;
        const center = boundsCenter(bounds);
        const distanceFromContent = Math.hypot(center.x - centroidX, center.y - centroidY);
        const absoluteOffCanvas = Math.abs(bounds.minX) > OFF_CANVAS_ABSOLUTE_BOUND_PX || Math.abs(bounds.minY) > OFF_CANVAS_ABSOLUTE_BOUND_PX;
        const relativeOffCanvas = allBounds.length > 1 && distanceFromContent > spread * OFF_CANVAS_RELATIVE_FACTOR;
        if (absoluteOffCanvas || relativeOffCanvas) {
            lints.push({
                severity: "error",
                rule: "off-canvas",
                elementIds: [id],
                message: `${id} sits far outside the rest of the board's content`,
                suggestedRepair: null,
            });
        }
    });
};

const lintAlignmentRegression = (elements, previousElements, lints) => {
    if (!previousElements) return;
    const before = pairwiseAligned(previousElements);
    const after = pairwiseAligned(elements);
    before.forEach((pairKey) => {
        if (after.has(pairKey)) return;
        const [a, b] = pairKey.split("|");
        if (!elements[a] || !elements[b]) return; // deleted, not misaligned
        lints.push({
            severity: "info",
            rule: "alignment-regression",
            elementIds: [a, b],
            message: `${a} and ${b} were aligned before this edit and no longer are`,
            suggestedRepair: "re-align",
        });
    });
};

const lintTextOverflow = (elements, lints) => {
    Object.entries(elements).forEach(([id, element]) => {
        if (element.type !== "sticky") return;
        if (stickyHeightForText(element) > element.height) {
            lints.push({
                severity: "warning",
                rule: "text-overflow",
                elementIds: [id],
                message: `${id}'s text no longer fits its own box`,
                suggestedRepair: "grow-box",
            });
        }
    });
};

const REGRESSION_RULES = new Set(["overlap-regression", "alignment-regression"]);

// Whether a before/after lint run found anything the edit newly broke.
export const hasGeometricRegression = (lints) => lints.some((lint) => REGRESSION_RULES.has(lint.rule));

export const lintScene = (elements, { previousElements = null } = {}) => {
    const lints = [];
    lintOverlapRegression(elements, previousElements, lints);
    lintOutsideFrame(elements, lints);
    lintDanglingConnectors(elements, lints);
    lintContrast(elements, previousElements, lints);
    lintOffCanvas(elements, lints);
    lintAlignmentRegression(elements, previousElements, lints);
    lintTextOverflow(elements, lints);
    return lints;
};

const TYPE_WORDS = {
    sticky: "a sticky note",
    shape: "a shape",
    text: "a text box",
    connector: "an arrow",
    frame: "a frame",
    path: "a drawing",
    image: "an image",
    table: "a table",
};
const MAX_NAME_LENGTH = 28;

// An element as a person would point at it: by its own words, or by what it is.
const spokenName = (element) => {
    const words = (element?.text ?? element?.name ?? "").split("\n")[0].trim();
    if (!words) return TYPE_WORDS[element?.type] ?? "an object";
    if (words.length <= MAX_NAME_LENGTH) return `"${words}"`;
    const cut = words.slice(0, MAX_NAME_LENGTH);
    return `"${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : MAX_NAME_LENGTH)}…"`;
};

const NOTICES = {
    "overlap-regression": ([a, b]) => `${a} and ${b} now overlap`,
    "outside-frame": ([a]) => `${a} sits outside its frame`,
    "dangling-connector": ([a]) => `${a} lost what it pointed to`,
    "low-contrast": ([a]) => `the text on ${a} is hard to read on its new colour`,
    "off-canvas": ([a]) => `${a} landed far from everything else`,
    "alignment-regression": ([a, b]) => `${a} and ${b} are no longer lined up`,
    "text-overflow": ([a]) => `the text no longer fits in ${a}`,
};

// The same finding for the review card, naming objects by what a person sees rather than by id.
export const describeLintForPeople = (lint, elements) => {
    const names = (lint.elementIds ?? []).map((id) => spokenName(elements[id]));
    return (NOTICES[lint.rule] ?? (() => lint.message))(names);
};
