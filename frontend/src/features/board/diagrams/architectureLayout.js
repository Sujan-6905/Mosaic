// Lays a repository out like a whiteboard drawing: rows inside labelled groups, data stores at the bottom,
// outside services to one side, and square arrows that go around boxes.
import { routeEdges } from "./architectureRouting";

const PALETTES = {
    frontend: { fill: "#ede9fe", stroke: "#7c3aed", text: "#2e1065", sub: "#5b21b6", name: "Frontend" },
    backend: { fill: "#d1fae5", stroke: "#059669", text: "#022c22", sub: "#047857", name: "Backend" },
    library: { fill: "#dbeafe", stroke: "#2563eb", text: "#172554", sub: "#1d4ed8", name: "Library" },
    data: { fill: "#ffedd5", stroke: "#ea580c", text: "#431407", sub: "#c2410c", name: "Data store" },
    external: { fill: "#e5e7eb", stroke: "#6b7280", text: "#111827", sub: "#4b5563", name: "External" },
};
const GROUP_ORDER = { frontend: 0, backend: 1, library: 2 };
const EDGE_COLOR = "#71717a";

const FONT_SIZE = 14;
const SUBTITLE_SIZE = 12;
const LINE_HEIGHT = 1.3;
const MIN_CELL = 150;
const MAX_CELL = 250;
const CELL_PADDING = 36;
const MAX_ROW_BOXES = 7;
const COLUMN_GAP = 22;
const ROW_GAP = 58;
const GROUP_PADDING = 30;
const GROUP_GAP = 96;
const GROUP_COLUMN_GAP = 96;
const GROUPS_BEFORE_COLUMNS = 3;
const MIN_BOX_HEIGHT = 66;
const BOX_TEXT_INSET = 0.12;
const SIDE_COLUMN_GAP = 130;
const SERVICE_WIDTH = 200;
const LEGEND_GAP = 52;
const BARYCENTER_SWEEPS = 4;

const paletteFor = (kind) => PALETTES[kind] ?? PALETTES.library;

// Orders each row so a box sits near what it connects to, which is most of what
// keeps a layered diagram's arrows from crossing.
const orderRows = (rows, edges) => {
    const neighbours = new Map();
    const link = (a, b) => {
        if (!neighbours.has(a)) neighbours.set(a, []);
        neighbours.get(a).push(b);
    };
    edges.forEach(({ from, to }) => {
        link(from, to);
        link(to, from);
    });
    const position = new Map();
    const measure = () => rows.forEach((row) => row.forEach((node, index) => position.set(node.id, (index + 0.5) / row.length)));
    measure();
    const sweep = (row) => {
        const score = new Map(
            row.map((node) => {
                const linked = (neighbours.get(node.id) ?? []).map((id) => position.get(id)).filter((value) => value !== undefined);
                return [node.id, linked.length ? linked.reduce((sum, value) => sum + value, 0) / linked.length : position.get(node.id)];
            }),
        );
        row.sort((a, b) => score.get(a.id) - score.get(b.id));
    };
    for (let pass = 0; pass < BARYCENTER_SWEEPS; pass += 1) {
        const order = pass % 2 === 0 ? rows : [...rows].reverse();
        order.forEach((row) => {
            sweep(row);
            row.forEach((node, index) => position.set(node.id, (index + 0.5) / row.length));
        });
    }
    return rows;
};

const rowsOfGroup = (nodes, edges) => {
    const byLayer = new Map();
    nodes.forEach((node) => {
        if (!byLayer.has(node.layer)) byLayer.set(node.layer, []);
        byLayer.get(node.layer).push(node);
    });
    const rows = [...byLayer.keys()]
        .sort((a, b) => a - b)
        .flatMap((layer) => {
            const row = byLayer.get(layer).sort((a, b) => a.id.localeCompare(b.id));
            const wrapped = [];
            for (let start = 0; start < row.length; start += MAX_ROW_BOXES) wrapped.push(row.slice(start, start + MAX_ROW_BOXES));
            return wrapped;
        });
    return orderRows(rows, edges);
};

const boxHeightFor = (node, width, metrics) => {
    const inner = width * (1 - 2 * BOX_TEXT_INSET);
    const titleLines = metrics.lineCount(node.title, inner, FONT_SIZE);
    const subLines = node.subtitle ? metrics.lineCount(node.subtitle, inner, SUBTITLE_SIZE) : 0;
    const textHeight = titleLines * FONT_SIZE * LINE_HEIGHT + subLines * SUBTITLE_SIZE * LINE_HEIGHT;
    return Math.max(MIN_BOX_HEIGHT, textHeight / (1 - 2 * BOX_TEXT_INSET));
};

// A group's boxes as rectangles in its own coordinates.
const groupInnerWidth = (nodes, edges, metrics) => {
    const rows = rowsOfGroup(nodes, edges);
    const cell = Math.min(MAX_CELL, Math.max(MIN_CELL, ...nodes.map((node) => metrics.textWidth(node.title, FONT_SIZE) + CELL_PADDING)));
    const columns = Math.max(...rows.map((row) => row.length));
    return columns * cell + (columns - 1) * COLUMN_GAP;
};

const layoutGroup = (nodes, edges, metrics, innerWidth) => {
    const rows = rowsOfGroup(nodes, edges);
    const rects = new Map();
    let y = GROUP_PADDING;
    for (const row of rows) {
        const width = (innerWidth - (row.length - 1) * COLUMN_GAP) / row.length;
        const height = Math.max(...row.map((node) => boxHeightFor(node, width, metrics)));
        row.forEach((node, index) => {
            rects.set(node.id, { x: GROUP_PADDING + index * (width + COLUMN_GAP), y, width, height });
        });
        y += height + ROW_GAP;
    }
    return { rects, width: innerWidth + GROUP_PADDING * 2, height: y - ROW_GAP + GROUP_PADDING };
};

const boxElement = (node, rect, palette, frameId, zIndex, shapeType = "Rectangle") => ({
    type: "shape",
    shapeType,
    moduleId: node.id,
    startX: rect.x,
    startY: rect.y,
    endX: rect.x + rect.width,
    endY: rect.y + rect.height,
    color: palette.stroke,
    colorToken: null,
    fillColor: palette.fill,
    fillColorToken: null,
    fillStyle: "solid",
    strokeStyle: "solid",
    cornerRadius: shapeType === "Rectangle" ? 10 : 0,
    size: 1.5,
    opacity: 100,
    text: node.title,
    subtext: node.subtitle || undefined,
    fontSize: FONT_SIZE,
    subtextSize: SUBTITLE_SIZE,
    fontWeight: "bold",
    align: "center",
    textColor: palette.text,
    textColorToken: null,
    subtextColor: palette.sub,
    zIndex,
    rotation: 0,
    groupId: null,
    frameId,
    locked: false,
});

const frameElement = (group, rect, palette) => ({
    type: "frame",
    moduleId: group.id,
    startX: rect.x,
    startY: rect.y,
    endX: rect.x + rect.width,
    endY: rect.y + rect.height,
    name: group.label,
    color: palette.stroke,
    colorToken: null,
    strokeStyle: "dashed",
    zIndex: 0,
    rotation: 0,
    groupId: null,
    frameId: null,
    locked: false,
});

const legendElements = (kinds, left, top, generateElementId, startZ) => {
    const items = [];
    let x = left;
    let z = startZ;
    kinds.forEach((kind) => {
        const palette = paletteFor(kind);
        items.push({
            elementId: generateElementId(),
            element: {
                type: "shape",
                shapeType: "Rectangle",
                startX: x,
                startY: top,
                endX: x + 18,
                endY: top + 18,
                color: palette.stroke,
                colorToken: null,
                fillColor: palette.fill,
                fillColorToken: null,
                cornerRadius: 4,
                size: 1.5,
                opacity: 100,
                zIndex: z,
                rotation: 0,
                groupId: null,
                frameId: null,
                locked: false,
            },
        });
        z += 1;
        items.push({
            elementId: generateElementId(),
            element: {
                type: "text",
                x: x + 26,
                y: top + 1,
                width: 90,
                autoWidth: true,
                text: palette.name,
                color: EDGE_COLOR,
                colorToken: null,
                size: 13,
                fontWeight: "normal",
                fontStyle: "normal",
                align: "left",
                opacity: 100,
                zIndex: z,
                rotation: 0,
                groupId: null,
                frameId: null,
                locked: false,
            },
        });
        z += 1;
        x += 40 + palette.name.length * 7.5 + 24;
    });
    return items;
};

// `metrics`: { textWidth(text, size), lineCount(text, width, size) }.
export const buildArchitectureElements = ({ graph, metrics, generateElementId, drawLegend = true }) => {
    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
    const drawnEdges = graph.edges.filter((edge) => edge.primary !== false && nodesById.has(edge.from) && nodesById.has(edge.to));
    const dataNodes = graph.nodes.filter((node) => node.group === "group:data");
    const externalNodes = graph.nodes.filter((node) => node.group === "group:external");
    const groups = [...(graph.groups ?? [])].sort((a, b) => (GROUP_ORDER[a.kind] ?? 3) - (GROUP_ORDER[b.kind] ?? 3));

    const groupParts = groups
        .map((group) => {
            const nodes = graph.nodes.filter((node) => node.group === group.id);
            const ids = new Set(nodes.map((node) => node.id));
            return { group, nodes, edges: drawnEdges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)) };
        })
        .filter(({ nodes }) => nodes.length > 0);
    // Every group shares one width, so the stack reads as a single structure.
    const sharedWidth = Math.max(0, ...groupParts.map(({ nodes, edges }) => groupInnerWidth(nodes, edges, metrics)));
    const placedGroups = groupParts.map(({ group, nodes, edges }) => ({ group, nodes, ...layoutGroup(nodes, edges, metrics, sharedWidth) }));

    // Many groups go two abreast, so a repository of a dozen packages isn't a
    // column you have to scroll down.
    const columns = placedGroups.length >= GROUPS_BEFORE_COLUMNS ? 2 : 1;
    const groupWidth = placedGroups[0]?.width ?? SERVICE_WIDTH;
    const widest = Math.max(SERVICE_WIDTH, groupWidth * columns + GROUP_COLUMN_GAP * (columns - 1));
    const elements = [];
    const rects = new Map();
    let zIndex = 1;
    let y = 0;
    const columnBottoms = Array.from({ length: columns }, () => 0);

    placedGroups.forEach(({ group, nodes, rects: localRects, width, height }) => {
        const column = columnBottoms.indexOf(Math.min(...columnBottoms));
        const left = -widest / 2 + column * (width + GROUP_COLUMN_GAP);
        y = columnBottoms[column];
        const frameId = generateElementId();
        const palette = paletteFor(group.kind);
        elements.push({ elementId: frameId, element: frameElement(group, { x: left, y, width, height }, palette) });
        nodes.forEach((node) => {
            const local = localRects.get(node.id);
            const rect = { ...local, x: local.x + left, y: local.y + y };
            rects.set(node.id, rect);
            const elementId = generateElementId();
            elements.push({ elementId, element: boxElement(node, rect, palette, frameId, zIndex) });
            rect.elementId = elementId;
            zIndex += 1;
        });
        columnBottoms[column] = y + height + GROUP_GAP;
    });
    y = Math.max(...columnBottoms, 0);

    if (dataNodes.length > 0) {
        const totalWidth = dataNodes.length * SERVICE_WIDTH + (dataNodes.length - 1) * COLUMN_GAP;
        dataNodes.forEach((node, index) => {
            const rect = { x: -totalWidth / 2 + index * (SERVICE_WIDTH + COLUMN_GAP), y, width: SERVICE_WIDTH, height: MIN_BOX_HEIGHT + 24 };
            const elementId = generateElementId();
            rects.set(node.id, { ...rect, elementId });
            elements.push({ elementId, element: boxElement(node, rect, PALETTES.data, null, zIndex, "Cylinder") });
            zIndex += 1;
        });
        y += MIN_BOX_HEIGHT + 24 + GROUP_GAP;
    }

    externalNodes.forEach((node, index) => {
        const rect = { x: widest / 2 + SIDE_COLUMN_GAP, y: index * (MIN_BOX_HEIGHT + COLUMN_GAP), width: SERVICE_WIDTH, height: MIN_BOX_HEIGHT };
        const elementId = generateElementId();
        rects.set(node.id, { ...rect, elementId, isSide: true });
        elements.push({ elementId, element: boxElement(node, rect, PALETTES.external, null, zIndex) });
        zIndex += 1;
    });

    const groupKindsUsed = [
        ...new Set(placedGroups.map(({ group }) => group.kind)),
        ...(dataNodes.length ? ["data"] : []),
        ...(externalNodes.length ? ["external"] : []),
    ];
    const connectors = routeEdges(drawnEdges, rects).map((route) => ({
        elementId: generateElementId(),
        element: {
            type: "connector",
            moduleId: `${route.edge.from}->${route.edge.to}`,
            startX: route.start.x,
            startY: route.start.y,
            endX: route.end.x,
            endY: route.end.y,
            startElementId: rects.get(route.edge.from).elementId,
            endElementId: rects.get(route.edge.to).elementId,
            startAnchor: route.startAnchor,
            endAnchor: route.endAnchor,
            waypoints: route.waypoints.length ? route.waypoints : null,
            routing: "straight",
            color: EDGE_COLOR,
            colorToken: null,
            size: 1.5,
            opacity: 100,
            strokeStyle: "solid",
            arrowStart: Boolean(route.edge.bidirectional),
            arrowEnd: true,
            startHead: route.edge.bidirectional ? "triangle" : "none",
            endHead: "triangle",
            ...(route.edge.label ? { text: route.edge.label, fontSize: 13 } : {}),
            zIndex: zIndex++,
            rotation: 0,
            groupId: null,
            frameId: null,
            locked: false,
        },
    }));

    const legend =
        drawLegend && groupKindsUsed.length > 1 ? legendElements(groupKindsUsed, -widest / 2, y + LEGEND_GAP - GROUP_GAP, generateElementId, zIndex) : [];
    return [...elements, ...connectors, ...legend];
};
