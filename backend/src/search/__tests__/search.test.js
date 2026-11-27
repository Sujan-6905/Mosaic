import { describe, it, expect } from "vitest";
import { embedText } from "../embedding.js";
import { searchBoards } from "../search.js";

const chunk = (text, overrides = {}) => ({ sourceType: "text", elementId: "e1", text, embedding: embedText(text), x: 0, y: 0, ...overrides });

describe("searchBoards", () => {
    it("ranks a board whose content matches the query above an unrelated board", () => {
        const indexes = [
            { shareId: "auth-board", title: "Auth Flow", chunks: [chunk("user login flow with OAuth and SSO")] },
            { shareId: "budget-board", title: "Q3 Budget", chunks: [chunk("quarterly budget spreadsheet numbers")] },
        ];
        const results = searchBoards(indexes, "the board where I sketched the auth flow");
        expect(results[0].shareId).toBe("auth-board");
    });

    it("excludes a board with no matching content at all", () => {
        const indexes = [{ shareId: "board-1", title: "Random", chunks: [chunk("completely unrelated content")] }];
        const results = searchBoards(indexes, "zzzznonexistentqueryterm");
        expect(results).toEqual([]);
    });

    it("boosts an exact substring match over a similar-but-inexact one", () => {
        const indexes = [
            { shareId: "exact", title: "Exact", chunks: [chunk("retro action items")] },
            { shareId: "fuzzy", title: "Fuzzy", chunks: [chunk("items and actions from the retro")] },
        ];
        const results = searchBoards(indexes, "retro action items");
        expect(results[0].shareId).toBe("exact");
    });

    it("returns each board's single best-matching chunk, not every chunk", () => {
        const indexes = [
            {
                shareId: "board-1",
                title: "Board",
                chunks: [chunk("irrelevant note", { elementId: "e1" }), chunk("auth login flow", { elementId: "e2" })],
            },
        ];
        const results = searchBoards(indexes, "auth login flow");
        expect(results).toHaveLength(1);
        expect(results[0].match.elementId).toBe("e2");
    });

    it("respects the limit", () => {
        const indexes = Array.from({ length: 5 }, (_, i) => ({
            shareId: `board-${i}`,
            title: `Board ${i}`,
            chunks: [chunk("shared search term")],
        }));
        expect(searchBoards(indexes, "shared search term", 2)).toHaveLength(2);
    });

    it("returns nothing for an empty index list", () => {
        expect(searchBoards([], "anything")).toEqual([]);
    });
});
