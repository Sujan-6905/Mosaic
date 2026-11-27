import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { boardElements, emptyDiff, fakeDrawing, modelReply } from "./aiTurnFixtures.js";

vi.mock("../../../ai/model/provider.js", async (importOriginal) => ({
    ...(await importOriginal()),
    chatCompletion: vi.fn(),
    modelCompletion: vi.fn(),
}));
class MockTurnBudgetExceededError extends Error {}
// How a diagram's style is chosen has its own tests; here it stays out of the model calls being counted.
vi.mock("../../../ai/turn/agentStyle.js", () => ({
    chooseDiagramStyle: vi.fn(async () => ({ structure: "flowchart", look: "ink", certain: true, choices: [] })),
}));
vi.mock("../../../ai/model/turnBudget.js", () => ({
    recordModelUsage: vi.fn(),
    createTurnBudget: vi.fn(() => ({ spend: vi.fn() })),
    TurnBudgetExceededError: MockTurnBudgetExceededError,
}));
vi.mock("../../../ai/edits/agentEdit.js", () => ({
    applyAgentEdit: vi.fn(),
    planAgentEdit: vi.fn(),
    commitPlannedEdit: vi.fn(),
    discardPlannedEdit: vi.fn(),
}));
vi.mock("../../../models/drawingSchema.js", () => ({
    default: { findOne: vi.fn() },
}));
vi.mock("../../../models/aiConversationSchema.js", () => ({
    mostRecentLiveRef: () => null,
    default: {
        appendTurn: vi.fn().mockResolvedValue(undefined),
        findOwned: vi.fn(),
        listForUser: vi.fn(),
        start: vi.fn(),
        removeById: vi.fn().mockResolvedValue(undefined),
    },
}));

const { chatCompletion, modelCompletion, ProviderError } = await import("../../../ai/model/provider.js");
const { resetBreakersForTests } = await import("../../../ai/model/resilience.js");
const { createTurnBudget } = await import("../../../ai/model/turnBudget.js");
const { commitPlannedEdit } = await import("../../../ai/edits/agentEdit.js");
const Drawing = (await import("../../../models/drawingSchema.js")).default;
const AiConversation = (await import("../../../models/aiConversationSchema.js")).default;
const authCheck = (await import("../../middlewares/authMiddleware.js")).default;
const { checkEditAccess } = await import("../../middlewares/checkAccess.js");
const validateBody = (await import("../../middlewares/validateBody.js")).default;
const { aiTurnSchema, aiEditCommitSchema } = await import("../../../validation/restSchemas.js");
const { runTurn } = await import("../aiController.js");
const { commitEditPreview } = await import("../aiEditController.js");

// Mirrors the real route wiring (aiRoutes.js).
const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.post("/api/ai/:shareId/turn", authCheck, checkEditAccess, validateBody(aiTurnSchema), runTurn);
    app.post("/api/ai/:shareId/edit/commit", authCheck, checkEditAccess, validateBody(aiEditCommitSchema), commitEditPreview);
    return app;
};

const token = jwt.sign({ userId: "user-1" }, process.env.JWT_SECRET);
const originalApiKey = process.env.GROQ_API_KEY;

const app = buildApp();

const sendTurn = (body) =>
    request(app)
        .post("/api/ai/board-1/turn")
        .set("Authorization", `Bearer ${token}`)
        .send({ message: "hello", ...body });

const lastModelMessages = () => modelCompletion.mock.calls.at(-1)[0].messages;

beforeEach(() => {
    vi.clearAllMocks();
    resetBreakersForTests();
    process.env.GROQ_API_KEY = "test-key";
    Drawing.findOne.mockResolvedValue(fakeDrawing);
    fakeDrawing.elements = boardElements;
    chatCompletion.mockResolvedValue("0.001");
    AiConversation.findOwned.mockResolvedValue(null);
});

afterAll(() => {
    process.env.GROQ_API_KEY = originalApiKey;
});

describe("POST /api/ai/:shareId/turn: failures", () => {
    const failedGeneration = '{"error":{"failed_generation":"The radius of Earth is 6,371 km","message":"org_01abc tier on_demand"}}';

    const expectNoProviderDetail = (res) => {
        const text = JSON.stringify(res.body);
        ["6,371", "org_01", "on_demand", "Groq", "failed_generation"].forEach((fragment) => expect(text).not.toContain(fragment));
    };

    it("re-asks without replaying a rejected generation, and never surfaces it", async () => {
        modelCompletion
            .mockRejectedValueOnce(new ProviderError({ code: "invalid_output", status: 400, providerCode: "json_validate_failed" }))
            .mockResolvedValueOnce(modelReply({ intent: "refuse" }));

        const res = await sendTurn({ message: "radius of earth" });

        expect(res.body.status).toBe("refused");
        expectNoProviderDetail(res);
        expect(JSON.stringify(lastModelMessages())).not.toContain("6,371");
    });

    it("gives up on invalid output after one re-ask, with a plain message", async () => {
        modelCompletion.mockResolvedValue({ content: "not json", usage: null });

        const res = await sendTurn({});

        expect(modelCompletion).toHaveBeenCalledTimes(2);
        expect(res.status).toBe(422);
        expect(res.body.code).toBe("invalid_output");
        expect(res.body.message).toContain("Try rewording");
    });

    it("asks once more with more room when an answer is cut off at its limit", async () => {
        modelCompletion
            .mockResolvedValueOnce({ content: '{"intent":"reply","mess', finishReason: "length", usage: null })
            .mockResolvedValueOnce({ ...modelReply({ message: "Hello" }), finishReason: "stop" });

        const res = await sendTurn({});

        expect(res.body.message).toBe("Hello");
        const [first, second] = modelCompletion.mock.calls.map(([request]) => request.maxTokens);
        expect(second).toBeGreaterThan(first);
    });

    it("shrinks the board context and retries when the provider says a request is too large", async () => {
        modelCompletion.mockRejectedValueOnce(new ProviderError({ code: "too_large", status: 413 })).mockResolvedValueOnce(modelReply({ message: "Hello" }));

        const res = await sendTurn({});

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("reply");
    });

    it("explains a request that is still too large, in words a person can act on", async () => {
        modelCompletion.mockRejectedValue(new ProviderError({ code: "too_large", status: 413 }));

        const res = await sendTurn({});

        expect(res.status).toBe(422);
        expect(res.body.message).toContain("Select the objects");
        expectNoProviderDetail(res);
    });

    it("falls back to the second model when the first is rate limited", async () => {
        modelCompletion
            .mockRejectedValueOnce(new ProviderError({ code: "rate_limited", status: 429, retryAfterMs: 60_000 }))
            .mockResolvedValueOnce(modelReply({ message: "Hello" }));

        const res = await sendTurn({});

        expect(res.body.status).toBe("reply");
        expect(modelCompletion.mock.calls[1][0].model).not.toBe(modelCompletion.mock.calls[0][0].model);
    });

    it("says when to try again once every model is rate limited", async () => {
        modelCompletion.mockRejectedValue(new ProviderError({ code: "rate_limited", status: 429, retryAfterMs: 42_000 }));

        const res = await sendTurn({});

        expect(res.status).toBe(429);
        expect(res.body.retryAfterSeconds).toBe(42);
        expect(res.body.message).toContain("about 42 seconds");
    });

    it("says the free allowance is spent, in hours, once the wait runs past the per-minute limit", async () => {
        modelCompletion.mockRejectedValue(new ProviderError({ code: "rate_limited", status: 429, retryAfterMs: 3 * 60 * 60 * 1000 }));

        const res = await sendTurn({});

        expect(res.status).toBe(429);
        expect(res.body.message).toBe("The assistant has used its free allowance for now. Try again in about 3 hours.");
    });

    it("reports an outage safely, with a trace id for support", async () => {
        modelCompletion.mockRejectedValue(new ProviderError({ code: "unavailable", status: 503 }));

        const res = await sendTurn({});

        expect(res.status).toBe(503);
        expect(res.body.message).toContain("Your board hasn't changed");
        expect(res.body.traceId).toBeTruthy();
    });

    it("never exposes an unexpected error's text", async () => {
        modelCompletion.mockRejectedValue(new Error(`secret detail ${failedGeneration}`));

        const res = await sendTurn({});

        expectNoProviderDetail(res);
        expect(res.body.message).not.toContain("secret detail");
    });

    it("stops rather than looping when a turn exceeds its model-call ceiling", async () => {
        const { TurnBudgetExceededError: BudgetError } = await import("../../../ai/model/turnBudget.js");
        createTurnBudget.mockReturnValueOnce({
            spend: () => {
                throw new BudgetError(7);
            },
        });

        const res = await sendTurn({});

        expect(res.status).toBe(422);
        expect(res.body.code).toBe("turn_budget");
    });

    it("returns 503 when GROQ_API_KEY isn't configured", async () => {
        delete process.env.GROQ_API_KEY;
        const res = await sendTurn({});
        expect(res.status).toBe(503);
    });

    it("returns 401 with no auth token and 400 with no message", async () => {
        expect((await request(app).post("/api/ai/board-1/turn").send({ message: "hi" })).status).toBe(401);
        expect((await request(app).post("/api/ai/board-1/turn").set("Authorization", `Bearer ${token}`).send({})).status).toBe(400);
    });
});

describe("POST /api/ai/:shareId/edit/commit", () => {
    it("commits a previously planned edit", async () => {
        commitPlannedEdit.mockResolvedValueOnce({ status: "applied", diff: { ...emptyDiff, modified: [{ elementId: "a" }] } });

        const res = await request(buildApp()).post("/api/ai/board-1/edit/commit").set("Authorization", `Bearer ${token}`).send({ token: "preview-token" });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("applied");
        expect(commitPlannedEdit).toHaveBeenCalledWith(
            expect.objectContaining({ token: "preview-token", shareId: "board-1", userId: "user-1", acceptedIndexes: null }),
        );
    });

    it("commits only the accepted subset when acceptedIndexes is given", async () => {
        commitPlannedEdit.mockResolvedValueOnce({ status: "applied", diff: emptyDiff });

        await request(buildApp())
            .post("/api/ai/board-1/edit/commit")
            .set("Authorization", `Bearer ${token}`)
            .send({ token: "preview-token", acceptedIndexes: [0] });

        expect(commitPlannedEdit).toHaveBeenCalledWith(expect.objectContaining({ acceptedIndexes: [0] }));
    });

    it("maps an expired/foreign token to 422", async () => {
        commitPlannedEdit.mockResolvedValueOnce({ status: "rejected", reason: "this preview has expired or was already resolved" });

        const res = await request(buildApp()).post("/api/ai/board-1/edit/commit").set("Authorization", `Bearer ${token}`).send({ token: "stale-token" });

        expect(res.status).toBe(422);
    });
});
