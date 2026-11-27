import { shapeElement, textElement, frameElement, meta } from "./elements.js";
import { inkFields, groupTint, categoryStrong, readableTextOn } from "./colors.js";
import { contrastRatio } from "../../color/contrast.js";

const FAINT_TINT_CONTRAST = 1.15;

const HEADER_TEXT = 13;

// The group shapes behind a diagram, back to front: biggest first so a nested
// ring or zone stays visible on top of the one holding it.
export const paintGroups = (ctx) => {
    const { scene, style, diagramId, newId, z, onBoardGround, font, out, model } = ctx;
    const { levers, palette, look } = style;
    const frameIdOf = new Map();
    const area = (group) => (group.maxX - group.minX) * (group.maxY - group.minY);
    const ordered = [...scene.groups].sort((a, b) => area(b) - area(a));
    const ink = palette.text ?? palette.ink;
    const groupMeta = (group) => meta(diagramId, "group", group.id, { data: { label: group.label, kind: group.kind } });
    const header = (group, x, y, width, extra = {}) =>
        group.label &&
        out.push({
            elementId: newId(),
            element: textElement({
                x,
                y,
                width,
                text: `${group.label}${levers.counts && group.count !== undefined ? ` (${group.count})` : ""}`,
                size: HEADER_TEXT,
                fontWeight: "bold",
                z: z(),
                ...inkFields(extra.color ?? ink, onBoardGround && !extra.color),
                ...font,
                ...meta(diagramId, "decor", `${group.id}:title`),
                ...extra.fields,
            }),
        });

    ordered.forEach((group) => {
        const slot = group.category ?? group.depth ?? 0;
        const tint = groupTint(slot, palette);
        const box = { minX: group.minX, minY: group.minY, maxX: group.maxX, maxY: group.maxY };
        const id = newId();
        switch (group.kind) {
            case "frame":
            case "zone": {
                if (levers.grouping === "frame" || levers.grouping === "nested") {
                    out.push({
                        elementId: id,
                        element: frameElement({
                            ...box,
                            name: group.label,
                            z: z(),
                            ...inkFields(palette.muted, onBoardGround),
                            fillColor: levers.grouping === "nested" ? tint : null,
                            ...groupMeta(group),
                        }),
                    });
                    frameIdOf.set(group.id, id);
                    return;
                }
                // A band tinted near white disappears on a white board, so it keeps an outline.
                const outlined = levers.grouping !== "band" || contrastRatio(tint, "#ffffff") < FAINT_TINT_CONTRAST;
                out.push({
                    elementId: id,
                    element: shapeElement({
                        shapeType: "Rectangle",
                        ...box,
                        z: z(),
                        ...inkFields(outlined ? palette.muted : tint, onBoardGround),
                        size: outlined ? 1.5 : 0,
                        strokeStyle: "dashed",
                        fillColor: levers.grouping === "band" ? tint : null,
                        cornerRadius: look.corner,
                        opacity: levers.grouping === "band" ? 70 : 100,
                        ...groupMeta(group),
                    }),
                });
                header(group, box.minX + 12, box.minY + 8, box.maxX - box.minX - 24);
                return;
            }
            case "boundary":
            case "sequence-frame": {
                out.push({
                    elementId: id,
                    element: shapeElement({
                        shapeType: "Rectangle",
                        ...box,
                        z: z(),
                        ...inkFields(palette.muted, onBoardGround),
                        size: 1.6,
                        strokeStyle: group.solid || group.kind === "sequence-frame" ? "solid" : "dashed",
                        cornerRadius: group.kind === "boundary" ? look.corner : 0,
                        ...groupMeta(group),
                    }),
                });
                header(group, box.minX + 12, box.minY + 8, Math.min(320, box.maxX - box.minX - 24));
                return;
            }
            case "band":
            case "lane":
            case "column":
            case "quadrant":
            case "block":
            case "cluster": {
                const banded = group.kind === "band" || group.kind === "quadrant" || group.kind === "block" || palette.groupTint;
                const fill = banded ? tint : null;
                out.push({
                    elementId: id,
                    element: shapeElement({
                        shapeType: "Rectangle",
                        ...box,
                        z: z(),
                        ...inkFields(palette.muted, onBoardGround),
                        size: group.kind === "cluster" ? 0 : 1,
                        fillColor: fill,
                        opacity: banded ? 80 : 100,
                        cornerRadius: group.kind === "cluster" || group.kind === "column" ? look.corner : 0,
                        ...groupMeta(group),
                    }),
                });
                if (group.headerSide === "left") {
                    header(group, box.minX + 12, (box.minY + box.maxY) / 2 - 10, (group.headerWidth ?? 140) - 24, {
                        color: fill ? readableTextOn(fill, ink) : null,
                    });
                } else {
                    header(group, box.minX + 12, box.minY + 10, box.maxX - box.minX - 24, {
                        color: fill ? readableTextOn(fill, ink) : null,
                        fields: group.kind === "cluster" ? { size: 18, ...ctx.handFont } : {},
                    });
                }
                if (group.letter) {
                    out.push({
                        elementId: newId(),
                        element: textElement({
                            x: box.maxX - 60,
                            y: box.minY + 6,
                            width: 50,
                            text: group.letter,
                            size: 40,
                            fontWeight: "bold",
                            align: "right",
                            z: z(),
                            ...inkFields(categoryStrong(slot, palette), false),
                            opacity: 60,
                            ...font,
                            ...meta(diagramId, "decor", `${group.id}:letter`),
                        }),
                    });
                }
                return;
            }
            case "circle":
            case "ring": {
                const fill = group.kind === "ring" ? groupTint(group.ring ?? 0, palette) : tint;
                out.push({
                    elementId: id,
                    element: shapeElement({
                        shapeType: "Ellipse",
                        ...box,
                        z: z(),
                        ...inkFields(group.kind === "circle" ? categoryStrong(slot, palette) : palette.muted, onBoardGround),
                        size: 1.6,
                        fillColor: fill,
                        opacity: group.kind === "circle" ? 55 : 85,
                        ...groupMeta(group),
                    }),
                });
                const width = Math.min(260, box.maxX - box.minX);
                const y = group.labelTop || group.kind === "ring" ? box.minY + 10 : box.minY - 26;
                header(group, (box.minX + box.maxX) / 2 - width / 2, y, width, { fields: { align: "center" } });
                return;
            }
            case "tile": {
                out.push({
                    elementId: id,
                    element: shapeElement({
                        shapeType: "Rectangle",
                        ...box,
                        z: z(),
                        ...inkFields(palette.ground ?? "#ffffff", false),
                        size: 2,
                        fillColor: tint,
                        ...groupMeta(group),
                    }),
                });
                return;
            }
            case "slab": {
                out.push({
                    elementId: id,
                    element: shapeElement({
                        shapeType: "IsoBlock",
                        ...box,
                        z: z(),
                        ...inkFields(palette.muted, onBoardGround),
                        size: 1.2,
                        fillColor: tint,
                        ...groupMeta(group),
                    }),
                });
                header(group, box.minX + 16, box.maxY - 26, 260);
                return;
            }
            default:
                out.push({
                    elementId: id,
                    element: shapeElement({ shapeType: "Rectangle", ...box, z: z(), ...inkFields(palette.muted, onBoardGround), size: 1, ...groupMeta(group) }),
                });
        }
    });

    // Nodes inside a frame belong to it, the way they would if dropped in by hand.
    model.nodes.forEach((node) => {
        const frameId = node.group ? frameIdOf.get(node.group) : null;
        if (frameId) ctx.frameOfNode.set(node.id, frameId);
    });
    model.groups.forEach((group) => {
        if (group.parent && frameIdOf.get(group.id) && frameIdOf.get(group.parent)) ctx.frameOfFrame.set(frameIdOf.get(group.id), frameIdOf.get(group.parent));
    });
};
