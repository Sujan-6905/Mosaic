import { colorTokenFor } from "../../color/colorTokens.js";
import { GLYPHS } from "../../diagramStyles/glyphs.js";

// Builders for the pieces every board offers, written as code rather than
// stored so they always match the current element shapes.
export const INK = "#000000";
const INK_TOKEN = colorTokenFor(INK) ?? null;
export const SOFT = { blue: "#dbeafe", green: "#dcfce7", amber: "#fef3c7", rose: "#ffe4e6", slate: "#f1f5f9", violet: "#ede9fe" };

let z = 0;
const base = () => ({ zIndex: (z += 1), rotation: 0, groupId: null, frameId: null, locked: false, opacity: 100 });

export const shape = (shapeType, x, y, w, h, extra = {}) => ({
    type: "shape",
    shapeType,
    startX: x,
    startY: y,
    endX: x + w,
    endY: y + h,
    color: INK,
    colorToken: INK_TOKEN,
    fillColor: null,
    size: 2,
    fontSize: 15,
    ...base(),
    // A pastel fill has no theme token, so its words keep dark ink in either theme.
    ...(extra.fillColor ? { textColor: INK, textColorToken: null } : {}),
    ...extra,
});

const arrow = (from, to, startElementId, endElementId, extra = {}) => ({
    type: "connector",
    startX: from.x,
    startY: from.y,
    endX: to.x,
    endY: to.y,
    startElementId,
    endElementId,
    color: INK,
    colorToken: INK_TOKEN,
    size: 2,
    arrowStart: false,
    arrowEnd: true,
    startHead: "none",
    endHead: "triangle",
    ...base(),
    ...extra,
});

export const sticky = (x, y, text, fillColor, size = 140) => ({
    type: "sticky",
    x,
    y,
    width: size,
    height: size,
    text,
    color: "#1f2937",
    fillColor,
    size: 16,
    align: "left",
    ...base(),
});

export const frame = (x, y, w, h, name) => ({ type: "frame", startX: x, startY: y, endX: x + w, endY: y + h, name, color: "#94a3b8", ...base(), zIndex: 0 });

export const text = (x, y, value, size = 16, extra = {}) => ({
    type: "text",
    x,
    y,
    width: Math.max(40, value.length * size * 0.6),
    autoWidth: true,
    text: value,
    color: INK,
    colorToken: INK_TOKEN,
    size,
    align: "left",
    ...base(),
    ...extra,
});

export const piece = (name, elements) => ({
    id: `starter-${name.toLowerCase().replace(/\W+/g, "-")}`,
    name,
    elements: Object.fromEntries(elements.map((element, i) => [`s${i}`, element])),
});

export const linked = (elements, links) => {
    const result = elements.map((element) => ({ ...element }));
    links.forEach(([fromIndex, toIndex, label]) => {
        const a = result[fromIndex];
        const b = result[toIndex];
        const centre = (el) => ({ x: (el.startX + el.endX) / 2, y: (el.startY + el.endY) / 2 });
        result.push(arrow(centre(a), centre(b), `s${fromIndex}`, `s${toIndex}`, label ? { text: label, fontSize: 12 } : {}));
    });
    return result;
};

// A straight line between two points (shape() takes a box, not two ends).
export const line = (x1, y1, x2, y2, extra = {}) => ({ ...shape("Line", x1, y1, 0, 0, extra), endX: x2, endY: y2 });

// A line icon from the diagram glyphs, in the board's ink.
export const icon = (name, x, y, size = 32, extra = {}) => ({
    type: "shape",
    shapeType: "Icon",
    startX: x,
    startY: y,
    endX: x + size,
    endY: y + size,
    color: INK,
    colorToken: INK_TOKEN,
    size: 0,
    fillColor: null,
    icon: GLYPHS[name],
    ...base(),
    ...extra,
});

// An icon over its name, the way infrastructure and cloud parts are usually drawn.
export const iconTile = (name, label, extra = {}) => [
    shape("Rectangle", 0, 0, 120, 100, { cornerRadius: 12, size: 1.5, fillColor: extra.fill ?? null }),
    icon(name, 44, 16, 32),
    { ...text(0, 62, label, 13), width: 120, autoWidth: false, align: "center" },
];

export const set = (id, title, description, pieces) => ({ _id: `kit-${id}`, title, description, starter: true, kit: true, pieces });
