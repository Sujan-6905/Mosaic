import { describe, it, expect } from "vitest";
import { continueList, insertLink, parseRichText, plainText, toggleInlineMark, toggleList } from "../richText.js";

const styles = (source) =>
    parseRichText(source)[0].runs.map(({ text, bold, italic, underline, strike, link }) => ({
        text,
        ...(bold && { bold }),
        ...(italic && { italic }),
        ...(underline && { underline }),
        ...(strike && { strike }),
        ...(link && { link }),
    }));

describe("parseRichText", () => {
    it("reads bold, italic, underline and strike runs", () => {
        expect(styles("a **b** *c* ++d++ ~~e~~")).toEqual([
            { text: "a " },
            { text: "b", bold: true },
            { text: " " },
            { text: "c", italic: true },
            { text: " " },
            { text: "d", underline: true },
            { text: " " },
            { text: "e", strike: true },
        ]);
    });

    it("nests marks", () => {
        expect(styles("**bold *both***")).toEqual([
            { text: "bold ", bold: true },
            { text: "both", bold: true, italic: true },
        ]);
    });

    it("leaves a lone or spaced asterisk as written", () => {
        expect(styles("2 * 3 * 4")).toEqual([{ text: "2 * 3 * 4" }]);
        expect(styles("a *b")).toEqual([{ text: "a *b" }]);
    });

    it("reads labelled and bare links, and escaped marks", () => {
        expect(styles("see [docs](https://example.com/a) or https://x.dev/b.")).toEqual([
            { text: "see " },
            { text: "docs", link: "https://example.com/a" },
            { text: " or " },
            { text: "https://x.dev/b", link: "https://x.dev/b" },
            { text: "." },
        ]);
        expect(styles("\\*not italic\\*")).toEqual([{ text: "*not italic*" }]);
    });

    it("never links a script address", () => {
        expect(styles("[x](javascript:alert(1))")).toEqual([{ text: "[x](javascript:alert(1))" }]);
    });

    it("reads bullets, numbers and nesting", () => {
        const [first, second, third] = parseRichText("- one\n  - two\n12. twelve");
        expect(first).toMatchObject({ marker: "•", level: 0 });
        expect(second).toMatchObject({ marker: "•", level: 1 });
        expect(third).toMatchObject({ marker: "12.", level: 0, runs: [{ text: "twelve" }] });
    });
});

describe("plainText", () => {
    it("drops formatting marks and keeps list prefixes", () => {
        expect(plainText("- **Login** [page](https://a.b)\nplain")).toBe("- Login page\nplain");
    });
});

describe("toggleInlineMark", () => {
    it("wraps the selected words and selects them inside the marks", () => {
        expect(toggleInlineMark("make this bold", 5, 9, "bold")).toEqual({ text: "make **this** bold", start: 7, end: 11 });
    });

    it("removes the mark when the selection is already wrapped", () => {
        expect(toggleInlineMark("make **this** bold", 7, 11, "bold")).toEqual({ text: "make this bold", start: 5, end: 9 });
    });

    it("does not read bold's inner asterisk as italic", () => {
        expect(toggleInlineMark("**word**", 2, 6, "italic").text).toBe("***word***");
    });

    it("marks each line of a multi-line selection and skips trailing spaces", () => {
        expect(toggleInlineMark("one\ntwo ", 0, 8, "underline").text).toBe("++one++\n++two++ ");
    });

    it("does nothing without a selection", () => {
        expect(toggleInlineMark("text", 2, 2, "bold")).toBeNull();
    });
});

describe("toggleList and continueList", () => {
    it("bullets every selected line and numbers them in order", () => {
        expect(toggleList("a\nb\nc", 0, 3, "bullet").text).toBe("- a\n- b\nc");
        expect(toggleList("- a\n- b", 0, 5, "number").text).toBe("1. a\n2. b");
    });

    it("takes the list off when every line already has it", () => {
        expect(toggleList("- a\n- b", 0, 7, "bullet").text).toBe("a\nb");
    });

    it("starts the next item, and ends the list on an empty one", () => {
        expect(continueList("1. first", 8)).toEqual({ text: "1. first\n2. ", caret: 12 });
        expect(continueList("- a\n- ", 6)).toEqual({ text: "- a\n", caret: 4 });
        expect(continueList("plain", 5)).toBeNull();
    });
});

describe("insertLink", () => {
    it("turns the selection into a label and selects the address", () => {
        const result = insertLink("read docs now", 5, 9);
        expect(result.text).toBe("read [docs](https://) now");
        expect(result.text.slice(result.start, result.end)).toBe("https://");
    });
});
