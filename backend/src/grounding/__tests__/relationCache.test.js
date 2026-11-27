import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../buildGroundedScene.js", () => ({
    buildGroundedScene: vi.fn(async (shareId, elements) => ({ objects: Object.keys(elements).map((ref) => ({ ref })), relations: [] })),
}));
vi.mock("../../liveRooms/liveScene.js", () => ({ isRoomLive: vi.fn(async () => true) }));
vi.mock("../../liveRooms/canvasStore.js", () => ({ default: { currentOpSeq: vi.fn(async () => 7) } }));

const { getGroundedScene, invalidateGroundedScene } = await import("../relationCache.js");
const { buildGroundedScene } = await import("../buildGroundedScene.js");
const { GROUNDING_SIZE_THRESHOLD } = await import("../viewportScope.js");

const rect = (x) => ({ type: "shape", startX: x, startY: 0, endX: x + 20, endY: 20 });
const bigBoard = Object.fromEntries(Array.from({ length: GROUNDING_SIZE_THRESHOLD + 1 }, (_, i) => [`el-${i}`, rect(i * 1000)]));
const nearOrigin = { minX: 0, minY: 0, maxX: 100, maxY: 100 };

beforeEach(() => {
    invalidateGroundedScene("board");
    buildGroundedScene.mockClear();
});

describe("getGroundedScene", () => {
    it("grounds a large board only around the caller's viewport and marks the scene partial", async () => {
        const scene = await getGroundedScene("board", bigBoard, nearOrigin);
        expect(scene.partial).toBe(true);
        expect(scene.objects.length).toBeLessThan(Object.keys(bigBoard).length);
    });

    it("never serves a viewport-scoped scene from the whole-board cache", async () => {
        await getGroundedScene("board", bigBoard, nearOrigin);
        const whole = await getGroundedScene("board", bigBoard);
        expect(whole.partial).toBeUndefined();
        expect(whole.objects).toHaveLength(Object.keys(bigBoard).length);
        await getGroundedScene("board", bigBoard);
        expect(buildGroundedScene).toHaveBeenCalledTimes(2);
    });
});
