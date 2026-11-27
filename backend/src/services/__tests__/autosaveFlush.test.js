import { describe, it, expect, vi } from "vitest";

vi.mock("../notifications.js", () => ({ notify: vi.fn().mockResolvedValue(null), userRoom: (userId) => `user:${userId}` }));
vi.mock("../boards.js", () => ({
    getBoardTitle: vi.fn().mockResolvedValue("Board"),
    SAVE_RESULT: { SAVED: "saved", BOARD_GONE: "board-gone", FAILED: "failed", NOTHING_TO_SAVE: "nothing-to-save" },
}));
vi.mock("../../observability/alerts.js", () => ({ sendAlert: vi.fn() }));

const { flushDirtyBoards } = await import("../autosaveFlush.js");
const createMemoryStore = (await import("../../liveRooms/memoryStore.js")).default;

describe("flushDirtyBoards", () => {
    it("re-marks a failed board for the next tick instead of retrying it within this one", async () => {
        const canvasStore = createMemoryStore();
        await canvasStore.markDirty("board-1");
        const flushRoom = vi.fn().mockResolvedValue("failed");

        await flushDirtyBoards({ canvasStore, flushRoom });

        expect(flushRoom).toHaveBeenCalledTimes(1);
        expect(await canvasStore.popDirty()).toBe("board-1");
    });

    it("drops a board whose drawing is gone and never re-marks it", async () => {
        const canvasStore = createMemoryStore();
        await canvasStore.markDirty("board-2");
        const onBoardGone = vi.fn();

        await flushDirtyBoards({ canvasStore, flushRoom: vi.fn().mockResolvedValue("board-gone"), onBoardGone });

        expect(onBoardGone).toHaveBeenCalledWith("board-2");
        expect(await canvasStore.popDirty()).toBeNull();
    });

    it("re-marks a board whose flush threw", async () => {
        const canvasStore = createMemoryStore();
        await canvasStore.markDirty("board-3");

        await flushDirtyBoards({ canvasStore, flushRoom: vi.fn().mockRejectedValue(new Error("timeout")) });

        expect(await canvasStore.popDirty()).toBe("board-3");
    });

    it("reports each saved board", async () => {
        const canvasStore = createMemoryStore();
        await canvasStore.markDirty("board-4");
        const onSaved = vi.fn();

        await flushDirtyBoards({ canvasStore, flushRoom: vi.fn().mockResolvedValue("saved"), onSaved });

        expect(onSaved).toHaveBeenCalledWith("board-4");
    });
});
