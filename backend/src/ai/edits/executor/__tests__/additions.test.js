import { describe, it, expect } from "vitest";
import { buildGroupIndex, executeOperation } from "../index.js";
import { tableElementSchema } from "../../../../validation/tableSchema.js";
import { elementSchema } from "../../../../validation/socketSchemas.js";

const box = { type: "shape", shapeType: "Rectangle", startX: 0, startY: 0, endX: 100, endY: 100, color: "#000", size: 2, opacity: 100, zIndex: 3, rotation: 0 };
const added = (result) => Object.values(result.newElementsById);

describe("add", () => {
    const empty = buildGroupIndex([]);

    it("builds a table from rows, the first row as headings", () => {
        const result = executeOperation({}, empty, {
            op: "add",
            kind: "table",
            text: "",
            rows: [
                ["Name", "Role", "Email"],
                ["Asha", "Design"],
            ],
        });
        const [table] = added(result);
        expect(table).toMatchObject({ type: "table", rows: 2, cols: 3, headerRow: true, cells: ["Name", "Role", "Email", "Asha", "Design", ""] });
        expect(tableElementSchema.safeParse(table).success).toBe(true);
    });

    it("places a named icon, and says which names exist for an unknown one", () => {
        const [icon] = added(executeOperation({}, empty, { op: "add", kind: "icon", text: "Rocket" }));
        expect(icon).toMatchObject({ type: "shape", shapeType: "Icon" });
        expect(elementSchema.safeParse(icon).success).toBe(true);
        expect(executeOperation({}, empty, { op: "add", kind: "icon", text: "unicorn" }).error).toMatch(/no icon named "unicorn".*rocket/);
    });

    it("writes words in the colour and size asked for", () => {
        const [text] = added(executeOperation({}, empty, { op: "add", kind: "text", text: "Hello world", color: "#e03131", textSize: "huge" }));
        expect(text).toMatchObject({ color: "#e03131", colorToken: null, size: 48 });
        expect(text.width).toBeGreaterThan(220);
    });
});

describe("frame", () => {
    it("draws a named frame around its refs, behind them, holding them", () => {
        const elements = { a: box, b: { ...box, startX: 200, endX: 300 } };
        const result = executeOperation(
            elements,
            buildGroupIndex([
                { ref: "obj_a", memberElementIds: ["a"] },
                { ref: "obj_b", memberElementIds: ["b"] },
            ]),
            {
                op: "frame",
                refs: ["obj_a", "obj_b"],
                name: "Backlog",
            },
        );
        const [[frameId, frame]] = Object.entries(result.newElementsById);
        expect(frame).toMatchObject({ type: "frame", name: "Backlog", startX: -40, endX: 340 });
        expect(frame.zIndex).toBeLessThan(box.zIndex);
        expect(result.updatedById.a.frameId).toBe(frameId);
        expect(elementSchema.safeParse(frame).success).toBe(true);
    });
});
