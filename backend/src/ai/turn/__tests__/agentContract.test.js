import { describe, it, expect } from "vitest";
import { AGENT_RESPONSE_SCHEMA, parseAgentResponse } from "../agentContract.js";
import { OPERATION_NAMES, SERVER_ONLY_OPERATIONS } from "../../edits/editLanguage.js";

const respond = (fields) => JSON.stringify({ intent: "reply", message: "", diagram: null, sketch: null, ops: null, candidates: null, ...fields });

const collectObjectSchemas = (node, found = []) => {
    if (!node || typeof node !== "object") return found;
    if (node.type === "object") found.push(node);
    Object.values(node).forEach((value) => collectObjectSchemas(value, found));
    return found;
};

describe("AGENT_RESPONSE_SCHEMA", () => {
    it("meets strict mode's rules: every object closed, every property required", () => {
        collectObjectSchemas(AGENT_RESPONSE_SCHEMA.schema).forEach((schema) => {
            expect(schema.additionalProperties).toBe(false);
            expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort());
        });
    });

    it("offers every operation in the edit language", () => {
        const opBranches = AGENT_RESPONSE_SCHEMA.schema.properties.ops.anyOf[0].items.anyOf;
        expect(opBranches.map((branch) => branch.properties.op.enum[0]).sort()).toEqual(
            OPERATION_NAMES.filter((name) => !SERVER_ONLY_OPERATIONS.includes(name)).sort(),
        );
    });
});

describe("parseAgentResponse", () => {
    it("reports non-JSON as invalid rather than throwing", () => {
        expect(parseAgentResponse("the radius of earth is 6371 km").type).toBe("invalid");
        expect(parseAgentResponse(undefined).type).toBe("invalid");
    });

    it.each([
        [{ intent: "reply", message: "" }],
        [{ intent: "diagram" }],
        [{ intent: "sketch" }],
        [{ intent: "edit" }],
        [{ intent: "edit", ops: [] }],
        [{ intent: "clarify", message: "Which?", candidates: ["only-one"] }],
        [{ intent: "unresolved", message: " " }],
        [{ intent: "something-else" }],
    ])("rejects output whose fields don't fit its intent: %j", (fields) => {
        expect(parseAgentResponse(respond(fields)).type).toBe("invalid");
    });

    it("needs no message to send someone to help, since the wording is fixed elsewhere", () => {
        expect(parseAgentResponse(respond({ intent: "help" }))).toEqual({ type: "help" });
    });

    it("needs no message to refuse, since the wording is fixed elsewhere", () => {
        expect(parseAgentResponse(respond({ intent: "refuse" }))).toEqual({ type: "refuse" });
    });

    it("strips strict mode's nulls from ops so the edit language accepts them", () => {
        const parsed = parseAgentResponse(respond({ intent: "edit", ops: [{ op: "connect", refA: "a", refB: "b", label: null }] }));
        expect(parsed.ops).toEqual([{ op: "connect", refA: "a", refB: "b" }]);
    });

    it("keeps moveToFrame's null frameRef, which means take it out of its frame", () => {
        const parsed = parseAgentResponse(respond({ intent: "edit", ops: [{ op: "moveToFrame", ref: "a", frameRef: null }] }));
        expect(parsed.ops[0].frameRef).toBeNull();
    });

    it("reads a restyle's null props as unchanged, names as hex, and none as no fill", () => {
        const parsed = parseAgentResponse(
            respond({ intent: "edit", ops: [{ op: "restyle", ref: "a", props: { color: "blue", fillColor: "none", opacity: null, size: null } }] }),
        );
        expect(parsed.ops[0].props).toEqual({ color: "#3b82f6", fillColor: null });
    });

    it("rejects an op the edit language doesn't have", () => {
        expect(parseAgentResponse(respond({ intent: "edit", ops: [{ op: "dropDatabase" }] })).type).toBe("invalid");
    });

    it("rejects a diagram with an edge to nowhere", () => {
        const diagram = { nodes: [{ id: "a", label: "A", shape: "box", fillColor: null }], edges: [{ from: "a", to: "ghost", label: null }], replaceRefs: [] };
        expect(parseAgentResponse(respond({ intent: "diagram", diagram })).type).toBe("invalid");
    });

    it("drops an unusable node colour rather than rejecting the diagram", () => {
        const diagram = { nodes: [{ id: "a", label: "A", shape: "box", fillColor: "sort of teal-ish" }], edges: [], replaceRefs: [] };
        expect(parseAgentResponse(respond({ intent: "diagram", diagram })).nodes[0].fillColor).toBeUndefined();
    });

    it("passes a sketch through as the subject to draw", () => {
        const parsed = parseAgentResponse(respond({ intent: "sketch", message: "Here it is.", sketch: { subject: "a house with a small cat" } }));
        expect(parsed).toMatchObject({ type: "sketch", subject: "a house with a small cat" });
    });

    it("rejects a sketch with nothing to draw", () => {
        expect(parseAgentResponse(respond({ intent: "sketch", sketch: { subject: "  " } })).type).toBe("invalid");
    });
});
