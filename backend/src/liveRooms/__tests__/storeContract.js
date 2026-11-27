import { describe, it, expect } from "vitest";

// Runs unchanged against both stores, so they can't drift apart.
const runStoreContractTests = (label, createStore) => {
    describe(`canvasStore contract - ${label}`, () => {
        it("createRoom returns true once and false on every call after", async () => {
            const store = createStore();
            expect(await store.createRoom("board-1")).toBe(true);
            expect(await store.createRoom("board-1")).toBe(false);
            expect(await store.roomExists("board-1")).toBe(true);
        });

        it("roomExists is false for a room never created", async () => {
            const store = createStore();
            expect(await store.roomExists("never-created")).toBe(false);
            expect(await store.getElements("never-created")).toEqual({});
        });

        it("setElement stamps a monotonically increasing version and getElements reflects it", async () => {
            const store = createStore();
            await store.createRoom("board-2");

            const first = await store.setElement("board-2", "el-1", { type: "shape", color: "red" }, "user-a");
            expect(first.version).toBe(1);
            expect(first.element).toMatchObject({ color: "red", version: 1, updatedBy: "user-a" });

            const second = await store.setElement("board-2", "el-1", { type: "shape", color: "blue" }, "user-b");
            expect(second.version).toBe(2);

            const elements = await store.getElements("board-2");
            expect(elements["el-1"]).toMatchObject({ color: "blue", version: 2 });
        });

        it("setElementFields changes only the named fields, so another person's change to a different field survives", async () => {
            const store = createStore();
            await store.createRoom("board-merge");
            await store.setElement("board-merge", "el-1", { type: "shape", color: "red", startX: 0, label: "old" }, "user-a");
            await store.setElement("board-merge", "el-1", { type: "shape", color: "blue", startX: 0, label: "old" }, "user-a");

            const moved = await store.setElementFields("board-merge", "el-1", { type: "shape", color: "red", startX: 50 }, ["startX", "label"], "user-b");

            expect(moved.element).toMatchObject({ type: "shape", color: "blue", startX: 50, version: 3, updatedBy: "user-b" });
            expect(moved.element).not.toHaveProperty("label");
        });

        it("setElementFields takes one table cell, so two people typing in different cells both keep their words", async () => {
            const store = createStore();
            await store.createRoom("board-cells");
            await store.setElement("board-cells", "t", { type: "table", rows: 1, cols: 3, cells: ["a", "b", "c"] }, "user-a");
            await store.setElementFields("board-cells", "t", { type: "table", rows: 1, cols: 3, cells: ["A", "b", "c"] }, ["cells.0"], "user-a");

            const { element } = await store.setElementFields(
                "board-cells",
                "t",
                { type: "table", rows: 1, cols: 3, cells: ["a", "b", "C"] },
                ["cells.2"],
                "user-b",
            );

            expect(element.cells).toEqual(["A", "b", "C"]);
        });

        it("setElementFields takes the whole cell list when the table changed shape", async () => {
            const store = createStore();
            await store.createRoom("board-cells-shape");
            await store.setElement("board-cells-shape", "t", { type: "table", rows: 1, cols: 2, cells: ["a", "b"] }, "user-a");

            const { element } = await store.setElementFields(
                "board-cells-shape",
                "t",
                { type: "table", rows: 2, cols: 2, cells: ["a", "b", "c", "d"] },
                ["rows", "cells.3"],
                "user-a",
            );

            expect(element).toMatchObject({ rows: 2, cells: ["a", "b", "c", "d"] });
        });

        it("keeps a room's workshop state and each person's votes until the room goes", async () => {
            const store = createStore();
            await store.createRoom("board-activity");
            await store.setActivity("board-activity", "timer", { running: true, endsAt: 5 });
            await store.setVotes("board-activity", "ada", ["el-1", "el-1"]);
            await store.setVotes("board-activity", "ben", ["el-2"]);

            expect(await store.getActivity("board-activity", "timer")).toEqual({ running: true, endsAt: 5 });
            expect(await store.getVotes("board-activity")).toEqual({ ada: ["el-1", "el-1"], ben: ["el-2"] });

            await store.setActivity("board-activity", "timer", null);
            await store.clearVotes("board-activity");
            expect(await store.getActivity("board-activity", "timer")).toBeNull();
            expect(await store.getVotes("board-activity")).toEqual({});
        });

        it("setElementFields never leaves a table with more rows than cells when a stale edit meets a new row", async () => {
            const store = createStore();
            await store.createRoom("board-cells-stale");
            await store.setElement("board-cells-stale", "t", { type: "table", rows: 3, cols: 2, cells: ["a", "b", "c", "d", "", ""] }, "user-a");

            const { element } = await store.setElementFields(
                "board-cells-stale",
                "t",
                { type: "table", rows: 2, cols: 2, cells: ["a", "B", "c", "d"] },
                ["cells.1"],
                "user-b",
            );

            expect(element.cells).toHaveLength(element.rows * element.cols);
            expect(element).toMatchObject({ rows: 2, cols: 2, cells: ["a", "B", "c", "d"] });
        });

        it("setElementFields ignores a named entry of a field that isn't a table's cells", async () => {
            const store = createStore();
            await store.createRoom("board-entry");
            await store.setElement("board-entry", "s", { type: "shape", color: "red", points: [1, 2] }, "user-a");

            const { element } = await store.setElementFields("board-entry", "s", { type: "shape", color: "blue", points: [9, 9] }, ["points.0"], "user-b");

            expect(element).toMatchObject({ color: "red", points: [1, 2] });
        });

        it("setElementFields writes the whole element when nothing is stored for it yet", async () => {
            const store = createStore();
            await store.createRoom("board-merge-new");
            const { element } = await store.setElementFields("board-merge-new", "el-1", { type: "text", text: "hi", x: 1 }, ["text"], "user-a");
            expect(element).toMatchObject({ type: "text", text: "hi", x: 1 });
        });

        it("deleteElement stamps a version that outranks a prior insert (tombstone survives removal)", async () => {
            const store = createStore();
            await store.createRoom("board-3");

            const inserted = await store.setElement("board-3", "el-1", { type: "shape" }, "user-a");
            const deleted = await store.deleteElement("board-3", "el-1");

            expect(deleted.version).toBeGreaterThan(inserted.version);
            expect(await store.getElements("board-3")).toEqual({});
        });

        it("seedElements loads persisted elements and their versions without re-stamping them", async () => {
            const store = createStore();
            await store.createRoom("board-4");

            await store.seedElements("board-4", {
                "el-1": { type: "shape", color: "green", version: 7 },
            });

            expect(await store.getElements("board-4")).toEqual({
                "el-1": { type: "shape", color: "green", version: 7 },
            });

            // Otherwise a restart could re-issue a version a client already holds.
            const next = await store.setElement("board-4", "el-1", { type: "shape", color: "black" }, "user-a");
            expect(next.version).toBe(8);
        });

        it("tracks participants: add, count, get, and remove", async () => {
            const store = createStore();
            await store.createRoom("board-5");

            await store.addParticipant("board-5", "sock-1", { userId: "u1", role: "edit", name: "A", color: "#111" });
            await store.addParticipant("board-5", "sock-2", { userId: "u2", role: "edit", name: "B", color: "#222" });

            expect(await store.getParticipantCount("board-5")).toBe(2);
            expect(await store.getParticipant("board-5", "sock-1")).toMatchObject({ userId: "u1", name: "A" });

            const participants = await store.getParticipants("board-5");
            expect(participants.map((p) => p.socketId).sort()).toEqual(["sock-1", "sock-2"]);

            const remaining = await store.removeParticipant("board-5", "sock-1");
            expect(remaining).toBe(1);
            expect(await store.getParticipant("board-5", "sock-1")).toBeNull();
        });

        it("deleteRoom clears elements, participants, and dirty state for that shareId", async () => {
            const store = createStore();
            await store.createRoom("board-6");
            await store.setElement("board-6", "el-1", { type: "shape" }, "user-a");
            await store.addParticipant("board-6", "sock-1", { userId: "u1", role: "edit", name: "A", color: "#111" });
            await store.markDirty("board-6");

            await store.deleteRoom("board-6");

            expect(await store.roomExists("board-6")).toBe(false);
            expect(await store.getElements("board-6")).toEqual({});
            expect(await store.getParticipants("board-6")).toEqual([]);
        });

        it("popDirty drains marked boards one at a time and returns null once empty", async () => {
            const store = createStore();
            await store.markDirty("board-7");
            await store.markDirty("board-8");

            const popped = new Set();
            popped.add(await store.popDirty());
            popped.add(await store.popDirty());

            expect(popped).toEqual(new Set(["board-7", "board-8"]));
            expect(await store.popDirty()).toBeNull();
        });

        it("getRoomCount reflects the number of active (created, not yet deleted) rooms", async () => {
            const store = createStore();
            expect(await store.getRoomCount()).toBe(0);

            await store.createRoom("board-9");
            await store.createRoom("board-10");
            expect(await store.getRoomCount()).toBe(2);

            await store.deleteRoom("board-9");
            expect(await store.getRoomCount()).toBe(1);
        });

        it("getTotalParticipantCount sums participants across every active room", async () => {
            const store = createStore();
            await store.createRoom("board-11");
            await store.createRoom("board-12");

            await store.addParticipant("board-11", "sock-1", { userId: "u1", role: "owner", name: "A", color: "#111" });
            await store.addParticipant("board-11", "sock-2", { userId: "u2", role: "editor", name: "B", color: "#222" });
            await store.addParticipant("board-12", "sock-3", { userId: "u3", role: "viewer", name: "C", color: "#333" });

            expect(await store.getTotalParticipantCount()).toBe(3);

            await store.removeParticipant("board-11", "sock-1");
            expect(await store.getTotalParticipantCount()).toBe(2);
        });

        it("getRoomOccupancySnapshot reflects live per-room occupancy across every active room", async () => {
            const store = createStore();
            await store.createRoom("board-13");
            await store.createRoom("board-14");

            await store.addParticipant("board-13", "sock-1", { userId: "u1", role: "editor", name: "A", color: "#111" });
            await store.addParticipant("board-13", "sock-2", { userId: "u2", role: "viewer", name: "B", color: "#222" });
            await store.addParticipant("board-14", "sock-3", { userId: "u3", role: "owner", name: "C", color: "#333" });

            const snapshot = await store.getRoomOccupancySnapshot();
            expect(snapshot.sort((a, b) => a.shareId.localeCompare(b.shareId))).toEqual([
                { shareId: "board-13", occupancy: 2 },
                { shareId: "board-14", occupancy: 1 },
            ]);
        });

        it("background defaults to blank, persists via setBackground, and is scoped per room", async () => {
            const store = createStore();
            await store.createRoom("board-15");
            await store.createRoom("board-16");

            expect(await store.getBackground("board-15")).toEqual({ type: "blank", colorToken: null });

            await store.setBackground("board-15", { type: "dot", colorToken: "canvas-grid" });
            expect(await store.getBackground("board-15")).toEqual({ type: "dot", colorToken: "canvas-grid" });
            expect(await store.getBackground("board-16")).toEqual({ type: "blank", colorToken: null });
        });

        it("seedBackground only overwrites when a persisted value exists", async () => {
            const store = createStore();
            await store.createRoom("board-17");

            await store.seedBackground("board-17", undefined);
            expect(await store.getBackground("board-17")).toEqual({ type: "blank", colorToken: null });

            await store.seedBackground("board-17", { type: "square", colorToken: null });
            expect(await store.getBackground("board-17")).toEqual({ type: "square", colorToken: null });
        });

        it("nextOpSeq hands out a board-wide monotonically increasing sequence, independent per board", async () => {
            const store = createStore();

            expect(await store.nextOpSeq("board-18")).toBe(1);
            expect(await store.nextOpSeq("board-18")).toBe(2);
            expect(await store.nextOpSeq("board-19")).toBe(1);
        });

        it("currentOpSeq peeks the latest handed-out sequence without minting a new one", async () => {
            const store = createStore();

            expect(await store.currentOpSeq("board-21")).toBe(0);
            await store.nextOpSeq("board-21");
            await store.nextOpSeq("board-21");
            expect(await store.currentOpSeq("board-21")).toBe(2);
            expect(await store.currentOpSeq("board-21")).toBe(2);
        });

        it("seedOpSeq re-seeds the counter so the next mint continues from it, not from 0", async () => {
            const store = createStore();

            await store.seedOpSeq("board-22", 500);
            expect(await store.currentOpSeq("board-22")).toBe(500);
            expect(await store.nextOpSeq("board-22")).toBe(501);
        });

        it("appendPendingOp buffers ops and drainPendingOps empties the buffer in order", async () => {
            const store = createStore();

            await store.appendPendingOp("board-20", { seq: 1, opType: "insert", elementId: "el-1" });
            await store.appendPendingOp("board-20", { seq: 2, opType: "update", elementId: "el-1" });

            expect(await store.drainPendingOps("board-20")).toEqual([
                { seq: 1, opType: "insert", elementId: "el-1" },
                { seq: 2, opType: "update", elementId: "el-1" },
            ]);
            expect(await store.drainPendingOps("board-20")).toEqual([]);
        });

        it("requeuePendingOps puts failed ops back ahead of ones buffered since", async () => {
            const store = createStore();

            await store.appendPendingOp("board-23", { seq: 3 });
            await store.requeuePendingOps("board-23", [{ seq: 1 }, { seq: 2 }]);

            expect(await store.drainPendingOps("board-23")).toEqual([{ seq: 1 }, { seq: 2 }, { seq: 3 }]);
        });
    });
};

export default runStoreContractTests;
