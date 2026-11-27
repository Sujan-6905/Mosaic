import { describe, it, expect } from "vitest";
import { isValidHex, normalizeHex, hexToRgb, rgbToHex, rgbToHsv, hsvToRgb } from "../colorMath.js";

describe("normalizeHex", () => {
    it("lowercases and adds a leading # to a bare 6-digit hex", () => {
        expect(normalizeHex("FF00AA")).toBe("#ff00aa");
    });

    it("expands a 3-digit shorthand", () => {
        expect(normalizeHex("#0af")).toBe("#00aaff");
    });

    it("rejects invalid input", () => {
        expect(normalizeHex("not-a-color")).toBeNull();
        expect(normalizeHex("")).toBeNull();
        expect(normalizeHex(null)).toBeNull();
    });
});

describe("isValidHex", () => {
    it("accepts 3 and 6 digit hex, with or without #", () => {
        expect(isValidHex("#fff")).toBe(true);
        expect(isValidHex("ffffff")).toBe(true);
        expect(isValidHex("#ffffff")).toBe(true);
    });

    it("rejects malformed input", () => {
        expect(isValidHex("ggg")).toBe(false);
        expect(isValidHex("#ffff")).toBe(false);
    });
});

describe("hexToRgb / rgbToHex", () => {
    it("round-trips a color exactly", () => {
        expect(rgbToHex(hexToRgb("#3b82f6"))).toBe("#3b82f6");
    });

    it("returns null for invalid hex", () => {
        expect(hexToRgb("nonsense")).toBeNull();
    });

    it("clamps out-of-range channel values", () => {
        expect(rgbToHex({ r: 300, g: -10, b: 128 })).toBe("#ff0080");
    });
});

describe("rgbToHsv / hsvToRgb", () => {
    it("round-trips pure red", () => {
        const hsv = rgbToHsv({ r: 255, g: 0, b: 0 });
        expect(hsv.h).toBeCloseTo(0);
        expect(hsv.s).toBeCloseTo(1);
        expect(hsv.v).toBeCloseTo(1);
        const rgb = hsvToRgb(hsv);
        expect(Math.round(rgb.r)).toBe(255);
        expect(Math.round(rgb.g)).toBe(0);
        expect(Math.round(rgb.b)).toBe(0);
    });

    it("treats black as zero saturation and value regardless of hue", () => {
        const hsv = rgbToHsv({ r: 0, g: 0, b: 0 });
        expect(hsv.s).toBe(0);
        expect(hsv.v).toBe(0);
    });

    it("round-trips an arbitrary color through hex -> hsv -> hex", () => {
        const original = hexToRgb("#7c3aed");
        const restored = hsvToRgb(rgbToHsv(original));
        expect(rgbToHex(restored)).toBe("#7c3aed");
    });
});
