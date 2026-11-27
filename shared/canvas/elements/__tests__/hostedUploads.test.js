import { describe, it, expect } from "vitest";
import { isHostedUpload, isRasterImageBytes } from "../hostedUploads.js";

describe("isHostedUpload", () => {
    const image = "https://res.cloudinary.com/demo/image/upload/v17/mosaic-boards/abc.png";

    it("accepts an upload in the app's folder, pinned to the account when one is known", () => {
        expect(isHostedUpload(image, "image")).toBe(true);
        expect(isHostedUpload(image, "image", { cloudName: "demo" })).toBe(true);
        expect(isHostedUpload(image, "image", { cloudName: "someone-else" })).toBe(false);
    });

    it.each([
        "http://res.cloudinary.com/demo/image/upload/v17/mosaic-boards/abc.png",
        "https://res.cloudinary.com.evil.example/demo/image/upload/v17/mosaic-boards/abc.png",
        "https://res.cloudinary.com/demo/image/upload/v17/other-folder/abc.png",
        "https://res.cloudinary.com/demo/raw/upload/v17/mosaic-boards/abc.png",
        "https://tracker.example/pixel.gif",
        "not a url",
    ])("refuses %s as an image", (src) => {
        expect(isHostedUpload(src, "image")).toBe(false);
    });
});

describe("isRasterImageBytes", () => {
    const padded = (bytes) => Uint8Array.from([...bytes, ...new Array(16).fill(0)]);

    it("recognises PNG, JPEG, GIF and WebP by their first bytes", () => {
        expect(isRasterImageBytes(padded([0x89, 0x50, 0x4e, 0x47]))).toBe(true);
        expect(isRasterImageBytes(padded([0xff, 0xd8, 0xff]))).toBe(true);
        expect(isRasterImageBytes(padded([0x47, 0x49, 0x46, 0x38]))).toBe(true);
        expect(isRasterImageBytes(padded([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]))).toBe(true);
    });

    it("refuses anything else, including SVG and HTML", () => {
        expect(isRasterImageBytes(padded([...Buffer.from("<svg xmlns")]))).toBe(false);
        expect(isRasterImageBytes(padded([...Buffer.from("<!doctype html>")]))).toBe(false);
        expect(isRasterImageBytes(new Uint8Array(3))).toBe(false);
    });
});
