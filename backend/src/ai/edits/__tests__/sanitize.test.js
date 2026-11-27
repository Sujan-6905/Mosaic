import { describe, it, expect } from "vitest";
import { sanitizeEditBatch } from "../sanitize.js";

const validRefs = new Set(["obj_a1b2c3", "obj_d4e5f6"]);

describe("sanitizeEditBatch", () => {
    it("repairs a hallucinated ref that is a near-miss typo of a real one", () => {
        const { ops, events } = sanitizeEditBatch([{ op: "restyle", ref: "obj_a1b2c4", props: { color: "red" } }], validRefs);
        expect(ops[0].ref).toBe("obj_a1b2c3");
        expect(events.some((e) => e.type === "ref-repaired")).toBe(true);
    });

    it("drops an operation whose ref has no plausible match", () => {
        const { ops, events } = sanitizeEditBatch([{ op: "restyle", ref: "totally-invented-ref", props: { color: "red" } }], validRefs);
        expect(ops).toHaveLength(0);
        expect(events.some((e) => e.type === "op-dropped")).toBe(true);
    });

    it("never lets a hallucinated ref reach the sanitized output", () => {
        const { ops } = sanitizeEditBatch([{ op: "align", refs: ["obj_a1b2c3", "invented-nonsense-ref"], edge: "left" }], validRefs);
        ops.forEach((op) => {
            (op.refs || [op.ref]).forEach((ref) => expect(validRefs.has(ref)).toBe(true));
        });
    });

    it("normalises a hex colour matching a theme token", () => {
        const { ops, events } = sanitizeEditBatch([{ op: "restyle", ref: "obj_a1b2c3", props: { color: "#000000" } }], validRefs);
        expect(ops[0].props.colorToken).toBe("ink-primary");
        expect(events.some((e) => e.type === "color-normalized")).toBe(true);
    });

    it("leaves a colour with no matching token untouched", () => {
        const { ops } = sanitizeEditBatch([{ op: "restyle", ref: "obj_a1b2c3", props: { color: "#3366ff" } }], validRefs);
        expect(ops[0].props.colorToken).toBeUndefined();
        expect(ops[0].props.color).toBe("#3366ff");
    });

    it("resolves two contradictory restyles of the same ref deterministically, keeping the last", () => {
        const { ops, events } = sanitizeEditBatch(
            [
                { op: "restyle", ref: "obj_a1b2c3", props: { color: "red" } },
                { op: "restyle", ref: "obj_a1b2c3", props: { color: "blue" } },
            ],
            validRefs,
        );
        expect(ops).toHaveLength(1);
        expect(ops[0].props.color).toBe("blue");
        expect(events.some((e) => e.type === "duplicate-op-dropped")).toBe(true);
    });

    it("counts every sanitisation in events", () => {
        const { events } = sanitizeEditBatch(
            [
                { op: "restyle", ref: "obj_a1b2c4", props: { color: "#000000" } },
                { op: "delete", refs: ["nonsense-ref"] },
            ],
            validRefs,
        );
        expect(events.length).toBeGreaterThan(0);
    });
});
