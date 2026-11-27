// Deterministic fixes for lints that have one; describeRemainingLints turns the rest into a
// complaint for the model.
import { translateElement } from "../../../../shared/canvas/geometry/elementGeometry.js";
import { getElementBounds, boundsCenter, stickyHeightForText } from "../../../../shared/canvas/geometry/bounds.js";
import { findContainingFrame } from "../../../../shared/canvas/elements/frames.js";
import { lintScene } from "./linter.js";
import { contrastRatio } from "../../../../shared/canvas/color/contrast.js";

const NUDGE_MARGIN_PX = 4;

// Separates along the axis needing the smaller nudge, split evenly between the two.
const repairNudgeApart = (elements, lint) => {
    const [idA, idB] = lint.elementIds;
    const a = getElementBounds(elements[idA]);
    const b = getElementBounds(elements[idB]);
    if (!a || !b) return {};

    const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
    const overlapY = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
    if (overlapX <= 0 || overlapY <= 0) return {};

    const centerA = boundsCenter(a);
    const centerB = boundsCenter(b);
    if (overlapX <= overlapY) {
        const push = (overlapX / 2 + NUDGE_MARGIN_PX) * (centerA.x <= centerB.x ? -1 : 1);
        return { [idA]: translateElement(elements[idA], push, 0), [idB]: translateElement(elements[idB], -push, 0) };
    }
    const push = (overlapY / 2 + NUDGE_MARGIN_PX) * (centerA.y <= centerB.y ? -1 : 1);
    return { [idA]: translateElement(elements[idA], 0, push), [idB]: translateElement(elements[idB], 0, -push) };
};

const repairFrameMembership = (elements, lint) => {
    const [id] = lint.elementIds;
    const bounds = getElementBounds(elements[id]);
    if (!bounds) return {};
    return { [id]: { ...elements[id], frameId: findContainingFrame(elements, bounds) } };
};

const repairDanglingConnector = (elements, lint) => {
    const [id] = lint.elementIds;
    const connector = elements[id];
    if (!connector) return {};
    return {
        [id]: {
            ...connector,
            startElementId: elements[connector.startElementId] ? connector.startElementId : null,
            endElementId: elements[connector.endElementId] ? connector.endElementId : null,
        },
    };
};

// Snaps the second element back onto the first along whichever axis is
// already closer: the axis a human nudging it back into place would pick.
const repairAlignment = (elements, lint) => {
    const [idA, idB] = lint.elementIds;
    const a = getElementBounds(elements[idA]);
    const b = getElementBounds(elements[idB]);
    if (!a || !b) return {};
    const centerA = boundsCenter(a);
    const centerB = boundsCenter(b);
    return Math.abs(centerA.x - centerB.x) <= Math.abs(centerA.y - centerB.y)
        ? { [idB]: translateElement(elements[idB], centerA.x - centerB.x, 0) }
        : { [idB]: translateElement(elements[idB], 0, centerA.y - centerB.y) };
};

// The same box lintTextOverflow measures, so a repaired box stops being flagged.
const repairTextOverflow = (elements, lint) => {
    const [id] = lint.elementIds;
    const sticky = elements[id];
    if (!sticky) return {};
    return { [id]: { ...sticky, height: stickyHeightForText(sticky) } };
};

const INK_ON_LIGHT = "#1f2937";
const INK_ON_DARK = "#ffffff";

// Whichever of dark ink or white reads better on the element's fill.
const repairReadableInk = (elements, lint) => {
    const [id] = lint.elementIds;
    const element = elements[id];
    if (!element) return {};
    const ink = contrastRatio(INK_ON_LIGHT, element.fillColor) >= contrastRatio(INK_ON_DARK, element.fillColor) ? INK_ON_LIGHT : INK_ON_DARK;
    return { [id]: element.type === "sticky" ? { ...element, color: ink } : { ...element, textColor: ink } };
};

const AUTO_REPAIRERS = {
    "readable-ink": repairReadableInk,
    "nudge-apart": repairNudgeApart,
    "re-derive-frame-membership": repairFrameMembership,
    "unbind-dangling-endpoint": repairDanglingConnector,
    "re-align": repairAlignment,
    "grow-box": repairTextOverflow,
};

const DEFAULT_MAX_PASSES = 1;

// A bounded loop, since a repair can cause a new lint. Only lints naming a fixer are applied;
// off-canvas and pre-existing low contrast are left as they are.
export const autoRepair = (elements, previousElements, { maxPasses = DEFAULT_MAX_PASSES } = {}) => {
    let current = elements;
    const applied = [];

    for (let pass = 0; pass < maxPasses; pass++) {
        const lints = lintScene(current, { previousElements });
        const repairable = lints.filter((lint) => AUTO_REPAIRERS[lint.suggestedRepair]);
        if (repairable.length === 0) break;

        let updatedById = {};
        repairable.forEach((lint) => {
            updatedById = { ...updatedById, ...AUTO_REPAIRERS[lint.suggestedRepair](current, lint) };
            applied.push({ rule: lint.rule, elementIds: lint.elementIds });
        });
        if (Object.keys(updatedById).length === 0) break;
        current = { ...current, ...updatedById };
    }

    return { elements: current, applied, remainingLints: lintScene(current, { previousElements }) };
};

// What repair couldn't clear, as one complaint for the model's next turn.
export const describeRemainingLints = (lints) => lints.map((lint) => `${lint.rule}: ${lint.message}`).join("; ");
