import { describe, expect, it } from "vitest";

const CLOUD = process.env.CLOUDINARY_CLOUD_NAME?.trim() || "demo";
import { fontFieldsFor, googleFontCssUrl, isFontFileBytes, isValidFontSource, parseFontInput } from "../../../../shared/canvas/elements/fontSources.js";
import { elementSchema } from "../socketSchemas.js";

describe("reading a font someone pastes", () => {
    it("takes a bare Google Fonts family name", () => {
        expect(parseFontInput("Space Grotesk")).toEqual({ family: "Space Grotesk", source: { kind: "google", url: googleFontCssUrl("Space Grotesk") } });
    });

    it("takes a Google Fonts specimen page", () => {
        expect(parseFontInput("https://fonts.google.com/specimen/Bricolage+Grotesque").family).toBe("Bricolage Grotesque");
    });

    it("keeps a Google Fonts stylesheet link as given", () => {
        const url = "https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap";
        expect(parseFontInput(url)).toEqual({ family: "Caveat", source: { kind: "google", url } });
    });

    it("hands back a link to a font file elsewhere for copying, named after the file unless given a name", () => {
        expect(parseFontInput("https://cdn.example.com/fonts/Acme-Sans_Bold.woff2")).toEqual({
            family: "Acme Sans Bold",
            fileLink: "https://cdn.example.com/fonts/Acme-Sans_Bold.woff2",
        });
        expect(parseFontInput("https://cdn.example.com/f.ttf?v=2", "House Face")).toEqual({
            family: "House Face",
            fileLink: "https://cdn.example.com/f.ttf?v=2",
        });
        expect(fontFieldsFor("https://cdn.example.com/f.woff2").fileLink).toBe("https://cdn.example.com/f.woff2");
    });

    it("keeps a font already in the app's uploads as it is", () => {
        const url = `https://res.cloudinary.com/${CLOUD}/raw/upload/v1/mosaic-boards/abc.woff2`;
        expect(parseFontInput(url, "House Face")).toEqual({ family: "House Face", source: { kind: "file", url } });
    });

    it("recognises font files by their first bytes", () => {
        expect(isFontFileBytes(new Uint8Array([0x77, 0x4f, 0x46, 0x32]))).toBe(true);
        expect(isFontFileBytes(new Uint8Array([0x00, 0x01, 0x00, 0x00]))).toBe(true);
        expect(isFontFileBytes(new TextEncoder().encode("<html>"))).toBe(false);
    });

    it("refuses non-https links, non-font files and names that could break out of CSS", () => {
        expect(parseFontInput("javascript:alert(1)").error).toMatch(/https/);
        expect(parseFontInput("http://cdn.example.com/f.woff2").error).toMatch(/https/);
        expect(parseFontInput("https://cdn.example.com/page.html").error).toBeDefined();
        expect(parseFontInput("Evil'); background: url(x").error).toBeDefined();
        expect(parseFontInput("https://cdn.example.com/f.woff2", "a'b").error).toBeDefined();
        expect(parseFontInput('https://cdn.example.com/f.woff2?x=");}@import url(https://evil.example.com/x.css').error).toBeDefined();
    });

    it("maps a web-safe family to no source at all", () => {
        expect(fontFieldsFor("georgia")).toEqual({ fontFamily: "Georgia, serif", fontSource: null });
        expect(fontFieldsFor("Caveat").fontSource.kind).toBe("google");
    });
});

describe("font sources on elements", () => {
    const text = (fontSource) => ({
        type: "text",
        x: 0,
        y: 0,
        width: 100,
        text: "hi",
        color: "#000",
        size: 16,
        zIndex: 1,
        rotation: 0,
        fontFamily: "'Caveat', sans-serif",
        fontSource,
    });

    it("accepts Google stylesheets and https font files", () => {
        expect(isValidFontSource({ kind: "google", url: googleFontCssUrl("Caveat") })).toBe(true);
        expect(elementSchema.safeParse(text({ kind: "file", url: `https://res.cloudinary.com/${CLOUD}/raw/upload/v1/mosaic-boards/a.woff2` })).success).toBe(
            true,
        );
        expect(elementSchema.safeParse(text(null)).success).toBe(true);
    });

    it("rejects a source pointing anywhere else", () => {
        expect(elementSchema.safeParse(text({ kind: "google", url: "https://evil.example.com/css2?family=X" })).success).toBe(false);
        expect(elementSchema.safeParse(text({ kind: "file", url: "https://cdn.example.com/a.woff2" })).success).toBe(false);
        expect(elementSchema.safeParse(text({ kind: "file", url: `https://res.cloudinary.com/${CLOUD}/raw/upload/v1/other-folder/a.woff2` })).success).toBe(
            false,
        );
        expect(
            isValidFontSource({ kind: "file", url: "https://res.cloudinary.com/someone-else/raw/upload/v1/mosaic-boards/a.woff2" }, { cloudName: "mosaic" }),
        ).toBe(false);
        expect(
            elementSchema.safeParse(text({ kind: "file", url: `https://res.cloudinary.com/${CLOUD}/raw/upload/mosaic-boards/a.woff2?x=");}` })).success,
        ).toBe(false);
        expect(elementSchema.safeParse(text({ kind: "file", url: "data:font/woff2;base64,AAAA" })).success).toBe(false);
    });
});
