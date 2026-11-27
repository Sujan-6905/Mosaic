import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../ai/model/provider.js", async (importOriginal) => ({ ...(await importOriginal()), modelCompletion: vi.fn() }));
vi.mock("../../ai/model/turnBudget.js", async (importOriginal) => ({ ...(await importOriginal()), recordModelUsage: vi.fn() }));
vi.mock("../../ai/turn/agentTurn.js", () => ({ modelChain: () => ["test-model"] }));

const { modelCompletion } = await import("../../ai/model/provider.js");
const { explainGraph } = await import("../explainGraph.js");

const graph = {
    folders: ["src/auth", "src/db"],
    nodes: [
        { id: "src/auth", label: "src/auth", kind: "module", fileCount: 3, sampleFiles: ["login.js"], contentHash: "secret-hash" },
        { id: "src/db", label: "src/db", kind: "module", fileCount: 2, sampleFiles: ["pool.js"], contentHash: "h2" },
        { id: "service:Redis", label: "Redis", kind: "service", fileCount: 0 },
    ],
    edges: [{ from: "src/auth", to: "src/db", weight: 2 }],
};

const replyWith = (modules) => modelCompletion.mockResolvedValue({ content: JSON.stringify({ modules }), usage: { inputTokens: 10, outputTokens: 5 } });

describe("explainGraph", () => {
    beforeEach(() => modelCompletion.mockReset());

    it("names the modules it was asked about, and keeps a folder name for one it skipped", async () => {
        replyWith([{ id: "src/auth", name: "Sign in", description: "Handles login." }]);
        const { nodes } = await explainGraph({ apiKey: "k", graph });
        expect(nodes[0]).toMatchObject({ label: "Sign in", description: "Handles login." });
        expect(nodes[1].label).toBe("src/db");
        expect(nodes[2].label).toBe("Redis");
    });

    it("ignores an id it wasn't given", async () => {
        replyWith([{ id: "made/up", name: "Ghost", description: "" }]);
        const { nodes } = await explainGraph({ apiKey: "k", graph });
        expect(nodes.map((node) => node.label)).toEqual(["src/auth", "src/db", "Redis"]);
    });

    it("sends the structure as fenced data, with no hashes", async () => {
        replyWith([]);
        await explainGraph({ apiKey: "k", graph });
        const { messages } = modelCompletion.mock.calls[0][0];
        expect(messages[0].content).not.toContain("src/auth");
        expect(messages[1].content).toContain("src/auth");
        expect(messages[1].content).toMatch(/<<board_data_/);
        expect(messages[1].content).not.toContain("secret-hash");
    });

    it("throws on a malformed reply, so the caller can fall back to folder names", async () => {
        modelCompletion.mockResolvedValue({ content: "not json" });
        await expect(explainGraph({ apiKey: "k", graph })).rejects.toThrow();
    });
});
