import { describe, it, expect } from "vitest";
import { buildArchitectureElements } from "../architectureLayout.js";
import { getBoundConnectorUpdates, resolveConnectorPolyline } from "../../../../../../shared/canvas/elements/connectors.js";

let nextId = 0;
const generateElementId = () => `el-${nextId++}`;
const metrics = {
    textWidth: (text, size) => text.length * size * 0.55,
    lineCount: (text, width, size) => Math.max(1, Math.ceil((text.length * size * 0.55) / width)),
};

const moduleNode = (id, group, layer) => ({ id, label: id, kind: "module", title: id, subtitle: "detail", group, layer, fileCount: 2 });
const graph = {
    groups: [
        { id: "group:frontend", label: "Frontend", kind: "frontend" },
        { id: "group:backend", label: "Backend", kind: "backend" },
    ],
    nodes: [
        moduleNode("pages", "group:frontend", 0),
        moduleNode("board", "group:frontend", 1),
        moduleNode("socket", "group:frontend", 2),
        moduleNode("server", "group:backend", 0),
        moduleNode("models", "group:backend", 1),
        { id: "service:Mongo", label: "Mongo", kind: "service", serviceKind: "data", title: "Mongo", subtitle: "Data store", group: "group:data", layer: 0 },
        { id: "service:Auth", label: "Auth", kind: "service", serviceKind: "external", title: "Auth", subtitle: "External", group: "group:external", layer: 0 },
    ],
    edges: [
        { from: "pages", to: "board", weight: 3, primary: true },
        { from: "board", to: "socket", weight: 2, primary: true },
        { from: "socket", to: "server", weight: 1, primary: true, label: "WebSocket", protocol: true, bidirectional: true },
        { from: "server", to: "models", weight: 2, primary: true },
        { from: "models", to: "service:Mongo", weight: 2, primary: true },
        { from: "pages", to: "service:Auth", weight: 1, primary: true },
        { from: "pages", to: "models", weight: 1, primary: false },
    ],
};

const build = () => {
    const list = buildArchitectureElements({ graph, metrics, generateElementId });
    return { list, byId: Object.fromEntries(list.map(({ elementId, element }) => [elementId, element])) };
};
const boxFor = (list, moduleId) => list.find(({ element }) => element.type === "shape" && element.moduleId === moduleId).element;

describe("buildArchitectureElements", () => {
    it("gives each group a labelled frame and each part a box with its title and subtitle", () => {
        const { list } = build();
        expect(list.filter(({ element }) => element.type === "frame").map(({ element }) => element.name)).toEqual(["Frontend", "Backend"]);
        expect(boxFor(list, "pages")).toMatchObject({ text: "pages", subtext: "detail", shapeType: "Rectangle" });
    });

    it("draws data stores as cylinders below everything", () => {
        const { list } = build();
        const store = boxFor(list, "service:Mongo");
        expect(store.shapeType).toBe("Cylinder");
        expect(store.startY).toBeGreaterThan(boxFor(list, "models").endY);
    });

    it("puts outside services to the side", () => {
        const { list } = build();
        expect(boxFor(list, "service:Auth").startX).toBeGreaterThan(boxFor(list, "pages").endX);
    });

    it("stacks rows in layer order, inside their group", () => {
        const { list } = build();
        expect(boxFor(list, "pages").endY).toBeLessThan(boxFor(list, "board").startY);
        expect(boxFor(list, "socket").endY).toBeLessThan(boxFor(list, "server").startY);
    });

    it("only draws edges marked primary, and carries a protocol's label and both heads", () => {
        const { list } = build();
        const connectors = list.filter(({ element }) => element.type === "connector").map(({ element }) => element);
        expect(connectors.some((connector) => connector.moduleId === "pages->models")).toBe(false);
        expect(connectors.find((connector) => connector.moduleId === "socket->server")).toMatchObject({
            text: "WebSocket",
            startHead: "triangle",
            endHead: "triangle",
        });
    });

    it("binds every arrow to real boxes, and its ends land on their edges", () => {
        const { list, byId } = build();
        list.filter(({ element }) => element.type === "connector").forEach(({ element }) => {
            expect(byId[element.startElementId]).toBeDefined();
            expect(byId[element.endElementId]).toBeDefined();
            const route = resolveConnectorPolyline(element, byId);
            const end = route[route.length - 1];
            const target = byId[element.endElementId];
            expect(end.x).toBeGreaterThanOrEqual(target.startX - 1);
            expect(end.x).toBeLessThanOrEqual(target.endX + 1);
        });
    });

    it("keeps arrows attached when a box is moved", () => {
        const { list, byId } = build();
        const [boardId] = list.find(({ element }) => element.moduleId === "board") ? [list.find(({ element }) => element.moduleId === "board").elementId] : [];
        const moved = { ...byId, [boardId]: { ...byId[boardId], startX: byId[boardId].startX + 300, endX: byId[boardId].endX + 300 } };
        const updates = getBoundConnectorUpdates(moved, [boardId]);
        expect(Object.keys(updates).length).toBeGreaterThan(0);
    });
});
