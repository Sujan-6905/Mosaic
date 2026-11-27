// Links for a system boundary with people and external systems outside it. Links between containers take
// the layered layout's own routes; a link from outside comes down a channel beside the boundary, crosses in
// the empty gap above its container's rank, and drops into the container's top.
import { labelAtSegment } from "./common.js";

const CHANNEL = 28;
const CHANNEL_STEP = 12;
const TOP_GAP = 28;
const PORT_SPREAD = 0.6;

const box = (node) => ({ minX: node.cx - node.w / 2, maxX: node.cx + node.w / 2, minY: node.cy - node.h / 2, maxY: node.cy + node.h / 2 });

const longestSegment = (points) =>
    points
        .slice(1)
        .map((point, index) => ({ index, length: Math.hypot(point.x - points[index].x, point.y - points[index].y) }))
        .sort((a, b) => b.length - a.length)[0]?.index ?? 0;

// The y midway between a container's top and the bottom of whatever sits in the rank above it.
const gapAbove = (scene, insideIds, node) => {
    const top = box(node).minY;
    const above = insideIds.map((id) => box(scene.nodes[id]).maxY).filter((bottom) => bottom <= top);
    return above.length ? (Math.max(...above) + top) / 2 : top - TOP_GAP;
};

export const routeBoundaryLinks = ({ model, scene, boundary, insideIds, insideEdges, routes }) => {
    const inside = new Set(insideIds);
    const edges = insideEdges.map((edge, index) => {
        const waypoints = routes[index]?.waypoints ?? [];
        if (waypoints.length === 0) return { ...edge };
        const ends = [scene.nodes[edge.from], scene.nodes[edge.to]].map((node) => ({ x: node.cx, y: node.cy }));
        const points = [ends[0], ...waypoints, ends[1]];
        return { ...edge, waypoints, labelT: labelAtSegment(points, longestSegment(points)) };
    });

    const crossing = model.edges.filter((edge) => inside.has(edge.from) !== inside.has(edge.to) && scene.nodes[edge.from] && scene.nodes[edge.to]);
    const perSide = { left: 0, right: 0 };
    const intoTop = new Map();
    crossing.forEach((edge) => {
        const target = inside.has(edge.to) ? edge.to : edge.from;
        intoTop.set(target, [...(intoTop.get(target) ?? []), edge]);
    });

    crossing.forEach((edge) => {
        const [outsideId, insideId] = inside.has(edge.to) ? [edge.from, edge.to] : [edge.to, edge.from];
        const outsider = scene.nodes[outsideId];
        const container = scene.nodes[insideId];
        const side = outsider.cx < boundary.minX ? "left" : "right";
        const step = perSide[side]++ * CHANNEL_STEP;
        const channelX = side === "left" ? boundary.minX - CHANNEL - step : boundary.maxX + CHANNEL + step;
        const siblings = intoTop.get(insideId);
        const slot = siblings.length === 1 ? 0 : siblings.indexOf(edge) / (siblings.length - 1) - 0.5;
        const portX = container.cx + slot * container.w * PORT_SPREAD;
        const gapY = gapAbove(scene, insideIds, container) - step / 2;
        const outward = { x: side === "left" ? outsider.cx + outsider.w / 2 + 1 : outsider.cx - outsider.w / 2 - 1, y: outsider.cy };
        const path = [outward, { x: channelX, y: outsider.cy }, { x: channelX, y: gapY }, { x: portX, y: gapY }, { x: portX, y: box(container).minY - 1 }];
        const points = edge.from === outsideId ? path : [...path].reverse();
        // The run between the outsider and the boundary is that link's alone, so its words go there.
        const labelSegment = edge.from === outsideId ? 0 : points.length - 2;
        edges.push({ ...edge, waypoints: points, labelT: labelAtSegment(points, labelSegment) });
    });
    // Outsiders on opposite sides would cross the whole boundary, so their link goes round beneath it.
    model.edges
        .filter((edge) => !inside.has(edge.from) && !inside.has(edge.to) && scene.nodes[edge.from] && scene.nodes[edge.to])
        .forEach((edge, index) => {
            const [from, to] = [scene.nodes[edge.from], scene.nodes[edge.to]];
            if (from.cx < boundary.minX === to.cx < boundary.minX) {
                edges.push({ ...edge });
                return;
            }
            const underY = boundary.maxY + CHANNEL + index * CHANNEL_STEP;
            // Each end leaves from its outer side, since a person's name sits beneath it.
            const outer = (node) => (node.cx < boundary.minX ? -1 : 1);
            const sideX = (node) => node.cx + outer(node) * (node.w / 2 + 1);
            const stemX = (node) => node.cx + outer(node) * (node.w / 2 + CHANNEL);
            const points = [
                { x: sideX(from), y: from.cy },
                { x: stemX(from), y: from.cy },
                { x: stemX(from), y: underY },
                { x: stemX(to), y: underY },
                { x: stemX(to), y: to.cy },
                { x: sideX(to), y: to.cy },
            ];
            edges.push({ ...edge, waypoints: points, labelT: labelAtSegment(points, 2) });
        });
    return edges;
};
