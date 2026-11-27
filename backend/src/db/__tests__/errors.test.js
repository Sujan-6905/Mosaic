import { describe, it, expect } from "vitest";
import { nullIfMissing } from "../errors.js";

describe("nullIfMissing", () => {
    it("passes a found document through", async () => {
        expect(await nullIfMissing(async () => ({ id: 1 }))).toEqual({ id: 1 });
    });

    it("turns a miss into null, whichever package threw it", async () => {
        class DocumentNotFoundError extends Error {}
        expect(
            await nullIfMissing(async () => {
                throw new DocumentNotFoundError();
            }),
        ).toBeNull();
        expect(
            await nullIfMissing(async () => {
                throw Object.assign(new Error("x"), { name: "DocumentNotFoundError" });
            }),
        ).toBeNull();
    });

    it("lets a database failure through, so an outage never reads as a missing board", async () => {
        await expect(
            nullIfMissing(async () => {
                throw new Error("ambiguous timeout");
            }),
        ).rejects.toThrow("ambiguous timeout");
    });
});
