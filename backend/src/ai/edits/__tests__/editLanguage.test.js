import { describe, it, expect } from "vitest";
import { validateEditBatch, OPERATION_NAMES } from "../editLanguage.js";
import { buildGroupIndex, executeOperation } from "../executor/index.js";

describe("validateEditBatch", () => {
    it("accepts a batch of valid operations", () => {
        const result = validateEditBatch({
            ops: [
                { op: "place", ref: "obj_1", relation: "below", anchorRef: "obj_2" },
                { op: "restyle", ref: "obj_1", props: { color: "red" } },
            ],
        });
        expect(result.valid).toBe(true);
        expect(result.ops).toHaveLength(2);
    });

    it("rejects an operation carrying a raw coordinate field", () => {
        const result = validateEditBatch({ ops: [{ op: "place", ref: "obj_1", relation: "below", anchorRef: "obj_2", x: 100, y: 200 }] });
        expect(result.valid).toBe(false);
    });

    it("makes a coordinate literal unrepresentable in every operation, not just place", () => {
        OPERATION_NAMES.forEach((op) => {
            const withCoordinate = { op, x: 10, y: 20, width: 30, height: 40 };
            expect(validateEditBatch({ ops: [withCoordinate] }).valid).toBe(false);
        });
    });

    it("never throws on malformed input", () => {
        expect(() => validateEditBatch(null)).not.toThrow();
        expect(() => validateEditBatch({ ops: "not an array" })).not.toThrow();
        expect(() => validateEditBatch(undefined)).not.toThrow();
    });

    it("returns an actionable message, not a bare rejection", () => {
        const result = validateEditBatch({ ops: [{ op: "align", refs: [], edge: "left" }] });
        expect(result.valid).toBe(false);
        expect(result.error.length).toBeGreaterThan(0);
    });

    it("rejects an unknown operation name", () => {
        const result = validateEditBatch({ ops: [{ op: "teleport", ref: "obj_1" }] });
        expect(result.valid).toBe(false);
    });

    it("requires restyle to change at least one property", () => {
        const result = validateEditBatch({ ops: [{ op: "restyle", ref: "obj_1", props: {} }] });
        expect(result.valid).toBe(false);
    });

    // Every op's strict schema rejects any field it doesn't define (a URL, a script, an arbitrary key).
    it("rejects an operation carrying a field outside its own schema, even alongside otherwise-valid fields", () => {
        const result = validateEditBatch({ ops: [{ op: "restyle", ref: "obj_1", props: { color: "red" }, script: "alert(1)" }] });
        expect(result.valid).toBe(false);
    });

    it("every operation name the edit language accepts has a real executor - a schema-valid op can never silently do nothing", () => {
        // A bare { op } lacks its fields; this only checks that dispatch finds an executor.
        OPERATION_NAMES.forEach((op) => {
            try {
                const result = executeOperation({}, buildGroupIndex([]), { op });
                expect(result.error, op).not.toMatch(/no executor for operation/);
            } catch (error) {
                expect(error.message, op).not.toMatch(/no executor for operation/);
            }
        });
    });
});
