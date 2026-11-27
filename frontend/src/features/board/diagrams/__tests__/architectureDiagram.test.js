import { describe, it, expect } from "vitest";
import { buildArchitectureDiagram } from "../architectureDiagram.js";
import { planDiagramSync } from "../architectureBoard.js";
import { restyleSelection } from "../diagramStyles.js";

let nextId = 0;
const generateElementId = () => `el-${nextId++}`;

const moduleNode = (id, group, layer, extra = {}) => ({
    id,
    label: id,
    kind: "module",
    title: `${id}/`,
    subtitle: "a, b",
    group,
    layer,
    fileCount: 2,
    ...extra,
});
const graph = {
    groups: [
        { id: "group:frontend", label: "Frontend (Next.js)", kind: "frontend" },
        { id: "group:backend", label: "Backend (Express)", kind: "backend" },
    ],
    nodes: [
        moduleNode("pages", "group:frontend", 0),
        moduleNode("board", "group:frontend", 1, { label: "Board editor", description: "Canvas, tools" }),
        moduleNode("server", "group:backend", 0),
        moduleNode("models", "group:backend", 1),
        moduleNode("shared", "group:frontend", 2),
        {
            id: "service:Mongo",
            label: "MongoDB",
            kind: "service",
            serviceKind: "data",
            title: "MongoDB",
            subtitle: "Data store",
            group: "group:data",
            layer: 0,
        },
        {
            id: "service:Kafka",
            label: "Kafka",
            kind: "service",
            serviceKind: "external",
            title: "Kafka",
            subtitle: "External",
            group: "group:external",
            layer: 0,
        },
    ],
    edges: [
        { from: "pages", to: "board", primary: true },
        { from: "board", to: "server", primary: true, label: "WebSocket", protocol: true },
        { from: "board", to: "shared", primary: true, weight: 3 },
        { from: "pages", to: "shared", primary: true, weight: 1 },
        { from: "server", to: "shared", primary: true },
        { from: "server", to: "models", primary: true },
        { from: "models", to: "service:Mongo", primary: true },
        { from: "server", to: "service:Kafka", primary: true },
        { from: "pages", to: "models", primary: false },
    ],
};

const build = (source = graph) => buildArchitectureDiagram({ graph: source, title: "acme/shop", generateElementId });
const asMap = (list) => Object.fromEntries(list.map(({ elementId, element }) => [elementId, element]));
const boxFor = (list, moduleId) => list.find(({ element }) => element.diagram?.role === "node" && element.moduleId === moduleId)?.element;
const tierOf = (element) => element.diagram.data.tier;

describe("buildArchitectureDiagram", () => {
    it("draws one box per module and service, each carrying the module it stands for", () => {
        const list = build();
        graph.nodes.forEach((node) => expect(boxFor(list, node.id)).toBeDefined());
    });

    it("bands parts by app, with code both apps import, data stores and outside services in their own tiers", () => {
        const list = build();
        expect(tierOf(boxFor(list, "pages"))).toBe("Frontend (Next.js)");
        expect(tierOf(boxFor(list, "server"))).toBe("Backend (Express)");
        expect(tierOf(boxFor(list, "shared"))).toBe("Shared code");
        expect(tierOf(boxFor(list, "service:Mongo"))).toBe("Data stores");
        expect(tierOf(boxFor(list, "service:Kafka"))).toBe("External services");
        expect(boxFor(list, "pages").endY).toBeLessThan(boxFor(list, "server").startY);
        expect(boxFor(list, "server").endY).toBeLessThan(boxFor(list, "service:Mongo").startY);
    });

    it("leads with the assistant's name when there is one, and the folder otherwise", () => {
        const list = build();
        expect(boxFor(list, "board").diagram.data).toMatchObject({ label: "Board editor", detail: "Canvas, tools" });
        expect(boxFor(list, "models").diagram.data.label).toBe("models");
    });

    it("draws data stores as cylinders and only links marked primary, keeping protocol labels", () => {
        const list = build();
        expect(boxFor(list, "service:Mongo").shapeType).toBe("Cylinder");
        const connectors = list.filter(({ element }) => element.type === "connector").map(({ element }) => element);
        expect(connectors.some((connector) => connector.moduleId === "pages->models")).toBe(false);
        expect(connectors.find((connector) => connector.moduleId === "board->server")?.text).toBe("WebSocket");
    });

    it("draws shared code's strongest link from each app rather than one from every box", () => {
        const links = build()
            .filter(({ element }) => element.type === "connector" && element.moduleId?.endsWith("->shared"))
            .map(({ element }) => element.moduleId);
        expect(links.sort()).toEqual(["board->shared", "server->shared"]);
    });

    it("is what a sync recognises: nothing new or removed against the same graph", () => {
        const plan = planDiagramSync(asMap(build()), graph);
        expect(plan.newNodes).toEqual([]);
        expect(plan.removedElementIds).toEqual([]);
        expect(plan.crossEdges).toEqual([]);
    });

    it("keeps module ids through a restyle, so sync still works afterwards", () => {
        const elements = asMap(build());
        const ids = Object.keys(elements);
        const restyled = restyleSelection({ elements, ids, recipe: { structure: "containers" }, generateElementId });
        const after = asMap(restyled.elements);
        expect(planDiagramSync(after, graph).newNodes).toEqual([]);
    });
});
