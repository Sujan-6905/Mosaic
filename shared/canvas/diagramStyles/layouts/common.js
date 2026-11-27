// A layout returns a scene: node boxes by id, edges (with waypoints when it routes
// them), group boxes, and marks such as lines, text, braces and rings.

export const emptyScene = () => ({ nodes: {}, edges: [], groups: [], marks: [] });

export const place = (scene, id, cx, cy, size, extra = {}) => {
    scene.nodes[id] = { cx, cy, w: size.w, h: size.h, ...extra };
};

// Tree links drawn as edges: each parent to its child, carrying the label of
// a model edge between them, plus model edges the tree didn't use as cross links.
export const treeEdges = (model, tree) => {
    const used = new Set();
    const edges = [];
    tree.parentOf.forEach((parent, child) => {
        const match = model.edges.find((edge) => (edge.from === parent && edge.to === child) || (edge.from === child && edge.to === parent));
        if (match) used.add(match);
        edges.push({
            from: parent,
            to: child,
            label: match?.label ?? null,
            kind: match?.kind ?? null,
            value: match?.value ?? null,
            reversed: match ? match.from === child : false,
        });
    });
    model.edges.forEach((edge) => {
        if (!used.has(edge) && edge.from !== edge.to) edges.push({ ...edge, cross: true });
    });
    return edges.map((edge) => (edge.reversed ? { ...edge, from: edge.to, to: edge.from, reversed: false, backwards: true } : edge));
};

// Which top-level branch each node hangs from, so a look can colour by branch.
export const branchIndexes = (tree) => {
    const branchOf = new Map();
    const children = tree.childrenOf.get(tree.rootId) ?? [];
    children.forEach((child, index) => {
        const mark = (id) => {
            branchOf.set(id, index);
            tree.childrenOf.get(id).forEach(mark);
        };
        mark(child);
    });
    return branchOf;
};

const pointBox = ({ x, y }) => ({ minX: x, minY: y, maxX: x, maxY: y });
const markBoxes = (mark) => {
    if (mark.points?.length) return mark.points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)).map(pointBox);
    if ([mark.minX, mark.minY, mark.maxX, mark.maxY].every(Number.isFinite)) return [{ minX: mark.minX, minY: mark.minY, maxX: mark.maxX, maxY: mark.maxY }];
    if (Number.isFinite(mark.x) && Number.isFinite(mark.minY) && Number.isFinite(mark.maxY))
        return [{ minX: mark.x, minY: mark.minY, maxX: mark.x, maxY: mark.maxY }];
    if (Number.isFinite(mark.x) && Number.isFinite(mark.y)) return [pointBox(mark)];
    return [];
};

export const sceneBounds = (scene) => {
    const boxes = [
        ...Object.values(scene.nodes).map((node) => ({
            minX: node.cx - node.w / 2,
            minY: node.cy - node.h / 2,
            maxX: node.cx + node.w / 2,
            maxY: node.cy + node.h / 2,
        })),
        ...scene.groups,
        // Lifelines, axes, rails, curves and routed links are drawn too, so the ground has to reach them.
        ...scene.marks.flatMap(markBoxes),
        ...scene.edges.flatMap((edge) => (edge.waypoints ?? []).map(pointBox)),
    ];
    if (boxes.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    return {
        minX: Math.min(...boxes.map((box) => box.minX)),
        minY: Math.min(...boxes.map((box) => box.minY)),
        maxX: Math.max(...boxes.map((box) => box.maxX)),
        maxY: Math.max(...boxes.map((box) => box.maxY)),
    };
};

export const boxAround = (boxes, padding, titleRoom = 0) => ({
    minX: Math.min(...boxes.map((box) => box.minX)) - padding,
    minY: Math.min(...boxes.map((box) => box.minY)) - padding - titleRoom,
    maxX: Math.max(...boxes.map((box) => box.maxX)) + padding,
    maxY: Math.max(...boxes.map((box) => box.maxY)) + padding,
});

export const nodeBox = (node) => ({ minX: node.cx - node.w / 2, minY: node.cy - node.h / 2, maxX: node.cx + node.w / 2, maxY: node.cy + node.h / 2 });

// Lays sized items left to right in rows no wider than `maxWidth`.
export const flowRows = (items, { maxWidth, gapX, gapY, startX = 0, startY = 0 }) => {
    const placed = [];
    let x = startX;
    let y = startY;
    let rowHeight = 0;
    items.forEach((item) => {
        if (x > startX && x + item.w > startX + maxWidth) {
            x = startX;
            y += rowHeight + gapY;
            rowHeight = 0;
        }
        placed.push({ ...item, cx: x + item.w / 2, cy: y + item.h / 2 });
        x += item.w + gapX;
        rowHeight = Math.max(rowHeight, item.h);
    });
    return { placed, width: Math.max(0, ...placed.map((item) => item.cx + item.w / 2 - startX)), height: y + rowHeight - startY };
};

// Longest-path rank from the sources, so a flow reads left to right in lanes.
export const longestPathRanks = (model, order) => {
    const rank = new Map(order.map((id) => [id, 0]));
    const position = new Map(order.map((id, index) => [id, index]));
    order.forEach((id) => {
        model.edges.forEach(({ from, to }) => {
            if (from === id && position.get(to) > position.get(from)) rank.set(to, Math.max(rank.get(to), rank.get(id) + 1));
        });
    });
    return rank;
};

export const GROUP_PADDING = 24;
export const GROUP_TITLE_ROOM = 26;

// How far along a route (as a fraction of its length) the middle of one of its segments lies, so a
// connector's label can sit on the run that has room for it.
export const labelAtSegment = (points, segment) => {
    const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
    const total = lengths.reduce((sum, length) => sum + length, 0);
    if (total === 0) return 0.5;
    const before = lengths.slice(0, segment).reduce((sum, length) => sum + length, 0);
    return Math.min(1, Math.max(0, (before + (lengths[segment] ?? 0) / 2) / total));
};
