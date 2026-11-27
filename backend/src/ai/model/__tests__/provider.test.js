import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveModelForRole, DEFAULT_MODELS } from "../provider.js";

describe("resolveModelForRole", () => {
    it("resolves each role to its documented default with no env override", () => {
        expect(resolveModelForRole("reasoning", {})).toBe(DEFAULT_MODELS.reasoning);
        expect(resolveModelForRole("stylist", {})).toBe(DEFAULT_MODELS.stylist);
    });

    it("prefers an env override over the default", () => {
        expect(resolveModelForRole("stylist", { AI_MODEL_STYLIST: "some-other-model" })).toBe("some-other-model");
    });

    it("throws a typed error for an unknown role", () => {
        expect(() => resolveModelForRole("summarizer", {})).toThrow('Unknown AI model role "summarizer"');
    });
});

describe("chatCompletion", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.unstubAllEnvs();
    });

    it("sends the resolved role's model and forces JSON mode by default", async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: "{}" } }] }) });
        const { chatCompletion } = await import("../provider.js");

        await chatCompletion({ apiKey: "key", role: "reasoning", messages: [{ role: "user", content: "hi" }] });

        const body = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(body.model).toBe(DEFAULT_MODELS.reasoning);
        expect(body.response_format).toEqual({ type: "json_object" });
    });

    it("omits response_format when the caller opts out of JSON mode", async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: "prose" } }] }) });
        const { chatCompletion } = await import("../provider.js");

        await chatCompletion({ apiKey: "key", role: "stylist", responseFormat: null, messages: [] });

        const body = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(body.response_format).toBeUndefined();
    });

    const failedResponse = (status, body, retryAfter = null) => ({
        ok: false,
        status,
        text: async () => body,
        headers: { get: (name) => (name === "retry-after" ? retryAfter : null) },
    });

    it.each([
        [400, '{"error":{"code":"json_validate_failed","failed_generation":"6,371 km"}}', "invalid_output"],
        [413, '{"error":{"message":"Request too large in organization org_01abc"}}', "too_large"],
        [429, '{"error":{"message":"Limit in organization org_01abc on_demand"}}', "rate_limited"],
        [401, "{}", "auth"],
        [503, "<html>", "unavailable"],
        [498, "{}", "unavailable"],
        [400, '{"error":{"code":"context_length_exceeded"}}', "too_large"],
        [400, "{}", "bad_request"],
    ])("classifies a %i and keeps the response body out of the error", async (status, body, code) => {
        global.fetch.mockResolvedValueOnce(failedResponse(status, body));
        const { chatCompletion: complete } = await import("../provider.js");

        const error = await complete({ apiKey: "key", messages: [] }).catch((caught) => caught);

        expect(error.code).toBe(code);
        ["6,371", "org_01", "on_demand", "failed_generation"].forEach((fragment) =>
            expect(`${error.message} ${JSON.stringify(error)}`).not.toContain(fragment),
        );
    });

    it("reads retry-after into milliseconds", async () => {
        global.fetch.mockResolvedValueOnce(failedResponse(429, "{}", "12"));
        const { chatCompletion: complete } = await import("../provider.js");
        await expect(complete({ apiKey: "key", messages: [] })).rejects.toMatchObject({ retryAfterMs: 12_000 });
    });

    it("asks for strict decoding when given a schema", async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
                usage: { prompt_tokens: 3, completion_tokens: 4 },
                model: "m",
            }),
        });
        const { modelCompletion } = await import("../provider.js");

        const result = await modelCompletion({ apiKey: "key", messages: [], responseSchema: { name: "x", schema: { type: "object" } } });

        const body = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(body.response_format).toEqual({ type: "json_schema", json_schema: { name: "x", strict: true, schema: { type: "object" } } });
        expect(result.usage).toEqual({ inputTokens: 3, outputTokens: 4 });
    });
});
