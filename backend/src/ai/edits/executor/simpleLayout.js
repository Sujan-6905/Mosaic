// A dependency-free layered layout for the edit executor's `tidy`; the backend image has no
// dagre for the richer shared layout engine.
const NODE_SPACING_PX = 48;
const RANK_SPACING_PX = 96;
const RADIAL_RING_STEP_PX = 220;

const rankNodes = (nodes, edges) => {
    const adjacency = new Map(nodes.map((node) => [node.id, new Set()]));
    edges.forEach(({ from, to }) => {
        adjacency.get(from)?.add(to);
        adjacency.get(to)?.add(from);
    });

    const degreeSorted = [...nodes].sort((a, b) => (adjacency.get(b.id)?.size || 0) - (adjacency.get(a.id)?.size || 0));
    const rank = new Map();
    const queue = [];
    if (degreeSorted[0]) {
        rank.set(degreeSorted[0].id, 0);
        queue.push(degreeSorted[0].id);
    }
    while (queue.length > 0) {
        const current = queue.shift();
        for (const neighbor of adjacency.get(current) || []) {
            if (!rank.has(neighbor)) {
                rank.set(neighbor, rank.get(current) + 1);
                queue.push(neighbor);
            }
        }
    }
    const maxRank = Math.max(0, ...rank.values());
    nodes.forEach((node) => {
        if (!rank.has(node.id)) rank.set(node.id, maxRank + 1);
    });
    return rank;
};

const layoutLayered = (nodes, edges, direction) => {
    const rank = rankNodes(nodes, edges);
    const byRank = new Map();
    nodes.forEach((node) => {
        const r = rank.get(node.id);
        if (!byRank.has(r)) byRank.set(r, []);
        byRank.get(r).push(node);
    });

    const positions = {};
    let rankOffset = 0;
    [...byRank.keys()]
        .sort((a, b) => a - b)
        .forEach((r) => {
            const rankNodesList = byRank.get(r);
            const crossSpan = rankNodesList.reduce((sum, node) => sum + (direction === "left-right" ? node.h : node.w) + NODE_SPACING_PX, -NODE_SPACING_PX);
            let crossCursor = -crossSpan / 2;
            const rankSize = Math.max(...rankNodesList.map((node) => (direction === "left-right" ? node.w : node.h)));

            rankNodesList.forEach((node) => {
                const along = rankOffset + rankSize / 2;
                const across = crossCursor + (direction === "left-right" ? node.h : node.w) / 2;
                positions[node.id] =
                    direction === "left-right" ? { cx: along, cy: across, w: node.w, h: node.h } : { cx: across, cy: along, w: node.w, h: node.h };
                crossCursor += (direction === "left-right" ? node.h : node.w) + NODE_SPACING_PX;
            });
            rankOffset += rankSize + RANK_SPACING_PX;
        });

    return positions;
};

const layoutRadial = (nodes, edges) => {
    const rank = rankNodes(nodes, edges);
    const byRank = new Map();
    nodes.forEach((node) => {
        const r = rank.get(node.id);
        if (!byRank.has(r)) byRank.set(r, []);
        byRank.get(r).push(node);
    });

    const positions = {};
    byRank.forEach((ringNodes, r) => {
        const radius = r * RADIAL_RING_STEP_PX;
        ringNodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / ringNodes.length;
            positions[node.id] = {
                cx: r === 0 ? 0 : radius * Math.cos(angle),
                cy: r === 0 ? 0 : radius * Math.sin(angle),
                w: node.w,
                h: node.h,
            };
        });
    });
    return positions;
};

// Returns { [nodeId]: { cx, cy, w, h } }, centred like the shared layout engine.
export const computeSimpleLayout = (nodes, edges, direction = "top-down") => {
    if (nodes.length === 0) return {};
    return direction === "radial" ? layoutRadial(nodes, edges) : layoutLayered(nodes, edges, direction);
};
