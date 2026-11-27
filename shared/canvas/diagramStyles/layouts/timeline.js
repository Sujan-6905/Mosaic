import { bucketsOf, bucketOf, flowOrder } from "../model.js";
import { emptyScene, place } from "./common.js";

const STEP = 210;
const STEM = 70;
const RAIL_GAP = 26;
const GANTT_UNIT = 44;
const GANTT_ROW = 40;
const GANTT_LABEL_WIDTH = 200;
const GIT_STEP = 90;
const RAIL_ENTRY_WIDTH = 220;
const RAIL_ENTRY_HEIGHT = 64;
const GIT_LABEL_CHAR = 6.2;
const GIT_LANE = 70;
const COMMIT_SIZE = { w: 22, h: 22 };

// Time order: start values where there are any, the flow otherwise.
const timeOrder = (model) => {
    const order = flowOrder(model);
    if (!model.nodes.some((node) => node.start !== null)) return order;
    const index = new Map(order.map((id, i) => [id, i]));
    return [...model.nodes].sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity) || index.get(a.id) - index.get(b.id)).map((node) => node.id);
};

const decimalsOf = (value) => (Number.isFinite(value) ? (String(value).split(".")[1] ?? "").length : 0);

// Every time on one timeline keeps the same decimal places, so 14.2 beside 14.05 reads as 14.20.
const isClockTime = (value) => value >= 0 && value < 24 && Math.round((value % 1) * 100) < 60;

const timeFormatter = (model, { clock = false } = {}) => {
    const starts = model.nodes.map((node) => node.start).filter(Number.isFinite);
    // Hours and minutes written as 14.05 read as a clock: 14:05.
    if (clock && starts.length > 0 && starts.every(isClockTime))
        return (value) => (Number.isFinite(value) ? `${Math.floor(value)}:${String(Math.round((value % 1) * 100)).padStart(2, "0")}` : "");
    const places = Math.min(2, Math.max(0, ...model.nodes.map((node) => decimalsOf(node.start))));
    return (value) => (value === null || value === undefined ? "" : places ? value.toFixed(places) : String(value));
};

const layoutAlternate = (ctx, scene) => {
    const { model, sizes, gap } = ctx;
    const order = timeOrder(model);
    const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
    const formatTime = timeFormatter(model);
    const step = Math.max(STEP, ...order.map((id) => sizes.get(id).w + 30)) * gap * 0.8;
    order.forEach((id, index) => {
        const size = sizes.get(id);
        const above = index % 2 === 0;
        const x = index * step;
        const cy = above ? -STEM - size.h / 2 : STEM + size.h / 2;
        place(scene, id, x, cy, size, { role: "milestone", order: index });
        scene.marks.push({
            type: "line",
            points: [
                { x, y: 0 },
                { x, y: above ? -STEM : STEM },
            ],
            tone: "muted",
        });
        scene.marks.push({ type: "dot", x, y: 0, tone: "accent", category: index });
        const when = formatTime(nodeById.get(id).start);
        if (when) scene.marks.push({ type: "text", x, y: above ? 18 : -18, text: when, align: "center", size: 12, tone: "muted", weight: "bold" });
    });
    scene.marks.push({
        type: "line",
        points: [
            { x: -step / 2, y: 0 },
            { x: (order.length - 0.5) * step, y: 0 },
        ],
        tone: "ink",
        width: 2.5,
        head: true,
    });
};

const layoutRail = (ctx, scene) => {
    const { model, sizes, gap } = ctx;
    const order = timeOrder(model);
    const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
    const formatTime = timeFormatter(model, { clock: true });
    let y = 0;
    order.forEach((id, index) => {
        // Entries read as a log, so they are boxes whatever their kind would draw.
        const size = { w: Math.max(RAIL_ENTRY_WIDTH, sizes.get(id).w), h: Math.min(sizes.get(id).h, RAIL_ENTRY_HEIGHT) };
        place(scene, id, 40 + size.w / 2, y + size.h / 2, size, { role: "entry", order: index, shape: "rounded" });
        scene.marks.push({ type: "dot", x: 0, y: y + size.h / 2, tone: "status", status: nodeById.get(id).status });
        const when = formatTime(nodeById.get(id).start);
        if (when) scene.marks.push({ type: "text", x: -18, y: y + size.h / 2, text: when, align: "right", size: 12, tone: "muted", weight: "bold" });
        y += size.h + RAIL_GAP * gap;
    });
    scene.marks.push({
        type: "line",
        points: [
            { x: 0, y: -10 },
            { x: 0, y: y },
        ],
        tone: "muted",
        width: 2.5,
    });
};

const layoutGantt = (ctx, scene) => {
    const { model } = ctx;
    const order = timeOrder(model);
    const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
    let cursor = 0;
    const spans = new Map(
        order.map((id) => {
            const node = nodeById.get(id);
            const start = node.start ?? cursor;
            const end = node.end !== null && node.end > start ? node.end : start + 1;
            cursor = end;
            return [id, { start, end }];
        }),
    );
    const first = Math.min(...[...spans.values()].map((span) => span.start));
    const last = Math.max(...[...spans.values()].map((span) => span.end));
    order.forEach((id, row) => {
        const { start, end } = spans.get(id);
        const y = row * GANTT_ROW + GANTT_ROW / 2 + 30;
        const w = (end - start) * GANTT_UNIT - 4;
        place(
            scene,
            id,
            GANTT_LABEL_WIDTH + (start - first) * GANTT_UNIT + 2 + w / 2,
            y,
            { w, h: GANTT_ROW - 12 },
            {
                role: "bar",
                fixedSize: true,
                hideLabel: true,
                lane: bucketOf(nodeById.get(id), "lane"),
                shape: nodeById.get(id).kind === "milestone" ? "diamond" : "rounded",
            },
        );
        scene.marks.push({ type: "text", x: GANTT_LABEL_WIDTH - 14, y, text: nodeById.get(id).label, align: "right", size: 13, tone: "ink" });
    });
    const height = order.length * GANTT_ROW + 30;
    for (let unit = first; unit <= last; unit += 1) {
        const x = GANTT_LABEL_WIDTH + (unit - first) * GANTT_UNIT;
        scene.marks.push({
            type: "line",
            points: [
                { x, y: 24 },
                { x, y: height + 6 },
            ],
            tone: "muted",
            faint: true,
        });
        if (unit < last) scene.marks.push({ type: "text", x: x + GANTT_UNIT / 2, y: 12, text: `W${unit}`, align: "center", size: 11, tone: "muted" });
    }
    const active = order.find((id) => /progress|doing|active|today/i.test(nodeById.get(id).status ?? ""));
    if (active) {
        const x = GANTT_LABEL_WIDTH + (spans.get(active).start - first + 0.5) * GANTT_UNIT;
        scene.marks.push({
            type: "line",
            points: [
                { x, y: 18 },
                { x, y: height + 10 },
            ],
            tone: "accent",
            width: 2,
            label: "Today",
        });
    }
    model.edges.forEach((edge) => {
        const from = scene.nodes[edge.from];
        const to = scene.nodes[edge.to];
        const startX = from.cx + from.w / 2;
        scene.edges.push({
            ...edge,
            startAnchor: { x: 1, y: 0.5 },
            endAnchor: { x: 0, y: 0.5 },
            waypoints: [
                { x: startX + 10, y: from.cy },
                { x: startX + 10, y: to.cy },
            ],
        });
    });
};

const layoutGit = (ctx, scene) => {
    const { model, sizes } = ctx;
    const order = timeOrder(model);
    const branches = bucketsOf(model, "lane").map((bucket) => bucket.key);
    const branchOf = new Map(model.nodes.map((node) => [node.id, node.lane ?? node.group ?? branches[0]]));
    const laneY = new Map(branches.map((branch, index) => [branch, index * GIT_LANE]));
    // Commit labels sit under their dots, so neighbours are spaced wider than the longest label.
    const step = Math.max(GIT_STEP, ...model.nodes.map((node) => node.label.length * GIT_LABEL_CHAR + 16));
    order.forEach((id, index) => {
        const node = model.nodes.find((candidate) => candidate.id === id);
        const branch = branchOf.get(id);
        const category = branches.indexOf(branch);
        if (node.kind === "milestone") {
            place(
                scene,
                id,
                index * step,
                laneY.get(branch) - 40,
                { w: Math.max(72, sizes.get(id).w * 0.6), h: 30 },
                { role: "tag", category, shape: "pill", fixedSize: true },
            );
            return;
        }
        place(scene, id, index * step, laneY.get(branch), COMMIT_SIZE, { role: "commit", category, shape: "circle", hideLabel: true, fixedSize: true });
        scene.marks.push({ type: "text", x: index * step, y: laneY.get(branch) + 26, text: node.label, align: "center", size: 11, tone: "muted" });
    });
    branches.forEach((branch, index) => {
        const xs = order.filter((id) => branchOf.get(id) === branch).map((id) => scene.nodes[id].cx);
        if (xs.length === 0) return;
        scene.marks.push({
            type: "line",
            points: [
                { x: Math.min(...xs) - 20, y: laneY.get(branch) },
                { x: Math.max(...xs) + 20, y: laneY.get(branch) },
            ],
            tone: "category",
            category: index,
            width: 4,
            behind: true,
        });
        scene.marks.push({
            type: "text",
            x: Math.min(...xs) - 34,
            y: laneY.get(branch),
            text: branch,
            align: "right",
            size: 12,
            tone: "category",
            category: index,
            weight: "bold",
        });
    });
    model.edges.forEach((edge) => {
        if (branchOf.get(edge.from) === branchOf.get(edge.to) && model.nodes.find((node) => node.id === edge.to)?.kind !== "milestone") return;
        scene.edges.push({ ...edge, routing: "curved", heads: { end: "none" }, category: branches.indexOf(branchOf.get(edge.from)) });
    });
};

const layoutValueStream = (ctx, scene) => {
    const { model, sizes, gap } = ctx;
    const order = flowOrder(model);
    const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
    const step = Math.max(...order.map((id) => sizes.get(id).w)) + 120 * gap;
    const ladderY = Math.max(...order.map((id) => sizes.get(id).h)) / 2 + 90;
    let processTotal = 0;
    let waitTotal = 0;
    const ladder = [];
    order.forEach((id, index) => {
        const x = index * step;
        const node = nodeById.get(id);
        place(scene, id, x, 0, sizes.get(id), { role: "step" });
        if (index > 0) {
            const wait = node.start ?? null;
            scene.marks.push({ type: "triangle", x: x - step / 2, y: 0, text: wait !== null ? `${wait}` : "" });
            if (wait !== null) waitTotal += wait;
            ladder.push({ x: x - step + sizes.get(order[index - 1]).w / 2, y: ladderY }, { x: x - sizes.get(id).w / 2, y: ladderY });
            if (wait !== null) scene.marks.push({ type: "text", x: x - step / 2, y: ladderY - 12, text: `${wait}`, align: "center", size: 11, tone: "muted" });
        }
        const processing = node.value;
        if (processing !== null) processTotal += processing;
        ladder.push({ x: x - sizes.get(id).w / 2, y: ladderY + 26 }, { x: x + sizes.get(id).w / 2, y: ladderY + 26 });
        if (processing !== null) scene.marks.push({ type: "text", x, y: ladderY + 40, text: `${processing}`, align: "center", size: 11, tone: "muted" });
    });
    scene.marks.push({ type: "polyline", points: ladder, tone: "ink", width: 2 });
    const end = (order.length - 1) * step + step / 2;
    scene.marks.push({
        type: "text",
        x: end,
        y: ladderY + 10,
        text: `Lead time ${waitTotal + processTotal}\nProcessing ${processTotal}`,
        align: "left",
        size: 12,
        tone: "ink",
        weight: "bold",
    });
    model.edges.forEach((edge) => scene.edges.push({ ...edge, routing: "straight" }));
};

const STORM_ROWS = { person: 0, command: 1, system: 1, event: 2, policy: 3, hotspot: 3 };

const layoutEvents = (ctx, scene) => {
    const { model, sizes, gap } = ctx;
    const order = flowOrder(model);
    const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
    const column = Math.max(...order.map((id) => sizes.get(id).w)) + 24 * gap;
    const rowHeight = Math.max(...order.map((id) => sizes.get(id).h)) + 20;
    let x = 0;
    // An actor, its command and the event it causes stack in one column; the
    // next note that can't sit lower starts the next column along the timeline.
    let lastRow = -1;
    order.forEach((id) => {
        const kind = nodeById.get(id).kind ?? "event";
        const row = STORM_ROWS[kind] ?? 2;
        if (row <= lastRow) x += column;
        lastRow = row;
        place(scene, id, x, row * rowHeight, sizes.get(id), { role: kind, sticky: true, tilt: true });
    });
    scene.marks.push({
        type: "line",
        points: [
            { x: -column / 2, y: 2 * rowHeight + rowHeight * 0.62 },
            { x: x + column / 2, y: 2 * rowHeight + rowHeight * 0.62 },
        ],
        tone: "muted",
        head: true,
        faint: true,
    });
};

const MODES = { alternate: layoutAlternate, rail: layoutRail, gantt: layoutGantt, git: layoutGit, "value-stream": layoutValueStream, events: layoutEvents };

export const layoutTimeline = (ctx) => {
    const scene = emptyScene();
    (MODES[ctx.options.mode] ?? layoutAlternate)(ctx, scene);
    return scene;
};
