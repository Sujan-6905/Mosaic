import { deriveTree, flowOrder } from "../model.js";
import { emptyScene, place } from "./common.js";
import { foldSidecars, routeMeshLinks } from "./meshLinks.js";

const MIN_RADIUS = 170;
const RING_GAP = 46;
const MESH_COLUMNS = 3;
const MESH_GAP = 70;
const MAX_LOOP_LENGTH = 6;

const ringRadius = (ids, sizes, gap) =>
    Math.max(MIN_RADIUS * gap, ids.reduce((sum, id) => sum + Math.max(sizes.get(id).w, sizes.get(id).h) + RING_GAP * gap, 0) / (2 * Math.PI));

const onRing = (scene, ids, sizes, radius, { start = -Math.PI / 2, extra = () => ({}) } = {}) => {
    ids.forEach((id, index) => {
        const angle = start + (2 * Math.PI * index) / ids.length;
        place(scene, id, radius * Math.cos(angle), radius * Math.sin(angle), sizes.get(id), { angle, ...extra(id, index) });
    });
};

// Bends an edge between two ring nodes outward along the ring, so a loop reads as a loop.
const arcThrough = (from, to, radius) => {
    let mid = (from.angle + to.angle) / 2;
    if (Math.abs(to.angle - from.angle) > Math.PI) mid += Math.PI;
    return [{ x: radius * 1.08 * Math.cos(mid), y: radius * 1.08 * Math.sin(mid) }];
};

const hubOf = (model) => {
    const degree = new Map(model.nodes.map((node) => [node.id, 0]));
    model.edges.forEach(({ from, to }) => {
        degree.set(from, degree.get(from) + 1);
        degree.set(to, degree.get(to) + 1);
    });
    return (model.nodes.find((node) => node.root || node.kind === "gateway") ?? [...model.nodes].sort((a, b) => degree.get(b.id) - degree.get(a.id))[0]).id;
};

const layoutCycle = (ctx, scene, { signed = false } = {}) => {
    const { model, sizes, gap } = ctx;
    const order = flowOrder(model);
    const radius = ringRadius(order, sizes, gap);
    onRing(scene, order, sizes, radius, { extra: (id, index) => ({ role: "step", order: index }) });
    model.edges.forEach((edge) => {
        const from = scene.nodes[edge.from];
        const to = scene.nodes[edge.to];
        scene.edges.push({
            ...edge,
            routing: "curved",
            waypoints: from === to ? [] : arcThrough(from, to, radius),
            label: signed ? (edge.label ?? signLabel(edge)) : edge.label,
        });
    });
    if (signed) markLoops(model, scene);
};

const signLabel = (edge) => (edge.kind === "-" || edge.kind === "negative" ? "-" : "+");
const signOf = (edge) => ((edge.label ?? edge.kind ?? "+").trim().startsWith("-") || edge.kind === "negative" ? -1 : 1);

// Every simple loop up to six variables, marked R when it reinforces (an even
// number of negative links) and B when it balances.
const markLoops = (model, scene) => {
    const outgoing = new Map(model.nodes.map((node) => [node.id, model.edges.filter((edge) => edge.from === node.id)]));
    const seen = new Set();
    model.nodes.forEach((start) => {
        const walk = (id, path, edges) => {
            if (path.length > MAX_LOOP_LENGTH) return;
            outgoing.get(id).forEach((edge) => {
                if (edge.to === start.id && path.length > 1) {
                    const key = [...path].sort().join("|");
                    if (seen.has(key)) return;
                    seen.add(key);
                    const negatives = [...edges, edge].filter((candidate) => signOf(candidate) < 0).length;
                    const points = path.map((member) => scene.nodes[member]);
                    scene.marks.push({
                        type: "loop",
                        x: points.reduce((sum, point) => sum + point.cx, 0) / points.length,
                        y: points.reduce((sum, point) => sum + point.cy, 0) / points.length,
                        text: negatives % 2 === 0 ? "R" : "B",
                    });
                } else if (!path.includes(edge.to)) {
                    walk(edge.to, [...path, edge.to], [...edges, edge]);
                }
            });
        };
        walk(start.id, [start.id], []);
    });
};

const layoutHub = (ctx, scene, { context = false } = {}) => {
    const { model, sizes, gap } = ctx;
    const hub = hubOf(model);
    const others = flowOrder(model).filter((id) => id !== hub);
    const hubSize = context ? { w: Math.max(sizes.get(hub).w * 1.5, 240), h: Math.max(sizes.get(hub).h * 1.6, 120) } : sizes.get(hub);
    place(scene, hub, 0, 0, hubSize, { role: "hub", fixedSize: context });
    // Far enough along each spoke's own direction that both boxes clear it with room for a label between.
    const spokeRoom = (model.edges.some((edge) => edge.label) ? 130 : 70) * gap;
    const reach = (size, angle) => (size.w / 2) * Math.abs(Math.cos(angle)) + (size.h / 2) * Math.abs(Math.sin(angle));
    const clearance = Math.max(
        0,
        ...others.map((id, index) => {
            const angle = -Math.PI / 2 + (2 * Math.PI * index) / others.length;
            return reach(hubSize, angle) + reach(sizes.get(id), angle) + spokeRoom;
        }),
    );
    const radius = Math.max(ringRadius(others, sizes, gap), clearance);
    onRing(scene, others, sizes, radius, { extra: (id) => ({ role: model.nodes.find((node) => node.id === id).kind ?? "spoke" }) });
    model.edges.forEach((edge) => {
        const viaHub = edge.from === hub || edge.to === hub;
        // A link between two spokes would cross the hub, so it bends round the outside of the ring.
        if (viaHub || !scene.nodes[edge.from] || !scene.nodes[edge.to]) scene.edges.push({ ...edge, routing: "straight", faint: !viaHub });
        else scene.edges.push({ ...edge, routing: "curved", waypoints: arcThrough(scene.nodes[edge.from], scene.nodes[edge.to], radius * 1.25), faint: true });
    });
};

const layoutPorts = (ctx, scene) => {
    const { model, sizes, gap } = ctx;
    const core = deriveTree(model).rootId;
    const coreSize = { w: 300 * gap, h: 260 * gap };
    place(scene, core, 0, 0, coreSize, { role: "core", shape: "hexagon", fixedSize: true });
    const adapters = model.nodes.filter((node) => node.id !== core).map((node) => node.id);
    const inbound = adapters.filter((id) => model.edges.some((edge) => edge.from === id && edge.to === core));
    const outbound = adapters.filter((id) => !inbound.includes(id));
    const side = (ids, sign) => {
        const span = Math.PI * 0.7;
        ids.forEach((id, index) => {
            const t = ids.length === 1 ? 0.5 : index / (ids.length - 1);
            const angle = (sign > 0 ? 0 : Math.PI) + (t - 0.5) * span * (sign > 0 ? 1 : -1);
            const radius = coreSize.w / 2 + sizes.get(id).w / 2 + 70 * gap;
            place(scene, id, radius * Math.cos(angle), radius * Math.sin(angle) * 0.9, sizes.get(id), { role: sign > 0 ? "driven" : "driving" });
        });
    };
    side(inbound, -1);
    side(outbound, 1);
    model.edges.forEach((edge) => scene.edges.push({ ...edge, routing: "straight" }));
};

const layoutMesh = (ctx, scene) => {
    const { model, sizes, gap } = ctx;
    const gateway = hubOf(model);
    const { folded, edges } = foldSidecars(model);
    scene.drawnElsewhere = folded;
    const services = flowOrder(model).filter((id) => id !== gateway && !folded.includes(id));
    const widest = Math.max(...services.map((id) => sizes.get(id).w), 150);
    const tallest = Math.max(...services.map((id) => sizes.get(id).h), 60);
    const gapX = MESH_GAP * gap;
    const gapY = MESH_GAP * gap;
    const cell = widest + gapX;
    const rowHeight = tallest + gapY;
    const columns = Math.min(MESH_COLUMNS, services.length);
    place(scene, gateway, ((columns - 1) * cell) / 2, -rowHeight, sizes.get(gateway), { role: "gateway" });
    const cells = new Map();
    services.forEach((id, index) => {
        const cellAt = { row: Math.floor(index / columns), col: index % columns };
        cells.set(id, cellAt);
        const x = cellAt.col * cell;
        const y = cellAt.row * rowHeight;
        place(scene, id, x, y, sizes.get(id), { role: "service" });
        const size = sizes.get(id);
        scene.marks.push({ type: "sidecar", x: x + size.w / 2 - 6, y: y - size.h / 2 + 6 });
    });
    const routed = routeMeshLinks({
        edges,
        scene,
        gateway,
        cellOf: (id) => cells.get(id),
        columnLeft: (col) => col * cell - widest / 2,
        rowTop: (row) => row * rowHeight - tallest / 2,
        gapX,
        gapY,
    });
    routed.forEach((edge) => scene.edges.push({ ...edge, dashed: edge.from !== gateway && edge.to !== gateway }));
};

const MODES = {
    cycle: (ctx, scene) => layoutCycle(ctx, scene),
    causal: (ctx, scene) => layoutCycle(ctx, scene, { signed: true }),
    hub: (ctx, scene) => layoutHub(ctx, scene),
    context: (ctx, scene) => layoutHub(ctx, scene, { context: true }),
    ports: layoutPorts,
    mesh: layoutMesh,
};

export const layoutCircular = (ctx) => {
    const scene = emptyScene();
    (MODES[ctx.options.mode] ?? MODES.cycle)(ctx, scene);
    return scene;
};
