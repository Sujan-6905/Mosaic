// A service mesh on a grid. Every service already wears a sidecar badge, so a node that only names a
// service's sidecar or proxy folds into that service; links then run through the gaps between rows and
// columns, so none crosses a service.
import { labelAtSegment } from "./common.js";

const SIDECAR = /\b(side ?car|proxy|envoy)\b/i;
const CHANNEL_STEP = 10;

const ownerOf = (node, services) => {
    if (!SIDECAR.test(node.label)) return null;
    const named = node.label.replace(SIDECAR, "").trim().toLowerCase();
    return services.find((service) => service !== node && !SIDECAR.test(service.label) && named && service.label.toLowerCase().includes(named)) ?? null;
};

// Sidecar nodes and the services they belong to; links to a sidecar become links to its service.
export const foldSidecars = (model) => {
    const ownerById = new Map();
    model.nodes.forEach((node) => {
        const owner = ownerOf(node, model.nodes);
        if (owner) ownerById.set(node.id, owner.id);
    });
    const resolve = (id) => ownerById.get(id) ?? id;
    const seen = new Set();
    const edges = model.edges
        .map((edge) => ({ ...edge, from: resolve(edge.from), to: resolve(edge.to) }))
        .filter((edge) => {
            const key = `${edge.from}\u0000${edge.to}`;
            if (edge.from === edge.to || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    return { folded: [...ownerById.keys()], edges };
};

const box = (node) => ({ minX: node.cx - node.w / 2, maxX: node.cx + node.w / 2, minY: node.cy - node.h / 2, maxY: node.cy + node.h / 2 });

// `cellOf` gives each service's grid row and column; the gateway sits above row 0.
export const routeMeshLinks = ({ edges, scene, gateway, cellOf, columnLeft, rowTop, gapX, gapY }) => {
    const runs = new Map();
    const take = (key) => {
        const count = runs.get(key) ?? 0;
        runs.set(key, count + 1);
        return count * CHANNEL_STEP;
    };
    return edges.map((edge) => {
        const [a, b] = [scene.nodes[edge.from], scene.nodes[edge.to]];
        if (!a || !b) return { ...edge };
        const [from, to] = [edge.from === gateway ? { row: -1, col: null } : cellOf(edge.from), edge.to === gateway ? { row: -1, col: null } : cellOf(edge.to)];
        if (from.row === to.row && to.col !== null && from.col !== null && Math.abs(from.col - to.col) === 1) return { ...edge, routing: "straight" };
        // Along the gap under the source's row, down the gap left of the target's column, into its side.
        const runY = (from.row < 0 ? rowTop(0) - gapY / 2 : box(a).maxY + gapY / 2) + take(`row:${from.row}`);
        const target = box(b);
        const laneX = (to.col === null ? (target.minX + target.maxX) / 2 : columnLeft(to.col) - gapX / 2) - take(`col:${to.col}`);
        const enterY = to.row < 0 ? target.maxY + 1 : b.cy;
        const points = [
            { x: a.cx, y: box(a).maxY + 1 },
            { x: a.cx, y: runY },
            { x: laneX, y: runY },
            { x: laneX, y: enterY },
            ...(to.row < 0 ? [] : [{ x: target.minX - 1, y: enterY }]),
        ];
        return { ...edge, waypoints: points, labelT: labelAtSegment(points, 1), routing: undefined };
    });
};
