import { connectorElement, meta } from "./elements.js";
import { inkFields, categoryStrong, ALERT } from "./colors.js";

const END_HEADS = {
    arrow: "arrow",
    triangle: "triangle",
    hollow: "triangle_outline",
    diamond: "diamond",
    "open-diamond": "diamond_outline",
    crowfoot: "crowfoot_many",
    dot: "dot",
    bar: "bar",
    none: "none",
};
const ROUNDED_ELBOW_RADIUS = 12;
const LABEL_FONT = 12;

// A transit-map route: straight along the longer axis, then one 45 degree run.
const metroWaypoints = (from, to) => {
    const dx = to.cx - from.cx;
    const dy = to.cy - from.cy;
    if (Math.abs(dx) < 1 || Math.abs(dy) < 1 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 1) return [];
    if (Math.abs(dx) > Math.abs(dy)) return [{ x: from.cx + Math.sign(dx) * (Math.abs(dx) - Math.abs(dy)), y: from.cy }];
    return [{ x: from.cx, y: from.cy + Math.sign(dy) * (Math.abs(dy) - Math.abs(dx)) }];
};

const bundledWaypoints = (from, to, centre) => {
    const mid = { x: (from.cx + to.cx) / 2, y: (from.cy + to.cy) / 2 };
    return [{ x: mid.x + (centre.x - mid.x) * 0.35, y: mid.y + (centre.y - mid.y) * 0.35 }];
};

const routeFor = (edge, from, to, levers, centre) => {
    if (edge.routing === "curved") return { routing: "curved", waypoints: edge.waypoints?.length ? edge.waypoints : null };
    if (edge.routing === "straight") return { routing: "straight", waypoints: null };
    if (edge.routing === "elbow") return { routing: "elbow", waypoints: null };
    // A route the layout worked out (round other nodes, along a rail, through a channel) is kept;
    // the routing lever only decides how it bends.
    if (edge.waypoints?.length) {
        if (levers.routing === "curved" || levers.routing === "bundled") return { routing: "curved", waypoints: edge.waypoints };
        return { routing: "straight", waypoints: edge.waypoints, ...(levers.routing === "rounded" ? { cornerRadius: ROUNDED_ELBOW_RADIUS } : {}) };
    }
    switch (levers.routing) {
        case "straight":
            return { routing: "straight", waypoints: null };
        case "curved":
            return { routing: "curved", waypoints: null };
        case "metro":
            return { routing: "straight", waypoints: metroWaypoints(from, to) };
        case "bundled":
            return { routing: "curved", waypoints: bundledWaypoints(from, to, centre) };
        case "rounded":
            return { routing: "elbow", waypoints: null, cornerRadius: ROUNDED_ELBOW_RADIUS };
        default:
            return { routing: "elbow", waypoints: null };
    }
};

const widthFor = (edge, levers, look, valueRange) => {
    if (edge.width) return edge.width;
    if (levers.line === "weight" && Number.isFinite(edge.value)) {
        const [low, high] = valueRange;
        return 1.5 + ((edge.value - low) / (high - low || 1)) * 6;
    }
    return Math.max(1, look.stroke * (edge.faint ? 0.6 : 0.9));
};

const labelText = (edge, levers, index) => {
    if (!edge.label) return levers.edgeLabels === "numbered" ? String(index + 1) : "";
    const label = levers.edgeLabels === "tag" ? edge.label.toUpperCase() : edge.label;
    return levers.edgeLabels === "numbered" ? `${index + 1}. ${label}` : label;
};

export const paintEdges = (ctx, elementIdOf) => {
    const { scene, style, diagramId, newId, z, onBoardGround, font, highlighted, out, slotOf, bounds } = ctx;
    const { look, levers, palette } = style;
    const centre = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
    const values = scene.edges.map((edge) => edge.value).filter(Number.isFinite);
    const valueRange = [Math.min(...values), Math.max(...values)];
    const labelGround = palette.ground ?? null;

    scene.edges.forEach((edge, index) => {
        const lit = highlighted.has(edge.from) && highlighted.has(edge.to);
        const baseColour = edge.alert
            ? ALERT
            : palette.spotlight
              ? lit
                  ? palette.accent
                  : palette.muted
              : edge.category !== undefined
                ? categoryStrong(edge.category, palette)
                : palette.edgeByCategory
                  ? categoryStrong(slotOf(edge.from), palette)
                  : edge.faint
                    ? palette.muted
                    : (palette.edge ?? palette.ink);
        const heads = { start: edge.heads?.start ?? "none", end: edge.heads?.end ?? END_HEADS[levers.ends] ?? "triangle" };
        const dashed = edge.dashed || levers.line === "dashed";
        const edgeStyle = {
            ...inkFields(baseColour, onBoardGround && !edge.alert && !palette.spotlight),
            size: widthFor(edge, levers, look, valueRange),
            strokeStyle: edge.faint && !dashed ? "dotted" : dashed ? "dashed" : levers.line === "dotted" ? "dotted" : "solid",
            ...(look.roughness ? { roughness: Math.min(look.roughness, 1.5) } : {}),
            startHead: heads.start,
            endHead: heads.end,
        };
        const text = labelText(edge, levers, index);
        const label = text
            ? {
                  text: text.slice(0, 200),
                  fontSize: levers.edgeLabels === "tag" ? LABEL_FONT - 1 : LABEL_FONT,
                  ...(font.fontFamily ? { fontFamily: font.fontFamily, fontSource: font.fontSource } : {}),
                  ...(levers.edgeLabels === "pill" || levers.edgeLabels === "tag" ? { labelStyle: levers.edgeLabels } : {}),
                  ...(levers.edgeLabels === "beside" ? { labelOffset: 14 } : {}),
                  ...(edge.labelT !== undefined ? { labelT: edge.labelT } : {}),
                  ...(labelGround ? { labelFill: labelGround } : {}),
              }
            : {};
        const edgeMeta = meta(diagramId, "edge", `${edge.from}->${edge.to}:${index}`, {
            data: Object.fromEntries(
                Object.entries({ from: edge.from, to: edge.to, label: edge.label, kind: edge.kind, value: edge.value }).filter(
                    ([, value]) => value !== null && value !== undefined,
                ),
            ),
        });

        if (edge.free) {
            const [start, ...rest] = edge.points;
            const end = rest.pop();
            out.push({
                elementId: newId(),
                element: connectorElement({ start, end, z: z(), waypoints: rest.length ? rest : null, ...edgeStyle, ...label, ...edgeMeta }),
            });
            return;
        }
        const from = scene.nodes[edge.from];
        const to = scene.nodes[edge.to];
        const startElementId = elementIdOf.get(edge.from);
        const endElementId = elementIdOf.get(edge.to);
        if (!from || !to || !startElementId || !endElementId) return;
        const route = routeFor(edge, from, to, levers, centre);
        out.push({
            elementId: newId(),
            element: connectorElement({
                start: { x: from.cx, y: from.cy },
                end: { x: to.cx, y: to.cy },
                startElementId,
                endElementId,
                z: z(),
                routing: route.routing,
                waypoints: route.waypoints,
                ...(route.cornerRadius ? { cornerRadius: route.cornerRadius } : {}),
                ...(edge.startAnchor ? { startAnchor: edge.startAnchor } : {}),
                ...(edge.endAnchor ? { endAnchor: edge.endAnchor } : {}),
                ...edgeStyle,
                ...label,
                ...edgeMeta,
            }),
        });
    });
};
