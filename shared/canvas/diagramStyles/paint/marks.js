import { shapeElement, textElement, connectorElement, regionElement, meta } from "./elements.js";
import { inkFields, categoryStrong } from "./colors.js";

const BRACE_SAMPLES = 24;

const braceOutline = (x, minY, maxY) => {
    const mid = (minY + maxY) / 2;
    const depth = 14;
    const points = [];
    for (let i = 0; i <= BRACE_SAMPLES; i += 1) {
        const t = i / BRACE_SAMPLES;
        const y = minY + (maxY - minY) * t;
        const bulge = Math.sin(t * Math.PI) * 0.35 + (Math.abs(y - mid) < (maxY - minY) * 0.06 ? 1 : 0);
        points.push({ x: x + depth * (1 - bulge) - depth / 2, y });
    }
    return points;
};

const toneColour = (mark, palette) => {
    if (mark.tone === "accent") return palette.accent;
    if (mark.tone === "muted") return palette.muted;
    if (mark.tone === "category") return categoryStrong(mark.category ?? 0, palette);
    return palette.text ?? palette.ink;
};

export const paintMarks = (ctx, { behind }) => {
    const { scene, style, diagramId, newId, z, onBoardGround, font, out } = ctx;
    const { palette, look } = style;
    scene.marks
        .filter((mark) => Boolean(mark.behind) === behind)
        .forEach((mark, index) => {
            const colour = toneColour(mark, palette);
            const ink = inkFields(colour, onBoardGround);
            const key = `mark:${behind ? "b" : "f"}${index}`;
            const markMeta = meta(diagramId, "decor", key, { tone: mark.tone ?? "ink", ...(mark.category !== undefined ? { category: mark.category } : {}) });
            switch (mark.type) {
                case "line":
                case "polyline":
                case "curve": {
                    const [start, ...rest] = mark.points;
                    const end = rest.pop();
                    out.push({
                        elementId: newId(),
                        element: connectorElement({
                            start,
                            end,
                            z: z(),
                            waypoints: rest.length ? rest : null,
                            routing: mark.type === "curve" ? "curved" : "straight",
                            ...ink,
                            size: mark.width ?? 1.4,
                            opacity: mark.faint ? 45 : 100,
                            strokeStyle: mark.dashed ? "dashed" : "solid",
                            endHead: mark.head ? "triangle" : "none",
                            ...(mark.label ? { text: mark.label, fontSize: 11, labelT: 0.92 } : {}),
                            ...markMeta,
                        }),
                    });
                    return;
                }
                case "text": {
                    const width = Math.max(40, ctx.metrics.textWidth(mark.text, mark.size ?? 13) * (mark.weight === "bold" ? 1.12 : 1) + 10);
                    const x = mark.align === "right" ? mark.x - width : mark.align === "center" ? mark.x - width / 2 : mark.x + (mark.offset ?? 0);
                    out.push({
                        elementId: newId(),
                        element: textElement({
                            x,
                            y: mark.y - (mark.size ?? 13) * 0.65,
                            width,
                            text: mark.text,
                            size: mark.size ?? 13,
                            align: mark.align ?? "left",
                            fontWeight: mark.weight ?? "normal",
                            z: z(),
                            ...ink,
                            ...font,
                            ...markMeta,
                        }),
                    });
                    return;
                }
                case "dot":
                case "loop": {
                    const radius = mark.type === "loop" ? 16 : 7;
                    out.push({
                        elementId: newId(),
                        element: shapeElement({
                            shapeType: "Ellipse",
                            minX: mark.x - radius,
                            minY: mark.y - radius,
                            maxX: mark.x + radius,
                            maxY: mark.y + radius,
                            z: z(),
                            ...ink,
                            size: mark.type === "loop" ? 2 : 0,
                            fillColor: mark.type === "loop" ? null : colour,
                            ...(mark.text ? { text: mark.text, fontSize: 13, fontWeight: "bold", textColor: colour } : {}),
                            ...markMeta,
                        }),
                    });
                    return;
                }
                case "brace":
                    out.push({
                        elementId: newId(),
                        element: {
                            type: "path",
                            points: braceOutline(mark.x, mark.minY, mark.maxY),
                            ...ink,
                            size: look.stroke,
                            opacity: 100,
                            zIndex: z(),
                            rotation: 0,
                            groupId: null,
                            frameId: null,
                            locked: false,
                            ...markMeta,
                        },
                    });
                    return;
                case "triangle":
                    out.push({
                        elementId: newId(),
                        element: shapeElement({
                            shapeType: "Triangle",
                            minX: mark.x - 18,
                            minY: mark.y - 16,
                            maxX: mark.x + 18,
                            maxY: mark.y + 16,
                            z: z(),
                            ...ink,
                            size: 1.6,
                            fillColor: palette.accent,
                            ...(mark.text ? { text: mark.text, fontSize: 10, verticalAlign: "bottom" } : {}),
                            ...markMeta,
                        }),
                    });
                    return;
                case "activation":
                    out.push({
                        elementId: newId(),
                        element: shapeElement({
                            shapeType: "Rectangle",
                            minX: mark.x - mark.width / 2,
                            minY: mark.minY,
                            maxX: mark.x + mark.width / 2,
                            maxY: mark.maxY,
                            z: z(),
                            ...ink,
                            size: 1.2,
                            fillColor: palette.pastels[0],
                            ...markMeta,
                        }),
                    });
                    return;
                case "sidecar":
                    out.push({
                        elementId: newId(),
                        element: shapeElement({
                            shapeType: "Rectangle",
                            minX: mark.x - 9,
                            minY: mark.y - 9,
                            maxX: mark.x + 9,
                            maxY: mark.y + 9,
                            z: z(),
                            ...inkFields(palette.muted, onBoardGround),
                            size: 1,
                            fillColor: palette.accent,
                            cornerRadius: 3,
                            ...markMeta,
                        }),
                    });
                    return;
                case "band":
                    out.push({
                        elementId: newId(),
                        element: regionElement({
                            points: mark.points,
                            z: z(),
                            color: categoryStrong(mark.category ?? 0, palette),
                            colorToken: null,
                            size: 0,
                            fillColor: categoryStrong(mark.category ?? 0, palette),
                            opacity: 42,
                            ...markMeta,
                        }),
                    });
                    return;
                case "cell":
                    out.push({
                        elementId: newId(),
                        element: shapeElement({
                            shapeType: "Rectangle",
                            minX: mark.minX + 3,
                            minY: mark.minY + 3,
                            maxX: mark.maxX - 3,
                            maxY: mark.maxY - 3,
                            z: z(),
                            ...ink,
                            size: 0,
                            fillColor: mark.emphasis ? palette.pastels[0] : null,
                            cornerRadius: 4,
                            text: mark.text,
                            fontSize: 16,
                            fontWeight: mark.emphasis ? "bold" : "normal",
                            textColor: palette.text ?? palette.ink,
                            ...font,
                            ...markMeta,
                        }),
                    });
                    return;
                default:
            }
        });
};
