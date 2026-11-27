import { describe, it, expect, beforeEach, vi } from "vitest";

describe("getCorrelationId", () => {
    beforeEach(() => {
        vi.resetModules();
        window.sessionStorage.clear();
    });

    it("mints a new id and persists it to sessionStorage on first call", async () => {
        const { getCorrelationId } = await import("../correlationId");

        const id = getCorrelationId();

        expect(id).toBeTruthy();
        expect(window.sessionStorage.getItem("mosaic:correlationId")).toBe(id);
    });

    it("returns the same id on a second call within the same module instance (in-memory cache)", async () => {
        const { getCorrelationId } = await import("../correlationId");

        const first = getCorrelationId();
        const second = getCorrelationId();

        expect(second).toBe(first);
    });

    it("reuses a pre-existing sessionStorage value instead of minting a new one", async () => {
        window.sessionStorage.setItem("mosaic:correlationId", "existing-id");
        const { getCorrelationId } = await import("../correlationId");

        expect(getCorrelationId()).toBe("existing-id");
    });
});
