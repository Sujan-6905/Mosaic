import { emptyScene, place } from "./common.js";

// The main path runs left to right through its checks; every other answer and
// every ending outcome hangs in its check's column, directly beneath it.

const GAP_X = 64;
const GAP_Y = 76;
const AFFIRMATIVE = /^(yes|y|true|ok|pass|passes|allowed|valid|continue|next|then)$/i;
const SIDE_CHANNEL_KINDS = new Set(["async", "message", "signal", "side", "event"]);

const isSideChannel = (edge) => SIDE_CHANNEL_KINDS.has(edge.kind);

const rootOf = (model, flowEdges) => {
    const marked = model.nodes.find((node) => node.root);
    if (marked) return marked.id;
    const entered = new Set(flowEdges.map((edge) => edge.to));
    return (model.nodes.find((node) => !entered.has(node.id) && flowEdges.some((edge) => edge.from === node.id)) ?? model.nodes[0]).id;
};

// The spine: a step always continues to its first successor; a check continues
// only along an affirmative (or unlabelled) answer that leads somewhere further.
const spineFrom = (rootId, model, outgoing) => {
    const kindOf = new Map(model.nodes.map((node) => [node.id, node.kind]));
    const spine = [rootId];
    const onSpine = new Set(spine);
    for (let current = rootId; ;) {
        const exits = (outgoing.get(current) ?? []).filter((edge) => !onSpine.has(edge.to));
        const leadsOn = (edge) => (outgoing.get(edge.to) ?? []).some((next) => !onSpine.has(next.to) && next.to !== current);
        const next =
            kindOf.get(current) === "decision"
                ? (exits.find((edge) => AFFIRMATIVE.test(edge.label ?? "") && leadsOn(edge)) ?? exits.find((edge) => !edge.label && leadsOn(edge)))
                : exits[0];
        if (!next) return spine;
        spine.push(next.to);
        onSpine.add(next.to);
        current = next.to;
    }
};

const answerOrder = (edge) => (AFFIRMATIVE.test(edge.label ?? "") ? 0 : edge.label ? 1 : 2);

export const layoutDecisionPath = ({ model, sizes, gap }) => {
    const scene = emptyScene();
    const flowEdges = model.edges.filter((edge) => !isSideChannel(edge) && edge.from !== edge.to);
    const outgoing = new Map(model.nodes.map((node) => [node.id, []]));
    flowEdges.forEach((edge) => outgoing.get(edge.from).push(edge));
    outgoing.forEach((edges) => edges.sort((a, b) => answerOrder(a) - answerOrder(b)));

    const spine = spineFrom(rootOf(model, flowEdges), model, outgoing);
    const cell = new Map(spine.map((id, column) => [id, { column, row: 0 }]));
    const rowsUsed = spine.map(() => 1);
    const hang = (id, column) => {
        cell.set(id, { column, row: rowsUsed[column] });
        rowsUsed[column] += 1;
    };

    // Answers and outcomes hang under the node they came from, breadth first so
    // a check's direct answers sit closest to it.
    const queue = [...spine];
    while (queue.length) {
        const id = queue.shift();
        (outgoing.get(id) ?? []).forEach((edge) => {
            if (cell.has(edge.to)) return;
            hang(edge.to, cell.get(id).column);
            queue.push(edge.to);
        });
    }
    // Whatever only points into the diagram (or hangs off a side channel) goes under its neighbour.
    for (let placedAny = true; placedAny;) {
        placedAny = false;
        model.edges.forEach((edge) => {
            const [known, unknown] = cell.has(edge.from) ? [edge.from, edge.to] : [edge.to, edge.from];
            if (!cell.has(known) || cell.has(unknown)) return;
            hang(unknown, cell.get(known).column);
            placedAny = true;
        });
    }

    const columns = rowsUsed.length;
    const rows = Math.max(...rowsUsed);
    const columnWidth = Array(columns).fill(0);
    const rowHeight = Array(rows).fill(0);
    cell.forEach(({ column, row }, id) => {
        columnWidth[column] = Math.max(columnWidth[column], sizes.get(id).w);
        rowHeight[row] = Math.max(rowHeight[row], sizes.get(id).h);
    });
    const gapX = GAP_X * gap;
    const gapY = GAP_Y * gap;
    const columnX = [];
    columnWidth.reduce((x, width, column) => {
        columnX[column] = x + width / 2;
        return x + width + gapX;
    }, 0);
    const rowY = [];
    rowHeight.reduce((y, height, row) => {
        rowY[row] = y + height / 2;
        return y + height + gapY;
    }, 0);

    model.nodes.forEach((node, order) => {
        const spot = cell.get(node.id);
        if (spot) place(scene, node.id, columnX[spot.column], rowY[spot.row], sizes.get(node.id), { order, role: spot.row === 0 ? "spine" : "branch" });
    });

    const rowBottom = (row) => rowY[row] + rowHeight[row] / 2;
    const columnRight = (column) => columnX[column] + columnWidth[column] / 2;
    const occupied = new Set([...cell.values()].map(({ column, row }) => `${column}:${row}`));
    const clearBetween = (column, fromRow, toRow) => {
        for (let row = Math.min(fromRow, toRow) + 1; row < Math.max(fromRow, toRow); row += 1) if (occupied.has(`${column}:${row}`)) return false;
        return true;
    };

    model.edges.forEach((edge) => {
        const from = cell.get(edge.from);
        const to = cell.get(edge.to);
        if (!from || !to || edge.from === edge.to) return;
        const a = scene.nodes[edge.from];
        const b = scene.nodes[edge.to];
        let waypoints = [];
        if (from.column === to.column) {
            // Straight down or up, unless another node is in the way: then out the right side and back in.
            if (!clearBetween(from.column, from.row, to.row)) {
                const x = columnRight(from.column) + gapX / 2;
                waypoints = [
                    { x, y: a.cy },
                    { x, y: b.cy },
                ];
            }
        } else if (from.row === to.row) {
            if (Math.abs(from.column - to.column) > 1 || to.column < from.column) {
                const y = rowBottom(from.row) + gapY / 2;
                waypoints = [
                    { x: a.cx, y },
                    { x: b.cx, y },
                ];
            }
        } else {
            // Across columns and rows: down a channel beneath the lower row, across, then into the target.
            const y = rowBottom(Math.max(from.row, to.row)) + gapY / 2;
            waypoints = [
                { x: a.cx, y },
                { x: b.cx, y },
            ];
        }
        scene.edges.push({ ...edge, waypoints, dashed: isSideChannel(edge) });
    });
    return scene;
};
