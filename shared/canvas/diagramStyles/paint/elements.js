import { withConnectorHeads } from "../../elements/connectors.js";
import { fontFieldsFor } from "../../elements/fontSources.js";

// Diagrams are drawn with ordinary shapes, text, stickies, frames and connectors,
// each carrying a small `diagram` note naming its diagram and what it stands for.

const TYPE_FONTS = { hand: "Kalam", sans: null, mono: "JetBrains Mono", serif: "Fraunces" };

// The look's own typeface when the type lever is the look's own voice,
// otherwise the lever's family.
export const fontFor = (look, levers) => {
    const natural = look.levers.type ?? "sans";
    const family = levers.type === natural ? look.font : TYPE_FONTS[levers.type];
    if (!family) return {};
    const fields = fontFieldsFor(family);
    return fields.error || fields.fileLink ? {} : { fontFamily: fields.fontFamily, fontSource: fields.fontSource ?? null };
};

export const createZCounter = (start = 0) => {
    let z = start;
    return () => (z += 1);
};

const base = (zIndex) => ({ zIndex, rotation: 0, groupId: null, frameId: null, locked: false, opacity: 100 });

export const meta = (diagramId, role, key, extra = {}) => ({ diagram: { id: diagramId, role, key, ...extra } });

export const shapeElement = ({ shapeType, minX, minY, maxX, maxY, z, ...rest }) => ({
    type: "shape",
    shapeType,
    startX: minX,
    startY: minY,
    endX: maxX,
    endY: maxY,
    size: 2,
    fillColor: null,
    ...base(z),
    ...rest,
});

export const textElement = ({ x, y, width, text, z, size = 14, align = "left", ...rest }) => ({
    type: "text",
    x,
    y,
    width: Math.max(20, width),
    text,
    size,
    align,
    ...base(z),
    ...rest,
});

export const stickyElement = ({ minX, minY, maxX, maxY, text, z, ...rest }) => ({
    type: "sticky",
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    text,
    size: 15,
    align: "center",
    ...base(z),
    ...rest,
});

export const frameElement = ({ minX, minY, maxX, maxY, name, z, ...rest }) => ({
    type: "frame",
    startX: minX,
    startY: minY,
    endX: maxX,
    endY: maxY,
    name: name.slice(0, 100),
    ...base(z),
    ...rest,
});

// A connector between two points, bound to elements when ids are given.
export const connectorElement = ({ start, end, startElementId = null, endElementId = null, z, startHead = "none", endHead = "none", ...rest }) => ({
    type: "connector",
    startX: start.x,
    startY: start.y,
    endX: end.x,
    endY: end.y,
    startElementId,
    endElementId,
    size: 2,
    ...withConnectorHeads({ startHead, endHead }),
    ...base(z),
    ...rest,
});

// A polygon as a Region shape, whose rings live in its own 0-1 box.
export const regionElement = ({ points, z, ...rest }) => {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const [minX, minY, maxX, maxY] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const width = maxX - minX || 1;
    const height = maxY - minY || 1;
    return shapeElement({
        shapeType: "Region",
        minX,
        minY,
        maxX,
        maxY,
        z,
        rings: [points.map((point) => ({ x: (point.x - minX) / width, y: (point.y - minY) / height }))],
        ...rest,
    });
};

export const iconElement = ({ icon, cx, cy, size, color, z, ...rest }) =>
    shapeElement({
        shapeType: "Icon",
        minX: cx - size / 2,
        minY: cy - size / 2,
        maxX: cx + size / 2,
        maxY: cy + size / 2,
        z,
        color,
        size: 0,
        icon,
        ...rest,
    });
