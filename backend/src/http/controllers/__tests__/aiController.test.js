import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { boardElements, fakeDrawing, graph, modelReply, plannedResult, stickyElements } from "./aiTurnFixtures.js";

vi.mock("../../../ai/model/provider.js", async (importOriginal) => ({
    ...(await importOriginal()),
    chatCompletion: vi.fn(),
    modelCompletion: vi.fn(),
}));
class MockTurnBudgetExceededError extends Error {}
// How a diagram's style is chosen has its own tests; here it stays out of the model calls being counted.
vi.mock("../../../ai/turn/agentStyle.js", () => ({
    chooseDiagramStyle: vi.fn(async () => ({ structure: "flowchart", look: "ink", certain: true, choices: [] })),
}));
vi.mock("../../../ai/model/turnBudget.js", () => ({
    recordModelUsage: vi.fn(),
    createTurnBudget: vi.fn(() => ({ spend: vi.fn() })),
    TurnBudgetExceededError: MockTurnBudgetExceededError,
}));
vi.mock("../../../ai/edits/agentEdit.js", () => ({
    applyAgentEdit: vi.fn(),
    planAgentEdit: vi.fn(),
    commitPlannedEdit: vi.fn(),
    discardPlannedEdit: vi.fn(),
}));
vi.mock("../../../models/drawingSchema.js", () => ({
    default: { findOne: vi.fn() },
}));
vi.mock("../../../models/aiConversationSchema.js", () => ({
    mostRecentLiveRef: () => null,
    default: {
        appendTurn: vi.fn().mockResolvedValue(undefined),
        findOwned: vi.fn(),
        listForUser: vi.fn(),
        start: vi.fn(),
        removeById: vi.fn().mockResolvedValue(undefined),
    },
}));

const { chatCompletion, modelCompletion } = await import("../../../ai/model/provider.js");
const { resetBreakersForTests } = await import("../../../ai/model/resilience.js");
const { planAgentEdit } = await import("../../../ai/edits/agentEdit.js");
const Drawing = (await import("../../../models/drawingSchema.js")).default;
const AiConversation = (await import("../../../models/aiConversationSchema.js")).default;
const authCheck = (await import("../../middlewares/authMiddleware.js")).default;
const { checkEditAccess } = await import("../../middlewares/checkAccess.js");
const validateBody = (await import("../../middlewares/validateBody.js")).default;
const { aiTurnSchema, aiEditCommitSchema } = await import("../../../validation/restSchemas.js");
const { runTurn } = await import("../aiController.js");
const { commitEditPreview } = await import("../aiEditController.js");

// Mirrors the real route wiring (aiRoutes.js).
const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.post("/api/ai/:shareId/turn", authCheck, checkEditAccess, validateBody(aiTurnSchema), runTurn);
    app.post("/api/ai/:shareId/edit/commit", authCheck, checkEditAccess, validateBody(aiEditCommitSchema), commitEditPreview);
    return app;
};

const token = jwt.sign({ userId: "user-1" }, process.env.JWT_SECRET);
const originalApiKey = process.env.GROQ_API_KEY;

const app = buildApp();

const sendTurn = (body) =>
    request(app)
        .post("/api/ai/board-1/turn")
        .set("Authorization", `Bearer ${token}`)
        .send({ message: "hello", ...body });

const lastModelMessages = () => modelCompletion.mock.calls.at(-1)[0].messages;

beforeEach(() => {
    vi.clearAllMocks();
    resetBreakersForTests();
    process.env.GROQ_API_KEY = "test-key";
    Drawing.findOne.mockResolvedValue(fakeDrawing);
    fakeDrawing.elements = boardElements;
    chatCompletion.mockResolvedValue("0.001");
    AiConversation.findOwned.mockResolvedValue(null);
});

afterAll(() => {
    process.env.GROQ_API_KEY = originalApiKey;
});

describe("POST /api/ai/:shareId/turn: what a turn does", () => {
    it("answers a question in words, without drawing or editing anything", async () => {
        modelCompletion.mockResolvedValueOnce(modelReply({ intent: "reply", message: "I can answer questions about this board and draw on it." }));

        const res = await sendTurn({ message: "hi, what can you help me with?" });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("reply");
        expect(res.body.message).toContain("answer questions");
        expect(res.body.nodes).toBeUndefined();
        expect(planAgentEdit).not.toHaveBeenCalled();
    });

    it("sends a question about using the whiteboard to Help and resources, in fixed wording", async () => {
        modelCompletion.mockResolvedValueOnce(modelReply({ intent: "help" }));

        const res = await sendTurn({ message: "how do I export this board?" });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("help");
        expect(res.body.message).toContain("Help and resources");
        expect(planAgentEdit).not.toHaveBeenCalled();
    });

    it("asks the model for a strict schema, so free text cannot come back", async () => {
        modelCompletion.mockResolvedValueOnce(modelReply({ message: "Hello" }));
        await sendTurn({});
        expect(modelCompletion.mock.calls[0][0].responseSchema.name).toBe("assistant_turn");
    });

    it("returns a diagram for review and maps the refs it replaces to element ids", async () => {
        fakeDrawing.elements = stickyElements("orange");
        const { getGroundedScene } = await import("../../../grounding/relationCache.js");
        const scene = await getGroundedScene("board-1", fakeDrawing.elements);
        const noteRef = scene.objects.find((object) => object.memberElementIds.includes("note")).ref;
        const carryingLabel = { ...graph, nodes: [{ id: "a", label: "orange", shape: "box", fillColor: null }, graph.nodes[1]] };
        modelCompletion.mockResolvedValueOnce(
            modelReply({ intent: "diagram", message: "Done.", diagram: { ...carryingLabel, replaceRefs: [noteRef, "obj_invented"] } }),
        );

        const res = await sendTurn({ message: "convert this" });

        expect(res.body.status).toBe("diagram");
        expect(res.body.nodes).toHaveLength(2);
        expect(res.body.replaces).toEqual(["note"]);
    });

    it("won't replace objects whose writing the new diagram doesn't carry: that's a new diagram", async () => {
        fakeDrawing.elements = stickyElements("orange");
        const { getGroundedScene } = await import("../../../grounding/relationCache.js");
        const scene = await getGroundedScene("board-1", fakeDrawing.elements);
        const noteRef = scene.objects.find((object) => object.memberElementIds.includes("note")).ref;
        modelCompletion.mockResolvedValueOnce(modelReply({ intent: "diagram", message: "Done.", diagram: { ...graph, replaceRefs: [noteRef] } }));

        const res = await sendTurn({ message: "a flowchart of two sum" });

        expect(res.body.replaces).toEqual([]);
    });

    it("carries colours requested for diagram nodes through as hex", async () => {
        const coloured = {
            ...graph,
            nodes: [
                { id: "a", label: "orange", shape: "box", fillColor: "orange" },
                { id: "b", label: "green", shape: "box", fillColor: "#22c55e" },
            ],
        };
        modelCompletion.mockResolvedValueOnce(modelReply({ intent: "diagram", message: "Done.", diagram: coloured }));

        const res = await sendTurn({ message: "flowchart with colours" });

        expect(res.body.nodes.map((node) => node.fillColor)).toEqual(["#f97316", "#22c55e"]);
    });

    it("draws a sketch in a second call and returns its named parts", async () => {
        modelCompletion.mockResolvedValueOnce(modelReply({ intent: "sketch", message: "A house.", sketch: { subject: "a house" } }));
        modelCompletion.mockResolvedValueOnce({
            content: JSON.stringify({
                plan: "Front view.",
                parts: [
                    { name: "ground", fill: null, draw: ["line 10,90 90,90"] },
                    { name: "roof", fill: null, draw: ["poly 10,90 50,50 90,90"] },
                ],
            }),
        });

        const res = await sendTurn({ message: "draw a house" });

        expect(res.body.status).toBe("sketch");
        expect(res.body.parts.map((part) => part.name)).toEqual(["ground", "roof"]);
    });

    it("says so when the drawing can't be read, rather than showing nothing", async () => {
        modelCompletion.mockResolvedValueOnce(modelReply({ intent: "sketch", message: "A house.", sketch: { subject: "a house" } }));
        modelCompletion.mockResolvedValueOnce({ content: "not json" });
        modelCompletion.mockResolvedValueOnce({ content: JSON.stringify({ plan: "x", parts: [] }) });

        const res = await sendTurn({ message: "draw a house" });

        expect(res.status).toBe(422);
    });

    it("asks again instead of clarifying when a new drawing is requested", async () => {
        modelCompletion.mockResolvedValueOnce(modelReply({ intent: "clarify", message: "Which cat?", candidates: ["obj_a", "obj_b"] }));
        modelCompletion.mockResolvedValueOnce(modelReply({ intent: "sketch", message: "A cat.", sketch: { subject: "a small cat" } }));
        modelCompletion.mockResolvedValueOnce({
            content: JSON.stringify({ plan: "Sitting.", parts: [{ name: "head", fill: null, draw: ["ellipse 50 30 10 10"] }] }),
        });

        const res = await sendTurn({ message: "create a small cat drawing" });

        expect(res.body.status).toBe("sketch");
    });

    describe("drawing something that goes with what's on the board", () => {
        const dogElements = {
            head: {
                type: "path",
                label: "head",
                sketchId: "dog-1",
                sketchTitle: "a dog",
                color: "#222222",
                colorToken: "ink-primary",
                size: 3,
                opacity: 100,
                zIndex: 1,
                rotation: 0,
                points: [
                    { x: 1000, y: 1000 },
                    { x: 1100, y: 1000 },
                    { x: 1100, y: 1100 },
                    { x: 1000, y: 1000 },
                ],
            },
            body: {
                type: "path",
                label: "body",
                sketchId: "dog-1",
                sketchTitle: "a dog",
                color: "#222222",
                size: 3,
                opacity: 100,
                zIndex: 2,
                rotation: 0,
                points: [
                    { x: 1100, y: 1100 },
                    { x: 1400, y: 1100 },
                    { x: 1400, y: 1300 },
                    { x: 1100, y: 1100 },
                ],
            },
        };
        const person = {
            content: JSON.stringify({
                plan: "Beside the dog.",
                parts: [
                    { name: "person", fill: null, draw: ["ellipse 120 40 10 10"] },
                    { name: "leash", fill: null, draw: ["line 110,60 50,50"] },
                ],
            }),
        };

        const wholeDogRef = async () => {
            const { getGroundedScene } = await import("../../../grounding/relationCache.js");
            const scene = await getGroundedScene("board-1", fakeDrawing.elements);
            return scene.objects.find((object) => object.type === "sketch").ref;
        };

        beforeEach(() => {
            fakeDrawing.elements = dogElements;
            planAgentEdit.mockResolvedValue(plannedResult());
        });

        it("draws against the outlines and proposes an edit, rather than a sketch to place by hand", async () => {
            const ref = await wholeDogRef();
            modelCompletion.mockResolvedValueOnce(
                modelReply({
                    intent: "sketch",
                    message: "Added a person.",
                    sketch: { subject: "a person holding a leash", title: "a person", relatedRefs: [ref] },
                }),
            );
            modelCompletion.mockResolvedValueOnce(person);

            const res = await sendTurn({ message: "add a person holding the dog's leash" });

            expect(res.body.status).toBe("planned");
            expect(
                lastModelMessages()
                    .map((message) => message.content)
                    .join("\n"),
            ).toContain('"name":"head"');
            const [drawn] = planAgentEdit.mock.calls.at(-1)[0].rawEditBatch.ops;
            expect(drawn.op).toBe("drawParts");
            expect(drawn).toMatchObject({ title: "a person", color: "#222222", colorToken: "ink-primary" });
            expect(drawn.parts.map((part) => part.name)).toEqual(["person", "leash"]);
            const [leashStart] = drawn.parts[1].strokes[0].points;
            expect(leashStart.x).toBeGreaterThan(1400);
        });

        it("still lands in place when the model forgets to name what it relates to", async () => {
            modelCompletion.mockResolvedValueOnce(
                modelReply({ intent: "sketch", message: "Done.", sketch: { subject: "a bone", title: "a bone", relatedRefs: [] } }),
            );
            modelCompletion.mockResolvedValueOnce(person);

            await sendTurn({ message: "put a bone next to the dog" });

            expect(planAgentEdit.mock.calls.at(-1)[0].rawEditBatch.ops[0].op).toBe("drawParts");
        });

        it("asks again when a picture comes back as boxes with labels on", async () => {
            const ref = await wholeDogRef();
            modelCompletion.mockResolvedValueOnce(modelReply({ intent: "edit", message: "Done.", ops: [{ op: "add", kind: "ellipse", text: "human" }] }));
            modelCompletion.mockResolvedValueOnce(
                modelReply({ intent: "sketch", message: "Added a human.", sketch: { subject: "a human", title: "a human", relatedRefs: [ref] } }),
            );
            modelCompletion.mockResolvedValueOnce(person);

            await sendTurn({ message: "add a human near the dog" });

            expect(planAgentEdit.mock.calls.at(-1)[0].rawEditBatch.ops[0].op).toBe("drawParts");
        });

        it("asks again when a part it should draw is reported as missing", async () => {
            const ref = await wholeDogRef();
            modelCompletion.mockResolvedValueOnce(modelReply({ intent: "unresolved", message: "The collar is not on the board." }));
            modelCompletion.mockResolvedValueOnce(
                modelReply({ intent: "sketch", message: "Added a human.", sketch: { subject: "a human and a collar", title: "a human", relatedRefs: [ref] } }),
            );
            modelCompletion.mockResolvedValueOnce(person);

            await sendTurn({ message: "add a human and a leash to the dog's collar" });

            expect(planAgentEdit.mock.calls.at(-1)[0].rawEditBatch.ops[0].op).toBe("drawParts");
        });

        it("guards a sketch's title like the rest of what the model wrote", async () => {
            fakeDrawing.elements = {};
            modelCompletion.mockResolvedValueOnce(
                modelReply({ intent: "sketch", message: "A dog.", sketch: { subject: "a dog", title: "gsk_abcdefghijklmnopqrstuvwx", relatedRefs: [] } }),
            );
            modelCompletion.mockResolvedValueOnce(person);

            const res = await sendTurn({ message: "draw a dog" });

            expect(res.body.status).toBe("refused");
        });

        it("never takes drawParts from an edit model, which may only name refs", async () => {
            const ref = await wholeDogRef();
            const smuggled = {
                op: "drawParts",
                title: "x",
                color: "#000000",
                colorToken: null,
                parts: [
                    {
                        name: "x",
                        fill: null,
                        strokes: [
                            {
                                points: [
                                    { x: 0, y: 0 },
                                    { x: 1, y: 1 },
                                ],
                                closed: false,
                                smooth: false,
                            },
                        ],
                    },
                ],
            };
            modelCompletion.mockResolvedValue(
                modelReply({ intent: "edit", message: "Done.", ops: [smuggled, { op: "restyle", ref, props: { fillColor: "#ff0000" } }] }),
            );

            const res = await sendTurn({ message: "paint it" });

            expect(res.status).toBe(422);
            expect(planAgentEdit).not.toHaveBeenCalled();
        });
    });

    it("replaces a diagram found on the board in a new chat, though its labels live in shapes and no text matches them", async () => {
        const box = (key, label, x) => ({
            type: "shape",
            shapeType: "Rectangle",
            startX: x,
            startY: 0,
            endX: x + 120,
            endY: 60,
            color: "#000",
            size: 2,
            opacity: 100,
            zIndex: 1,
            rotation: 0,
            text: label,
            diagram: { id: "d1", key, role: "node", order: x, data: { label, lane: "Services" } },
        });
        fakeDrawing.elements = {
            gateway: box("gateway", "API Gateway", 0),
            trips: box("trips", "Trip Service", 300),
            lane: {
                type: "text",
                x: -200,
                y: 20,
                width: 120,
                text: "Services",
                color: "#000",
                size: 14,
                opacity: 100,
                zIndex: 2,
                rotation: 0,
                diagram: { id: "d1", key: "lane:Services:title", role: "decor", recipe: { structure: "layered-tiers", look: "watercolour" } },
            },
        };
        const { getGroundedScene } = await import("../../../grounding/relationCache.js");
        const scene = await getGroundedScene("board-1", fakeDrawing.elements);
        const refOf = (id) => scene.objects.find((object) => object.memberElementIds.includes(id)).ref;
        modelCompletion.mockResolvedValueOnce(
            modelReply({
                intent: "diagram",
                message: "Added a CDN.",
                diagram: {
                    nodes: [
                        { id: refOf("gateway"), label: "API Gateway", shape: "box", fillColor: null },
                        { id: refOf("trips"), label: "Trip Service", shape: "box", fillColor: null },
                        { id: "cdn", label: "CDN", shape: "box", fillColor: null },
                    ],
                    edges: [{ from: "cdn", to: refOf("gateway"), label: null }],
                    replaceRefs: [],
                },
            }),
        );

        const res = await sendTurn({ message: "Add a CDN in front of the API Gateway" });

        expect(res.body.status).toBe("diagram");
        expect(res.body.replaces.sort()).toEqual(["gateway", "lane", "trips"]);
    });

    it("replaces a diagram already on the board when asked to change it, instead of drawing a second one", async () => {
        fakeDrawing.elements = {
            startShape: {
                type: "shape",
                shapeType: "Ellipse",
                startX: 0,
                startY: 0,
                endX: 100,
                endY: 60,
                color: "#000",
                size: 2,
                opacity: 100,
                zIndex: 1,
                rotation: 0,
            },
            startText: { type: "text", x: 20, y: 20, width: 60, text: "Start", color: "#000", size: 14, opacity: 100, zIndex: 2, rotation: 0 },
        };
        AiConversation.findOwned.mockResolvedValueOnce({
            messages: [
                { role: "user", content: "a flowchart" },
                { role: "assistant", content: "Drew it.", ...graph },
            ],
        });
        modelCompletion.mockResolvedValueOnce(
            modelReply({
                intent: "diagram",
                message: "Added a step.",
                diagram: {
                    nodes: [...graph.nodes, { id: "c", label: "Check", shape: "box", fillColor: null }],
                    edges: [...graph.edges, { from: "b", to: "c", label: null }],
                    replaceRefs: [],
                },
            }),
        );

        const res = await sendTurn({ message: "add a check step" });

        expect(res.body.status).toBe("diagram");
        expect(res.body.replaces.sort()).toEqual(["startShape", "startText"]);
    });

    it("reports a missing target without calling it a failure", async () => {
        modelCompletion.mockResolvedValueOnce(modelReply({ intent: "unresolved", message: "Nothing is selected." }));

        const res = await sendTurn({ message: "convert the selection" });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("unresolved");
        expect(AiConversation.appendTurn.mock.calls[0][1][1].failed).toBeUndefined();
    });

    it("asks a disambiguating question only with candidates that really exist", async () => {
        fakeDrawing.elements = stickyElements("note");
        const { getGroundedScene } = await import("../../../grounding/relationCache.js");
        const scene = await getGroundedScene("board-1", fakeDrawing.elements);
        const refs = scene.objects.map((object) => object.ref);
        modelCompletion.mockResolvedValueOnce(modelReply({ intent: "clarify", message: "Which one?", candidates: refs }));

        const res = await sendTurn({ message: "move it" });

        expect(res.body.status).toBe("ambiguous");
        expect(res.body.candidates.map((candidate) => candidate.ref)).toEqual(refs);
    });

    it("works on an empty board, since a question or a new diagram needs no objects", async () => {
        fakeDrawing.elements = {};
        modelCompletion.mockResolvedValueOnce(modelReply({ intent: "reply", message: "This board is empty." }));

        const res = await sendTurn({ message: "what's on this board?" });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("reply");
    });
});
