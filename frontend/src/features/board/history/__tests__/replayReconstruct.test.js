import { describe, it, expect } from "vitest";
import { buildReplayCheckpoints, reconstructAtSeq, CHECKPOINT_INTERVAL } from "../replayReconstruct.js";

const op = (seq, overrides = {}) => ({ seq, opType: "insert", elementId: `el-${seq}`, after: { color: "red" }, authorId: "u1", ts: seq * 1000, ...overrides });

describe("buildReplayCheckpoints / reconstructAtSeq", () => {
    it("reconstructs the exact state at any seq by replaying ops forward", () => {
        const ops = [
            op(1),
            op(2, { opType: "update", elementId: "el-1", after: { color: "blue" } }),
            op(3, { opType: "delete", elementId: "el-1", after: null }),
        ];
        const checkpoints = buildReplayCheckpoints(ops);

        expect(reconstructAtSeq(ops, checkpoints, 1).elements).toEqual({ "el-1": { color: "red" } });
        expect(reconstructAtSeq(ops, checkpoints, 2).elements).toEqual({ "el-1": { color: "blue" } });
        expect(reconstructAtSeq(ops, checkpoints, 3).elements).toEqual({});
    });

    it("applies a background op and reconstructs it correctly", () => {
        const ops = [op(1), op(2, { opType: "background", elementId: null, after: { type: "dot", colorToken: null } })];
        const checkpoints = buildReplayCheckpoints(ops);
        expect(reconstructAtSeq(ops, checkpoints, 2).background).toEqual({ type: "dot", colorToken: null });
        expect(reconstructAtSeq(ops, checkpoints, 1).background).toEqual({ type: "blank", colorToken: null });
    });

    it("never replays from op 1 when a closer checkpoint exists", () => {
        const ops = Array.from({ length: CHECKPOINT_INTERVAL * 3 }, (_, i) => op(i + 1));
        const checkpoints = buildReplayCheckpoints(ops);
        // Correct at seq 105 means the checkpoint near 100 was used as the base.
        const target = CHECKPOINT_INTERVAL * 2 + 5;
        const state = reconstructAtSeq(ops, checkpoints, target);
        expect(Object.keys(state.elements)).toHaveLength(target);
        expect(checkpoints.some((c) => c.seq === CHECKPOINT_INTERVAL * 2)).toBe(true);
    });

    it("reconstructs an empty board at seq 0", () => {
        const ops = [op(1)];
        const checkpoints = buildReplayCheckpoints(ops);
        expect(reconstructAtSeq(ops, checkpoints, 0)).toEqual({ elements: {}, background: { type: "blank", colorToken: null } });
    });

    it("starts from a window's base state instead of an empty board", () => {
        const base = { seq: 40, elements: { old: { color: "green" } }, background: { type: "grid", colorToken: null } };
        const ops = [op(41), op(42, { opType: "delete", elementId: "old", after: null })];
        const checkpoints = buildReplayCheckpoints(ops, base);

        expect(reconstructAtSeq(ops, checkpoints, 40)).toEqual({ elements: base.elements, background: base.background });
        expect(reconstructAtSeq(ops, checkpoints, 41).elements).toEqual({ old: { color: "green" }, "el-41": { color: "red" } });
        expect(reconstructAtSeq(ops, checkpoints, 42)).toEqual({ elements: { "el-41": { color: "red" } }, background: base.background });
    });
});
