import { describe, it, expect } from "vitest";
import validateDiagram from "../validateDiagram.js";

const validDiagram = JSON.stringify({
    nodes: [
        { id: "presentation", label: "Presentation Layer" },
        { id: "application", label: "Application Layer", shape: "ellipse" },
    ],
    edges: [{ from: "presentation", to: "application", label: "calls" }],
});

describe("validateDiagram", () => {
    it("accepts a well-formed graph", () => {
        const result = validateDiagram(validDiagram);
        expect(result.valid).toBe(true);
        expect(result.nodes).toHaveLength(2);
        expect(result.edges).toHaveLength(1);
    });

    it("rejects malformed JSON", () => {
        const result = validateDiagram("{not json");
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/not valid JSON/i);
    });

    it("rejects a response missing the nodes array", () => {
        const result = validateDiagram(JSON.stringify({ edges: [] }));
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/nodes/i);
    });

    it("rejects a response missing the edges array", () => {
        const result = validateDiagram(JSON.stringify({ nodes: [{ id: "a", label: "A" }] }));
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/edges/i);
    });

    it("rejects an empty nodes array", () => {
        const result = validateDiagram(JSON.stringify({ nodes: [], edges: [] }));
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/empty/i);
    });

    it("rejects more than 30 nodes", () => {
        const nodes = Array.from({ length: 31 }, (_, i) => ({ id: `n${i}`, label: `Node ${i}` }));
        const result = validateDiagram(JSON.stringify({ nodes, edges: [] }));
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/too many/i);
    });

    it("rejects more than 60 edges", () => {
        const nodes = [
            { id: "a", label: "A" },
            { id: "b", label: "B" },
        ];
        const edges = Array.from({ length: 61 }, () => ({ from: "a", to: "b" }));
        const result = validateDiagram(JSON.stringify({ nodes, edges }));
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/too many/i);
    });

    it("rejects a node missing an id", () => {
        const result = validateDiagram(JSON.stringify({ nodes: [{ label: "A" }], edges: [] }));
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/missing a string "id"/i);
    });

    it("rejects a node missing a label", () => {
        const result = validateDiagram(JSON.stringify({ nodes: [{ id: "a" }], edges: [] }));
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/missing a string "label"/i);
    });

    it("rejects a duplicate node id", () => {
        const nodes = [
            { id: "a", label: "A" },
            { id: "a", label: "A again" },
        ];
        const result = validateDiagram(JSON.stringify({ nodes, edges: [] }));
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/used more than once/i);
    });

    it("rejects an invalid node shape", () => {
        const result = validateDiagram(JSON.stringify({ nodes: [{ id: "a", label: "A", shape: "hexagon" }], edges: [] }));
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/invalid "shape"/i);
    });

    it("rejects an edge referencing a node id that doesn't exist", () => {
        const nodes = [{ id: "a", label: "A" }];
        const result = validateDiagram(JSON.stringify({ nodes, edges: [{ from: "a", to: "ghost" }] }));
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/references a node id/i);
    });

    it("never accepts coordinates as a substitute for the graph contract", () => {
        const result = validateDiagram(JSON.stringify({ elements: [{ kind: "box", x: 0, y: 0, w: 10, h: 10 }] }));
        expect(result.valid).toBe(false);
    });
});

describe("validateDiagram decision nodes", () => {
    it("accepts a diamond-shaped decision node", () => {
        const raw = JSON.stringify({
            nodes: [
                { id: "q", label: "Valid?", shape: "diamond" },
                { id: "ok", label: "Continue" },
            ],
            edges: [{ from: "q", to: "ok", label: "yes" }],
        });
        expect(validateDiagram(raw).valid).toBe(true);
    });
});
