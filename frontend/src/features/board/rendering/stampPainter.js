import { stampKindOf } from "../../../../../shared/canvas/elements/stamps.js";

const GLYPH_GRID = 24;
const GLYPH_SHARE = 0.62;

const discOf = (stamp) => {
    const size = Math.min(Math.abs(stamp.endX - stamp.startX), Math.abs(stamp.endY - stamp.startY));
    return { cx: (stamp.startX + stamp.endX) / 2, cy: (stamp.startY + stamp.endY) / 2, size };
};

const glyphPaths = new Map();
const glyphPath = (d) => {
    if (!glyphPaths.has(d)) glyphPaths.set(d, new Path2D(d));
    return glyphPaths.get(d);
};

export const paintStamp = (context, stamp) => {
    const kind = stampKindOf(stamp.kind);
    const { cx, cy, size } = discOf(stamp);
    context.save();
    context.globalAlpha = (stamp.opacity ?? 100) / 100;
    context.translate(cx, cy);
    if (stamp.rotation) context.rotate((stamp.rotation * Math.PI) / 180);
    context.shadowColor = "rgba(0, 0, 0, 0.2)";
    context.shadowBlur = size * 0.12;
    context.shadowOffsetY = size * 0.04;
    context.fillStyle = kind.color;
    context.beginPath();
    context.arc(0, 0, size / 2, 0, Math.PI * 2);
    context.fill();
    context.shadowColor = "transparent";
    if (kind.text) {
        context.fillStyle = kind.ink;
        context.font = `bold ${size * 0.42}px sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(kind.text, 0, size * 0.02);
    } else {
        const scale = (size * GLYPH_SHARE) / GLYPH_GRID;
        context.scale(scale, scale);
        context.translate(-GLYPH_GRID / 2, -GLYPH_GRID / 2);
        context.strokeStyle = kind.ink;
        context.lineWidth = 2.4;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.stroke(glyphPath(kind.glyph));
    }
    context.restore();
};

export const stampToSvg = (stamp) => {
    const kind = stampKindOf(stamp.kind);
    const { cx, cy, size } = discOf(stamp);
    const scale = (size * GLYPH_SHARE) / GLYPH_GRID;
    const mark = kind.text
        ? `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-weight="bold" font-size="${size * 0.42}" fill="${kind.ink}">${kind.text}</text>`
        : `<path d="${kind.glyph}" transform="translate(${cx - (GLYPH_GRID * scale) / 2} ${cy - (GLYPH_GRID * scale) / 2}) scale(${scale})" fill="none" stroke="${kind.ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />`;
    return `<g opacity="${(stamp.opacity ?? 100) / 100}"><circle cx="${cx}" cy="${cy}" r="${size / 2}" fill="${kind.color}" />${mark}</g>`;
};
