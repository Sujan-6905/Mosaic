import { describe, it, expect } from "vitest";
import { applyResolutionPolicy } from "../resolutionPolicy.js";

const candidate = (ref, score) => ({ ref, score });

describe("applyResolutionPolicy", () => {
    it("resolves when the top score clears the threshold with a clear lead", () => {
        const result = applyResolutionPolicy([candidate("a", 0.8), candidate("b", 0.3)]);
        expect(result).toEqual({ status: "resolved", candidates: [candidate("a", 0.8)] });
    });

    it("stays ambiguous when the top two scores are too close to call", () => {
        const result = applyResolutionPolicy([candidate("a", 0.6), candidate("b", 0.58)]);
        expect(result.status).toBe("ambiguous");
        expect(result.candidates.map((c) => c.ref)).toEqual(["a", "b"]);
    });

    it("stays ambiguous when the top score never clears the resolved threshold", () => {
        const result = applyResolutionPolicy([candidate("a", 0.3), candidate("b", 0.25)]);
        expect(result.status).toBe("ambiguous");
    });

    it("reports none when nothing clears even the ambiguous floor", () => {
        const result = applyResolutionPolicy([candidate("a", 0.05)]);
        expect(result).toEqual({ status: "none", candidates: [] });
    });

    it("resolves a lone strong candidate with no runner-up to compare against", () => {
        const result = applyResolutionPolicy([candidate("a", 0.9)]);
        expect(result.status).toBe("resolved");
    });
});
