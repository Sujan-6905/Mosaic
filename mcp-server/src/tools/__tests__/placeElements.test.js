import { describe, expect, it, vi } from "vitest";
import { placeElements } from "../common.js";

const box = (x, y) => ({
    type: "shape",
    shapeType: "Rectangle",
    startX: x,
    startY: y,
    endX: x + 100,
    endY: y + 40,
    color: "#000",
    size: 2,
    opacity: 100,
    zIndex: 1,
    rotation: 0,
});

describe("placeElements", () => {
    it("moves the agent's cursor to the placement, then to each box as it is drawn", async () => {
        const writes = [];
        const session = {
            ensureReady: async () => {},
            assertCanEdit: () => {},
            listElements: () => new Map(),
            writeElement: async (op, id) => writes.push(id),
            moveCursor: vi.fn(async (x, y) => writes.push(`cursor ${x},${y}`)),
        };
        await placeElements(
            session,
            [
                { elementId: "a", element: box(0, 0) },
                { elementId: "b", element: box(200, 0) },
            ],
            { x: 500, y: 300 },
        );
        expect(writes).toEqual(["cursor 500,300", "cursor 400,300", "a", "cursor 600,300", "b"]);
    });
});
