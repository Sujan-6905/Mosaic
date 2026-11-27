import { describe, expect, it } from "vitest";
import { buildOpsPreview, describeOperation } from "../operationSummary.js";
import { colorName } from "../../turn/colorNames.js";

const names = new Map([
    ["obj_pg", "PostgreSQL"],
    ["obj_redis", "Redis"],
]);
const restyle = (props) => ({ op: "restyle", ref: "obj_pg", props });

describe("restyle summaries", () => {
    it("say what changes in everyday words", () => {
        expect(describeOperation(restyle({ fillColor: "#22c55e" }), names)).toBe('Fill "PostgreSQL" green');
        expect(describeOperation(restyle({ fillColor: null }), names)).toBe('Clear the fill of "PostgreSQL"');
        expect(describeOperation(restyle({ color: "#ef4444", font: "hand" }), names)).toBe(
            'Make "PostgreSQL"\'s lines and text red and set it in a handwritten font',
        );
        expect(describeOperation(restyle({ opacity: 60 }), names)).toBe('Fade "PostgreSQL" to 60%');
    });

    it("carry the new colour for the review card's swatch", () => {
        const preview = buildOpsPreview([restyle({ fillColor: "green" }), { op: "connect", refA: "obj_pg", refB: "obj_redis" }], names, [
            { applied: true, updatedById: { a: {} } },
            { applied: true, newElementsById: { b: {} } },
        ]);
        expect(preview[0]).toMatchObject({ summary: 'Fill "PostgreSQL" green', swatch: "#22c55e" });
        expect(preview[1].swatch).toBeUndefined();
    });
});

describe("colorName", () => {
    it("names the nearest everyday colour, and nothing for what isn't a colour", () => {
        expect(colorName("#1f9d55")).toBe("green");
        expect(colorName("#9ca3af")).toBe("grey");
        expect(colorName("#dcfce7")).toBe("light green");
        expect(colorName("#d9ead3")).toBe("light green");
        expect(colorName("#ffffff")).toBe("white");
        expect(colorName("#7f1d1d")).toBe("dark red");
        expect(colorName("not a colour")).toBeNull();
    });
});
