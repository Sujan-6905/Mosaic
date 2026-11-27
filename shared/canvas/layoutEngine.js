// Graph layout for generated diagrams and Tidy Up. Positions are node centres; callers
// convert to their own corner-based fields.

import { estimateWrappedLineCount } from "./geometry/bounds.js";

// dagre is a package, which shared code cannot import itself; each runtime
// (the browser bundle, the MCP server) hands in its own copy once at startup.
let dagre = null;
export const provideDagre = (library) => {
    dagre = library;
};

export const LAYOUT_DIRECTIONS = { TOP_DOWN: "top-down", LEFT_RIGHT: "left-right", RADIAL: "radial" };

const NODE_LABEL_FONT_SIZE = 14;
const EDGE_LABEL_FONT_SIZE = 12;
export const LABEL_LINE_HEIGHT = 1.3;
const AVG_CHAR_WIDTH_RATIO = 0.55;

// Defaults to the character-width estimate used for bounds; the live board passes real
// canvas metrics so a node fits exactly what the renderer draws.
export const estimatedTextMetrics = {
    textWidth: (text, fontSize) => Math.max(...(text || " ").split("\n").map((line) => line.length)) * fontSize * AVG_CHAR_WIDTH_RATIO,
    lineCount: estimateWrappedLineCount,
};

// The label rectangle's corners must clear the outline: an ellipse grows by sqrt(2), a diamond by 2.
const SHAPE_SIZING = {
    box: { maxTextWidth: 228, padX: 16, padY: 14, grow: 1, minW: 100, minH: 56 },
    ellipse: { maxTextWidth: 170, padX: 10, padY: 8, grow: Math.SQRT2, minW: 110, minH: 56 },
    diamond: { maxTextWidth: 130, padX: 8, padY: 6, grow: 2, minW: 120, minH: 72 },
};

const EDGE_LABEL_MAX_WIDTH = 120;
const EDGE_LABEL_OFFSET = 8;

// Wrapping at a width computed from the same text's own measured width can
// tip onto a second line through float rounding alone.
const WRAP_SLACK = 1;

const measureTextBlock = (text, fontSize, maxWidth, metrics) => {
    const width = Math.min(maxWidth, Math.ceil(metrics.textWidth(text, fontSize)) + WRAP_SLACK);
    const height = metrics.lineCount(text, width, fontSize) * fontSize * LABEL_LINE_HEIGHT;
    return { width, height };
};

const sizeNode = (node, metrics) => {
    if (node.w && node.h) return { w: node.w, h: node.h };
    const sizing = SHAPE_SIZING[node.shape] || SHAPE_SIZING.box;
    const text = measureTextBlock(node.label, NODE_LABEL_FONT_SIZE, sizing.maxTextWidth, metrics);
    return {
        w: Math.ceil(Math.max(sizing.minW, (text.width + sizing.padX * 2) * sizing.grow)),
        h: Math.ceil(Math.max(sizing.minH, (text.height + sizing.padY * 2) * sizing.grow)),
        textWidth: text.width,
        textHeight: text.height,
    };
};

const sizeEdgeLabel = (label, metrics) => (label ? measureTextBlock(label, EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH, metrics) : null);

// Drops collinear route points: dagre leaves one per rank, and a straight "bend" makes a
// later drag look like a jump.
const COLLINEAR_TOLERANCE = 0.5;
const simplifyRoute = (points) =>
    points.filter((point, i) => {
        if (i === 0 || i === points.length - 1) return true;
        const prev = points[i - 1];
        const next = points[i + 1];
        const cross = (point.x - prev.x) * (next.y - prev.y) - (point.y - prev.y) * (next.x - prev.x);
        return Math.abs(cross) / (Math.hypot(next.x - prev.x, next.y - prev.y) || 1) > COLLINEAR_TOLERANCE;
    });

// Each rank row's centre and half-extent along the main axis; nodes, label slots and bends sit on them.
const RANK_PRECISION = 100;
const collectRankRows = (graph, nodeIds, edgeKeys, main, extent) => {
    const rows = new Map();
    const note = (position, half) => {
        const key = Math.round(position * RANK_PRECISION);
        rows.set(key, { position, half: Math.max(half, rows.get(key)?.half ?? 0) });
    };
    nodeIds.forEach((id) => {
        const node = graph.node(id);
        note(node[main], node[extent] / 2);
    });
    edgeKeys.forEach((key) => {
        const edge = graph.edge(key);
        (edge.points || []).forEach((point) => note(point[main], 0));
        if (edge.width) note(edge[main], edge[extent] / 2);
    });
    return (position) => rows.get(Math.round(position * RANK_PRECISION)) ?? { position, half: 0 };
};

// Orthogonal routes that only cross sideways in the node-free gap between ranks. Hops share
// a gap's midline only when they fan from or into one node, so no false junctions appear.
const LANE_SPACING = 10;

const orthogonalizeRoutes = (pointLists, edges, rowAt, main, cross) => {
    const gaps = new Map();
    const plans = pointLists.map((points, edgeIndex) => {
        if (!points) return null;
        const edge = edges[edgeIndex];
        return points.slice(1).map((to, i) => {
            const from = points[i];
            if (Math.abs(from[main] - to[main]) <= 0.01 || Math.abs(from[cross] - to[cross]) <= 0.01) return { to };
            const direction = Math.sign(to[main] - from[main]);
            const fromRow = rowAt(from[main]);
            const toRow = rowAt(to[main]);
            const nearEdge = fromRow.position + direction * fromRow.half;
            const farEdge = toRow.position - direction * toRow.half;
            const mid = (nearEdge + farEdge) / 2;
            const gapKey = Math.round(mid * RANK_PRECISION);
            if (!gaps.has(gapKey)) gaps.set(gapKey, { span: Math.abs(farEdge - nearEdge), hops: [] });
            const hop = {
                mid,
                from,
                to,
                sideCross: Math.min(from[cross], to[cross]),
                keys: [i === 0 && `out:${edge.from}`, i === points.length - 2 && `in:${edge.to}`, `edge:${edgeIndex}:${i}`].filter(Boolean),
            };
            gaps.get(gapKey).hops.push(hop);
            return hop;
        });
    });

    gaps.forEach(({ span, hops }) => {
        const laneOf = new Map();
        const lanes = [];
        hops.forEach((hop) => {
            const shared = hop.keys.map((key) => laneOf.get(key)).find((lane) => lane !== undefined);
            const lane = shared ?? lanes.push({ hops: [] }) - 1;
            lanes[lane].hops.push(hop);
            hop.keys.forEach((key) => laneOf.set(key, lane));
        });
        lanes.sort((a, b) => Math.min(...a.hops.map((h) => h.sideCross)) - Math.min(...b.hops.map((h) => h.sideCross)));
        const spacing = Math.min(LANE_SPACING, span / (lanes.length + 1));
        lanes.forEach((lane, index) => {
            const offset = (index - (lanes.length - 1) / 2) * spacing;
            lane.hops.forEach((hop) => {
                hop.jog = hop.mid + offset;
            });
        });
    });

    return plans.map((plan, edgeIndex) => {
        if (!plan) return null;
        const route = [pointLists[edgeIndex][0]];
        plan.forEach((hop) => {
            if (hop.jog !== undefined) route.push({ [main]: hop.jog, [cross]: hop.from[cross] }, { [main]: hop.jog, [cross]: hop.to[cross] });
            route.push(hop.to);
        });
        return route;
    });
};

// Moves a run that sits a few pixels off its end node onto that node's column, unless the
// shifted run would cross a node.
const KINK_MAX = 18;

const runHitsBox = (a, b, box) =>
    Math.min(a.x, b.x) < box.maxX && Math.max(a.x, b.x) > box.minX && Math.min(a.y, b.y) < box.maxY && Math.max(a.y, b.y) > box.minY;

const sameCross = (a, b, cross) => Math.abs(a[cross] - b[cross]) < 0.01;

// Indexes of the straight run along the main axis that ends at `from`
// (step -1) or starts at it (step +1): every point sharing its column.
const runIndexes = (route, from, step, cross) => {
    const indexes = [from];
    for (let k = from + step; k >= 0 && k < route.length && sameCross(route[k], route[from], cross); k += step) indexes.push(k);
    return indexes;
};

const straightenKinks = (points, boxes, cross) => {
    const route = points.map((point) => ({ ...point }));
    const last = route.length - 1;
    const clear = (from, to) => {
        for (let k = Math.max(1, from); k <= Math.min(last, to); k += 1) {
            if (boxes.some((box) => runHitsBox(route[k - 1], route[k], box))) return false;
        }
        return true;
    };
    const tryShift = (indexes, value) => {
        if (indexes.includes(0) || indexes.includes(last)) return false;
        const saved = indexes.map((k) => route[k][cross]);
        indexes.forEach((k) => {
            route[k][cross] = value;
        });
        if (clear(Math.min(...indexes), Math.max(...indexes) + 1)) return true;
        indexes.forEach((k, n) => {
            route[k][cross] = saved[n];
        });
        return false;
    };
    for (let i = 0; i < last; i += 1) {
        const jog = route[i + 1][cross] - route[i][cross];
        if (Math.abs(jog) < 0.01 || Math.abs(jog) > KINK_MAX) continue;
        if (!tryShift(runIndexes(route, i, -1, cross), route[i + 1][cross])) tryShift(runIndexes(route, i + 1, 1, cross), route[i][cross]);
    }
    return route;
};

// The column a route runs along at a given point on the main axis, so an
// edge label placed beside a run can follow that run when it's shifted.
const columnAt = (route, position, main, cross) => {
    for (let k = 1; k < route.length; k += 1) {
        const [a, b] = [route[k - 1], route[k]];
        if (sameCross(a, b, cross) && position >= Math.min(a[main], b[main]) && position <= Math.max(a[main], b[main])) return a[cross];
    }
    return null;
};

// A group's box keeps this much room around its members, and more above them for its name.
const GROUP_PADDING = 20;
const GROUP_TITLE_ROOM = 18;

const layoutLayered = (nodes, edges, direction, metrics, groups = []) => {
    if (!dagre) throw new Error("Graph layout needs provideDagre(dagre) first");
    const graph = new dagre.graphlib.Graph({ multigraph: true, compound: groups.length > 0 });
    graph.setGraph({
        rankdir: direction === LAYOUT_DIRECTIONS.LEFT_RIGHT ? "LR" : "TB",
        nodesep: 48,
        edgesep: 24,
        ranksep: 72,
    });

    const positions = {};
    nodes.forEach((node) => {
        positions[node.id] = sizeNode(node, metrics);
        graph.setNode(node.id, { width: positions[node.id].w, height: positions[node.id].h });
    });
    groups.forEach((group) => graph.setNode(group.id, {}));
    groups.forEach((group) => group.parent && graph.hasNode(group.parent) && graph.setParent(group.id, group.parent));
    nodes.forEach((node) => node.group && graph.hasNode(node.group) && graph.setParent(node.id, node.group));
    const edgeLabels = edges.map((edge) => sizeEdgeLabel(edge.label, metrics));
    edges.forEach((edge, i) => {
        if (!graph.hasNode(edge.from) || !graph.hasNode(edge.to)) return;
        const label = edgeLabels[i];
        graph.setEdge(
            { v: edge.from, w: edge.to, name: String(i) },
            label ? { width: label.width, height: label.height, labelpos: "r", labeloffset: EDGE_LABEL_OFFSET } : {},
        );
    });

    dagre.layout(graph);

    nodes.forEach((node) => {
        const placed = graph.node(node.id);
        positions[node.id] = { cx: placed.x, cy: placed.y, ...positions[node.id] };
    });

    const [main, cross, extent] = direction === LAYOUT_DIRECTIONS.LEFT_RIGHT ? ["x", "y", "width"] : ["y", "x", "height"];
    const edgeKeys = edges.map((edge, i) => ({ v: edge.from, w: edge.to, name: String(i) })).filter((key) => graph.hasEdge(key));
    const rowAt = collectRankRows(
        graph,
        nodes.map((node) => node.id),
        edgeKeys,
        main,
        extent,
    );

    // Routes start from node centres, which the renderer clips to the outline.
    const laidEdges = edges.map((edge, i) => graph.edge({ v: edge.from, w: edge.to, name: String(i) }));
    const pointLists = edges.map((edge, i) => {
        if (!laidEdges[i] || edge.from === edge.to) return null;
        const center = (id) => ({ x: positions[id].cx, y: positions[id].cy });
        return [center(edge.from), ...(laidEdges[i].points || []).slice(1, -1), center(edge.to)];
    });
    const orthogonal = orthogonalizeRoutes(pointLists, edges, rowAt, main, cross);
    const nodeBoxes = Object.fromEntries(
        nodes.map((node) => {
            const { cx, cy, w, h } = positions[node.id];
            return [node.id, { minX: cx - w / 2, minY: cy - h / 2, maxX: cx + w / 2, maxY: cy + h / 2 }];
        }),
    );

    const routes = edges.map((edge, i) => {
        const laid = laidEdges[i];
        if (!laid) return null;
        const label = edgeLabels[i];
        const others = () => nodes.filter((node) => node.id !== edge.from && node.id !== edge.to).map((node) => nodeBoxes[node.id]);
        const straightened = orthogonal[i] ? straightenKinks(orthogonal[i], others(), cross) : null;
        let labelShift = 0;
        if (label && straightened) {
            const before = columnAt(orthogonal[i], laid[main], main, cross);
            const after = columnAt(straightened, laid[main], main, cross);
            if (before !== null && after !== null) labelShift = after - before;
        }
        const route = straightened ?? [
            { x: positions[edge.from].cx, y: positions[edge.from].cy },
            ...(laid.points || []).slice(1, -1),
            { x: positions[edge.to].cx, y: positions[edge.to].cy },
        ];
        return {
            waypoints: simplifyRoute(route).slice(1, -1),
            label: label ? { cx: laid.x + (cross === "x" ? labelShift : 0), cy: laid.y + (cross === "y" ? labelShift : 0), ...label } : null,
        };
    });
    return { positions, routes, groupBoxes: boxGroups(groups, nodes, positions) };
};

// Each group's box from the members actually inside it, nested groups first, so
// a parent always wraps its children with room to spare.
const boxGroups = (groups, nodes, positions) => {
    const boxes = {};
    const depthOf = (group, seen = new Set()) => {
        const parent = groups.find((candidate) => candidate.id === group.parent);
        return parent && !seen.has(parent.id) ? 1 + depthOf(parent, seen.add(group.id)) : 0;
    };
    [...groups]
        .sort((a, b) => depthOf(b) - depthOf(a))
        .forEach((group) => {
            const memberBoxes = [
                ...nodes
                    .filter((node) => node.group === group.id)
                    .map((node) => {
                        const { cx, cy, w, h } = positions[node.id];
                        return { minX: cx - w / 2, minY: cy - h / 2, maxX: cx + w / 2, maxY: cy + h / 2 };
                    }),
                ...groups.filter((child) => child.parent === group.id && boxes[child.id]).map((child) => boxes[child.id]),
            ];
            if (memberBoxes.length === 0) return;
            boxes[group.id] = {
                minX: Math.min(...memberBoxes.map((box) => box.minX)) - GROUP_PADDING,
                minY: Math.min(...memberBoxes.map((box) => box.minY)) - GROUP_PADDING - GROUP_TITLE_ROOM,
                maxX: Math.max(...memberBoxes.map((box) => box.maxX)) + GROUP_PADDING,
                maxY: Math.max(...memberBoxes.map((box) => box.maxY)) + GROUP_PADDING,
            };
        });
    return boxes;
};

const RADIAL_RING_STEP = 220;
const RADIAL_NODE_GAP = 40;

// Root in the middle, one ring per depth, each branch in a wedge sized by its leaf count so
// lines don't cross. The root is the node marked `root`, else the best-connected one.
const layoutRadial = (nodes, edges, metrics) => {
    const sizeById = {};
    nodes.forEach((node) => {
        sizeById[node.id] = sizeNode(node, metrics);
    });

    const adjacency = new Map(nodes.map((node) => [node.id, []]));
    edges.forEach(({ from, to }) => {
        if (!adjacency.has(from) || !adjacency.has(to) || from === to) return;
        adjacency.get(from).push(to);
        adjacency.get(to).push(from);
    });
    const byDegree = [...nodes].sort((a, b) => adjacency.get(b.id).length - adjacency.get(a.id).length);
    const rootId = nodes.find((node) => node.root)?.id ?? byDegree[0]?.id;

    // Breadth-first, so each node hangs off its nearest route to the root; a
    // node nothing reaches joins the outermost ring on its own.
    const parentOf = new Map([[rootId, null]]);
    const childrenOf = new Map(nodes.map((node) => [node.id, []]));
    const levelOf = new Map([[rootId, 0]]);
    const queue = [rootId];
    while (queue.length > 0) {
        const current = queue.shift();
        adjacency.get(current).forEach((neighbour) => {
            if (parentOf.has(neighbour)) return;
            parentOf.set(neighbour, current);
            levelOf.set(neighbour, levelOf.get(current) + 1);
            childrenOf.get(current).push(neighbour);
            queue.push(neighbour);
        });
    }
    const outermost = Math.max(0, ...levelOf.values());
    nodes
        .filter((node) => !levelOf.has(node.id))
        .forEach((node) => {
            levelOf.set(node.id, outermost + 1);
            childrenOf.get(rootId).push(node.id);
        });

    const leavesUnder = new Map();
    const countLeaves = (id) => {
        const children = childrenOf.get(id);
        const leaves = children.length === 0 ? 1 : children.reduce((sum, child) => sum + countLeaves(child), 0);
        leavesUnder.set(id, leaves);
        return leaves;
    };
    countLeaves(rootId);

    // Each ring is wide enough to seat its own nodes side by side.
    const radiusOf = [0];
    const deepest = Math.max(0, ...levelOf.values());
    for (let level = 1; level <= deepest; level += 1) {
        const ring = nodes.filter((node) => levelOf.get(node.id) === level);
        const needed = ring.reduce((sum, node) => sum + Math.max(sizeById[node.id].w, sizeById[node.id].h) + RADIAL_NODE_GAP, 0) / (2 * Math.PI);
        radiusOf.push(Math.max(radiusOf[level - 1] + RADIAL_RING_STEP, needed));
    }

    const positions = {};
    const place = (id, fromAngle, toAngle) => {
        const level = levelOf.get(id);
        const angle = (fromAngle + toAngle) / 2;
        const radius = radiusOf[level];
        positions[id] = { cx: radius * Math.cos(angle), cy: radius * Math.sin(angle), ...sizeById[id] };
        let start = fromAngle;
        childrenOf.get(id).forEach((child) => {
            const share = ((toAngle - fromAngle) * leavesUnder.get(child)) / leavesUnder.get(id);
            place(child, start, start + share);
            start += share;
        });
    };
    place(rootId, -Math.PI, Math.PI);

    const routes = edges.map((edge) => {
        const label = sizeEdgeLabel(edge.label, metrics);
        const from = positions[edge.from];
        const to = positions[edge.to];
        if (!from || !to) return null;
        return { waypoints: [], label: label ? { cx: (from.cx + to.cx) / 2, cy: (from.cy + to.cy) / 2 - label.height, ...label } : null };
    });
    return { positions, routes };
};

// Returns { positions: { [id]: { cx, cy, w, h } }, routes (indexed like `edges`), groupBoxes }.
export const layoutGraph = (nodes, edges, direction = LAYOUT_DIRECTIONS.TOP_DOWN, metrics = estimatedTextMetrics, groups = []) => {
    if (nodes.length === 0) return { positions: {}, routes: [], groupBoxes: {} };
    if (direction === LAYOUT_DIRECTIONS.RADIAL) return { ...layoutRadial(nodes, edges, metrics), groupBoxes: {} };
    return layoutLayered(nodes, edges, direction, metrics, groups);
};

export const computeLayout = (nodes, edges, direction, metrics) => layoutGraph(nodes, edges, direction, metrics).positions;
