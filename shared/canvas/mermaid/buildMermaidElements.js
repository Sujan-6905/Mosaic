// Mermaid's own parser reads the code, then the board's layout places it.
import { withConnectorHeads } from "../elements/connectors.js";
import { layoutGraph, LAYOUT_DIRECTIONS } from "../layoutEngine.js";
import { graphFromDiagram } from "./mermaidGraph.js";
import { buildSequenceElements } from "./sequenceLayout.js";

const FONT_SIZE = 14;
const DETAIL_FONT_SIZE = 12;
const LINE_HEIGHT = 1.3;
const BOX_PADDING_X = 18;
const BOX_PADDING_Y = 14;
const MIN_BOX = { w: 110, h: 52 };
const MARKER_SIZE = 26;
const MAX_LABEL_WIDTH = 220;
const INK = "#1f2937";

const FIRST_KEYWORD =
    /^\s*(?:%%[^\n]*\n\s*)*(?:---[\s\S]*?---\s*)?(flowchart|graph|sequenceDiagram|classDiagram(?:-v2)?|stateDiagram(?:-v2)?|erDiagram|mindmap|architecture-beta)\b/;

const FENCED = /^\s*```\s*mermaid[^\n]*\n([\s\S]*?)\n\s*```\s*$/;

// The Mermaid code in pasted text, also when it comes inside a Markdown ```mermaid fence, or null.
export const mermaidSourceIn = (text) => {
    const source = FENCED.exec(text ?? "")?.[1] ?? text ?? "";
    return FIRST_KEYWORD.test(source) ? source : null;
};

export const MERMAID_KINDS = ["Flowchart", "Sequence", "Class", "Entity relationship", "State", "Mind map", "Architecture"];

const firstLine = (message) =>
    String(message ?? "Mermaid couldn't read this")
        .split("\n")
        .find((line) => line.trim()) ?? "Mermaid couldn't read this";

// `{ kind, ... }` ready to build, or `{ error }` saying what's wrong, in Mermaid's
// words. `mermaid` is the initialised library, which each runtime loads its own way.
export const parseMermaidWith = async (mermaid, text) => {
    if (!text?.trim()) return { error: "Paste some Mermaid code to convert." };
    let diagram;
    try {
        diagram = await mermaid.mermaidAPI.getDiagramFromText(text);
    } catch (error) {
        return { error: firstLine(error?.message) };
    }
    if (diagram.type === "sequence") return { kind: "sequence", db: diagram.db };
    const graph = graphFromDiagram(diagram.type, diagram.db);
    if (!graph) return { error: `A ${diagram.type} diagram can't become board shapes yet. Supported: ${MERMAID_KINDS.join(", ")}.` };
    if (graph.nodes.length === 0) return { error: "There's nothing in this diagram to draw." };
    return graph;
};

const sizeOf = (node, metrics) => {
    if (node.marker) return { w: MARKER_SIZE, h: MARKER_SIZE };
    const labelWidth = Math.min(MAX_LABEL_WIDTH, metrics.textWidth(node.label, FONT_SIZE) + 2);
    const labelHeight = metrics.lineCount(node.label, labelWidth, FONT_SIZE) * FONT_SIZE * LINE_HEIGHT;
    const detailWidth = Math.max(0, ...node.details.map((line) => metrics.textWidth(line, DETAIL_FONT_SIZE) + 2));
    const detailHeight = node.details.length * DETAIL_FONT_SIZE * LINE_HEIGHT;
    let w = Math.max(labelWidth, detailWidth) + BOX_PADDING_X * 2;
    let h = labelHeight + detailHeight + BOX_PADDING_Y * 2 + (detailHeight ? 6 : 0);
    if (node.round) w = h = Math.max(w, h) * Math.SQRT2;
    if (node.diamond) {
        w *= 2;
        h *= 2;
    }
    return { w: Math.ceil(Math.max(MIN_BOX.w, w)), h: Math.ceil(Math.max(MIN_BOX.h, h)) };
};

const layoutDirection = (direction) =>
    direction === "radial" ? LAYOUT_DIRECTIONS.RADIAL : direction === "left-right" ? LAYOUT_DIRECTIONS.LEFT_RIGHT : LAYOUT_DIRECTIONS.TOP_DOWN;

// Board elements for a parsed diagram, as [{ elementId, element }] centred on (0, 0),
// with zIndex counting up from 1 so the caller can lift them above the board.
export const buildMermaidElements = (parsed, { metrics, color = INK, generateElementId }) => {
    let zIndex = 10;
    let behind = 0;
    const base = ({ behind: goesBehind = false } = {}) => ({
        zIndex: goesBehind ? (behind += 0.01) : (zIndex += 1),
        rotation: 0,
        groupId: null,
        frameId: null,
        locked: false,
    });
    if (parsed.kind === "sequence") {
        return centred(
            buildSequenceElements(parsed.db, { metrics, color, fontSize: FONT_SIZE, base, newId: generateElementId }).map(([elementId, element]) => ({
                elementId,
                element,
            })),
        );
    }

    const sized = parsed.nodes.map((node) => ({ ...node, ...sizeOf(node, metrics) }));
    const layout = layoutGraph(sized, parsed.edges, layoutDirection(parsed.direction), metrics, parsed.groups);
    const mirror = (point) => (!parsed.reversed ? point : parsed.direction === "left-right" ? { ...point, x: -point.x } : { ...point, y: -point.y });
    const result = [];

    const frameIds = {};
    parsed.groups.forEach((group) => {
        const box = layout.groupBoxes[group.id];
        if (!box) return;
        frameIds[group.id] = generateElementId();
        const a = mirror({ x: box.minX, y: box.minY });
        const b = mirror({ x: box.maxX, y: box.maxY });
        result.push({
            elementId: frameIds[group.id],
            element: {
                type: "frame",
                startX: Math.min(a.x, b.x),
                startY: Math.min(a.y, b.y),
                endX: Math.max(a.x, b.x),
                endY: Math.max(a.y, b.y),
                name: group.label || group.id,
                color: "#94a3b8",
                ...base({ behind: true }),
            },
        });
    });
    parsed.groups.forEach((group) => {
        const frame = result.find(({ elementId }) => elementId === frameIds[group.id]);
        if (frame && group.parent && frameIds[group.parent]) frame.element.frameId = frameIds[group.parent];
    });

    const shapeIds = {};
    sized.forEach((node) => {
        const position = layout.positions[node.id];
        if (!position) return;
        const center = mirror({ x: position.cx, y: position.cy });
        shapeIds[node.id] = generateElementId();
        const ink = node.color ?? color;
        result.push({
            elementId: shapeIds[node.id],
            element: {
                type: "shape",
                shapeType: node.shapeType,
                startX: center.x - position.w / 2,
                startY: center.y - position.h / 2,
                endX: center.x + position.w / 2,
                endY: center.y + position.h / 2,
                ...(node.cornerRadius ? { cornerRadius: node.cornerRadius } : {}),
                color: ink,
                fillColor: node.marker ? ink : (node.fillColor ?? null),
                size: node.marker === "end" ? 5 : 2,
                opacity: 100,
                ...(node.label ? { text: node.label, fontSize: FONT_SIZE } : {}),
                ...(node.details.length
                    ? { subtext: node.details.join("\n"), subtextSize: DETAIL_FONT_SIZE, align: "left", verticalAlign: "top", fontWeight: "bold" }
                    : {}),
                ...(node.textColor ? { textColor: node.textColor } : {}),
                ...base(),
                frameId: node.group ? (frameIds[node.group] ?? null) : null,
            },
        });
    });

    parsed.edges.forEach((edge, i) => {
        const route = layout.routes[i];
        const from = layout.positions[edge.from];
        const to = layout.positions[edge.to];
        if (!route || !from || !to || !shapeIds[edge.from] || !shapeIds[edge.to]) return;
        const start = mirror({ x: from.cx, y: from.cy });
        const end = mirror({ x: to.cx, y: to.cy });
        result.push({
            elementId: generateElementId(),
            element: {
                type: "connector",
                startX: start.x,
                startY: start.y,
                endX: end.x,
                endY: end.y,
                startElementId: shapeIds[edge.from],
                endElementId: shapeIds[edge.to],
                waypoints: route.waypoints.length > 0 ? route.waypoints.map(mirror) : null,
                ...(edge.label ? { text: edge.label, fontSize: 12 } : {}),
                color,
                size: edge.size,
                opacity: 100,
                ...withConnectorHeads({ startHead: edge.startHead, endHead: edge.endHead }),
                strokeStyle: edge.strokeStyle,
                ...base(),
            },
        });
    });
    return centred(result);
};

const extentOf = (element) => {
    if (element.type === "sticky") return [element.x, element.y, element.x + element.width, element.y + element.height];
    const xs = [element.startX, element.endX, ...(element.waypoints ?? []).map((point) => point.x)];
    const ys = [element.startY, element.endY, ...(element.waypoints ?? []).map((point) => point.y)];
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

const centred = (entries) => {
    const extents = entries.map(({ element }) => extentOf(element));
    const cx = (Math.min(...extents.map((e) => e[0])) + Math.max(...extents.map((e) => e[2]))) / 2;
    const cy = (Math.min(...extents.map((e) => e[1])) + Math.max(...extents.map((e) => e[3]))) / 2;
    return entries.map(({ elementId, element }) => {
        if (element.type === "sticky") return { elementId, element: { ...element, x: element.x - cx, y: element.y - cy } };
        return {
            elementId,
            element: {
                ...element,
                startX: element.startX - cx,
                startY: element.startY - cy,
                endX: element.endX - cx,
                endY: element.endY - cy,
                ...(element.waypoints ? { waypoints: element.waypoints.map((point) => ({ x: point.x - cx, y: point.y - cy })) } : {}),
            },
        };
    });
};
