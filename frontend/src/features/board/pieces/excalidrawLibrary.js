import { fontFieldsFor } from "../../../../../shared/canvas/elements/fontSources.js";
import { colorTokenFor } from "../../../../../shared/canvas/color/colorTokens.js";
import { pieceFromSelection } from "../../../../../shared/canvas/pieces/pieces.js";
import { withConnectorHeads } from "../../../../../shared/canvas/elements/connectors.js";

// Reads an .excalidrawlib (either version) into pieces. Images, frames and embeds need
// files a library can't carry, so they're left out.

const SHAPES = { rectangle: "Rectangle", ellipse: "Ellipse", diamond: "Diamond" };
const FILLS = { solid: "solid", hachure: "hachure", "cross-hatch": "crosshatch", zigzag: "hachure" };
const HEADS = {
    arrow: "arrow",
    triangle: "triangle",
    triangle_outline: "triangle_outline",
    bar: "bar",
    dot: "dot",
    circle: "dot",
    circle_outline: "circle_outline",
    diamond: "diamond",
    diamond_outline: "diamond_outline",
};
const FONTS = { 1: "Kalam", 2: "Helvetica Neue", 3: "Courier New", 5: "Kalam", 6: "Nunito", 7: "Lilita One", 8: "Courier New" };
const MAX_PIECES = 200;
const MAX_ELEMENTS_PER_PIECE = 500;

const colour = (value) => (typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value) ? value : null);
const base = (source, index) => ({
    zIndex: index + 1,
    rotation: Number.isFinite(source.angle) ? (source.angle * 180) / Math.PI : 0,
    groupId: source.groupIds?.[0] ? `excalidraw-${source.groupIds[0]}` : null,
    frameId: null,
    locked: false,
    opacity: Number.isFinite(source.opacity) ? Math.max(0, Math.min(100, source.opacity)) : 100,
});
const ink = (source) => {
    const hex = colour(source.strokeColor) ?? "#000000";
    return { color: hex, colorToken: colorTokenFor(hex) ?? null };
};
const fontOf = (source) => {
    const family = FONTS[source.fontFamily];
    if (!family) return {};
    const fields = fontFieldsFor(family);
    return fields.error || fields.fileLink ? {} : { fontFamily: fields.fontFamily, ...(fields.fontSource ? { fontSource: fields.fontSource } : {}) };
};
const textAlign = (value) => (["left", "center", "right"].includes(value) ? value : "left");

const convertShape = (source, index) => {
    const fill = colour(source.backgroundColor);
    return {
        type: "shape",
        shapeType: SHAPES[source.type],
        startX: source.x,
        startY: source.y,
        endX: source.x + source.width,
        endY: source.y + source.height,
        ...ink(source),
        fillColor: fill,
        ...(fill ? { fillStyle: FILLS[source.fillStyle] ?? "solid" } : {}),
        strokeStyle: ["dashed", "dotted"].includes(source.strokeStyle) ? source.strokeStyle : "solid",
        size: Number.isFinite(source.strokeWidth) ? source.strokeWidth : 2,
        ...(source.roughness ? { roughness: Math.min(3, source.roughness) } : {}),
        ...(source.roundness && source.type === "rectangle" ? { cornerRadius: Math.min(16, Math.min(source.width, source.height) / 4) } : {}),
        ...base(source, index),
    };
};

const convertLinear = (source, index) => {
    const points = (source.points ?? []).map(([dx, dy]) => ({ x: source.x + dx, y: source.y + dy }));
    if (points.length < 2) return null;
    const isArrow = source.type === "arrow";
    const startHead = isArrow ? (HEADS[source.startArrowhead] ?? "none") : "none";
    const endHead = isArrow ? (HEADS[source.endArrowhead] ?? "none") : "none";
    return {
        type: "connector",
        startX: points[0].x,
        startY: points[0].y,
        endX: points.at(-1).x,
        endY: points.at(-1).y,
        startElementId: source.startBinding?.elementId ?? null,
        endElementId: source.endBinding?.elementId ?? null,
        waypoints: points.length > 2 ? points.slice(1, -1).slice(0, 64) : null,
        ...ink(source),
        size: Number.isFinite(source.strokeWidth) ? source.strokeWidth : 2,
        opacity: base(source, index).opacity,
        ...withConnectorHeads({ startHead, endHead }),
        strokeStyle: ["dashed", "dotted"].includes(source.strokeStyle) ? source.strokeStyle : "solid",
        ...(source.roughness ? { roughness: Math.min(3, source.roughness) } : {}),
        ...(source.roundness && points.length > 2 ? { routing: "curved" } : {}),
        ...base(source, index),
        rotation: 0,
    };
};

const convertFreedraw = (source, index) => {
    const points = (source.points ?? []).map(([dx, dy]) => ({ x: source.x + dx, y: source.y + dy })).slice(0, 10000);
    if (points.length === 0) return null;
    return {
        type: "path",
        points,
        ...ink(source),
        size: Number.isFinite(source.strokeWidth) ? source.strokeWidth * 2 : 3,
        ...base(source, index),
        rotation: 0,
    };
};

const convertText = (source, index) => ({
    type: "text",
    x: source.x,
    y: source.y,
    width: Math.max(20, source.width || 20),
    text: String(source.text ?? source.originalText ?? "").slice(0, 5000),
    ...ink(source),
    size: Number.isFinite(source.fontSize) ? source.fontSize : 20,
    align: textAlign(source.textAlign),
    ...fontOf(source),
    ...base(source, index),
});

// One library item's elements as a { id: element } map, with words that sat
// inside a box moved onto the box itself.
const convertItem = (sources) => {
    const live = sources.filter((source) => source && !source.isDeleted);
    const elements = {};
    live.forEach((source, index) => {
        let element = null;
        if (SHAPES[source.type]) element = convertShape(source, index);
        else if (source.type === "arrow" || source.type === "line") element = convertLinear(source, index);
        else if (source.type === "freedraw") element = convertFreedraw(source, index);
        else if (source.type === "text" && !source.containerId) element = convertText(source, index);
        if (element) elements[source.id] = element;
    });
    live.filter((source) => source.type === "text" && source.containerId && elements[source.containerId]).forEach((source) => {
        const container = elements[source.containerId];
        Object.assign(container, {
            text: String(source.text ?? "").slice(0, container.type === "connector" ? 200 : 5000),
            fontSize: Math.max(4, Math.min(400, source.fontSize ?? 20)),
            ...(container.type === "shape" ? { align: textAlign(source.textAlign), textColor: colour(source.strokeColor) } : {}),
            ...fontOf(source),
        });
    });
    Object.values(elements).forEach((element) => {
        if (element.type !== "connector") return;
        if (!elements[element.startElementId]) element.startElementId = null;
        if (!elements[element.endElementId]) element.endElementId = null;
    });
    return elements;
};

export const isExcalidrawLibrary = (parsed) => parsed?.type === "excalidrawlib";

export const piecesFromExcalidrawLibrary = (parsed) => {
    const items =
        parsed.version === 1 || Array.isArray(parsed.library)
            ? (parsed.library ?? []).map((elements, index) => ({ name: `Item ${index + 1}`, elements }))
            : (parsed.libraryItems ?? []).map((item, index) => ({ name: item.name || `Item ${index + 1}`, elements: item.elements ?? [] }));
    return items
        .slice(0, MAX_PIECES)
        .map((item) => {
            const elements = convertItem(item.elements);
            const ids = Object.keys(elements);
            return ids.length && ids.length <= MAX_ELEMENTS_PER_PIECE
                ? { name: String(item.name).slice(0, 60), elements: pieceFromSelection(elements, ids) }
                : null;
        })
        .filter(Boolean);
};
