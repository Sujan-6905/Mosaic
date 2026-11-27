import { describe, it, expect } from "vitest";
import { matchesCommand, filterCommands } from "../commandMatch.js";

const cmd = (label, category = "Edit") => ({ id: label, label, category });

describe("matchesCommand", () => {
    it("matches every command when the query is empty", () => {
        expect(matchesCommand(cmd("Undo"), "")).toBe(true);
    });

    it("matches a straightforward substring", () => {
        expect(matchesCommand(cmd("Bring to front"), "front")).toBe(true);
    });

    it("matches multi-word queries regardless of word order", () => {
        expect(matchesCommand(cmd("Bring to front"), "front bring")).toBe(true);
        expect(matchesCommand(cmd("Bring to front"), "bring front")).toBe(true);
    });

    it("does not match when one query word is missing", () => {
        expect(matchesCommand(cmd("Bring to front"), "front back")).toBe(false);
    });

    it("is case-insensitive", () => {
        expect(matchesCommand(cmd("Undo"), "UNDO")).toBe(true);
    });

    it("also matches against the command's category", () => {
        expect(matchesCommand(cmd("Rectangle tool", "Tools"), "tools rectangle")).toBe(true);
    });
});

describe("filterCommands", () => {
    it("returns every command for an empty query, unranked", () => {
        const commands = [cmd("Undo"), cmd("Redo")];
        expect(filterCommands(commands, "")).toEqual(commands);
    });

    it("excludes non-matching commands", () => {
        const commands = [cmd("Undo"), cmd("Redo"), cmd("Export board")];
        expect(filterCommands(commands, "redo").map((c) => c.label)).toEqual(["Redo"]);
    });

    it("ranks a label-prefix match above a mid-label match", () => {
        const commands = [cmd("Bring to front"), cmd("Front-facing export")];
        const results = filterCommands(commands, "front");
        expect(results[0].label).toBe("Front-facing export");
    });
});
