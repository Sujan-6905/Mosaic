import { bucketOf, bucketsOf, flowOrder } from "../model.js";
import { emptyScene, place, flowRows } from "./common.js";

const LAYER_HEIGHT = 64;
const LAYER_GAP = 8;
const FUNNEL_TOP = 560;
const FUNNEL_NARROWING = 0.13;
const PYRAMID_BASE = 620;
const APEX_STRETCH = 1.8;
const APEX_MIN_WIDTH = 190;
const ISO_LIFT = 70;

// A ring in the shape's own 0-1 box, which is how a Region shape stores its outline.
const trapezoidRing = (topInset, bottomInset) => [
    [
        { x: topInset, y: 0 },
        { x: 1 - topInset, y: 0 },
        { x: 1 - bottomInset, y: 1 },
        { x: bottomInset, y: 1 },
    ],
];

const layoutFunnel = (ctx, scene) => {
    const { model, gap } = ctx;
    const order = flowOrder(model);
    const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
    const top = FUNNEL_TOP * gap;
    order.forEach((id, index) => {
        const width = top * (1 - FUNNEL_NARROWING * index);
        const next = top * (1 - FUNNEL_NARROWING * (index + 1));
        const inset = (width - next) / 2 / width;
        const y = index * (LAYER_HEIGHT + LAYER_GAP);
        place(
            scene,
            id,
            0,
            y,
            { w: width, h: LAYER_HEIGHT },
            { role: "stage", shape: "region", rings: trapezoidRing(0, inset), fixedSize: true, category: index },
        );
        const value = nodeById.get(id).value;
        if (value !== null) scene.marks.push({ type: "text", x: top / 2 + 24, y, text: String(value), align: "left", size: 14, tone: "muted", weight: "bold" });
    });
};

const layoutPyramid = (ctx, scene) => {
    const { model, gap } = ctx;
    const order = flowOrder(model);
    const layers = order.length;
    // Wide enough that the apex, a triangle a layer's width across, still holds a long word.
    const base = Math.max(PYRAMID_BASE, APEX_MIN_WIDTH * layers) * gap;
    // The apex is a narrow triangle, so it is taller than the rest to give its words room at its base.
    const heightOf = (index) => (index === 0 ? LAYER_HEIGHT * APEX_STRETCH : LAYER_HEIGHT);
    let y = 0;
    order.forEach((id, index) => {
        const topWidth = (base * index) / layers;
        const bottomWidth = (base * (index + 1)) / layers;
        const inset = (bottomWidth - topWidth) / 2 / bottomWidth;
        const height = heightOf(index);
        y += index === 0 ? height / 2 : (heightOf(index - 1) + height) / 2 + LAYER_GAP;
        place(
            scene,
            id,
            0,
            y,
            { w: bottomWidth, h: height },
            { role: "layer", shape: "region", rings: trapezoidRing(inset, 0), fixedSize: true, category: index, textBottom: index === 0 },
        );
    });
};

const layoutIsometric = (ctx, scene) => {
    const { model, sizes, gap } = ctx;
    const tiers = bucketsOf(model, "tier");
    let y = 0;
    tiers.forEach((tier, index) => {
        const ids = model.nodes.filter((node) => bucketOf(node, "tier") === tier.key).map((node) => node.id);
        const { placed, width, height } = flowRows(
            ids.map((id) => ({ id, ...sizes.get(id) })),
            { maxWidth: 900, gapX: 30 * gap, gapY: 24 },
        );
        const slabWidth = Math.max(width + 120, 520);
        scene.groups.push({
            id: `tier:${tier.key}`,
            label: tier.label,
            kind: "slab",
            category: index,
            minX: -slabWidth / 2,
            minY: y - 20,
            maxX: slabWidth / 2,
            maxY: y + height + ISO_LIFT,
        });
        placed.forEach((item) => place(scene, item.id, item.cx - width / 2, y + item.cy + 10, sizes.get(item.id), { role: "block", category: index }));
        y += height + ISO_LIFT + 50 * gap;
    });
    model.edges.forEach((edge) => scene.edges.push({ ...edge, routing: "straight" }));
};

const BAR_WIDTH = 72;
const BAR_GAP = 36;
const BAR_MAX_HEIGHT = 320;

// Columns from a shared baseline, each as tall as its value, with the value above and the label below.
const layoutBars = (ctx, scene) => {
    const { model, gap } = ctx;
    const order = flowOrder(model);
    const valueOf = (id) => Math.max(0, model.nodes.find((node) => node.id === id).value ?? 1);
    const highest = Math.max(...order.map(valueOf), 1);
    const step = (BAR_WIDTH + BAR_GAP) * gap;
    order.forEach((id, index) => {
        const height = Math.max(4, (valueOf(id) / highest) * BAR_MAX_HEIGHT);
        const x = index * step;
        place(scene, id, x, -height / 2, { w: BAR_WIDTH, h: height }, { role: "bar", shape: "box", hideLabel: true, fixedSize: true, category: index });
        const { label, value } = model.nodes.find((node) => node.id === id);
        scene.marks.push({ type: "text", x, y: 22, text: label, align: "center", size: 13, tone: "ink" });
        if (value !== null)
            scene.marks.push({ type: "text", x, y: -height - 14, text: String(value), align: "center", size: 13, tone: "muted", weight: "bold" });
    });
    scene.marks.push({
        type: "line",
        points: [
            { x: -step / 2, y: 0 },
            { x: (order.length - 0.5) * step, y: 0 },
        ],
        tone: "muted",
    });
};

const MODES = { funnel: layoutFunnel, pyramid: layoutPyramid, isometric: layoutIsometric, bars: layoutBars };

export const layoutStack = (ctx) => {
    const scene = emptyScene();
    (MODES[ctx.options.mode] ?? layoutPyramid)(ctx, scene);
    return scene;
};
