import { describe, expect, it } from "vitest";
import "../layoutEngine.js";
import { buildDiagram } from "../../../../../../shared/canvas/diagramStyles/index.js";
import { explicitStyleIn } from "../../../../../../shared/canvas/diagramStyles/ranking.js";
import { elementSchema } from "../../../../../../backend/src/validation/socketSchemas.js";

let counter = 0;
const build = (model, recipe) => buildDiagram({ model, recipe, generateElementId: () => `e${(counter += 1)}` }).elements.map(({ element }) => element);
const node = (id, label, extra = {}) => ({ id, label, ...extra });

const tiers = {
    nodes: [
        node("web", "Web", { tier: "Clients" }),
        node("gw", "Gateway", { tier: "Edge" }),
        node("orders", "Orders", { tier: "Services" }),
        node("menu", "Menu", { tier: "Services" }),
        node("pay", "Payments", { tier: "Services" }),
        node("db", "Postgres", { tier: "Data" }),
        node("cache", "Redis", { tier: "Data" }),
    ],
    edges: [
        { from: "web", to: "gw", label: "HTTPS" },
        { from: "gw", to: "orders", label: "REST" },
        { from: "gw", to: "cache", label: "Session lookup" },
        { from: "orders", to: "pay", label: "Charge" },
        { from: "orders", to: "db", label: "SQL" },
        { from: "menu", to: "cache", label: "Cache" },
    ],
};

describe("layered tiers", () => {
    const elements = build(tiers, { structure: "layered-tiers" });
    const connectors = elements.filter((element) => element.type === "connector" && element.diagram?.role === "edge");
    const boxOf = (label) => {
        const shape = elements.find((element) => element.type === "shape" && element.text === label);
        return { minX: shape.startX, maxX: shape.endX, minY: shape.startY, maxY: shape.endY };
    };

    it("draws every link, each with a route and its label on the route's channel", () => {
        expect(connectors).toHaveLength(tiers.edges.length);
        connectors.filter((connector) => connector.waypoints?.length).forEach((connector) => expect(connector.labelT).toBeGreaterThan(0));
    });

    it("routes a link that skips a lane clear of that lane's nodes", () => {
        const skipping = connectors.find((connector) => connector.text === "Session lookup");
        const vertical = skipping.waypoints.slice(1, -1).find((point, index, points) => points[index + 1] && points[index + 1].x === point.x);
        ["Orders", "Menu", "Payments"].map(boxOf).forEach((box) => expect(vertical.x <= box.minX || vertical.x >= box.maxX).toBe(true));
    });

    it("passes a labelled link within a lane under the row rather than through a neighbour", () => {
        const charge = connectors.find((connector) => connector.text === "Charge");
        expect(Math.max(...charge.waypoints.map((point) => point.y))).toBeGreaterThan(boxOf("Orders").maxY);
    });
});

describe("structure layouts", () => {
    it("draws a bar chart with columns as tall as their values", () => {
        const elements = build({ nodes: [node("jan", "Jan", { value: 10 }), node("feb", "Feb", { value: 20 })], edges: [] }, { structure: "bar-chart" });
        const bars = elements.filter((element) => element.type === "shape" && element.diagram?.role === "node");
        const heights = bars.map((bar) => Math.abs(bar.endY - bar.startY));
        expect(heights[1] / heights[0]).toBeCloseTo(2, 1);
        expect(elements.every((element) => elementSchema.safeParse(element).success)).toBe(true);
    });

    it("treats nodes that only name a lane as its heading", () => {
        const model = { nodes: [node("now", "Now"), node("sso", "SSO", { parent: "now" }), node("api", "API v2", { status: "Next" })], edges: [] };
        const texts = build(model, { structure: "now-next-later" }).map((element) => element.text);
        expect(texts.filter((text) => text === "Now")).toHaveLength(1);
        expect(texts).toContain("SSO");
    });

    it("uses four column nodes as quadrant names without drawing them again", () => {
        const names = ["Quick wins", "Big bets", "Fill-ins", "Money pits"];
        const model = {
            nodes: [...names.map((name, index) => node(`q${index}`, name, { kind: "column" })), node("a", "Dark mode", { group: "q0" })],
            edges: [],
        };
        const texts = build(model, { structure: "quadrant" }).map((element) => element.text ?? element.name);
        names.forEach((name) => expect(texts.filter((text) => text === name)).toHaveLength(1));
    });

    it("labels a wide sunburst segment at its own point, not at its outline's centre", () => {
        const model = {
            nodes: [
                node("root", "Budget"),
                node("eng", "Engineering", { parent: "root" }),
                node("ops", "Ops", { parent: "root", value: 1 }),
                node("sal", "Salaries", { parent: "eng", value: 9 }),
            ],
            edges: [],
        };
        const elements = build(model, { structure: "sunburst" });
        const label = elements.find((element) => element.type === "text" && element.text === "Engineering");
        expect(label).toBeTruthy();
        expect(Math.hypot(label.x + label.width / 2, label.y)).toBeGreaterThan(60);
    });

    it("writes an incident's hours and minutes as a clock", () => {
        const model = { nodes: [node("a", "Alert", { start: 14.02 }), node("b", "Fixed", { start: 14.2 })], edges: [] };
        const texts = build(model, { structure: "incident-timeline" }).map((element) => element.text);
        expect(texts).toEqual(expect.arrayContaining(["14:02", "14:20"]));
    });
});

describe("styles named in a message", () => {
    it("reads the most specific structure named", () => {
        expect(explicitStyleIn("Data pipeline: ingest from Stripe").structure).toBe("data-pipeline");
        expect(explicitStyleIn("Incident timeline: 14:02 alert").structure).toBe("incident-timeline");
        expect(explicitStyleIn("Onion layers for clean architecture: entities, use cases").structure).toBe("onion-layers");
    });

    it("reads a one-word look only when the message is about appearance", () => {
        expect(explicitStyleIn("Onion layers for clean architecture").look).toBeNull();
        expect(explicitStyleIn("Org chart of our engineering team").look).toBeNull();
        expect(explicitStyleIn("make it clean and minimal style").look).toBe("hairline");
    });
});

describe("busy architecture structures", () => {
    it("folds a service's sidecar into the service's own badge, keeping its links", () => {
        const model = {
            nodes: [node("gw", "Gateway"), node("orders", "Orders"), node("pay", "Payments"), node("os", "Orders sidecar")],
            edges: [
                { from: "gw", to: "orders" },
                { from: "os", to: "pay", label: "gRPC" },
            ],
        };
        const elements = build(model, { structure: "service-mesh" });
        expect(elements.some((element) => element.text === "Orders sidecar")).toBe(false);
        const links = elements.filter((element) => element.type === "connector" && element.diagram?.role === "edge");
        expect(links).toHaveLength(2);
    });

    it("brings links from outside a system boundary in beside it, not through it", () => {
        const model = {
            nodes: [node("user", "Customer", { kind: "person" }), node("web", "Web app", { group: "s" }), node("api", "API", { group: "s" })],
            edges: [
                { from: "web", to: "api" },
                { from: "user", to: "api", label: "Orders" },
            ],
        };
        const elements = build(model, { structure: "containers" });
        const boundary = elements.find((element) => element.diagram?.role === "group");
        const link = elements.find((element) => element.type === "connector" && element.text === "Orders");
        const lane = link.waypoints.find((point, index) => link.waypoints[index + 1]?.x === point.x);
        expect(lane.x).toBeLessThan(Math.min(boundary.startX, boundary.endX));
    });
});
