import { describe, it, expect, beforeEach } from "vitest";
import { createTurnTrace, getRecentAiTraces, resetTracesForTests } from "../turnTrace.js";

describe("createTurnTrace", () => {
    beforeEach(() => resetTracesForTests());

    it("records spans, totals tokens from inference spans and keeps the trace for the dashboard", async () => {
        const trace = createTurnTrace({ surface: "panel", shareId: "s", userId: "u" });
        await trace.span("guard.input", {}, async () => "ok");
        trace.addSpan("chat model-a", { "gen_ai.usage.input_tokens": 100, "gen_ai.usage.output_tokens": 20 });
        trace.addSpan("chat model-b", { "gen_ai.usage.input_tokens": 50, "gen_ai.usage.output_tokens": 5 });

        const finished = trace.finish({ outcome: "reply" });

        expect(finished).toMatchObject({ inputTokens: 150, outputTokens: 25, modelCalls: 2, outcome: "reply" });
        expect(getRecentAiTraces()[0].traceId).toBe(trace.traceId);
    });

    it("records a failed span's error type and rethrows", async () => {
        const trace = createTurnTrace({ surface: "panel", shareId: "s", userId: "u" });
        const failing = trace.span("plan.edit", {}, async () => {
            throw Object.assign(new Error("boom"), { code: "too_large" });
        });
        await expect(failing).rejects.toThrow("boom");
        expect(trace.finish({ outcome: "failed" }).spans[0].attributes["error.type"]).toBe("too_large");
    });

    it("carries no prompt or output text, only counts", () => {
        const trace = createTurnTrace({ surface: "panel", shareId: "s", userId: "u" });
        trace.setAttributes({ "mosaic.guard.flagged": true });
        const serialized = JSON.stringify(trace.finish({ outcome: "refused" }));
        expect(serialized).not.toMatch(/"(prompt|message|content|text)"/);
    });
});
