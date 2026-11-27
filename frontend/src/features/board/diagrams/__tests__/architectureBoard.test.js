import { describe, it, expect } from "vitest";
import {
    buildConnectorBetween,
    comparisonToChanges,
    describeSyncResult,
    findModuleBoxId,
    pickDiagramEdges,
    planDiagramSync,
    REMOVED_MODULE_COLOR,
} from "../architectureBoard.js";

const moduleNode = (id, label = id) => ({ id, label, kind: "module" });
const box = (moduleId, x = 0) => ({
    type: "shape",
    shapeType: "Rectangle",
    moduleId,
    startX: x,
    startY: 0,
    endX: x + 100,
    endY: 50,
    color: "#111111",
    opacity: 100,
});
const label = (moduleId, text) => ({ type: "text", moduleId, text, x: 0, y: 0, width: 100 });
const link = (from, to) => ({ type: "connector", moduleId: `${from}->${to}`, color: "#111111", opacity: 100 });

describe("pickDiagramEdges", () => {
    it("draws what the analysis marked and leaves the rest in the graph", () => {
        const edges = [
            { from: "a", to: "b", weight: 9, primary: true },
            { from: "a", to: "c", weight: 1, primary: false },
        ];
        expect(pickDiagramEdges({ nodes: [], edges })).toEqual([edges[0]]);
    });
});

describe("planDiagramSync", () => {
    const elements = {
        a: box("auth", 500),
        aLabel: label("auth", "Sign in, as I renamed it"),
        b: box("db"),
        ab: link("auth", "db"),
        note: { type: "sticky", text: "Mine" },
    };

    it("does nothing when the structure matches", () => {
        const plan = planDiagramSync(elements, { nodes: [moduleNode("auth"), moduleNode("db")], edges: [{ from: "auth", to: "db", weight: 1 }] });
        expect(plan).toMatchObject({ updates: {}, removedElementIds: [], newNodes: [], crossEdges: [], newInternalEdges: [] });
    });

    it("never moves a box or rewords its label", () => {
        const plan = planDiagramSync(elements, {
            nodes: [moduleNode("auth", "A new generated name"), moduleNode("db"), moduleNode("queue")],
            edges: [{ from: "auth", to: "db", weight: 1 }],
        });
        expect(Object.keys(plan.updates)).toEqual([]);
    });

    it("marks a removed module and its link instead of deleting them", () => {
        const plan = planDiagramSync(elements, { nodes: [moduleNode("db")], edges: [] });
        expect(plan.removedElementIds.sort()).toEqual(["a", "ab"]);
        expect(plan.updates.a.color).toBe(REMOVED_MODULE_COLOR);
        expect(plan.updates.a.startX).toBe(500);
    });

    it("leaves what someone drew by hand alone", () => {
        const plan = planDiagramSync(elements, { nodes: [], edges: [] });
        expect(plan.updates.note).toBeUndefined();
    });

    it("sorts new work into new modules, links among them and links to existing boxes", () => {
        const plan = planDiagramSync(elements, {
            nodes: [moduleNode("auth"), moduleNode("db"), moduleNode("queue"), moduleNode("mail")],
            edges: [
                { from: "auth", to: "db", weight: 3 },
                { from: "queue", to: "mail", weight: 2 },
                { from: "queue", to: "db", weight: 1 },
            ],
        });
        expect(plan.newNodes.map((node) => node.id)).toEqual(["queue", "mail"]);
        expect(plan.newInternalEdges.map((edge) => `${edge.from}->${edge.to}`)).toEqual(["queue->mail"]);
        expect(plan.crossEdges.map((edge) => `${edge.from}->${edge.to}`)).toEqual(["queue->db"]);
    });
});

describe("buildConnectorBetween", () => {
    it("joins the two boxes' centres and stays bound to them", () => {
        const connector = buildConnectorBetween({
            edge: { from: "a", to: "b" },
            startElementId: "s",
            endElementId: "e",
            startElement: box("a"),
            endElement: box("b", 300),
            color: "#000000",
            zIndex: 9,
        });
        expect(connector).toMatchObject({ startElementId: "s", endElementId: "e", startX: 50, endX: 350, moduleId: "a->b", arrowEnd: true, zIndex: 9 });
    });
});

describe("findModuleBoxId", () => {
    it("finds the box, not its label", () => {
        expect(findModuleBoxId({ t: label("db", "DB"), b: box("db") }, "db")).toBe("b");
    });
});

describe("describeSyncResult", () => {
    it("says whether anything happened", () => {
        expect(describeSyncResult({ addedCount: 0, removedCount: 0, unchanged: true })).toBe("Already up to date.");
        expect(describeSyncResult({ addedCount: 0, removedCount: 0, unchanged: false })).toContain("structure didn't");
        expect(describeSyncResult({ addedCount: 2, removedCount: 1 })).toBe("2 new modules added, 1 removed item marked in red. Your layout stayed as it was.");
    });
});

describe("comparisonToChanges", () => {
    const elements = { a: box("auth"), aLabel: label("auth", "Sign in"), b: box("db", 300) };
    const emptyDiff = { addedNodes: [], changedNodes: [], removedNodes: [], addedEdges: [], removedEdges: [] };

    it("uses the board's own wording and points at the box", () => {
        const [change] = comparisonToChanges({ ...emptyDiff, changedNodes: [moduleNode("auth", "folder/auth")] }, elements);
        expect(change).toMatchObject({ kind: "edited", name: "Sign in" });
        expect(change.bounds).not.toBeNull();
    });

    it("lists a module the diagram doesn't have, with nowhere to point", () => {
        const [change] = comparisonToChanges({ ...emptyDiff, addedNodes: [moduleNode("queue", "queue")] }, elements);
        expect(change).toMatchObject({ kind: "added", name: "queue", bounds: null });
    });

    it("covers both ends of a link", () => {
        const [change] = comparisonToChanges({ ...emptyDiff, addedEdges: [{ from: "auth", to: "db" }] }, elements);
        expect(change.name).toBe("link from Sign in to db");
        expect(change.bounds).toMatchObject({ minX: 0, maxX: 400 });
    });
});
