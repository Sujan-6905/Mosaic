import { describe, expect, it, vi } from "vitest";
import { chooseDiagramStyle, fallbackStyle } from "../agentStyle.js";

const diagram = {
    nodes: [
        { id: "a", label: "Plan" },
        { id: "b", label: "Build" },
        { id: "c", label: "Ship" },
    ],
    edges: [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
    ],
    groups: [],
};
const reply = (body) => ({ content: JSON.stringify(body) });

describe("choosing a diagram style", () => {
    it("asks nothing when the message names both a structure and a look", async () => {
        const call = vi.fn();
        const style = await chooseDiagramStyle({ text: "our release as a pipeline, blueprint style", diagram, call, boundary: "b" });
        expect(style).toMatchObject({ structure: "pipeline", look: "blueprint", certain: true });
        expect(call).not.toHaveBeenCalled();
    });

    it("keeps the style of the diagram a follow-up changes", async () => {
        const call = vi.fn();
        const previous = { structure: "cycle", look: "clay" };
        expect(await chooseDiagramStyle({ text: "add a review step", diagram, previousStyle: previous, call, boundary: "b" })).toMatchObject({
            structure: "cycle",
            look: "clay",
            certain: true,
        });
        expect(call).not.toHaveBeenCalled();
    });

    it("shortlists from one line per style, then decides from the shortlist's detail", async () => {
        const call = vi
            .fn()
            .mockResolvedValueOnce(reply({ structures: ["pipeline", "flowchart", "numbered-steps"], looks: ["ink", "soft-cards"] }))
            .mockResolvedValueOnce(reply({ structure: "pipeline", look: "soft-cards", confident: true, why: "A short linear process.", alternatives: [] }));
        const style = await chooseDiagramStyle({ text: "how we ship a release", diagram, call, boundary: "b" });
        expect(style).toMatchObject({ structure: "pipeline", look: "soft-cards", certain: true, choices: [] });
        expect(call).toHaveBeenCalledTimes(2);
        const shortlistPrompt = call.mock.calls[0][0].messages.map((message) => message.content).join("\n");
        const decisionPrompt = call.mock.calls[1][0].messages.map((message) => message.content).join("\n");
        expect(shortlistPrompt).toContain("wardley-map");
        expect(decisionPrompt).toContain("pipeline (Pipeline)");
        expect(decisionPrompt).not.toContain("wardley-map");
    });

    it("offers the close candidates when the model can't decide between them", async () => {
        const call = vi
            .fn()
            .mockResolvedValueOnce(reply({ structures: ["pipeline", "numbered-steps"], looks: ["ink"] }))
            .mockResolvedValueOnce(
                reply({
                    structure: "pipeline",
                    look: "ink",
                    confident: false,
                    why: "Reads as a workflow.",
                    alternatives: [{ structure: "numbered-steps", look: "ink", why: "Friendlier for a newcomer." }],
                }),
            );
        const style = await chooseDiagramStyle({ text: "how we ship a release", diagram, call, boundary: "b" });
        expect(style.certain).toBe(false);
        expect(style.choices.map((choice) => choice.structure)).toEqual(["pipeline", "numbered-steps"]);
    });

    it("ignores a pick that wasn't on its own shortlist", async () => {
        const call = vi
            .fn()
            .mockResolvedValueOnce(reply({ structures: ["pipeline", "flowchart"], looks: ["ink", "clay"] }))
            .mockResolvedValueOnce(reply({ structure: "wardley-map", look: "ink", confident: true, why: "", alternatives: [] }));
        const style = await chooseDiagramStyle({ text: "how we ship a release", diagram, call, boundary: "b" });
        expect(style.structure).not.toBe("wardley-map");
        expect(style.source).toBe("ranked");
    });

    it("still draws, from the content alone, when the model calls fail", async () => {
        const call = vi.fn().mockRejectedValue(new Error("rate limited"));
        const style = await chooseDiagramStyle({ text: "a mind map of our launch", diagram, call, boundary: "b" });
        expect(style).toMatchObject({ structure: "radial-map", look: "ink", certain: true, source: "ranked" });
        expect(fallbackStyle("a timeline", diagram).structure).toBe("timeline");
    });
});
