import { z } from "zod";
import { getElementBounds } from "../../../shared/canvas/geometry/bounds.js";
import { colorTokenFor } from "../../../shared/canvas/color/colorTokens.js";
import { translateElement } from "../../../shared/canvas/geometry/elementGeometry.js";
import { nextZIndex } from "../../../shared/canvas/editing/zOrder.js";

export const json = (data) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });

export const shareIdField = z
    .string()
    .min(1)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "A shareId uses letters, numbers, dashes and underscores")
    .describe("The board's shareId, e.g. from list_boards or create_board");

export const placementFields = {
    x: z.number().optional().describe("Where the centre lands; defaults to just right of the board's existing content"),
    y: z.number().optional().describe("Where the centre lands; defaults to the vertical middle of the existing content"),
};

const PLACEMENT_GAP = 120;

const unionBounds = (elements) =>
    elements
        .map(getElementBounds)
        .filter(Boolean)
        .reduce(
            (box, b) => ({
                minX: Math.min(box.minX, b.minX),
                minY: Math.min(box.minY, b.minY),
                maxX: Math.max(box.maxX, b.maxX),
                maxY: Math.max(box.maxY, b.maxY),
            }),
            { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
        );

// Places elements built around (0, 0) at a point or beside existing content, above everything,
// with colour tokens filled in so they follow the viewer's theme.
// The agent's cursor visits each box it draws, so people see who is drawing what; a line follows its ends.
export const showWorkAt = async (session, element) => {
    if (element.type === "connector") return;
    const box = unionBounds([element]);
    if (Number.isFinite(box.minX)) await session.moveCursor((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2);
};

export const placeElements = async (session, entries, { x, y } = {}) => {
    await session.ensureReady();
    session.assertCanEdit();
    const content = unionBounds(entries.map(({ element }) => element));
    const existing = unionBounds([...session.listElements().values()]);
    const hasExisting = Number.isFinite(existing.minX);
    const width = content.maxX - content.minX;
    const centreX = x ?? (hasExisting ? existing.maxX + PLACEMENT_GAP + width / 2 : 0);
    const centreY = y ?? (hasExisting ? (existing.minY + existing.maxY) / 2 : 0);
    const dx = centreX - (content.minX + content.maxX) / 2;
    const dy = centreY - (content.minY + content.maxY) / 2;
    const zBase = nextZIndex([...session.listElements().values()]);

    await session.moveCursor(centreX, centreY);
    const placed = [];
    for (const { elementId, element } of entries) {
        const moved = translateElement(element, dx, dy);
        await showWorkAt(session, moved);
        const tokens = {
            ...(moved.color && moved.colorToken === undefined ? { colorToken: colorTokenFor(moved.color) ?? null } : {}),
            ...(moved.fillColor && moved.fillColorToken === undefined ? { fillColorToken: colorTokenFor(moved.fillColor) ?? null } : {}),
        };
        await session.writeElement("insert", elementId, { ...moved, ...tokens, zIndex: zBase + (element.zIndex ?? 0) });
        placed.push(elementId);
    }
    return { elementIds: placed, bounds: { minX: content.minX + dx, minY: content.minY + dy, maxX: content.maxX + dx, maxY: content.maxY + dy } };
};
