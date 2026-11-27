import { layoutGraph, LAYOUT_DIRECTIONS } from "../../layoutEngine.js";
import { bucketOf, bucketsOf, deriveTree, matchFixedBucket, valueOf } from "../model.js";
import { emptyScene, place, flowRows, boxAround, nodeBox, GROUP_PADDING, GROUP_TITLE_ROOM } from "./common.js";
import { routeBoundaryLinks } from "./boundaryLinks.js";

const OUTSIDE_GAP = 110;
const STACK_GAP = 36;

const stackColumn = (scene, ids, sizes, x, extra = {}) => {
    const total = ids.reduce((sum, id) => sum + sizes.get(id).h + STACK_GAP, -STACK_GAP);
    let y = -total / 2;
    ids.forEach((id) => {
        place(scene, id, x, y + sizes.get(id).h / 2, sizes.get(id), extra);
        y += sizes.get(id).h + STACK_GAP;
    });
};

const isOutside = (node) => node.kind === "person" || node.kind === "external";

const layoutBoundary = (ctx, scene) => {
    const { model, sizes, metrics, gap } = ctx;
    const inside = model.nodes.filter((node) => !isOutside(node));
    const people = model.nodes.filter((node) => node.kind === "person");
    const externals = model.nodes.filter((node) => node.kind === "external");
    const insideIds = new Set(inside.map((node) => node.id));
    const insideEdges = model.edges.filter((edge) => insideIds.has(edge.from) && insideIds.has(edge.to));
    const laid = layoutGraph(
        inside.map((node) => ({ id: node.id, label: node.label, w: sizes.get(node.id).w, h: sizes.get(node.id).h })),
        insideEdges,
        LAYOUT_DIRECTIONS.TOP_DOWN,
        metrics,
    );
    inside.forEach((node) => place(scene, node.id, laid.positions[node.id].cx, laid.positions[node.id].cy, sizes.get(node.id), { role: "container" }));
    const boundary = boxAround(
        inside.map((node) => nodeBox(scene.nodes[node.id])),
        GROUP_PADDING * 1.5,
        GROUP_TITLE_ROOM,
    );
    scene.groups.push({ id: "boundary", label: model.title ?? model.groups[0]?.label ?? "System", kind: "boundary", ...boundary });
    const centreY = (boundary.minY + boundary.maxY) / 2;
    stackColumn(
        scene,
        people.map((node) => node.id),
        sizes,
        boundary.minX - OUTSIDE_GAP * gap - Math.max(0, ...people.map((node) => sizes.get(node.id).w)) / 2,
        { role: "person" },
    );
    stackColumn(
        scene,
        externals.map((node) => node.id),
        sizes,
        boundary.maxX + OUTSIDE_GAP * gap + Math.max(0, ...externals.map((node) => sizes.get(node.id).w)) / 2,
        { role: "external" },
    );
    [...people, ...externals].forEach((node) => {
        scene.nodes[node.id].cy += centreY;
    });
    scene.edges.push(...routeBoundaryLinks({ model, scene, boundary, insideIds: [...insideIds], insideEdges, routes: laid.routes }));
};

const layoutUseCases = (ctx, scene) => {
    const { model, sizes, gap } = ctx;
    const actors = model.nodes.filter((node) => node.kind === "person");
    const cases = model.nodes.filter((node) => node.kind !== "person");
    const columns = cases.length > 6 ? 2 : 1;
    const caseWidth = Math.max(...cases.map((node) => sizes.get(node.id).w), 160);
    const { placed, width, height } = flowRows(
        cases.map((node) => ({ id: node.id, ...sizes.get(node.id), w: caseWidth })),
        { maxWidth: caseWidth * columns + 40 * (columns - 1), gapX: 40, gapY: 26 * gap },
    );
    placed.forEach((item) => place(scene, item.id, item.cx - width / 2, item.cy - height / 2, sizes.get(item.id), { role: "usecase", shape: "circle-wide" }));
    const boundary = boxAround(
        cases.map((node) => nodeBox(scene.nodes[node.id])),
        GROUP_PADDING * 1.5,
        GROUP_TITLE_ROOM,
    );
    scene.groups.push({ id: "boundary", label: model.title ?? "System", kind: "boundary", solid: true, ...boundary });
    const left = actors.filter((_, index) => index % 2 === 0).map((node) => node.id);
    const right = actors.filter((_, index) => index % 2 === 1).map((node) => node.id);
    stackColumn(scene, left, sizes, boundary.minX - OUTSIDE_GAP * gap, { role: "person" });
    stackColumn(scene, right, sizes, boundary.maxX + OUTSIDE_GAP * gap, { role: "person" });
    model.edges.forEach((edge) => scene.edges.push({ ...edge, routing: "straight", heads: { end: edge.kind ? "arrow" : "none" }, dashed: Boolean(edge.kind) }));
};

// Groups packed inside their parents, bottom up: each group is as large as
// its own nodes in rows plus its child groups in rows.
const layoutZones = (ctx, scene) => {
    const { model, sizes, gap } = ctx;
    const boxes = new Map();
    const measure = (groupId) => {
        const children = model.groups.filter((group) => group.parent === groupId).map((group) => group.id);
        const nodes = model.nodes
            .filter((node) => (groupId ? node.group === groupId : !node.group || !model.groups.some((group) => group.id === node.group)))
            .map((node) => node.id);
        const items = [...children.map((id) => ({ id, group: true, ...measure(id) })), ...nodes.map((id) => ({ id, group: false, ...sizes.get(id) }))];
        const area = items.reduce((sum, item) => sum + item.w * item.h, 0);
        const { placed, width, height } = flowRows(items, { maxWidth: Math.max(420, Math.sqrt(area) * 1.6), gapX: 34 * gap, gapY: 30 * gap });
        const pad = groupId ? GROUP_PADDING : 0;
        boxes.set(groupId ?? "", { placed, width, height, pad });
        return { w: width + pad * 2, h: height + pad * 2 + (groupId ? GROUP_TITLE_ROOM : 0) };
    };
    measure(null);
    const position = (groupId, originX, originY, depth) => {
        const { placed, pad } = boxes.get(groupId ?? "");
        const top = originY + pad + (groupId ? GROUP_TITLE_ROOM : 0);
        placed.forEach((item) => {
            const left = originX + pad + item.cx - item.w / 2;
            const upper = top + item.cy - item.h / 2;
            if (item.group) {
                const group = model.groups.find((candidate) => candidate.id === item.id);
                scene.groups.push({ id: item.id, label: group.label, kind: "zone", depth, minX: left, minY: upper, maxX: left + item.w, maxY: upper + item.h });
                position(item.id, left, upper, depth + 1);
            } else {
                place(scene, item.id, left + item.w / 2, upper + item.h / 2, sizes.get(item.id), { role: "resource" });
            }
        });
    };
    position(null, 0, 0, 0);
    model.edges.forEach((edge) => scene.edges.push({ ...edge }));
};

const VENN_RADIUS = 190;

const layoutVenn = (ctx, scene) => {
    const { model, sizes, gap } = ctx;
    const sets = (model.groups.length ? model.groups : bucketsOf(model, "group").map((bucket) => ({ id: bucket.key, label: bucket.label }))).slice(0, 3);
    const radius = VENN_RADIUS * gap;
    const offset = radius * 0.62;
    const centres =
        sets.length === 3
            ? [
                  { x: -offset, y: -offset * 0.55 },
                  { x: offset, y: -offset * 0.55 },
                  { x: 0, y: offset * 0.8 },
              ]
            : sets.length === 2
              ? [
                    { x: -offset, y: 0 },
                    { x: offset, y: 0 },
                ]
              : [{ x: 0, y: 0 }];
    sets.forEach((set, index) =>
        scene.groups.push({
            id: set.id,
            label: set.label,
            kind: "circle",
            category: index,
            minX: centres[index].x - radius,
            minY: centres[index].y - radius,
            maxX: centres[index].x + radius,
            maxY: centres[index].y + radius,
        }),
    );
    const regions = new Map();
    model.nodes.forEach((node) => {
        const members = node.sets.length ? node.sets : [bucketOf(node, "group")];
        const indexes = members.map((member) => sets.findIndex((set) => set.id === member)).filter((index) => index >= 0);
        const key = indexes.sort().join("+") || "0";
        regions.set(key, [...(regions.get(key) ?? []), node.id]);
    });
    regions.forEach((ids, key) => {
        const members = key.split("+").map(Number);
        const centre = members.reduce((sum, index) => ({ x: sum.x + centres[index].x / members.length, y: sum.y + centres[index].y / members.length }), {
            x: 0,
            y: 0,
        });
        const away = sets.length > members.length && members.length === 1 ? 0.45 : 0;
        const others = centres.filter((_, index) => !members.includes(index));
        const push = others.length
            ? others.reduce((sum, other) => ({ x: sum.x + (centre.x - other.x), y: sum.y + (centre.y - other.y) }), { x: 0, y: 0 })
            : { x: 0, y: 0 };
        const length = Math.hypot(push.x, push.y) || 1;
        const anchor = { x: centre.x + (push.x / length) * radius * away, y: centre.y + (push.y / length) * radius * away };
        const total = ids.reduce((sum, id) => sum + sizes.get(id).h + 8, -8);
        let y = anchor.y - total / 2;
        ids.forEach((id) => {
            place(scene, id, anchor.x, y + sizes.get(id).h / 2, sizes.get(id), { role: "item", shape: "none" });
            y += sizes.get(id).h + 8;
        });
    });
};

const RING_STEP = 130;

const layoutRings = (ctx, scene) => {
    const { model, sizes, options, gap } = ctx;
    const buckets = bucketsOf(model, "tier", options.fixed);
    const rings = buckets.map((bucket) => bucket.key);
    const ringOf = new Map(
        model.nodes.map((node) => [node.id, options.fixed ? (matchFixedBucket(node, rings, "tier") ?? rings[rings.length - 1]) : bucketOf(node, "tier")]),
    );
    const step = Math.max(RING_STEP, ...model.nodes.map((node) => sizes.get(node.id).h + 60)) * gap;
    rings.forEach((ring, index) => {
        const outer = step * (index + 1) + 30;
        scene.groups.push({
            id: `ring:${ring}`,
            label: buckets[index].label,
            kind: "ring",
            category: index,
            ring: index,
            minX: -outer,
            minY: -outer,
            maxX: outer,
            maxY: outer,
        });
    });
    rings.forEach((ring, index) => {
        const ids = model.nodes.filter((node) => ringOf.get(node.id) === ring).map((node) => node.id);
        const radius = index === 0 && ids.length === 1 ? 0 : step * (index + 0.5) + (index === 0 ? 0 : 30);
        // A lone item sits at the top of its band, so single-item layers read as a stack.
        ids.forEach((id, i) => {
            const angle = ids.length === 1 ? -Math.PI / 2 : -Math.PI / 2 + (2 * Math.PI * (i + 0.5)) / ids.length + index * 0.4;
            place(scene, id, radius * Math.cos(angle), radius * Math.sin(angle), sizes.get(id), { role: "item", ring: index });
        });
    });
    model.edges.forEach((edge) => scene.edges.push({ ...edge, routing: "straight", faint: true }));
};

// Squarified treemap: rows of rectangles laid along the shorter side so each
// stays as close to square as it can.
const squarify = (items, box) => {
    const result = [];
    const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
    let remaining = [...items].sort((a, b) => b.value - a.value);
    let { minX, minY, maxX, maxY } = box;
    const scale = ((maxX - minX) * (maxY - minY)) / total;
    while (remaining.length > 0) {
        const width = maxX - minX;
        const height = maxY - minY;
        const side = Math.min(width, height);
        let row = [];
        let best = Infinity;
        for (const item of remaining) {
            const candidate = [...row, item];
            const area = candidate.reduce((sum, entry) => sum + entry.value * scale, 0);
            const thickness = area / side;
            const worst = Math.max(
                ...candidate.map((entry) => Math.max((entry.value * scale) / thickness / thickness, (thickness * thickness) / (entry.value * scale))),
            );
            if (worst > best) break;
            best = worst;
            row = candidate;
        }
        const area = row.reduce((sum, entry) => sum + entry.value * scale, 0);
        const thickness = area / side;
        let cursor = 0;
        row.forEach((entry) => {
            const length = (entry.value * scale) / thickness;
            if (width >= height) result.push({ ...entry, minX, minY: minY + cursor, maxX: minX + thickness, maxY: minY + cursor + length });
            else result.push({ ...entry, minX: minX + cursor, minY, maxX: minX + cursor + length, maxY: minY + thickness });
            cursor += length;
        });
        if (width >= height) minX += thickness;
        else minY += thickness;
        remaining = remaining.slice(row.length);
    }
    return result;
};

const layoutTreemap = (ctx, scene) => {
    const { model } = ctx;
    const tree = deriveTree(model);
    const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
    const weight = new Map();
    const measure = (id) => {
        const children = tree.childrenOf.get(id);
        weight.set(id, children.length ? children.reduce((sum, child) => sum + measure(child), 0) : valueOf(nodeById.get(id)));
        return weight.get(id);
    };
    measure(tree.rootId);
    const fill = (id, box, depth, branch) => {
        const children = tree.childrenOf.get(id);
        if (children.length === 0) {
            place(
                scene,
                id,
                (box.minX + box.maxX) / 2,
                (box.minY + box.maxY) / 2,
                { w: box.maxX - box.minX - 4, h: box.maxY - box.minY - 4 },
                { role: "leaf", depth, branch, fixedSize: true },
            );
            return;
        }
        const header = depth === 0 ? 0 : 24;
        if (depth > 0) scene.groups.push({ id: `tile:${id}`, label: nodeById.get(id).label, kind: "tile", category: branch, owner: id, ...box });
        squarify(
            children.map((child) => ({ id: child, value: weight.get(child) })),
            { minX: box.minX + 4, minY: box.minY + header + 4, maxX: box.maxX - 4, maxY: box.maxY - 4 },
        ).forEach((rect, index) => fill(rect.id, rect, depth + 1, depth === 0 ? index : branch));
    };
    const total = weight.get(tree.rootId);
    const width = 900;
    const height = Math.max(420, Math.min(700, 900 * 0.62));
    fill(tree.rootId, { minX: 0, minY: 0, maxX: width, maxY: height }, 0, 0);
    // The root names the map; it sits above as a title rather than as a tile.
    if (!scene.nodes[tree.rootId])
        place(scene, tree.rootId, width / 2, -36, { w: Math.min(width, 360), h: 40 }, { role: "title", shape: "none", fixedSize: true, total });
    tree.childrenOf.forEach((children, id) => {
        if (children.length && id !== tree.rootId && !scene.nodes[id]) {
            const tile = scene.groups.find((group) => group.owner === id);
            place(
                scene,
                id,
                (tile.minX + tile.maxX) / 2,
                tile.minY + 12,
                { w: tile.maxX - tile.minX - 8, h: 22 },
                { role: "tile-title", shape: "none", fixedSize: true, textAlign: "left" },
            );
        }
    });
};

const packCircles = (circles) => {
    const placed = [];
    [...circles]
        .sort((a, b) => b.r - a.r)
        .forEach((circle) => {
            if (placed.length === 0) {
                placed.push({ ...circle, x: 0, y: 0 });
                return;
            }
            let best = null;
            placed.forEach((anchor) => {
                for (let step = 0; step < 24; step += 1) {
                    const angle = (step / 24) * Math.PI * 2;
                    const distance = anchor.r + circle.r + 6;
                    const candidate = { ...circle, x: anchor.x + distance * Math.cos(angle), y: anchor.y + distance * Math.sin(angle) };
                    if (placed.some((other) => Math.hypot(other.x - candidate.x, other.y - candidate.y) < other.r + candidate.r + 5)) continue;
                    const reach = Math.hypot(candidate.x, candidate.y) + candidate.r;
                    if (!best || reach < best.reach) best = { ...candidate, reach };
                }
            });
            placed.push(best ?? { ...circle, x: 0, y: placed.length * circle.r * 2 });
        });
    const enclosing = Math.max(...placed.map((circle) => Math.hypot(circle.x, circle.y) + circle.r));
    return { placed, radius: enclosing };
};

const layoutPacking = (ctx, scene) => {
    const { model, sizes } = ctx;
    const tree = deriveTree(model);
    const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
    const packed = new Map();
    const build = (id) => {
        const children = tree.childrenOf.get(id);
        if (children.length === 0) {
            const size = sizes.get(id);
            const r = Math.max(Math.max(size.w, size.h) / 2, 26 * Math.sqrt(valueOf(nodeById.get(id))));
            packed.set(id, { r, children: [] });
            return r;
        }
        const circles = children.map((child) => ({ id: child, r: build(child) }));
        const { placed, radius } = packCircles(circles);
        packed.set(id, { r: radius + 22, children: placed });
        return radius + 22;
    };
    build(tree.rootId);
    const position = (id, x, y, depth, branch) => {
        const { r, children } = packed.get(id);
        if (children.length === 0) {
            place(scene, id, x, y, { w: r * 2, h: r * 2 }, { role: "leaf", shape: "circle", fixedSize: true, depth, branch });
            return;
        }
        // The container's own node is placed as its title below, so the circle carries no second label.
        scene.groups.push({
            id: `pack:${id}`,
            label: "",
            kind: "circle",
            category: branch,
            depth,
            minX: x - r,
            minY: y - r,
            maxX: x + r,
            maxY: y + r,
            labelTop: true,
        });
        children.forEach((child, index) => position(child.id, x + child.x, y + child.y, depth + 1, depth === 0 ? index : branch));
    };
    position(tree.rootId, 0, 0, 0, 0);
    if (!scene.nodes[tree.rootId])
        place(scene, tree.rootId, 0, -packed.get(tree.rootId).r - 24, { w: 260, h: 36 }, { role: "title", shape: "none", fixedSize: true });
    tree.childrenOf.forEach((children, id) => {
        if (children.length && !scene.nodes[id]) {
            const circle = scene.groups.find((group) => group.id === `pack:${id}`);
            place(scene, id, (circle.minX + circle.maxX) / 2, circle.minY + 16, { w: 140, h: 22 }, { role: "pack-title", shape: "none", fixedSize: true });
        }
    });
};

const MODES = {
    boundary: layoutBoundary,
    usecases: layoutUseCases,
    zones: layoutZones,
    venn: layoutVenn,
    rings: layoutRings,
    treemap: layoutTreemap,
    packing: layoutPacking,
};

export const layoutNested = (ctx) => {
    const scene = emptyScene();
    (MODES[ctx.options.mode] ?? layoutZones)(ctx, scene);
    return scene;
};
