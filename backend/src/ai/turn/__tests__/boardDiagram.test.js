import { describe, expect, it } from "vitest";
import { keepBoardLanes, readBoardDiagram, readDiagramBehind } from "../boardDiagram.js";

const node = (key, label, order, data = {}) => ({
    type: "shape",
    shapeType: "Rectangle",
    text: label,
    diagram: { id: "d1", key, role: "node", order, data: { label, ...data } },
});
const elements = {
    gateway: node("gateway", "API Gateway", 0, { kind: "service", lane: "Edge" }),
    redis: node("redis", "Redis", 1, { kind: "database", lane: "Data" }),
    link: {
        type: "connector",
        startElementId: "gateway",
        endElementId: "redis",
        text: "cache",
        diagram: { id: "d1", key: "gateway-redis", role: "edge", data: {} },
    },
    title: {
        type: "text",
        text: "Ride hailing",
        diagram: { id: "d1", key: "title", role: "title", recipe: { structure: "layered-tiers", look: "watercolour" } },
    },
    note: { type: "sticky", text: "Launch Friday" },
};
const objects = [
    { ref: "obj_gateway", name: "API Gateway", memberElementIds: ["gateway"] },
    { ref: "obj_redis", name: "Redis", memberElementIds: ["redis"] },
    { ref: "obj_link", name: "cache", memberElementIds: ["link"] },
    { ref: "obj_title", name: "Ride hailing", memberElementIds: ["title"] },
    { ref: "obj_note", name: "Launch Friday", memberElementIds: ["note"] },
];

describe("readBoardDiagram", () => {
    it("offers the diagram a message names a part of, by the refs the model edits with, in its own style", () => {
        const offered = readBoardDiagram("Add a CDN between the apps and the API gateway", objects, elements);
        expect(offered.diagram.nodes).toEqual([
            { id: "obj_gateway", label: "API Gateway", kind: "service", lane: "Edge" },
            { id: "obj_redis", label: "Redis", kind: "database", lane: "Data" },
        ]);
        expect(offered.diagram.edges).toEqual([{ from: "obj_gateway", to: "obj_redis", label: "cache" }]);
        expect(offered.diagram.style).toEqual({ structure: "layered-tiers", look: "watercolour" });
        expect(offered.placedDiagram.refs.sort()).toEqual(["obj_gateway", "obj_link", "obj_redis", "obj_title"]);
    });

    it("offers the only diagram when the message speaks of a diagram without naming a part", () => {
        expect(readBoardDiagram("add a load balancer to the diagram", objects, elements)).not.toBeNull();
    });

    it("leaves messages about other things alone", () => {
        expect(readBoardDiagram("draw a cat next to the note", objects, elements)).toBeNull();
    });

    it("never offers a diagram whose text was flagged", () => {
        expect(readBoardDiagram("rename the API gateway", objects, elements, ["obj_redis"])).toBeNull();
    });
});

describe("keepBoardLanes", () => {
    const previous = {
        nodes: [
            { id: "obj_gateway", label: "API Gateway", lane: "Edge" },
            { id: "obj_redis", label: "Redis", lane: "Data" },
        ],
    };

    it("keeps the lanes nodes already had and leaves new nodes where the model put them", () => {
        const updated = {
            nodes: [
                { id: "obj_gateway", label: "API Gateway", lane: "service" },
                { id: "cdn", label: "CDN", lane: "Edge" },
            ],
        };
        expect(keepBoardLanes(updated, previous, "add a CDN in front of the gateway").nodes).toEqual([
            { id: "obj_gateway", label: "API Gateway", lane: "Edge" },
            { id: "cdn", label: "CDN", lane: "Edge" },
        ]);
    });

    it("adds no lanes to a diagram that had none", () => {
        const plain = { nodes: [{ id: "a", label: "A" }] };
        expect(
            keepBoardLanes(
                {
                    nodes: [
                        { id: "a", label: "A", lane: "client" },
                        { id: "b", label: "B", lane: "store" },
                    ],
                },
                plain,
                "add B",
            ).nodes,
        ).toEqual([
            { id: "a", label: "A" },
            { id: "b", label: "B" },
        ]);
    });

    it("keeps the board's band when the model writes its own under another field", () => {
        const updated = {
            nodes: [
                { id: "obj_gateway", label: "API Gateway", tier: "Edge Tier" },
                { id: "cdn", label: "CDN", tier: "Edge Tier" },
            ],
        };
        expect(keepBoardLanes(updated, previous, "add a CDN in front of the gateway").nodes).toEqual([
            { id: "obj_gateway", label: "API Gateway", lane: "Edge" },
            { id: "cdn", label: "CDN", lane: "Edge" },
        ]);
    });

    it("lets a message about lanes move things between them", () => {
        const updated = { nodes: [{ id: "obj_gateway", label: "API Gateway", lane: "Data" }] };
        expect(keepBoardLanes(updated, previous, "move the gateway to the data lane").nodes[0].lane).toBe("Data");
    });
});

describe("readDiagramBehind", () => {
    it("reads the whole diagram behind placed objects, with its style, so a follow-up replaces all of it", () => {
        const offered = readDiagramBehind(["obj_gateway"], objects, elements);
        expect(offered.diagram.style).toEqual({ structure: "layered-tiers", look: "watercolour" });
        expect(offered.placedDiagram.refs.sort()).toEqual(["obj_gateway", "obj_link", "obj_redis", "obj_title"]);
        expect(offered.diagram.edges).toEqual([{ from: "obj_gateway", to: "obj_redis", label: "cache" }]);
    });

    it("leaves objects that carry no diagram to the caller", () => {
        expect(readDiagramBehind(["obj_note"], objects, elements)).toBeNull();
    });
});
