import { shapeElement, textElement, meta } from "./elements.js";
import { inkFields, categoryStrong, readableTextOn } from "./colors.js";

const GROUND_MARGIN = 56;
const DARK_GROUND = "#15171b";
const PAPER_GROUND = "#f6f1e7";

// A look with its own ground gets a backdrop behind the diagram; a patterned
// ground lays the pattern over it as a second, unfilled sheet.
export const paintGround = (ctx, bounds) => {
    const { style, diagramId, newId, z, out } = ctx;
    const { palette, levers } = style;
    const ground = palette.ground ?? (levers.ground === "dark" ? DARK_GROUND : levers.ground === "paper" ? PAPER_GROUND : null);
    const pattern = levers.ground === "dots" || levers.ground === "grid" || levers.ground === "lines" ? levers.ground : null;
    if (!ground && !pattern) return;
    const box = { minX: bounds.minX - GROUND_MARGIN, minY: bounds.minY - GROUND_MARGIN, maxX: bounds.maxX + GROUND_MARGIN, maxY: bounds.maxY + GROUND_MARGIN };
    if (ground)
        out.push({
            elementId: newId(),
            element: shapeElement({
                shapeType: "Rectangle",
                ...box,
                z: z(),
                color: ground,
                colorToken: null,
                size: 0,
                fillColor: ground,
                cornerRadius: 14,
                ...meta(diagramId, "ground", "ground"),
            }),
        });
    if (pattern)
        out.push({
            elementId: newId(),
            element: shapeElement({
                shapeType: "Rectangle",
                ...box,
                z: z(),
                color: palette.groundPattern ?? palette.muted,
                colorToken: null,
                size: 0,
                fillColor: palette.groundPattern ?? palette.muted,
                fillStyle: pattern,
                opacity: palette.groundPattern ? 100 : 35,
                cornerRadius: 14,
                ...meta(diagramId, "ground", "pattern"),
            }),
        });
};

const SWATCH = 16;

export const paintLegend = (ctx, bounds, categories) => {
    const { style, diagramId, newId, z, onBoardGround, font, out } = ctx;
    const { palette, levers } = style;
    if (!levers.legend) return;
    const ink = inkFields(palette.text ?? palette.ink, onBoardGround);
    const entries =
        levers.colorBy === "heat" && categories.range
            ? palette.colors.map((colour, index) => ({
                  colour,
                  label: index === 0 ? String(categories.range[0]) : index === palette.colors.length - 1 ? String(categories.range[1]) : "",
              }))
            : categories.keys.slice(0, 8).map((key, index) => ({
                  colour: palette.fillCycle ? palette.ink : categoryStrong(index, palette),
                  fillStyle: palette.fillCycle?.[index % palette.fillCycle.length],
                  label: typeof key === "number" ? `Group ${key + 1}` : String(key),
              }));
    if (entries.length === 0) return;
    let y = bounds.maxY + 28;
    const x = bounds.minX;
    out.push({
        elementId: newId(),
        element: textElement({
            x,
            y,
            width: 200,
            text: levers.colorBy === "heat" ? "Scale" : "Key",
            size: 12,
            fontWeight: "bold",
            z: z(),
            ...ink,
            ...font,
            ...meta(diagramId, "decor", "legend:title"),
        }),
    });
    y += 22;
    entries.forEach((entry, index) => {
        const left = levers.colorBy === "heat" ? x + index * (SWATCH + 2) : x;
        const top = levers.colorBy === "heat" ? y : y + index * (SWATCH + 8);
        out.push({
            elementId: newId(),
            element: shapeElement({
                shapeType: "Rectangle",
                minX: left,
                minY: top,
                maxX: left + SWATCH,
                maxY: top + SWATCH,
                z: z(),
                color: entry.colour,
                colorToken: null,
                size: 1,
                fillColor: entry.colour,
                fillStyle: entry.fillStyle && entry.fillStyle !== "none" ? entry.fillStyle : "solid",
                cornerRadius: 3,
                ...meta(diagramId, "decor", `legend:${index}`),
            }),
        });
        if (entry.label)
            out.push({
                elementId: newId(),
                element: textElement({
                    x: levers.colorBy === "heat" ? left - 4 : left + SWATCH + 8,
                    y: levers.colorBy === "heat" ? top + SWATCH + 4 : top,
                    width: 160,
                    text: entry.label,
                    size: 12,
                    z: z(),
                    ...ink,
                    ...font,
                    ...meta(diagramId, "decor", `legend:label:${index}`),
                }),
            });
    });
};

export const paintCallouts = (ctx) => {
    const { scene, style, diagramId, newId, z, model, out } = ctx;
    if (!style.levers.callouts) return;
    model.nodes.forEach((node, index) => {
        const placed = scene.nodes[node.id];
        if (!placed) return;
        const cx = placed.cx - placed.w / 2;
        const cy = placed.cy - placed.h / 2;
        out.push({
            elementId: newId(),
            element: shapeElement({
                shapeType: "Ellipse",
                minX: cx - 12,
                minY: cy - 12,
                maxX: cx + 12,
                maxY: cy + 12,
                z: z(),
                color: style.palette.accent,
                colorToken: null,
                size: 0,
                fillColor: style.palette.accent,
                text: String(index + 1),
                fontSize: 12,
                fontWeight: "bold",
                textColor: readableTextOn(style.palette.accent, "#1f2937"),
                groupId: `${diagramId}:${node.id}`,
                ...meta(diagramId, "decor", `${node.id}:callout`),
            }),
        });
    });
};

export const paintTitle = (ctx, bounds) => {
    const { model, style, diagramId, newId, z, onBoardGround, font, out } = ctx;
    if (!model.title) return;
    out.push({
        elementId: newId(),
        element: textElement({
            x: bounds.minX,
            y: bounds.minY - 56,
            width: Math.max(240, bounds.maxX - bounds.minX),
            text: style.levers.caps ? model.title.toUpperCase() : model.title,
            size: 22,
            fontWeight: "bold",
            z: z(),
            ...inkFields(style.palette.text ?? style.palette.ink, onBoardGround),
            ...font,
            ...meta(diagramId, "title", "title", { data: { label: model.title.slice(0, 400) } }),
        }),
    });
};
