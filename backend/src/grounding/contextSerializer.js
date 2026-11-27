// The model's view of a board: objects and relations by ref, never coordinates, within a
// character budget.
const DEFAULT_CHAR_BUDGET = 6000;

// Relations grow with the square of nearby objects, so they get their own cap.
const RELATION_BUDGET_SHARE = 0.3;
const MAX_OBJECT_TEXT_CHARS = 240;

// Past this, a selection is summarised by type ("mostly sticky notes") rather than listed.
const SELECTION_DETAIL_CAP = 40;

// Enough of a group's members for the model to recognise it ("the task
// cluster", "every sticky in Q1") without one huge group eating the budget.
const GROUP_MEMBER_CAP = 12;

const groupMembers = (object, canonicalObjectsByRef) => {
    const names = object.memberRefs.map((memberRef) => {
        const member = canonicalObjectsByRef.get(memberRef);
        return member?.name || member?.shapeType || member?.type || memberRef;
    });
    const hidden = names.length - GROUP_MEMBER_CAP;
    return hidden > 0 ? [...names.slice(0, GROUP_MEMBER_CAP), `+${hidden} more`] : names;
};

const membersOf = (object, canonicalObjectsByRef) =>
    (object.memberRefs ?? [object.ref]).map((memberRef) => canonicalObjectsByRef.get(memberRef)).filter(Boolean);

const STROKE_WORDS = { Rectangle: "box", Diamond: "diamond", Triangle: "triangle", Circle: "ellipse", Ellipse: "ellipse", Line: "line" };
const strokeWord = (stroke) => STROKE_WORDS[stroke?.shapeType] ?? (stroke?.kind === "curve" ? "curve" : null);

const clipText = (text) => (text.length > MAX_OBJECT_TEXT_CHARS ? `${text.slice(0, MAX_OBJECT_TEXT_CHARS - 1)}…` : text);

const objectToContext = (object, canonicalObjectsByRef, suspectRefs) => {
    const members = membersOf(object, canonicalObjectsByRef);
    const texts = members.filter((member) => (member.type === "text" || member.type === "sticky") && member.name).map((member) => clipText(member.name));
    const drawn = [...new Set(members.map((member) => strokeWord(member.stroke)).filter(Boolean))];
    const fill = members.find((member) => member.fillColor)?.fillColor;

    // Text that reads like instructions stays out of the model's context, so it
    // can't steer a turn, while the object itself remains addressable.
    if (suspectRefs.has(object.ref)) return { ref: object.ref, kind: object.type, name: "[text hidden: reads like instructions to the assistant]" };

    return {
        ref: object.ref,
        kind: object.type,
        ...(object.shapeType ? { shapeType: object.shapeType } : {}),
        ...(object.name ? { name: object.name } : {}),
        ...(texts.length > 0 ? { text: texts } : {}),
        ...(drawn.length > 0 ? { drawn } : {}),
        ...(fill ? { fill } : {}),
        ...(object.wholeSketch ? { parts: object.partRefs } : object.memberRefs?.length > 1 ? { members: groupMembers(object, canonicalObjectsByRef) } : {}),
    };
};

const ownerRefByMemberRef = (objects) => {
    const owners = new Map();
    objects.forEach((object) => (object.memberRefs ?? [object.ref]).forEach((memberRef) => owners.set(memberRef, object.ref)));
    return owners;
};

const ARROW_REACH_PX = 48;
const reaches = (bounds, point) =>
    point.x >= bounds.minX - ARROW_REACH_PX &&
    point.x <= bounds.maxX + ARROW_REACH_PX &&
    point.y >= bounds.minY - ARROW_REACH_PX &&
    point.y <= bounds.maxY + ARROW_REACH_PX;

// A hand-drawn arrow records nothing it joins, so its stroke's start and end give the direction.
const handDrawnArrowRelations = (groundedScene, canonicalObjects) => {
    const owners = ownerRefByMemberRef(groundedScene.objects);
    const targets = canonicalObjects.filter((object) => object.type !== "connector" && object.stroke?.kind !== "line" && object.stroke?.kind !== "curve");
    const smallestAt = (point) =>
        targets
            .filter((target) => reaches(target.bounds, point))
            .sort((a, b) => areaOf(a.bounds) - areaOf(b.bounds))
            .at(0);

    const relations = [];
    canonicalObjects
        .filter((object) => object.stroke?.kind === "line" || object.stroke?.kind === "curve")
        .forEach(({ stroke }) => {
            const from = smallestAt(stroke.start);
            const to = smallestAt(stroke.end);
            const fromRef = from && owners.get(from.ref);
            const toRef = to && owners.get(to.ref);
            if (fromRef && toRef && fromRef !== toRef) relations.push([fromRef, "arrow-to", toRef]);
        });
    return relations;
};

// Most useful first, so what the budget cuts is what matters least.
const RELATION_PRIORITY = { "arrow-to": 0, "connected-to": 1, "inside-frame": 2, inside: 3 };
const relationsWithinBudget = (relations, includedRefs, selectionSet, budget) => {
    const rank = ([subject, relation, object]) => (selectionSet.has(subject) || selectionSet.has(object) ? 0 : 10) + (RELATION_PRIORITY[relation] ?? 5);
    const kept = [];
    let size = 0;
    [...relations]
        .filter(([subject, , object]) => includedRefs.has(subject) && includedRefs.has(object))
        .sort((a, b) => rank(a) - rank(b))
        .forEach((relation) => {
            const added = JSON.stringify(relation).length + 1;
            if (size + added > budget) return;
            kept.push(relation);
            size += added;
        });
    return kept;
};

const areaOf = (bounds) => (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);

const distanceToPoint = (bounds, x, y) => {
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    return Math.hypot(centerX - x, centerY - y);
};

// Nearest the viewport centre, else largest first, so cuts drop stray strokes before frames.
// Selected objects always lead their tier.
const priorityOrder = (objects, viewport, selectionSet) => {
    const bySecondaryOrder = (list) => {
        if (!viewport) return [...list].sort((a, b) => areaOf(b.bounds) - areaOf(a.bounds));
        const centerX = (viewport.minX + viewport.maxX) / 2;
        const centerY = (viewport.minY + viewport.maxY) / 2;
        return [...list].sort((a, b) => distanceToPoint(a.bounds, centerX, centerY) - distanceToPoint(b.bounds, centerX, centerY));
    };

    if (selectionSet.size === 0) return bySecondaryOrder(objects);

    const selected = objects.filter((object) => selectionSet.has(object.ref));
    const rest = objects.filter((object) => !selectionSet.has(object.ref));
    return [...bySecondaryOrder(selected), ...bySecondaryOrder(rest)];
};

const summarizeSelection = (objects, selectionSet) => {
    const selectedObjects = objects.filter((object) => selectionSet.has(object.ref));
    const byType = {};
    selectedObjects.forEach((object) => {
        byType[object.type] = (byType[object.type] || 0) + 1;
    });
    return { count: selectedObjects.length, byType };
};

export const serializeSceneContext = (groundedScene, { viewport = null, selection = [], charBudget = DEFAULT_CHAR_BUDGET, suspectRefs = [] } = {}) => {
    const suspectRefSet = new Set(suspectRefs);
    const selectionSet = new Set(selection);
    const canonicalObjects = groundedScene.canonicalScene?.objects ?? [];
    const canonicalObjectsByRef = new Map(canonicalObjects.map((object) => [object.ref, object]));
    const ordered = priorityOrder(groundedScene.objects, viewport, selectionSet);
    const includedRefs = new Set();
    const objects = [];
    let selectedIncluded = 0;
    let runningSize = JSON.stringify({ viewport, selection, objects: [] }).length;

    for (const object of ordered) {
        const isSelected = selectionSet.has(object.ref);
        // Selected objects bypass the budget up to the detail cap; the rest fall into the summary.
        if (isSelected && selectedIncluded >= SELECTION_DETAIL_CAP) continue;

        const candidate = objectToContext(object, canonicalObjectsByRef, suspectRefSet);
        const addedSize = JSON.stringify(candidate).length + 1; // +1 for the array separator
        if (!isSelected && objects.length > 0 && runningSize + addedSize > charBudget) break;

        objects.push(candidate);
        runningSize += addedSize;
        includedRefs.add(object.ref);
        if (isSelected) selectedIncluded += 1;
    }

    const relations = relationsWithinBudget(
        [...groundedScene.relations, ...handDrawnArrowRelations(groundedScene, canonicalObjects)],
        includedRefs,
        selectionSet,
        charBudget * RELATION_BUDGET_SHARE,
    );

    return {
        viewport,
        selection,
        ...(selectionSet.size > SELECTION_DETAIL_CAP ? { selectionSummary: summarizeSelection(groundedScene.objects, selectionSet) } : {}),
        objects,
        relations,
        truncated: objects.length < groundedScene.objects.length,
        ...(groundedScene.partial && { scope: "viewport" }),
    };
};
