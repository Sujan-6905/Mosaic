import { describe, expect, it } from "vitest";
import "../layoutEngine.js";
import { buildDiagram, centreDiagramOn, readDiagram, restyleDiagram, STRUCTURES, LOOKS, LEVERS } from "../../../../../../shared/canvas/diagramStyles/index.js";
import { explicitStyleIn, rankStructures, structureFit } from "../../../../../../shared/canvas/diagramStyles/ranking.js";
import { structureSummaries, structureDetails } from "../../../../../../shared/canvas/diagramStyles/catalog.js";
import { elementSchema } from "../../../../../../backend/src/validation/socketSchemas.js";
import { getElementBounds } from "../../../../../../shared/canvas/geometry/bounds.js";

const system = {
    title: "Checkout",
    nodes: [
        { id: "user", label: "Shopper", kind: "person", lane: "Customer", group: "edge", value: 5, start: 1, end: 3, x: 0.2, y: 0.9, status: "To do" },
        {
            id: "web",
            label: "Web app",
            kind: "client",
            lane: "Frontend",
            group: "edge",
            detail: "Next.js",
            value: 3,
            start: 2,
            end: 5,
            x: 0.5,
            y: 0.7,
            status: "Doing",
        },
        { id: "api", label: "Checkout API", kind: "service", lane: "Backend", group: "core", value: 8, start: 4, end: 7, x: 0.6, y: 0.5, status: "Done" },
        { id: "pay", label: "Payment ok?", kind: "decision", lane: "Backend", group: "core", value: 2, start: 6, end: 8, x: 0.8, y: 0.4 },
        { id: "db", label: "Orders DB", kind: "database", lane: "Data", group: "data", value: 6, start: 7, end: 9, x: 0.9, y: 0.2 },
    ],
    edges: [
        { from: "user", to: "web", label: "browses" },
        { from: "web", to: "api", label: "HTTPS" },
        { from: "api", to: "pay" },
        { from: "pay", to: "db", label: "yes" },
    ],
    groups: [
        { id: "edge", label: "Edge" },
        { id: "core", label: "Core" },
        { id: "data", label: "Storage" },
    ],
};

const build = (recipe, model = system) => {
    let n = 0;
    return buildDiagram({ model, recipe, generateElementId: () => `e${n++}` });
};
const asMap = (built) => Object.fromEntries(built.elements.map(({ elementId, element }) => [elementId, element]));
const nodeElements = (built) => built.elements.filter(({ element }) => element.diagram?.role === "node");
const centreOf = (element) => ({
    x: ((element.startX ?? element.x) + (element.endX ?? element.x + element.width)) / 2,
    y: ((element.startY ?? element.y) + (element.endY ?? element.y + element.height)) / 2,
});

describe("the style catalogue", () => {
    it("holds 72 structures and 43 looks, numbered in order with unique ids", () => {
        expect(STRUCTURES).toHaveLength(72);
        expect(LOOKS).toHaveLength(43);
        expect(STRUCTURES.map((structure) => structure.number)).toEqual(Array.from({ length: 72 }, (_, i) => i + 1));
        expect(LOOKS.map((look) => look.number)).toEqual(Array.from({ length: 43 }, (_, i) => i + 1));
        expect(new Set(STRUCTURES.map((structure) => structure.id)).size).toBe(72);
        expect(new Set(LOOKS.map((look) => look.id)).size).toBe(43);
    });

    it("gives the assistant a short line per structure and the full detail only on request", () => {
        expect(structureSummaries().split("\n")).toHaveLength(72);
        const details = structureDetails(["swimlanes", "not-a-structure"]);
        expect(details).toContain("Swimlanes");
        expect(details).not.toContain("not-a-structure");
    });

    it("presets only levers the engine knows, with values from each lever's own options", () => {
        const known = new Map(LEVERS.map((lever) => [lever.id, lever.options]));
        LOOKS.forEach((look) =>
            Object.entries(look.levers).forEach(([id, value]) =>
                expect({ look: look.id, id, valid: known.get(id)?.includes(value) }).toEqual({ look: look.id, id, valid: true }),
            ),
        );
    });
});

describe("building a diagram", () => {
    it("draws every structure in every look as valid board elements, one node element per node", () => {
        STRUCTURES.forEach((structure) =>
            LOOKS.forEach((look) => {
                const built = build({ structure: structure.id, look: look.id });
                expect({ structure: structure.id, look: look.id, nodes: nodeElements(built).length }).toEqual({
                    structure: structure.id,
                    look: look.id,
                    nodes: system.nodes.length,
                });
                built.elements.forEach(({ element }) => {
                    const parsed = elementSchema.safeParse(element);
                    if (!parsed.success)
                        throw new Error(
                            `${structure.id}/${look.id} ${element.type}: ${parsed.error.issues[0].path.join(".")} ${parsed.error.issues[0].message}`,
                        );
                    Object.entries(element).forEach(([field, value]) => {
                        if (typeof value === "number" && !Number.isFinite(value))
                            throw new Error(`${structure.id}/${look.id} ${element.type}.${field} is ${value}`);
                    });
                });
            }),
        );
    }, 60_000);

    it("binds every edge to the two nodes it joins", () => {
        const built = build({ structure: "flowchart", look: "ink" });
        const elements = asMap(built);
        const nodeIdFor = new Map(nodeElements(built).map(({ elementId, element }) => [element.diagram.key, elementId]));
        const connectors = Object.values(elements).filter((element) => element.diagram?.role === "edge");
        expect(connectors).toHaveLength(system.edges.length);
        system.edges.forEach((edge) =>
            expect(
                connectors.some((connector) => connector.startElementId === nodeIdFor.get(edge.from) && connector.endElementId === nodeIdFor.get(edge.to)),
            ).toBe(true),
        );
    });

    it("lets kinds carry meaning: a decision is a diamond, a database a cylinder, a person a figure", () => {
        const byKey = Object.fromEntries(nodeElements(build({ structure: "flowchart", look: "ink" })).map(({ element }) => [element.diagram.key, element]));
        expect(byKey.pay.shapeType).toBe("Diamond");
        expect(byKey.db.shapeType).toBe("Cylinder");
        expect(byKey.user.shapeType).toBe("Person");
    });

    it("draws a look with its own ground behind the diagram and keeps the default look on the board's ground", () => {
        expect(build({ structure: "flowchart", look: "blueprint" }).elements.some(({ element }) => element.diagram?.role === "ground")).toBe(true);
        expect(build({ structure: "flowchart", look: "ink" }).elements.some(({ element }) => element.diagram?.role === "ground")).toBe(false);
    });

    it("keeps the theme's ink for dark lines on the board's own ground", () => {
        const node = nodeElements(build({ structure: "flowchart", look: "soft-cards" }))[0].element;
        expect(node.colorToken).toBe("ink-primary");
    });

    it("comes out the same for the same input", () => {
        expect(build({ structure: "radial-map", look: "sketchbook" })).toEqual(build({ structure: "radial-map", look: "sketchbook" }));
    });

    it("centres a diagram where it is placed", () => {
        const placed = centreDiagramOn(build({ structure: "org-chart", look: "ink" }), 500, -200);
        const xs = placed.map(({ element }) => centreOf(element).x).filter(Number.isFinite);
        expect(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - 500)).toBeLessThan(200);
    });
});

describe("the decision path", () => {
    const embedGate = {
        nodes: [
            { id: "host", label: "Host page", detail: "a doc or a site" },
            { id: "embed", label: "Mosaic embed page", detail: "a board or one frame" },
            { id: "site", label: "Site allowed?", kind: "decision" },
            { id: "public", label: "Board public?", kind: "decision" },
            { id: "refused", label: "Browser refuses it", detail: "frame-ancestors list", status: "refused" },
            { id: "live", label: "Live read-only view", detail: "zoom, fit, Open in Mosaic", status: "live" },
            { id: "signin", label: "Sign in to view", detail: "storage access or popup" },
        ],
        edges: [
            { from: "host", to: "embed" },
            { from: "embed", to: "site" },
            { from: "site", to: "public", label: "yes" },
            { from: "site", to: "refused", label: "no" },
            { from: "public", to: "live", label: "yes" },
            { from: "public", to: "signin", label: "no" },
            { from: "signin", to: "live", label: "has access" },
            { from: "host", to: "live", label: "postMessage: camera, frames, events", kind: "message" },
        ],
    };
    const built = build({ structure: "decision-path", look: "graphite" }, embedGate);
    const at = Object.fromEntries(nodeElements(built).map(({ element }) => [element.diagram.key, centreOf(element)]));

    it("runs the checks left to right and hangs each other answer under its check", () => {
        expect(at.host.y).toBeCloseTo(at.site.y);
        expect(at.public.y).toBeCloseTo(at.site.y);
        expect(at.host.x < at.embed.x && at.embed.x < at.site.x && at.site.x < at.public.x).toBe(true);
        expect(at.refused.x).toBeCloseTo(at.site.x);
        expect(at.refused.y).toBeGreaterThan(at.site.y);
        expect(at.live.x).toBeCloseTo(at.public.x);
        expect(at.signin.x).toBeCloseTo(at.public.x);
        expect(at.signin.y).toBeGreaterThan(at.live.y);
    });

    it("tints outcomes by what they mean and dashes the side channel", () => {
        const byKey = Object.fromEntries(nodeElements(built).map(({ element }) => [element.diagram.key, element]));
        expect(byKey.refused.color).toBe("#dc2626");
        expect(byKey.live.color).toBe("#5b8def");
        expect(byKey.signin.fillColor).toBeNull();
        expect(byKey.site.shapeType).toBe("Diamond");
        const side = built.elements.find(({ element }) => element.diagram?.role === "edge" && element.diagram.data.kind === "message");
        expect(side.element.strokeStyle).toBe("dashed");
        expect(built.elements.every(({ element }) => elementSchema.safeParse(element).success)).toBe(true);
    });
});

describe("restyling", () => {
    it("reads a styled diagram back to the same content and recipe", () => {
        const built = build({ structure: "swimlanes", look: "clay", levers: { routing: "curved" } });
        const elements = asMap(built);
        const read = readDiagram(elements, [Object.keys(elements)[3]]);
        expect(read.recipe).toEqual({ structure: "swimlanes", look: "clay", levers: { routing: "curved" } });
        expect(read.model.nodes.map((node) => node.label)).toEqual(system.nodes.map((node) => node.label));
        expect(read.model.edges.map(({ from, to }) => `${from}>${to}`)).toEqual(system.edges.map(({ from, to }) => `${from}>${to}`));
        expect(read.elementIds).toHaveLength(built.elements.length);
    });

    it("keeps every edge and group label through structures that draw free arrows or no groups", () => {
        let elements = asMap(build({ structure: "layered-tiers", look: "watercolour" }));
        let n = 0;
        for (const structure of ["hub-and-spoke", "request-journey", "layered-tiers"]) {
            const result = restyleDiagram({ elements, ids: Object.keys(elements), recipe: { structure }, generateElementId: () => `r${n++}` });
            elements = Object.fromEntries(result.elements.map(({ elementId, element }) => [elementId, element]));
            const read = readDiagram(elements, Object.keys(elements));
            expect(read.model.edges.map(({ from, to }) => `${from}>${to}`).sort()).toEqual(system.edges.map(({ from, to }) => `${from}>${to}`).sort());
            expect(read.model.groups.map(({ id, label }) => `${id}=${label}`).sort()).toEqual(["core=Core", "data=Storage", "edge=Edge"]);
        }
    });

    it("keeps the words a look wrote in capitals as the words the person typed", () => {
        const elements = asMap(build({ structure: "flowchart", look: "blueprint" }));
        const read = readDiagram(elements, Object.keys(elements));
        expect(read.model.nodes.find((node) => node.id === "api").label).toBe("Checkout API");
        expect(read.model.title).toBe("Checkout");
    });

    it("lays a diagram out again for a new structure, replacing every old element", () => {
        const elements = asMap(build({ structure: "flowchart", look: "ink" }));
        let n = 0;
        const result = restyleDiagram({
            elements,
            ids: Object.keys(elements).slice(0, 1),
            recipe: { structure: "timeline" },
            generateElementId: () => `r${n++}`,
        });
        expect(result.removeIds.sort()).toEqual(Object.keys(elements).sort());
        expect(result.recipe.structure).toBe("timeline");
        expect(result.elements.filter(({ element }) => element.diagram?.role === "node")).toHaveLength(system.nodes.length);
    });

    it("lays an untouched diagram out afresh for a new look, keeping the routes that go round other boxes", () => {
        const elements = asMap(build({ structure: "layered-tiers", look: "watercolour" }));
        let n = 0;
        const result = restyleDiagram({ elements, ids: Object.keys(elements), recipe: { look: "blueprint" }, generateElementId: () => `r${n++}` });
        const routesOf = (list) =>
            Object.fromEntries(
                list
                    .filter(({ element }) => element.type === "connector" && element.diagram?.role === "edge")
                    .map(({ element }) => [element.diagram.key, element.waypoints]),
            );
        const fresh = build({ structure: "layered-tiers", look: "blueprint" }).elements;
        const shift = (list) => {
            const first = list.find(({ element }) => element.diagram?.role === "node").element;
            return { x: first.startX ?? first.x, y: first.startY ?? first.y };
        };
        const [a, b] = [shift(result.elements), shift(fresh)];
        const moved = (routes, d) =>
            Object.fromEntries(
                Object.entries(routes).map(([key, points]) => [key, points?.map((p) => ({ x: Math.round(p.x - d.x), y: Math.round(p.y - d.y) })) ?? null]),
            );
        expect(moved(routesOf(result.elements), a)).toEqual(moved(routesOf(fresh), b));
    });

    it("repaints a new look in place, leaving each node where the person moved it", () => {
        const elements = asMap(build({ structure: "flowchart", look: "ink" }));
        const [movedId, moved] = Object.entries(elements).find(([, element]) => element.diagram?.key === "api");
        elements[movedId] = { ...moved, startX: moved.startX + 400, endX: moved.endX + 400 };
        let n = 0;
        const result = restyleDiagram({ elements, ids: [movedId], recipe: { look: "night-neon" }, generateElementId: () => `r${n++}` });
        const repainted = result.elements.find(({ element }) => element.diagram?.key === "api").element;
        expect(centreOf(repainted).x).toBeCloseTo(centreOf(elements[movedId]).x, 0);
        expect(repainted.diagram.recipe.look).toBe("night-neon");
    });

    it("restyles boxes and arrows drawn by hand, using the words inside each box", () => {
        const box = (x, extra = {}) => ({
            type: "shape",
            shapeType: "Rectangle",
            startX: x,
            startY: 0,
            endX: x + 120,
            endY: 60,
            color: "#000000",
            size: 2,
            opacity: 100,
            zIndex: 1,
            rotation: 0,
            ...extra,
        });
        const elements = {
            a: box(0, { text: "Idea" }),
            b: box(300),
            label: { type: "text", x: 320, y: 20, width: 80, text: "Build", color: "#000000", size: 14, zIndex: 2, rotation: 0 },
            link: {
                type: "connector",
                startX: 60,
                startY: 30,
                endX: 360,
                endY: 30,
                startElementId: "a",
                endElementId: "b",
                color: "#000000",
                size: 2,
                opacity: 100,
                arrowStart: false,
                arrowEnd: true,
                zIndex: 3,
                rotation: 0,
            },
        };
        let n = 0;
        const result = restyleDiagram({
            elements,
            ids: Object.keys(elements),
            recipe: { structure: "pipeline", look: "soft-cards" },
            generateElementId: () => `r${n++}`,
        });
        const labels = result.elements.filter(({ element }) => element.diagram?.role === "node").map(({ element }) => element.text);
        expect(labels).toEqual(["Idea", "Build"]);
    });
});

describe("choosing a style from words and content", () => {
    it("finds a structure or look a message names outright", () => {
        expect(explicitStyleIn("draw our onboarding as swimlanes in blueprint style")).toEqual({ structure: "swimlanes", look: "blueprint" });
        expect(explicitStyleIn("a mind map of the launch, hand-drawn").look).toBe("sketchbook");
        expect(explicitStyleIn("a list of our services")).toEqual({ structure: null, look: null });
    });

    it("scores a Gantt low without dates and a Sankey low without amounts", () => {
        const plain = {
            nodes: [
                { id: "a", label: "A" },
                { id: "b", label: "B" },
            ],
            edges: [{ from: "a", to: "b" }],
        };
        expect(structureFit("gantt", plain)).toBeLessThan(structureFit("gantt", system));
        expect(structureFit("sankey", plain)).toBeLessThan(0.5);
    });

    it("ranks what the words point at first", () => {
        expect(rankStructures("an org chart of the team", system)[0]).toBe("org-chart");
    });
});

const rideHailing = {
    title: "Ride hailing",
    nodes: [
        { id: "rider", label: "Rider App", kind: "phone", lane: "Clients" },
        { id: "driver", label: "Driver App", kind: "phone", lane: "Clients" },
        { id: "gw", label: "API Gateway", kind: "gateway", lane: "Edge" },
        { id: "match", label: "Matching Service", kind: "service", lane: "Services" },
        { id: "price", label: "Pricing Service", kind: "service", lane: "Services" },
        { id: "trip", label: "Trip Service", kind: "service", lane: "Services" },
        { id: "redis", label: "Redis", kind: "database", lane: "Data" },
        { id: "pg", label: "PostgreSQL", kind: "database", lane: "Data" },
        { id: "kafka", label: "Kafka", kind: "queue", lane: "Async" },
    ],
    edges: [
        { from: "rider", to: "gw", label: "HTTPS" },
        { from: "driver", to: "gw", label: "HTTPS" },
        { from: "gw", to: "match", label: "gRPC" },
        { from: "gw", to: "price", label: "gRPC" },
        { from: "gw", to: "trip", label: "gRPC" },
        { from: "trip", to: "match", label: "gRPC" },
        { from: "trip", to: "price", label: "gRPC" },
        { from: "match", to: "redis", label: "cache" },
        { from: "trip", to: "pg", label: "SQL" },
        { from: "trip", to: "kafka", label: "publish" },
    ],
    groups: [],
};

describe("suggesting and drawing a system", () => {
    it("suggests architecture structures for services and stores, not process notations or one request's journey", () => {
        const suggested = rankStructures("", rideHailing, 6);
        expect(STRUCTURES.find((structure) => structure.id === suggested[0]).group).toMatch(/^Architecture/);
        expect(suggested).toContain("layered-tiers");
        for (const unfit of ["request-journey", "bpmn-process", "git-graph"]) expect(suggested).not.toContain(unfit);
    });

    it("routes every link round the boxes between its ends", () => {
        const through = (elements) => {
            const nodes = Object.entries(elements).filter(([, element]) => element.diagram?.role === "node");
            return Object.values(elements)
                .filter((element) => element.type === "connector" && element.diagram?.role === "edge")
                .flatMap((connector) => {
                    const points = [{ x: connector.startX, y: connector.startY }, ...(connector.waypoints ?? []), { x: connector.endX, y: connector.endY }];
                    return nodes
                        .filter(([id]) => id !== connector.startElementId && id !== connector.endElementId)
                        .filter(([, node]) => {
                            const box = getElementBounds(node);
                            return points.some((point, index) => {
                                if (index === 0) return false;
                                const before = points[index - 1];
                                for (let k = 0.05; k < 0.96; k += 0.05) {
                                    const x = before.x + (point.x - before.x) * k;
                                    const y = before.y + (point.y - before.y) * k;
                                    if (x > box.minX + 2 && x < box.maxX - 2 && y > box.minY + 2 && y < box.maxY - 2) return true;
                                }
                                return false;
                            });
                        })
                        .map(([, node]) => `${connector.diagram.key} through ${node.diagram.key}`);
                });
        };
        for (const structure of ["hub-and-spoke", "system-context", "layered-tiers", "cloud-zones"]) {
            expect(through(asMap(build({ structure, look: "ink" }, rideHailing)))).toEqual([]);
        }
    });
});
