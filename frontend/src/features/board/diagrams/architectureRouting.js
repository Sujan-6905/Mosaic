// Square arrows between boxes: straight down where clear, otherwise through the gaps between rows.

const STRAIGHT_MIN_OVERLAP = 24;
const ANCHOR_SPACING = 26;
const LANE_SPACING = 8;
const LANES_PER_GAP = 5;
const GAP_MIDDLE = 29;
const BOX_CLEARANCE = 12;
const SIDE_CHANNEL = 40;

const overlaps = (rect, top, bottom) => rect.y < bottom && rect.y + rect.height > top;
const centerX = (rect) => rect.x + rect.width / 2;
const centerY = (rect) => rect.y + rect.height / 2;
const anchorOf = (rect, point) => ({
    x: Math.min(1, Math.max(0, (point.x - rect.x) / rect.width)),
    y: Math.min(1, Math.max(0, (point.y - rect.y) / rect.height)),
});

// The x nearest `wanted` that a vertical line can run down without touching a box.
const freeColumn = (rects, top, bottom, wanted, ignore) => {
    const blocked = rects
        .filter((rect) => !ignore.includes(rect) && overlaps(rect, top, bottom))
        .map((rect) => [rect.x - BOX_CLEARANCE, rect.x + rect.width + BOX_CLEARANCE])
        .sort((a, b) => a[0] - b[0]);
    const merged = [];
    blocked.forEach(([start, end]) => {
        const last = merged[merged.length - 1];
        if (last && start <= last[1]) last[1] = Math.max(last[1], end);
        else merged.push([start, end]);
    });
    const hit = merged.find(([start, end]) => wanted > start && wanted < end);
    if (!hit) return wanted;
    return wanted - hit[0] <= hit[1] - wanted ? hit[0] : hit[1];
};

// Keeps arrows that meet the same box from landing on top of one another.
const createAnchorSpots = () => {
    const taken = new Map();
    return (rect, side, wanted) => {
        const key = `${rect.elementId}:${side}`;
        const used = taken.get(key) ?? [];
        const min = rect.x + 14;
        const max = rect.x + rect.width - 14;
        let x = Math.min(max, Math.max(min, wanted));
        for (let attempt = 1; used.some((other) => Math.abs(other - x) < ANCHOR_SPACING) && attempt < 12; attempt += 1) {
            const step = Math.ceil(attempt / 2) * ANCHOR_SPACING * (attempt % 2 === 0 ? -1 : 1);
            x = Math.min(max, Math.max(min, wanted + step));
        }
        used.push(x);
        taken.set(key, used);
        return x;
    };
};

// Keeps horizontal runs in the same gap from sharing a line.
const createLanes = () => {
    const taken = new Map();
    return (y) => {
        const key = Math.round(y / 4);
        const count = taken.get(key) ?? 0;
        taken.set(key, count + 1);
        // Several arrows can share one gap, but none may leave it.
        const slot = count % LANES_PER_GAP;
        return y + (slot % 2 === 0 ? 1 : -1) * Math.ceil(slot / 2) * LANE_SPACING;
    };
};

const routeVertical = (edge, from, to, allRects, spot, lane) => {
    const overlapStart = Math.max(from.x, to.x);
    const overlapEnd = Math.min(from.x + from.width, to.x + to.width);
    const top = from.y + from.height;
    const bottom = to.y;
    const narrower = from.width < to.width ? from : to;
    // Straight down whenever the two share enough width and nothing's in between.
    if (overlapEnd - overlapStart >= STRAIGHT_MIN_OVERLAP) {
        const wanted = Math.min(overlapEnd - 12, Math.max(overlapStart + 12, centerX(narrower)));
        const column = freeColumn(allRects, top, bottom, wanted, [from, to]);
        if (column >= overlapStart + 8 && column <= overlapEnd - 8) {
            const x = spot(from, "bottom", column);
            spot(to, "top", x);
            return { start: { x, y: top }, end: { x, y: bottom }, waypoints: [], from, to };
        }
    }
    const startX = spot(from, "bottom", centerX(to) < centerX(from) ? centerX(from) - from.width * 0.2 : centerX(from) + from.width * 0.2);
    const endX = spot(to, "top", centerX(from) < centerX(to) ? centerX(to) - to.width * 0.2 : centerX(to) + to.width * 0.2);
    // Neighbouring rows share one gap, so one run across it is all this needs.
    if (bottom - top <= GAP_MIDDLE * 2 + 1) {
        const run = lane((top + bottom) / 2);
        return {
            start: { x: startX, y: top },
            end: { x: endX, y: bottom },
            waypoints: [
                { x: startX, y: run },
                { x: endX, y: run },
            ],
            from,
            to,
        };
    }
    const upperLane = lane(top + GAP_MIDDLE);
    const lowerLane = lane(bottom - GAP_MIDDLE);
    const middle = freeColumn(allRects, upperLane, lowerLane, (startX + endX) / 2, [from, to]);
    return {
        start: { x: startX, y: top },
        end: { x: endX, y: bottom },
        waypoints: [
            { x: startX, y: upperLane },
            { x: middle, y: upperLane },
            { x: middle, y: lowerLane },
            { x: endX, y: lowerLane },
        ],
        from,
        to,
    };
};

// Boxes side by side: out one flank and into the other.
const routeSideways = (from, to, allRects, lane) => {
    const leftToRight = centerX(from) <= centerX(to);
    const startX = leftToRight ? from.x + from.width : from.x;
    const endX = leftToRight ? to.x : to.x + to.width;
    const y = (Math.max(from.y, to.y) + Math.min(from.y + from.height, to.y + to.height)) / 2;
    const blocked = allRects.some(
        (rect) =>
            rect !== from && rect !== to && overlaps(rect, y - 2, y + 2) && rect.x < Math.max(startX, endX) && rect.x + rect.width > Math.min(startX, endX),
    );
    if (!blocked) return { start: { x: startX, y }, end: { x: endX, y }, waypoints: [], from, to };
    const over = lane(Math.min(from.y, to.y) - 26);
    const fromX = centerX(from);
    const toX = centerX(to);
    return {
        start: { x: fromX, y: from.y },
        end: { x: toX, y: to.y },
        waypoints: [
            { x: fromX, y: over },
            { x: toX, y: over },
        ],
        from,
        to,
    };
};

// A box off to the side joined from inside the main stack: up out of the box into
// the gap above it, across to a channel outside everything, then in from the side.
const routeToSideBox = (from, side, allRects, spot, lane, sideChannelX) => {
    const startX = spot(from, "top", centerX(from) + from.width * 0.25);
    const y = centerY(side);
    const up = lane(from.y - 22);
    return {
        start: { x: startX, y: from.y },
        end: { x: side.x, y },
        waypoints: [
            { x: startX, y: up },
            { x: sideChannelX, y: up },
            { x: sideChannelX, y },
        ],
        from,
        to: side,
    };
};

export const routeEdges = (edges, rects) => {
    const allRects = [...rects.values()];
    const spot = createAnchorSpots();
    const lane = createLanes();
    const channelX = Math.max(0, ...allRects.filter((rect) => !rect.isSide).map((rect) => rect.x + rect.width)) + SIDE_CHANNEL;

    // Shortest first, so the plainest arrows get the straight paths.
    const ordered = [...edges].sort((a, b) => Math.abs(rects.get(a.to).y - rects.get(a.from).y) - Math.abs(rects.get(b.to).y - rects.get(b.from).y));

    return ordered.map((edge) => {
        const from = rects.get(edge.from);
        const to = rects.get(edge.to);
        let route;
        if (to.isSide && !from.isSide) route = routeToSideBox(from, to, allRects, spot, lane, channelX);
        else if (from.y + from.height <= to.y) route = routeVertical(edge, from, to, allRects, spot, lane);
        else if (to.y + to.height <= from.y) {
            // Drawn downhill and flipped, so an upward import reads the same way.
            const flipped = routeVertical(edge, to, from, allRects, spot, lane);
            route = { start: flipped.end, end: flipped.start, waypoints: [...flipped.waypoints].reverse(), from, to };
        } else route = routeSideways(from, to, allRects, lane);
        return {
            edge,
            start: route.start,
            end: route.end,
            waypoints: route.waypoints,
            startAnchor: anchorOf(from, route.start),
            endAnchor: anchorOf(to, route.end),
        };
    });
};
