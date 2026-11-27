import { translateElement } from "../geometry/elementGeometry.js";
import { getElementBounds, getUnionBounds } from "../geometry/bounds.js";
import { estimatedTextMetrics } from "../layoutEngine.js";
import { buildDiagram, centreDiagramOn, normalizeRecipe } from "./index.js";

const NUMBER_PREFIX = /^\d+\.\s+/;
const LAYOUT_LEVERS = ["direction", "density", "twoLines", "icons", "caps"];

// The words a person sees now, unless they're only the stored label as the
// look wrote it (in capitals, or numbered), in which case the stored label wins.
const currentLabel = (written, stored) => {
    const plain = (written ?? "").replace(NUMBER_PREFIX, "").split("\n")[0].trim();
    if (!stored) return plain;
    return plain.toLowerCase() === stored.toLowerCase() || plain === "" ? stored : plain;
};

const insideBox = (point, box) => point.x >= box.minX && point.x <= box.maxX && point.y >= box.minY && point.y <= box.maxY;

// A diagram nobody styled (drawn by hand, or from before styles existed): its
// boxes, the words inside them and the arrows between them.
const deriveFromDrawing = (elements, ids) => {
    const chosen = ids.map((id) => [id, elements[id]]).filter(([, element]) => element);
    const boxes = chosen.filter(
        ([, element]) => (element.type === "shape" && !["Region", "Icon", "Line", "Arrow"].includes(element.shapeType)) || element.type === "sticky",
    );
    const texts = chosen.filter(([, element]) => element.type === "text");
    const frames = chosen.filter(([, element]) => element.type === "frame");
    const boxIds = new Set(boxes.map(([id]) => id));
    const nodes = boxes.map(([id, element]) => {
        const box = getElementBounds(element);
        const inner = texts.find(([, text]) => {
            const bounds = getElementBounds(text);
            return insideBox({ x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }, box);
        });
        return {
            id,
            label: element.text || inner?.[1].text || "",
            group: element.frameId && frames.some(([frameId]) => frameId === element.frameId) ? element.frameId : null,
            kind: element.shapeType === "Diamond" ? "decision" : element.shapeType === "Cylinder" ? "database" : null,
        };
    });
    const edges = chosen
        .filter(([, element]) => element.type === "connector" && boxIds.has(element.startElementId) && boxIds.has(element.endElementId))
        .map(([, element]) => ({ from: element.startElementId, to: element.endElementId, label: element.text || null }));
    const groups = frames.map(([id, element]) => ({ id, label: element.name || "Group" }));
    return { model: { nodes: nodes.filter((node) => node.label), edges, groups }, recipe: null, elementIds: chosen.map(([id]) => id) };
};

// The model and recipe behind whatever is selected. A selection touching a
// styled diagram reads that whole diagram, so Restyle never splits one apart.
export const readDiagram = (elements, ids) => {
    const counts = new Map();
    ids.forEach((id) => {
        const diagramId = elements[id]?.diagram?.id;
        if (diagramId) counts.set(diagramId, (counts.get(diagramId) ?? 0) + 1);
    });
    if (counts.size === 0) return { diagramId: null, ...deriveFromDrawing(elements, ids) };
    const diagramId = [...counts].sort((a, b) => b[1] - a[1])[0][0];
    const members = Object.entries(elements).filter(([, element]) => element?.diagram?.id === diagramId);
    const nodeKeyOf = new Map(members.filter(([, element]) => element.diagram.role === "node").map(([id, element]) => [id, element.diagram.key]));
    const labelOfGroup = new Map();
    const nodes = members
        .filter(([, element]) => element.diagram.role === "node")
        .sort((a, b) => (a[1].diagram.order ?? 0) - (b[1].diagram.order ?? 0))
        .map(([, element]) => {
            const { groupLabel, ...data } = element.diagram.data ?? {};
            if (groupLabel && data.group) labelOfGroup.set(data.group, groupLabel);
            return { ...data, id: element.diagram.key, label: currentLabel(element.text, data.label) };
        });
    const edgeData = new Map(members.filter(([, element]) => element.diagram.role === "edge").map(([id, element]) => [id, element.diagram.data ?? {}]));
    const nodeKeys = new Set(nodeKeyOf.values());
    // Free edges, such as a journey's message arrows, bind to nothing, so their ends come from their edge data.
    const endsOf = (id, element) => {
        if (nodeKeyOf.has(element.startElementId) && nodeKeyOf.has(element.endElementId))
            return [nodeKeyOf.get(element.startElementId), nodeKeyOf.get(element.endElementId)];
        const data = edgeData.get(id);
        return data && nodeKeys.has(data.from) && nodeKeys.has(data.to) ? [data.from, data.to] : null;
    };
    const edges = Object.entries(elements).flatMap(([id, element]) => {
        const ends = element?.type === "connector" ? endsOf(id, element) : null;
        if (!ends) return [];
        const data = edgeData.get(id) ?? {};
        return [{ ...data, from: ends[0], to: ends[1], label: element.text ? currentLabel(element.text, data.label) : null }];
    });
    const groupIds = new Set(nodes.map((node) => node.group).filter(Boolean));
    // Structures that lay groups out as bands key them "lane:<group>"; other bands are lanes, read from the nodes.
    const groupIdOf = (key) => (!key.includes(":") ? key : key.startsWith("lane:") && groupIds.has(key.slice(5)) ? key.slice(5) : null);
    const groups = members
        .filter(([, element]) => element.diagram.role === "group" && groupIdOf(element.diagram.key))
        .map(([, element]) => ({
            id: groupIdOf(element.diagram.key),
            label: element.type === "frame" ? element.name : (element.diagram.data?.label ?? element.diagram.key),
            kind: element.diagram.data?.kind ?? null,
        }));
    const drawnGroups = new Set(groups.map((group) => group.id));
    groups.push(...[...groupIds].filter((id) => !drawnGroups.has(id) && labelOfGroup.has(id)).map((id) => ({ id, label: labelOfGroup.get(id), kind: null })));
    const recipe = members.find(([, element]) => element.diagram.recipe)?.[1].diagram.recipe ?? null;
    const titleElement = members.find(([, element]) => element.diagram.role === "title")?.[1];
    const title = titleElement ? currentLabel(titleElement.text, titleElement.diagram.data?.label) : null;
    return { diagramId, model: { nodes, edges, groups, title }, recipe, elementIds: members.map(([id]) => id) };
};

const UNMOVED_TOLERANCE = 1.5;

const centreOfBounds = (element) => {
    const bounds = getElementBounds(element);
    return bounds && { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
};

// Whether every node still sits where the engine put it, so a new look may lay the diagram out afresh, routes
// included, instead of holding nodes in place and dropping the routes that went round them.
const laidOutByEngine = (read, elements, recipe, centre, metrics) => {
    let n = 0;
    const original = centreDiagramOn(
        buildDiagram({ model: read.model, recipe, metrics, generateElementId: () => `probe${n++}`, diagramId: "probe" }),
        centre.x,
        centre.y,
    );
    const expected = new Map(
        original.filter(({ element }) => element.diagram?.role === "node").map(({ element }) => [element.diagram.key, centreOfBounds(element)]),
    );
    const current = read.elementIds.map((id) => elements[id]).filter((element) => element?.diagram?.role === "node");
    return (
        current.length === expected.size &&
        current.every((element) => {
            const was = expected.get(element.diagram.key);
            const now = centreOfBounds(element);
            return was && now && Math.abs(was.x - now.x) <= UNMOVED_TOLERANCE && Math.abs(was.y - now.y) <= UNMOVED_TOLERANCE;
        })
    );
};

// A new structure or layout lever lays the diagram out again in place; a look
// alone repaints it and keeps every node where the person left it.
export const restyleDiagram = ({ elements, ids, recipe: change = {}, metrics = estimatedTextMetrics, generateElementId }) => {
    const read = readDiagram(elements, ids);
    if (read.model.nodes.length === 0) return null;
    const before = normalizeRecipe(read.recipe ?? {});
    const recipe = normalizeRecipe({
        structure: change.structure ?? before.structure,
        look: change.look ?? before.look,
        levers: { ...before.levers, ...(change.levers ?? {}) },
    });
    const built = buildDiagram({ model: read.model, recipe, metrics, generateElementId, diagramId: read.diagramId ?? generateElementId() });
    const oldBounds = getUnionBounds(read.elementIds.map((id) => elements[id]).filter(Boolean));
    const centre = oldBounds ? { x: (oldBounds.minX + oldBounds.maxX) / 2, y: (oldBounds.minY + oldBounds.maxY) / 2 } : { x: 0, y: 0 };
    const relaid = !read.diagramId || recipe.structure !== before.structure || LAYOUT_LEVERS.some((lever) => recipe.levers[lever] !== before.levers[lever]);
    const placed = centreDiagramOn(built, centre.x, centre.y);
    if (relaid || laidOutByEngine(read, elements, before, centre, metrics)) return { removeIds: read.elementIds, elements: placed, recipe };

    // Repaint: each node returns to its old centre; everything else follows the new build.
    const oldCentres = new Map(
        read.elementIds
            .map((id) => elements[id])
            .filter((element) => element?.diagram?.role === "node")
            .map((element) => {
                const bounds = getElementBounds(element);
                return [element.diagram.key, { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }];
            }),
    );
    const shiftOf = new Map();
    const moved = placed.map(({ elementId, element }) => {
        const key = element.diagram?.role === "node" ? element.diagram.key : null;
        const target = key ? oldCentres.get(key) : null;
        if (!target) return { elementId, element };
        const bounds = getElementBounds(element);
        const dx = target.x - (bounds.minX + bounds.maxX) / 2;
        const dy = target.y - (bounds.minY + bounds.maxY) / 2;
        shiftOf.set(elementId, { dx, dy });
        if (element.groupId) shiftOf.set(`group:${element.groupId}`, { dx, dy });
        return { elementId, element: translateElement(element, dx, dy) };
    });
    const centreOf = new Map(
        moved
            .filter(({ element }) => element.diagram?.role === "node")
            .map(({ elementId, element }) => {
                const bounds = getElementBounds(element);
                return [elementId, { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }];
            }),
    );
    const settled = moved.map(({ elementId, element }) => {
        if (element.diagram?.role !== "node" && element.groupId && shiftOf.has(`group:${element.groupId}`)) {
            const { dx, dy } = shiftOf.get(`group:${element.groupId}`);
            return { elementId, element: translateElement(element, dx, dy) };
        }
        if (element.type !== "connector" || !centreOf.has(element.startElementId) || !centreOf.has(element.endElementId)) return { elementId, element };
        const start = centreOf.get(element.startElementId);
        const end = centreOf.get(element.endElementId);
        const shifted =
            shiftOf.get(element.startElementId)?.dx ||
            shiftOf.get(element.startElementId)?.dy ||
            shiftOf.get(element.endElementId)?.dx ||
            shiftOf.get(element.endElementId)?.dy;
        return {
            elementId,
            element: {
                ...element,
                startX: start.x,
                startY: start.y,
                endX: end.x,
                endY: end.y,
                ...(shifted && element.waypoints ? { waypoints: null, routing: element.routing === "curved" ? "curved" : "elbow" } : {}),
            },
        };
    });
    return { removeIds: read.elementIds, elements: settled, recipe };
};
