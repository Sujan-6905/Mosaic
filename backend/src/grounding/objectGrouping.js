// Turns grouping results into the objects every later layer reasons over. Ref stability is an
// in-memory registry per board, reset on restart along with the live rooms.
import { groupByStructuralSignals, groupByTemporalSignal, arbitrateGrouping, stabilizeGroupRefs } from "./groupingSignals.js";
import { isLayerEnabled, LAYER_KEYS } from "./flags.js";
import { getRecentOpEntries } from "./opLogSource.js";
import { unionBounds } from "../../../shared/canvas/geometry/bounds.js";

const stabilityByShareId = new Map();

const registryFor = (shareId) => {
    if (!stabilityByShareId.has(shareId)) {
        stabilityByShareId.set(shareId, { previousGroups: [], usedRefs: new Set() });
    }
    return stabilityByShareId.get(shareId);
};

// A single-member group keeps its element's own ref, so boards with nothing freehand see no ref churn.
const buildObject = (canonicalScene, memberRefs, ref, meta) => {
    const members = memberRefs.map((memberRef) => canonicalScene.objects.find((object) => object.ref === memberRef));
    const bounds = unionBounds(members.map((member) => member.bounds));

    const sole = members.length === 1 ? members[0] : null;
    const sharedFrameId = members.every((member) => member.frameId === members[0].frameId) ? members[0].frameId : null;
    // A merged label group is named here, so a different label can't attach to it later. A group
    // with several labels (a sticky cluster) has none.
    const labelMembers = sole ? [] : members.filter((member) => (member.type === "text" || member.type === "sticky") && member.name);
    const labelMember = labelMembers.length === 1 ? labelMembers[0] : null;

    return {
        ref,
        type: sole ? sole.type : "group",
        shapeType: sole ? sole.shapeType : null,
        bounds,
        name: sole ? sole.name : (labelMember?.name ?? null),
        frameId: sharedFrameId,
        groupId: members.find((member) => member.groupId)?.groupId ?? null,
        zIndex: Math.max(...members.map((member) => member.zIndex ?? 0)),
        locked: members.some((member) => member.locked),
        startElementId: sole ? sole.startElementId : null,
        endElementId: sole ? sole.endElementId : null,
        memberRefs,
        memberElementIds: members.map((member) => member.elementId),
        signals: meta?.signals ?? [],
        confidence: meta?.confidence ?? 1,
    };
};

export const buildGroupedObjects = async (shareId, canonicalScene) => {
    const canonicalObjects = canonicalScene.objects;
    if (canonicalObjects.length === 0) return [];

    if (!isLayerEnabled(LAYER_KEYS.GROUPING)) {
        return canonicalObjects.map((object) => buildObject(canonicalScene, [object.ref], object.ref, null));
    }

    const opLogEntries = isLayerEnabled(LAYER_KEYS.TEMPORAL_GROUPING) ? await getRecentOpEntries(shareId) : [];
    // Lets the structural pass respect the temporal pass's author boundary.
    const elementAuthors = new Map();
    for (const entry of opLogEntries) {
        const existing = elementAuthors.get(entry.elementId);
        if (!existing) elementAuthors.set(entry.elementId, entry.authorId);
    }

    const structural = groupByStructuralSignals(canonicalObjects, elementAuthors);
    const temporal = groupByTemporalSignal(canonicalObjects, opLogEntries);
    const arbitrated = arbitrateGrouping(structural, temporal, canonicalObjects);

    const solo = arbitrated.groups.filter((group) => group.memberRefs.length === 1);
    const multi = arbitrated.groups.filter((group) => group.memberRefs.length > 1);

    const registry = registryFor(shareId);
    const stabilized = stabilizeGroupRefs(multi, registry.previousGroups, registry.usedRefs);
    registry.previousGroups = stabilized.groups.map((group) => ({ ref: group.ref, memberRefs: group.memberRefs }));

    const soloObjects = solo.map((group) => buildObject(canonicalScene, group.memberRefs, group.memberRefs[0], group));
    const multiObjects = stabilized.groups.map((group) => buildObject(canonicalScene, group.memberRefs, group.ref, group));

    return [...soloObjects, ...multiObjects];
};
