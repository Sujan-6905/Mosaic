import { describe, it, expect, beforeEach } from "vitest";
import { createTurnBudget, TurnBudgetExceededError, estimateTokens, recordModelUsage, MAX_MODEL_CALLS_PER_TURN } from "../turnBudget.js";
import { _resetForTests, getMetrics } from "../../../observability/metrics.js";

const base = { rooms: 0, sockets: 0, roomOccupancy: 0 };

beforeEach(() => {
    _resetForTests();
});

describe("estimateTokens", () => {
    it("approximates tokens at roughly 4 characters each", () => {
        expect(estimateTokens("a".repeat(400))).toBe(100);
    });

    it("treats missing text as zero tokens", () => {
        expect(estimateTokens(undefined)).toBe(0);
        expect(estimateTokens("")).toBe(0);
    });
});

describe("recordModelUsage", () => {
    it("estimates tokens from the texts when the provider sent no usage", () => {
        recordModelUsage({ promptText: "a".repeat(40), responseText: "b".repeat(40) });

        const metrics = getMetrics(base);
        expect(metrics.ai.modelCallsToday).toBe(1);
        expect(metrics.ai.tokensApproxToday).toBe(20);
    });

    it("prefers the provider's own token count", () => {
        recordModelUsage({ promptText: "a".repeat(4000), usage: { inputTokens: 7, outputTokens: 3 } });

        expect(getMetrics(base).ai.tokensApproxToday).toBe(10);
    });
});

describe("createTurnBudget", () => {
    it("allows calls up to the per-turn ceiling", () => {
        const turnBudget = createTurnBudget();
        for (let i = 0; i < MAX_MODEL_CALLS_PER_TURN; i++) {
            expect(() => turnBudget.spend()).not.toThrow();
        }
    });

    it("throws a typed error rather than allowing an unbounded turn", () => {
        const turnBudget = createTurnBudget();
        for (let i = 0; i < MAX_MODEL_CALLS_PER_TURN; i++) turnBudget.spend();

        expect(() => turnBudget.spend()).toThrow(TurnBudgetExceededError);
    });

    it("is scoped per turn - a fresh turn starts with a clean ceiling", () => {
        const first = createTurnBudget();
        for (let i = 0; i < MAX_MODEL_CALLS_PER_TURN; i++) first.spend();

        const second = createTurnBudget();
        expect(() => second.spend()).not.toThrow();
    });
});
