import { nodeTexts, fontSizeFor, shapeRoom } from "../nodeShapes.js";
import { GLYPHS } from "../glyphs.js";
import { nodeColours, stickyColour, inkFields, readableTextOn, categoryStrong, outcomeColours } from "./colors.js";
import { shapeElement, stickyElement, textElement, iconElement, regionElement, meta } from "./elements.js";

const LEADING_NUMBER = /^\s*(?:step\s*)?\d{1,3}\s*[.):-]?\s+/i;

// The silhouette names the engine uses, as the board's own shape types.
const SHAPE_TYPES = {
    box: "Rectangle",
    rounded: "Rectangle",
    pill: "Rectangle",
    circle: "Ellipse",
    "circle-wide": "Ellipse",
    hexagon: "Hexagon",
    cylinder: "Cylinder",
    person: "Person",
    browser: "Browser",
    phone: "Phone",
    folder: "Folder",
    queue: "Queue",
    cloud: "Cloud",
    diamond: "Diamond",
    document: "Document",
    triangle: "Triangle",
    iso: "IsoBlock",
    datastore: "DataStore",
    gateway: "Diamond",
    event: "Ellipse",
    "end-event": "Ellipse",
    dot: "Ellipse",
    target: "Ellipse",
    bar: "Rectangle",
    "and-gate": "AndGate",
    "or-gate": "OrGate",
    none: "Rectangle",
};

// Which glyph a node shows when the icons lever is on: its own icon, else one for its kind.
const KIND_GLYPHS = {
    database: "database",
    store: "database",
    queue: "list-ordered",
    person: "user",
    client: "monitor",
    phone: "smartphone",
    cloud: "cloud",
    service: "server",
    system: "boxes",
    gateway: "shield",
    external: "globe",
    document: "file-text",
    folder: "folder",
    event: "zap",
    decision: "workflow",
    task: "check",
    process: "cog",
    start: "flag",
    end: "target",
    note: "message-square",
    milestone: "flag",
};

const glyphFor = (node) => GLYPHS[node.icon] ?? GLYPHS[KIND_GLYPHS[node.kind]] ?? null;

const SHADOWS = { soft: "soft", hard: "hard", long: "long", glow: "glow" };

const cornerFor = (shape, look, h) => {
    if (shape === "pill") return h / 2;
    if (shape === "rounded" || shape === "sticky") return look.corner;
    if (shape === "hexagon") return Math.min(look.corner, 8);
    return 0;
};

// The data a Restyle reads back to rebuild the model without the model being asked again.
// A group's label rides on its nodes, since some structures draw no group of their own to read it back from.
const nodeData = (node, groupLabels) =>
    Object.fromEntries(
        Object.entries({
            label: node.label,
            detail: node.detail,
            kind: node.kind,
            group: node.sets.length > 1 ? node.sets.join(" & ") : node.group,
            groupLabel: node.sets.length > 1 ? null : groupLabels.get(node.group),
            parent: node.parent,
            value: node.value,
            start: node.start,
            end: node.end,
            x: node.x,
            y: node.y,
            status: node.status,
            owner: node.owner,
            tier: node.tier,
            lane: node.lane,
            icon: node.icon,
            root: node.root || null,
        }).filter(([, value]) => value !== null && value !== undefined && value !== ""),
    );

// Words on a fill keep the colour chosen for that fill; words straight on the
// board follow the theme like any other ink.
const textInk = (colours, onBoardGround) => {
    if (colours.fill || !onBoardGround) return { textColor: colours.text, textColorToken: null };
    const { color, colorToken } = inkFields(colours.text, true);
    return { textColor: color, textColorToken: colorToken };
};

export const paintNodes = (ctx) => {
    const { model, scene, style, categories, diagramId, recipe, newId, z, onBoardGround, font, highlighted, out } = ctx;
    const { look, levers, palette, structure } = style;
    const elementIdOf = new Map();
    const fontSize = fontSizeFor(levers, look);
    const groupLabels = new Map((model.groups ?? []).map((group) => [group.id, group.label]));

    model.nodes.forEach((node, order) => {
        const placed = scene.nodes[node.id];
        if (!placed) return;
        const shape = placed.shape ?? ctx.shapeOf(node);
        const slot = placed.category ?? categories.slotOf(node.id);
        const lit = highlighted.has(node.id);
        const outcome = structure.options?.tones ? outcomeColours(node.status, palette) : null;
        const colours =
            outcome ??
            (shape === "none" && placed.category !== undefined
                ? { ...nodeColours({ slot, node, palette, levers, highlighted: lit }), fill: null, text: categoryStrong(slot, palette) }
                : nodeColours({ slot, node, palette, levers, highlighted: lit }));
        const box = { minX: placed.cx - placed.w / 2, minY: placed.cy - placed.h / 2, maxX: placed.cx + placed.w / 2, maxY: placed.cy + placed.h / 2 };
        const id = newId();
        elementIdOf.set(node.id, id);
        const texts = nodeTexts(node, levers);
        // A step card shows its own number, so a label that starts with one would show it twice.
        const label = placed.number ? texts.label.replace(LEADING_NUMBER, "") || texts.label : texts.label;
        const { sub } = texts;
        const number = placed.number && structure.options?.notation === "dataflow" ? `${placed.number}. ` : "";
        const room = shapeRoom(shape);
        const showLabel = !placed.hideLabel && !placed.textOnly && !room.noLabel;
        const labelOutside = showLabel && room.fixed && room.labelBelow;
        const groupId = labelOutside || (levers.icons !== "none" && glyphFor(node)) || placed.number ? `${diagramId}:${node.id}` : null;
        const nodeMeta = meta(diagramId, "node", node.id, { order, recipe, data: nodeData(node, groupLabels) });
        const textFields = {
            text: showLabel && !labelOutside ? number + label : "",
            ...(sub && showLabel && !labelOutside ? { subtext: sub, subtextSize: Math.round(fontSize * 0.82) } : {}),
            fontSize,
            ...font,
            ...(look.fontWeight ? { fontWeight: look.fontWeight } : {}),
            ...(look.fontStyle ? { fontStyle: look.fontStyle } : {}),
            align: placed.textAlign ?? "center",
            verticalAlign: placed.textTop ? "top" : placed.textBottom || shape === "person" ? "bottom" : "middle",
            ...textInk(colours, onBoardGround),
        };

        if (placed.sticky || shape === "sticky" || look.sticky) {
            const fill = stickyColour(node, slot, palette);
            out.push({
                elementId: id,
                element: stickyElement({
                    ...box,
                    z: z(),
                    text: number + label + (sub ? `\n${sub}` : ""),
                    fillColor: fill,
                    color: readableTextOn(fill, "#1f2937"),
                    size: fontSize + 1,
                    ...font,
                    rotation: placed.tilt ? ((order * 37) % 7) - 3 : 0,
                    groupId,
                    ...nodeMeta,
                }),
            });
            return;
        }

        if (shape === "region") {
            const points =
                placed.ring ?? (placed.rings ? placed.rings[0].map((point) => ({ x: box.minX + point.x * placed.w, y: box.minY + point.y * placed.h })) : []);
            // A ring sector's own box centres on the chart's middle once it spans a half turn, so its words
            // go on their own at the point the layout chose for them.
            const labelApart = Boolean(placed.ring) && Boolean(textFields.text);
            const labelGroupId = labelApart ? (groupId ?? `${diagramId}:${node.id}`) : groupId;
            out.push({
                elementId: id,
                element: regionElement({
                    points,
                    z: z(),
                    ...inkFields(colours.stroke, onBoardGround),
                    size: palette.noStroke ? 0 : look.stroke,
                    fillColor: colours.fill ?? palette.pastels[slot % palette.pastels.length],
                    fillStyle: colours.fillStyle,
                    roughness: look.roughness,
                    ...textFields,
                    ...(labelApart ? { text: "", subtext: undefined } : {}),
                    groupId: labelGroupId,
                    ...nodeMeta,
                }),
            });
            if (labelApart)
                out.push({
                    elementId: newId(),
                    element: textElement({
                        x: placed.cx - placed.w / 2,
                        y: placed.cy - fontSize * 0.7,
                        width: placed.w,
                        text: textFields.text,
                        size: fontSize,
                        align: "center",
                        z: z(),
                        ...font,
                        color: colours.text,
                        colorToken: null,
                        groupId: labelGroupId,
                        ...meta(diagramId, "decor", `${node.id}:label`),
                    }),
                });
            return;
        }

        const filled = shape === "dot" || shape === "bar";
        const element = shapeElement({
            shapeType: SHAPE_TYPES[shape] ?? "Rectangle",
            ...box,
            z: z(),
            ...inkFields(colours.stroke, onBoardGround),
            size: shape === "none" || palette.noStroke ? 0 : shape === "end-event" ? look.stroke * 2.2 : outcome ? look.stroke * 1.6 : look.stroke,
            fillColor: filled ? colours.stroke : shape === "none" ? null : colours.fill,
            fillStyle: colours.fill && !filled ? colours.fillStyle : "solid",
            strokeStyle: palette.stitch ? "dashed" : "solid",
            cornerRadius: cornerFor(shape, look, box.maxY - box.minY),
            ...(look.roughness ? { roughness: look.roughness } : {}),
            ...(levers.depth !== "flat" && SHADOWS[levers.depth] && shape !== "none"
                ? { shadow: SHADOWS[levers.depth], shadowColor: palette.shadowColor ?? (levers.depth === "glow" ? colours.stroke : null) }
                : {}),
            ...textFields,
            ...(shape === "gateway" ? { text: "X", fontWeight: "bold" } : {}),
            ...(levers.icons === "leading" || levers.icons === "tile" ? { textInsetLeft: 34 } : {}),
            ...(levers.icons === "big" ? { textInsetTop: 40 } : placed.number && structure.family === "cards" ? { textInsetTop: 48 } : {}),
            groupId,
            ...nodeMeta,
        });
        out.push({ elementId: id, element });

        if (labelOutside) {
            const width = Math.max(120, ctx.metrics.textWidth(label, fontSize) + 8);
            out.push({
                elementId: newId(),
                element: textElement({
                    x: placed.cx - width / 2,
                    y: box.maxY + 6,
                    width,
                    text: label,
                    size: fontSize - 1,
                    align: "center",
                    z: z(),
                    ...inkFields(palette.text ?? palette.ink, onBoardGround),
                    ...font,
                    groupId,
                    ...meta(diagramId, "label", node.id),
                }),
            });
        }
        if (shape === "target") {
            const inset = (box.maxX - box.minX) * 0.26;
            out.push({
                elementId: newId(),
                element: shapeElement({
                    shapeType: "Ellipse",
                    minX: box.minX + inset,
                    minY: box.minY + inset,
                    maxX: box.maxX - inset,
                    maxY: box.maxY - inset,
                    z: z(),
                    ...inkFields(colours.stroke, onBoardGround),
                    fillColor: colours.stroke,
                    groupId,
                    ...meta(diagramId, "decor", `${node.id}:target`),
                }),
            });
        }
        paintNodeIcon(ctx, { node, placed, box, colours, slot, groupId });
        if (placed.number && structure.family === "cards") {
            out.push({
                elementId: newId(),
                element: textElement({
                    x: box.minX + 18,
                    y: box.minY + 14,
                    width: 80,
                    text: String(placed.number).padStart(2, "0"),
                    size: 30,
                    fontWeight: "bold",
                    z: z(),
                    ...inkFields(palette.accent, false),
                    ...font,
                    groupId,
                    ...meta(diagramId, "decor", `${node.id}:number`),
                }),
            });
        }
    });
    return elementIdOf;
};

const paintNodeIcon = (ctx, { node, placed, box, colours, slot, groupId }) => {
    const { style, out, newId, z, diagramId } = ctx;
    const { levers, palette } = style;
    const glyph = glyphFor(node);
    if (levers.icons === "none" || !glyph || placed.hideLabel) return;
    const tileColour = palette.colors[((slot % palette.colors.length) + palette.colors.length) % palette.colors.length];
    const iconMeta = meta(diagramId, "decor", `${node.id}:icon`);
    if (levers.icons === "tile") {
        const tile = { minX: box.minX + 6, minY: placed.cy - 14, maxX: box.minX + 34, maxY: placed.cy + 14 };
        out.push({
            elementId: newId(),
            element: shapeElement({
                shapeType: "Rectangle",
                ...tile,
                z: z(),
                color: tileColour,
                colorToken: null,
                size: 0,
                fillColor: tileColour,
                cornerRadius: 5,
                groupId,
                ...iconMeta,
            }),
        });
        out.push({
            elementId: newId(),
            element: iconElement({
                icon: glyph,
                cx: box.minX + 20,
                cy: placed.cy,
                size: 18,
                color: readableTextOn(tileColour, "#ffffff"),
                z: z(),
                groupId,
                ...meta(diagramId, "decor", `${node.id}:glyph`),
            }),
        });
        return;
    }
    const positions = {
        badge: { cx: box.minX + 14, cy: box.minY + 14, size: 16 },
        leading: { cx: box.minX + 22, cy: placed.cy, size: 20 },
        big: { cx: placed.cx, cy: box.minY + 30, size: 34 },
    };
    const spot = positions[levers.icons];
    out.push({ elementId: newId(), element: iconElement({ icon: glyph, ...spot, color: colours.stroke, z: z(), groupId, ...iconMeta }) });
};
