import { layoutGraph, LAYOUT_DIRECTIONS } from "../../layoutEngine.js";
import { emptyScene, place } from "./common.js";

// Notations whose edge kinds carry the meaning in their ends.
const NOTATION_HEADS = {
    er: {
        "one-one": { start: "crowfoot_one", end: "crowfoot_one" },
        "one-many": { start: "crowfoot_one", end: "crowfoot_many" },
        "many-one": { start: "crowfoot_many", end: "crowfoot_one" },
        "many-many": { start: "crowfoot_many", end: "crowfoot_many" },
        default: { start: "crowfoot_one", end: "crowfoot_many" },
    },
    class: {
        inherits: { start: "none", end: "triangle_outline" },
        implements: { start: "none", end: "triangle_outline", dashed: true },
        composes: { start: "diamond", end: "none" },
        aggregates: { start: "diamond_outline", end: "none" },
        uses: { start: "none", end: "arrow", dashed: true },
        default: { start: "none", end: "arrow" },
    },
    components: { default: { start: "dot", end: "circle_outline" } },
    dataflow: { default: { start: "none", end: "arrow" } },
};

const notationHeads = (notation, kind) => {
    const table = NOTATION_HEADS[notation];
    if (!table) return null;
    return table[kind] ?? table.default;
};

const directionFor = (ctx) => {
    const lever = ctx.levers.direction;
    if (lever === "top-down") return LAYOUT_DIRECTIONS.TOP_DOWN;
    if (lever === "left-right") return LAYOUT_DIRECTIONS.LEFT_RIGHT;
    return ctx.options.direction === "left-right" ? LAYOUT_DIRECTIONS.LEFT_RIGHT : LAYOUT_DIRECTIONS.TOP_DOWN;
};

export const layoutLayered = (ctx) => {
    const { model, sizes, options, metrics, gap } = ctx;
    const scene = emptyScene();
    const groups = model.groups.filter(
        (group) => model.nodes.some((node) => node.group === group.id) || model.groups.some((child) => child.parent === group.id),
    );
    // Groups share dagre's id space with nodes, so they get a prefix of their own.
    const groupKey = (id) => (id ? `group:${id}` : null);
    const nodes = model.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        w: Math.round(sizes.get(node.id).w * Math.sqrt(gap)),
        h: sizes.get(node.id).h,
        group: options.ignoreGroups ? null : groupKey(node.group),
    }));
    const dagreGroups = options.ignoreGroups ? [] : groups.map((group) => ({ id: groupKey(group.id), parent: groupKey(group.parent) }));
    const layout = layoutGraph(
        nodes,
        model.edges.map(({ from, to, label }) => ({ from, to, label })),
        directionFor(ctx),
        metrics,
        dagreGroups,
    );

    model.nodes.forEach((node, index) => {
        const spot = layout.positions[node.id];
        place(scene, node.id, spot.cx, spot.cy, sizes.get(node.id), { order: index, role: node.kind ?? "step" });
    });
    model.edges.forEach((edge, index) => {
        const route = layout.routes[index];
        if (!route) return;
        const heads = notationHeads(options.notation, edge.kind);
        scene.edges.push({
            ...edge,
            waypoints: route.waypoints,
            heads,
            dashed: heads?.dashed || edge.kind === "async",
        });
    });
    groups.forEach((group) => {
        const box = layout.groupBoxes?.[groupKey(group.id)];
        if (box) scene.groups.push({ id: group.id, label: group.label, kind: "frame", ...box });
    });
    if (options.notation === "dataflow") {
        let number = 1;
        model.nodes.forEach((node) => {
            if (!["external", "store", "database"].includes(node.kind)) scene.nodes[node.id].number = number++;
        });
    }
    return scene;
};
