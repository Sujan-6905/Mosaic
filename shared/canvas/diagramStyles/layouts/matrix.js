import { bucketsOf, bucketOf, deriveTree, matchFixedBucket } from "../model.js";
import { emptyScene, place, flowRows } from "./common.js";

const QUADRANT_SIZE = 640;
const BLOCK_GAP = 14;
const ITEM_GAP = 12;
const PAD = 22;
const HEADER = 44;

const stackInside = (scene, ids, sizes, box, extra = () => ({})) => {
    const { placed } = flowRows(
        ids.map((id) => ({ id, ...sizes.get(id) })),
        { maxWidth: box.maxX - box.minX - PAD * 2, gapX: ITEM_GAP, gapY: ITEM_GAP, startX: box.minX + PAD, startY: box.minY + HEADER },
    );
    placed.forEach((item) => place(scene, item.id, item.cx, item.cy, sizes.get(item.id), extra(item.id)));
};

const blockHeightFor = (ids, sizes, width) => {
    const { height } = flowRows(
        ids.map((id) => ({ id, ...sizes.get(id) })),
        { maxWidth: width - PAD * 2, gapX: ITEM_GAP, gapY: ITEM_GAP },
    );
    return HEADER + height + PAD;
};

const DEFAULT_QUADRANTS = ["Do first", "Plan", "Quick wins", "Later"];

const LABEL_ROW = 34;
const PIN_MARGIN = 10;

// Pinned items keep to their own quadrant, clear of its label, and step apart where scores collide.
const settlePins = (scene, ids, quadrants) => {
    const boxOf = (node) => quadrants.find((q) => node.cx >= q.minX && node.cx <= q.maxX && node.cy >= q.minY && node.cy <= q.maxY) ?? quadrants[0];
    const homes = new Map(ids.map((id) => [id, boxOf(scene.nodes[id])]));
    const clamp = (id) => {
        const node = scene.nodes[id];
        const home = homes.get(id);
        node.cx = Math.min(Math.max(node.cx, home.minX + node.w / 2 + PIN_MARGIN), home.maxX - node.w / 2 - PIN_MARGIN);
        node.cy = Math.min(Math.max(node.cy, home.minY + LABEL_ROW + node.h / 2), home.maxY - node.h / 2 - PIN_MARGIN);
    };
    ids.forEach(clamp);
    for (let round = 0; round < 40; round += 1) {
        let moved = false;
        ids.forEach((a, i) =>
            ids.slice(i + 1).forEach((b) => {
                const [p, q] = [scene.nodes[a], scene.nodes[b]];
                const overlapX = (p.w + q.w) / 2 + PIN_MARGIN - Math.abs(p.cx - q.cx);
                const overlapY = (p.h + q.h) / 2 + PIN_MARGIN - Math.abs(p.cy - q.cy);
                if (overlapX <= 0 || overlapY <= 0) return;
                const [upper, lower] = p.cy <= q.cy ? [a, b] : [b, a];
                scene.nodes[upper].cy -= overlapY / 2;
                scene.nodes[lower].cy += overlapY / 2;
                clamp(upper);
                clamp(lower);
                moved = true;
            }),
        );
        if (!moved) break;
    }
};

const layoutQuadrant = (ctx, scene) => {
    const { model, sizes, gap } = ctx;
    const size = QUADRANT_SIZE * gap;
    const half = size / 2;
    const columnNodes = model.nodes.filter((node) => node.kind === "column");
    const names =
        columnNodes.length === 4
            ? columnNodes.map((node) => node.label)
            : model.groups.length === 4
              ? model.groups.map((group) => group.label)
              : DEFAULT_QUADRANTS;
    const quadrants = [
        [0, 0],
        [half, 0],
        [0, half],
        [half, half],
    ].map(([x, y], index) => ({
        id: `quadrant:${index}`,
        label: names[index],
        kind: "quadrant",
        category: index,
        minX: x,
        minY: y,
        maxX: x + half,
        maxY: y + half,
    }));
    scene.groups.push(...quadrants);
    scene.marks.push(
        {
            type: "line",
            points: [
                { x: half, y: -10 },
                { x: half, y: size + 10 },
            ],
            tone: "muted",
        },
        {
            type: "line",
            points: [
                { x: -10, y: half },
                { x: size + 10, y: half },
            ],
            tone: "muted",
        },
    );
    const items = model.nodes.filter((node) => node.kind !== "column");
    const unplaced = [];
    items.forEach((node) => {
        if (node.x !== null && node.y !== null) place(scene, node.id, node.x * size, (1 - node.y) * size, sizes.get(node.id), { role: "item", pin: true });
        else unplaced.push(node);
    });
    settlePins(
        scene,
        items.filter((node) => scene.nodes[node.id]).map((node) => node.id),
        quadrants,
    );
    // Nodes that only name a quadrant are its heading, and an item can point at one by parent or group.
    if (columnNodes.length === 4) scene.drawnElsewhere = columnNodes.map((node) => node.id);
    const quadrantOf = (node) => {
        if (columnNodes.length === 4) return columnNodes.findIndex((column) => [node.parent, node.group].includes(column.id) || node.group === column.label);
        if (model.groups.length === 4) return model.groups.findIndex((group) => group.id === bucketOf(node, "group"));
        return -1;
    };
    quadrants.forEach((quadrant, index) => {
        const ids = unplaced
            .filter((node) => (quadrantOf(node) >= 0 ? quadrantOf(node) === index : unplaced.indexOf(node) % 4 === index))
            .map((node) => node.id);
        stackInside(scene, ids, sizes, quadrant);
    });
};

const layoutAxes = (ctx, scene) => {
    const { model, sizes, options, gap } = ctx;
    const width = 900 * gap;
    const height = 600 * gap;
    const tree = deriveTree(model);
    const deepest = Math.max(1, ...tree.depthOf.values());
    model.nodes.forEach((node, index) => {
        const x = node.x ?? (index + 0.5) / model.nodes.length;
        const y = node.y ?? 1 - (tree.depthOf.get(node.id) ?? 0) / deepest;
        place(scene, node.id, 40 + x * (width - 80), 30 + (1 - y) * (height - 60), sizes.get(node.id), { role: "item" });
    });
    model.edges.forEach((edge) => scene.edges.push({ ...edge, routing: "straight", heads: { end: "none" } }));
    scene.marks.push(
        {
            type: "line",
            points: [
                { x: 0, y: height },
                { x: width, y: height },
            ],
            tone: "muted",
            head: true,
        },
        {
            type: "line",
            points: [
                { x: 0, y: height },
                { x: 0, y: 0 },
            ],
            tone: "muted",
            head: true,
        },
        { type: "text", x: width, y: height + 30, text: options.xLabel ?? "", align: "right", tone: "muted", size: 13 },
        { type: "text", x: -14, y: 0, text: options.yLabel ?? "", align: "right", tone: "muted", size: 13 },
    );
    (options.xTicks ?? []).forEach((tick, index, ticks) => {
        const x = (width * (index + 0.5)) / ticks.length;
        scene.marks.push({ type: "text", x, y: height + 14, text: tick, align: "center", tone: "muted", size: 12 });
        if (index > 0)
            scene.marks.push({
                type: "line",
                points: [
                    { x: (width * index) / ticks.length, y: 0 },
                    { x: (width * index) / ticks.length, y: height },
                ],
                tone: "muted",
                dashed: true,
                faint: true,
            });
    });
};

const CELL_MARKS = { full: "●", yes: "●", partial: "◐", some: "◐", none: "○", no: "○" };

const layoutTable = (ctx, scene) => {
    const { model, sizes } = ctx;
    const isColumn = (node) => node.kind === "column" || (node.kind === "person" && ctx.options.lettered);
    const columns = model.nodes.filter(isColumn);
    const rows = model.nodes.filter((node) => !isColumn(node));
    const firstWidth = Math.max(160, ...rows.map((node) => sizes.get(node.id).w));
    const columnWidth = Math.max(110, ...columns.map((node) => sizes.get(node.id).w));
    const rowHeight = Math.max(48, ...rows.map((node) => sizes.get(node.id).h)) + 8;
    columns.forEach((node, index) =>
        place(
            scene,
            node.id,
            firstWidth + columnWidth * index + columnWidth / 2,
            rowHeight / 2,
            { w: columnWidth - 8, h: rowHeight - 8 },
            { role: "header", shape: "box" },
        ),
    );
    rows.forEach((node, rowIndex) => {
        const cy = rowHeight * (rowIndex + 1) + rowHeight / 2;
        place(scene, node.id, firstWidth / 2, cy, { w: firstWidth - 8, h: rowHeight - 8 }, { role: "row", textAlign: "left", shape: "box" });
        columns.forEach((column, columnIndex) => {
            const edge = model.edges.find(
                (candidate) => (candidate.from === node.id && candidate.to === column.id) || (candidate.from === column.id && candidate.to === node.id),
            );
            const raw = edge?.label ?? (edge ? "full" : "");
            const shown = CELL_MARKS[raw.toLowerCase()] ?? raw;
            const cx = firstWidth + columnWidth * columnIndex + columnWidth / 2;
            scene.marks.push({
                type: "cell",
                minX: cx - columnWidth / 2,
                minY: cy - rowHeight / 2,
                maxX: cx + columnWidth / 2,
                maxY: cy + rowHeight / 2,
                text: shown,
                emphasis: /^[ra]$/i.test(raw) || raw.toLowerCase() === "full",
            });
        });
    });
    const totalWidth = firstWidth + columnWidth * columns.length;
    for (let row = 1; row <= rows.length; row += 1) {
        scene.marks.push({
            type: "line",
            points: [
                { x: 0, y: rowHeight * row },
                { x: totalWidth, y: rowHeight * row },
            ],
            tone: "muted",
            faint: true,
        });
    }
};

const layoutBlocks = (ctx, scene) => {
    const { model, sizes, options } = ctx;
    const names = options.fixed;
    const columns = options.columns ?? 2;
    const blockWidth = 340;
    const assigned = new Map(names.map((name) => [name, []]));
    model.nodes.forEach((node) => assigned.get(matchFixedBucket(node, names, "group") ?? names[0]).push(node.id));
    const rows = Math.ceil(names.length / columns);
    const heights = Array.from({ length: rows }, (_, row) =>
        Math.max(200, ...names.slice(row * columns, row * columns + columns).map((name) => blockHeightFor(assigned.get(name), sizes, blockWidth))),
    );
    let y = 0;
    heights.forEach((height, row) => {
        names.slice(row * columns, row * columns + columns).forEach((name, column) => {
            const index = row * columns + column;
            const box = {
                id: `block:${name}`,
                label: name,
                kind: "block",
                category: index,
                letter: options.lettered ? name[0] : null,
                minX: column * (blockWidth + BLOCK_GAP),
                minY: y,
                maxX: column * (blockWidth + BLOCK_GAP) + blockWidth,
                maxY: y + height,
            };
            scene.groups.push(box);
            stackInside(scene, assigned.get(name), sizes, box, () => ({ role: "item" }));
        });
        y += height + BLOCK_GAP;
    });
};

// The canvas's standard nine blocks, as [name, column, row, column span, row span] on a 10 by 3 grid.
const CANVAS_BLOCKS = [
    ["Key partners", 0, 0, 2, 2],
    ["Key activities", 2, 0, 2, 1],
    ["Key resources", 2, 1, 2, 1],
    ["Value propositions", 4, 0, 2, 2],
    ["Customer relationships", 6, 0, 2, 1],
    ["Channels", 6, 1, 2, 1],
    ["Customer segments", 8, 0, 2, 2],
    ["Cost structure", 0, 2, 5, 1],
    ["Revenue streams", 5, 2, 5, 1],
];

const layoutCanvas = (ctx, scene) => {
    const { model, sizes } = ctx;
    const names = CANVAS_BLOCKS.map(([name]) => name);
    const assigned = new Map(names.map((name) => [name, []]));
    model.nodes.forEach((node) => assigned.get(matchFixedBucket(node, names, "group") ?? "Value propositions").push(node.id));
    const unit = 160;
    const rowHeight = Math.max(170, ...CANVAS_BLOCKS.map(([name, , , span]) => blockHeightFor(assigned.get(name), sizes, span * unit)));
    CANVAS_BLOCKS.forEach(([name, column, row, columnSpan, rowSpan], index) => {
        const box = {
            id: `block:${name}`,
            label: name,
            kind: "block",
            category: index,
            minX: column * unit,
            minY: row * rowHeight,
            maxX: (column + columnSpan) * unit,
            maxY: (row + rowSpan) * rowHeight,
        };
        scene.groups.push(box);
        stackInside(scene, assigned.get(name), sizes, box, () => ({ role: "item" }));
    });
};

const layoutStoryMap = (ctx, scene) => {
    const { model, sizes, gap } = ctx;
    const usesParents = model.nodes.some((node) => node.parent);
    const tree = deriveTree(model);
    const parentChildren = new Map(model.nodes.map((node) => [node.id, model.nodes.filter((child) => child.parent === node.id).map((child) => child.id)]));
    const childrenOf = (id) => (usesParents ? parentChildren.get(id) : tree.childrenOf.get(id)) ?? [];
    const activities = usesParents ? model.nodes.filter((node) => !node.parent).map((node) => node.id) : childrenOf(tree.rootId);
    const releases = bucketsOf(
        { ...model, nodes: model.nodes.filter((node) => childrenOf(node.id).length === 0 && !activities.includes(node.id)) },
        "status",
    ).map((bucket) => bucket.key);
    let x = 0;
    const columnWidth = Math.max(170, ...model.nodes.map((node) => sizes.get(node.id).w)) + ITEM_GAP;
    const rowHeight = Math.max(70, ...model.nodes.map((node) => sizes.get(node.id).h)) + ITEM_GAP * gap;
    activities.forEach((activity) => {
        const steps = childrenOf(activity);
        const span = Math.max(1, steps.length);
        place(
            scene,
            activity,
            x + (span * columnWidth) / 2 - ITEM_GAP / 2,
            rowHeight / 2,
            { w: span * columnWidth - ITEM_GAP, h: sizes.get(activity).h },
            { role: "activity" },
        );
        steps.forEach((step, index) => {
            const cx = x + index * columnWidth + columnWidth / 2;
            place(scene, step, cx, rowHeight * 1.5, sizes.get(step), { role: "step" });
            let y = rowHeight * 2.4;
            releases.forEach((release, releaseIndex) => {
                childrenOf(step)
                    .filter((story) => (model.nodes.find((node) => node.id === story).status ?? releases[0]) === release)
                    .forEach((story) => {
                        place(scene, story, cx, y + releaseIndex * rowHeight * 0.4 + sizes.get(story).h / 2, sizes.get(story), {
                            role: "story",
                            sticky: true,
                            release: releaseIndex,
                        });
                        y += sizes.get(story).h + ITEM_GAP;
                    });
            });
        });
        x += span * columnWidth;
    });
    Object.values(scene.nodes)
        .filter((node) => node.role === "story")
        .forEach((node) => {
            node.release ??= 0;
        });
    releases.slice(1).forEach((release, index) => {
        const ys = Object.values(scene.nodes)
            .filter((node) => node.role === "story" && node.release === index + 1)
            .map((node) => node.cy - node.h / 2 - ITEM_GAP / 2);
        if (ys.length)
            scene.marks.push({
                type: "line",
                points: [
                    { x: -10, y: Math.min(...ys) },
                    { x, y: Math.min(...ys) },
                ],
                dashed: true,
                tone: "accent",
                label: release,
            });
    });
    // Without parent fields the tree's root names the whole map, so it heads it.
    model.nodes.forEach((node) => {
        if (scene.nodes[node.id]) return;
        if (node.id === tree.rootId && !usesParents)
            place(scene, node.id, x / 2, -rowHeight * 0.7, { w: Math.max(sizes.get(node.id).w, x - ITEM_GAP), h: sizes.get(node.id).h }, { role: "title" });
        else place(scene, node.id, x + columnWidth / 2, rowHeight / 2, sizes.get(node.id), { role: "activity" });
    });
};

const layoutClusters = (ctx, scene) => {
    const { model, sizes } = ctx;
    const clusters = bucketsOf(model, "group").map((bucket, index) => {
        const ids = model.nodes.filter((node) => bucketOf(node, "group") === bucket.key).map((node) => node.id);
        const width = Math.min(3, ids.length) * (150 + ITEM_GAP) + PAD;
        return { bucket, ids, index, w: Math.max(200, width), h: blockHeightFor(ids, sizes, Math.max(200, width)) + 10 };
    });
    const { placed } = flowRows(clusters, { maxWidth: 1500, gapX: 60, gapY: 50 });
    placed.forEach((cluster) => {
        const box = {
            id: `cluster:${cluster.bucket.key}`,
            label: cluster.bucket.label,
            kind: "cluster",
            category: cluster.index,
            minX: cluster.cx - cluster.w / 2,
            minY: cluster.cy - cluster.h / 2,
            maxX: cluster.cx + cluster.w / 2,
            maxY: cluster.cy + cluster.h / 2,
        };
        scene.groups.push(box);
        stackInside(scene, cluster.ids, sizes, box, () => ({ sticky: true, category: cluster.index, tilt: true }));
    });
};

const MODES = {
    quadrant: layoutQuadrant,
    axes: layoutAxes,
    table: layoutTable,
    blocks: layoutBlocks,
    canvas: layoutCanvas,
    storymap: layoutStoryMap,
    clusters: layoutClusters,
};

export const layoutMatrix = (ctx) => {
    const scene = emptyScene();
    (MODES[ctx.options.mode] ?? layoutQuadrant)(ctx, scene);
    return scene;
};
