import { deriveTree, flowOrder } from "../model.js";
import { emptyScene, place, longestPathRanks, flowRows } from "./common.js";

const SANKEY_COLUMN = 260;
const SANKEY_HEIGHT = 460;
const SANKEY_BAR = 16;
const SANKEY_GAP = 18;
const BAND_SAMPLES = 16;

const bezier = (a, b, t) => {
    const mid = (a.x + b.x) / 2;
    const mt = 1 - t;
    return {
        x: mt ** 3 * a.x + 3 * mt * mt * t * mid + 3 * mt * t * t * mid + t ** 3 * b.x,
        y: mt ** 3 * a.y + 3 * mt * mt * t * a.y + 3 * mt * t * t * b.y + t ** 3 * b.y,
    };
};

// Columns by how far a stage is from the sources, each node as tall as the
// flow through it, and each flow a band as wide as its amount.
export const layoutSankey = (ctx) => {
    const { model, gap } = ctx;
    const scene = emptyScene();
    const order = flowOrder(model);
    const rank = longestPathRanks(model, order);
    const amount = (edge) => (Number.isFinite(edge.value) && edge.value > 0 ? edge.value : 1);
    const through = new Map(
        model.nodes.map((node) => {
            const into = model.edges.filter((edge) => edge.to === node.id).reduce((sum, edge) => sum + amount(edge), 0);
            const out = model.edges.filter((edge) => edge.from === node.id).reduce((sum, edge) => sum + amount(edge), 0);
            return [node.id, Math.max(into, out, 1)];
        }),
    );
    const columns = new Map();
    order.forEach((id) => columns.set(rank.get(id), [...(columns.get(rank.get(id)) ?? []), id]));
    const scale = Math.min(
        ...[...columns.values()].map((ids) => (SANKEY_HEIGHT * gap - SANKEY_GAP * (ids.length - 1)) / ids.reduce((sum, id) => sum + through.get(id), 0)),
    );
    columns.forEach((ids, column) => {
        let y = 0;
        ids.forEach((id) => {
            const h = Math.max(6, through.get(id) * scale);
            place(
                scene,
                id,
                column * SANKEY_COLUMN * gap,
                y + h / 2,
                { w: SANKEY_BAR, h },
                { role: "stage", fixedSize: true, hideLabel: true, category: column },
            );
            const node = model.nodes.find((candidate) => candidate.id === id);
            scene.marks.push({
                type: "text",
                x: column * SANKEY_COLUMN * gap + SANKEY_BAR,
                y: y + h / 2,
                text: node.label,
                align: "left",
                size: 13,
                tone: "ink",
                offset: 8,
            });
            y += h + SANKEY_GAP;
        });
    });
    const outCursor = new Map(order.map((id) => [id, 0]));
    const inCursor = new Map(order.map((id) => [id, 0]));
    model.edges.forEach((edge, index) => {
        const from = scene.nodes[edge.from];
        const to = scene.nodes[edge.to];
        const thickness = amount(edge) * scale;
        const startTop = from.cy - from.h / 2 + outCursor.get(edge.from);
        const endTop = to.cy - to.h / 2 + inCursor.get(edge.to);
        outCursor.set(edge.from, outCursor.get(edge.from) + thickness);
        inCursor.set(edge.to, inCursor.get(edge.to) + thickness);
        const a = { x: from.cx + SANKEY_BAR / 2, y: startTop };
        const b = { x: to.cx - SANKEY_BAR / 2, y: endTop };
        const upper = Array.from({ length: BAND_SAMPLES + 1 }, (_, i) => bezier(a, b, i / BAND_SAMPLES));
        const lower = Array.from({ length: BAND_SAMPLES + 1 }, (_, i) =>
            bezier({ x: a.x, y: a.y + thickness }, { x: b.x, y: b.y + thickness }, 1 - i / BAND_SAMPLES),
        );
        scene.marks.push({
            type: "band",
            points: [...upper, ...lower],
            category: from.category,
            order: index,
            label: edge.label ?? (Number.isFinite(edge.value) ? String(edge.value) : null),
        });
    });
    return scene;
};

const BONE_LENGTH = 190;
const BONE_STEP = 230;
const CAUSE_STEP = 30;

export const layoutFishbone = (ctx) => {
    const { model, sizes, gap } = ctx;
    const scene = emptyScene();
    const tree = deriveTree(model);
    const categories = tree.childrenOf.get(tree.rootId) ?? [];
    const pairs = Math.ceil(categories.length / 2);
    const spineEnd = pairs * BONE_STEP * gap + 60;
    const head = sizes.get(tree.rootId);
    place(scene, tree.rootId, spineEnd + head.w / 2 + 10, 0, head, { role: "effect" });
    scene.marks.push({
        type: "line",
        points: [
            { x: -40, y: 0 },
            { x: spineEnd, y: 0 },
        ],
        tone: "ink",
        width: 3,
        head: true,
    });
    categories.forEach((id, index) => {
        const above = index % 2 === 0;
        const baseX = Math.floor(index / 2) * BONE_STEP * gap + BONE_STEP * 0.55;
        const tip = { x: baseX - BONE_LENGTH * 0.55, y: above ? -BONE_LENGTH : BONE_LENGTH };
        const size = sizes.get(id);
        place(scene, id, tip.x, tip.y + (above ? -size.h / 2 - 6 : size.h / 2 + 6), size, { role: "category", branch: index });
        scene.marks.push({ type: "line", points: [tip, { x: baseX, y: 0 }], tone: "category", category: index, width: 2 });
        (tree.childrenOf.get(id) ?? []).forEach((cause, causeIndex) => {
            const t = (causeIndex + 1) / ((tree.childrenOf.get(id).length ?? 0) + 1);
            const on = { x: tip.x + (baseX - tip.x) * t, y: tip.y * (1 - t) };
            const causeSize = sizes.get(cause);
            place(scene, cause, on.x - causeSize.w / 2 - 34, on.y, causeSize, { role: "cause", shape: "none", branch: index, textAlign: "right" });
            scene.marks.push({ type: "line", points: [{ x: on.x - 30, y: on.y }, on], tone: "category", category: index, width: 1.5 });
            const descendants = [];
            const collect = (id) =>
                (tree.childrenOf.get(id) ?? []).forEach((child) => {
                    descendants.push(child);
                    collect(child);
                });
            collect(cause);
            descendants.forEach((detail, detailIndex) => {
                const detailSize = sizes.get(detail);
                place(scene, detail, on.x - causeSize.w - 60 - detailSize.w / 2, on.y + (detailIndex + 1) * CAUSE_STEP * (above ? -0.8 : 0.8), detailSize, {
                    role: "cause",
                    shape: "none",
                    branch: index,
                });
            });
        });
    });
    return scene;
};

const CARD_WIDTH = 230;
const CARD_HEIGHT = 170;
const CARDS_PER_ROW = 4;

export const layoutCards = (ctx) => {
    const { model, sizes, gap } = ctx;
    const scene = emptyScene();
    const order = flowOrder(model);
    const items = order.map((id) => ({ id, w: Math.max(CARD_WIDTH, sizes.get(id).w), h: Math.max(CARD_HEIGHT, sizes.get(id).h + 64) }));
    const width = Math.max(...items.map((item) => item.w));
    const { placed } = flowRows(
        items.map((item) => ({ ...item, w: width })),
        { maxWidth: (width + 40 * gap) * CARDS_PER_ROW, gapX: 48 * gap, gapY: 48 * gap },
    );
    placed.forEach((item, index) => {
        place(
            scene,
            item.id,
            item.cx,
            item.cy,
            { w: item.w, h: item.h },
            { role: "card", ...(ctx.options.numbered ? { number: index + 1, textTop: true } : {}), fixedSize: true },
        );
    });
    // Steps on one row are joined; the numbers carry the order from one row to the next.
    order.slice(1).forEach((id, index) => {
        if (scene.nodes[id].cy === scene.nodes[order[index]].cy) scene.edges.push({ from: order[index], to: id, routing: "straight", faint: true });
    });
    return scene;
};
