import { labelAtSegment } from "./common.js";

// Links between nodes laid out in horizontal lanes: each crossing gets its own channel at a lane
// boundary, ends spread along a node's side, a link that skips lanes runs down a gap clear of the
// lanes between, and labelled links within a lane pass under the nodes between their ends.

const LABEL_ROW = 18;
const CHANNEL_MARGIN = 14;
const PORT_SPREAD = 0.7;
const UNDER_ROW = 16;
const CLEARANCE = 24;

// The lane boundaries a link runs along: the one above its lower end, and also the one below its
// upper end when it skips lanes.
const boundariesOf = (fromLane, toLane) => {
    if (fromLane === toLane) return [];
    const [upper, lower] = fromLane < toLane ? [fromLane, toLane] : [toLane, fromLane];
    return lower - upper === 1 ? [lower] : [upper + 1, lower];
};

// Room above and below each lane's row for the channels of the links that cross its boundaries.
export const linkPads = (model, laneIndexOf, laneCount, basePad) => {
    const counts = new Array(laneCount).fill(0);
    model.edges.forEach((edge) => boundariesOf(laneIndexOf(edge.from), laneIndexOf(edge.to)).forEach((boundary) => (counts[boundary] += 1)));
    const half = (count) => Math.max(basePad, (count * LABEL_ROW) / 2 + CHANNEL_MARGIN);
    return counts.map((count, index) => ({ top: half(count), bottom: index + 1 < laneCount ? half(counts[index + 1]) : basePad }));
};

const nodesIn = (scene, laneIndexOf, lane) => Object.entries(scene.nodes).filter(([id]) => laneIndexOf(id) === lane);

const blockedBetween = (scene, laneIndexOf, a, b, lane) =>
    nodesIn(scene, laneIndexOf, lane).some(([, node]) => node !== a && node !== b && node.cx > Math.min(a.cx, b.cx) && node.cx < Math.max(a.cx, b.cx));

// The x nearest `wanted` where a vertical run clears every node of the given lanes.
const clearColumn = (scene, laneIndexOf, lanes, wanted) => {
    const spans = lanes
        .flatMap((lane) => nodesIn(scene, laneIndexOf, lane))
        .map(([, node]) => [node.cx - node.w / 2 - CLEARANCE, node.cx + node.w / 2 + CLEARANCE])
        .sort((a, b) => a[0] - b[0]);
    const blocking = spans.find(([left, right]) => wanted > left && wanted < right);
    if (!blocking) return wanted;
    const candidates = [...spans.map(([left]) => left), ...spans.map(([, right]) => right)].filter(
        (x) => !spans.some(([left, right]) => x > left + 0.5 && x < right - 0.5),
    );
    return candidates.sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted))[0] ?? wanted;
};

const spreadPorts = (scene, plans) => {
    const bySide = new Map();
    plans.forEach((plan) => {
        [
            [plan.edge.from, plan.fromSide, "fromX", plan.b.cx],
            [plan.edge.to, plan.toSide, "toX", plan.a.cx],
        ].forEach(([id, side, end, otherX]) => {
            const key = `${id}\u0000${side}`;
            bySide.set(key, [...(bySide.get(key) ?? []), { plan, end, otherX, id }]);
        });
    });
    bySide.forEach((ends) => {
        const node = scene.nodes[ends[0].id];
        ends.sort((a, b) => a.otherX - b.otherX);
        ends.forEach(({ plan, end }, index) => {
            plan[end] = ends.length === 1 ? node.cx : node.cx + (index / (ends.length - 1) - 0.5) * node.w * PORT_SPREAD;
        });
    });
};

const sideY = (node, side) => (side === "bottom" ? node.cy + node.h / 2 + 1 : node.cy - node.h / 2 - 1);

export const routeLaneLinks = (model, scene, laneIndexOf, lanes) => {
    const plans = [];
    const direct = [];
    model.edges.forEach((edge) => {
        const a = scene.nodes[edge.from];
        const b = scene.nodes[edge.to];
        if (!a || !b || edge.from === edge.to) return;
        const fromLane = laneIndexOf(edge.from);
        const toLane = laneIndexOf(edge.to);
        // Neighbours in one lane join directly, unless a label needs more room than the gap between them.
        if (fromLane === toLane && !edge.label && !blockedBetween(scene, laneIndexOf, a, b, fromLane)) {
            direct.push({ ...edge });
            return;
        }
        const down = fromLane <= toLane;
        plans.push({ edge, a, b, fromLane, toLane, fromSide: down ? "bottom" : "top", toSide: down && fromLane !== toLane ? "top" : "bottom" });
    });
    spreadPorts(scene, plans);

    const channels = new Map();
    const claim = (key, plan, slot) => channels.set(key, [...(channels.get(key) ?? []), { plan, slot }]);
    plans.forEach((plan) => {
        const boundaries = boundariesOf(plan.fromLane, plan.toLane);
        plan.channelY = [];
        if (boundaries.length === 0) claim(`under:${plan.fromLane}`, plan, 0);
        boundaries.forEach((boundary, slot) => claim(boundary, plan, slot));
    });
    channels.forEach((entries, key) => {
        entries.sort((p, q) => Math.min(p.plan.fromX, p.plan.toX) - Math.min(q.plan.fromX, q.plan.toX));
        entries.forEach(({ plan, slot }, index) => {
            if (typeof key === "number") {
                plan.channelY[slot] = lanes[key].minY + (index - (entries.length - 1) / 2) * LABEL_ROW;
                return;
            }
            const rowBottom = Math.max(...nodesIn(scene, laneIndexOf, plan.fromLane).map(([, node]) => node.cy + node.h / 2));
            plan.channelY[slot] = rowBottom + UNDER_ROW * (index + 1);
        });
    });

    return [
        ...direct,
        ...plans.map((plan) => {
            const start = { x: plan.fromX, y: sideY(plan.a, plan.fromSide) };
            const end = { x: plan.toX, y: sideY(plan.b, plan.toSide) };
            // Channels are held top to bottom; a link going up meets the lower one first.
            const [first, last = first] = plan.fromLane <= plan.toLane ? plan.channelY : [...plan.channelY].reverse();
            const skipped = [];
            for (let lane = Math.min(plan.fromLane, plan.toLane) + 1; lane < Math.max(plan.fromLane, plan.toLane); lane += 1) skipped.push(lane);
            const middle = skipped.length > 0 ? [{ x: clearColumn(scene, laneIndexOf, skipped, (plan.fromX + plan.toX) / 2), y: first }] : [];
            const waypoints = [
                start,
                { x: plan.fromX, y: first },
                ...middle,
                ...(middle.length ? [{ x: middle[0].x, y: last }] : []),
                { x: plan.toX, y: last },
                end,
            ];
            return { ...plan.edge, waypoints, labelT: labelAtSegment(waypoints, 1) };
        }),
    ];
};
