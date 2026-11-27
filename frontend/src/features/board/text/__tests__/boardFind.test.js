import { describe, it, expect } from "vitest";
import { findOnBoard } from "../boardFind.js";

const text = (x, y, words) => ({ type: "text", x, y, width: 100, text: words, size: 16 });

describe("findOnBoard", () => {
    const elements = {
        lower: text(0, 400, "Login page"),
        upperRight: text(300, 0, "login button"),
        upperLeft: text(0, 0, "Sign in or LOGIN"),
        frame: { type: "frame", startX: 0, startY: 200, endX: 200, endY: 300, name: "Login flow" },
        unrelated: text(0, 100, "Pricing"),
    };

    it("matches words regardless of case, in reading order", () => {
        expect(findOnBoard(elements, "login")).toEqual(["upperLeft", "upperRight", "frame", "lower"]);
    });

    it("finds nothing for an empty or blank query", () => {
        expect(findOnBoard(elements, "   ")).toEqual([]);
    });

    it("finds nothing when no element carries the words", () => {
        expect(findOnBoard(elements, "checkout")).toEqual([]);
    });
});
