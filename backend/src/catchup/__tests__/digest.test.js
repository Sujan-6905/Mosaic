import { describe, it, expect } from "vitest";
import { buildCatchUpDigest, describeDigestForModel, isDigestEmpty } from "../digest.js";

const box = (x, extra = {}) => ({ type: "shape", shapeType: "Rectangle", startX: x, startY: 0, endX: x + 10, endY: 10, version: 1, ...extra });
const op = (elementId, authorId, ts = 100, extra = {}) => ({ elementId, authorId, ts, opType: "update", ...extra });
const classifyChange = (before, after) => (before.color === after.color ? "moved" : "modified");
const getBounds = (element) => ({ minX: element.startX, minY: element.startY, maxX: element.endX, maxY: element.endY });

const digestFor = (overrides) =>
    buildCatchUpDigest({
        viewerId: "me",
        since: "2026-01-01T00:00:00.000Z",
        ops: [],
        before: {},
        current: {},
        objects: [],
        comments: [],
        nameOfUser: (id) => ({ ana: "Ana", raj: "Raj" })[id] ?? "Someone",
        classifyChange,
        getBounds,
        ...overrides,
    });

describe("buildCatchUpDigest", () => {
    it("reports nothing when only the viewer changed things", () => {
        const digest = digestFor({ ops: [op("a", "me")], before: {}, current: { a: box(0) } });
        expect(isDigestEmpty(digest)).toBe(true);
    });

    it("classifies added, removed, moved and edited against the state before the visit", () => {
        const digest = digestFor({
            ops: [op("added", "ana"), op("removed", "ana"), op("moved", "ana"), op("edited", "ana")],
            before: { removed: box(0, { text: "Old" }), moved: box(10), edited: box(20) },
            current: { added: box(30, { text: "New" }), moved: box(50), edited: box(20, { color: "#f00" }) },
            objects: [
                { ref: "o1", name: "Added box", memberElementIds: ["added"] },
                { ref: "o2", name: "Moved box", memberElementIds: ["moved"] },
                { ref: "o3", name: "Edited box", memberElementIds: ["edited"] },
            ],
        });
        const kindOf = (name) => digest.changes.find((change) => change.name === name)?.kind;
        expect(kindOf("Added box")).toBe("added");
        expect(kindOf("Moved box")).toBe("moved");
        expect(kindOf("Edited box")).toBe("edited");
        expect(kindOf('"Old"')).toBe("removed");
        expect(digest.people[0]).toEqual({ userId: "ana", name: "Ana", added: 1, changed: 2, removed: 1 });
    });

    it("ignores something added and removed while the viewer was away", () => {
        const digest = digestFor({ ops: [op("brief", "ana")], before: {}, current: {} });
        expect(digest.changes).toEqual([]);
    });

    it("ignores an element that ended up exactly where it started", () => {
        const digest = digestFor({ ops: [op("a", "ana")], before: { a: box(0, { version: 3 }) }, current: { a: box(0, { version: 9, updatedBy: "ana" }) } });
        expect(digest.changes).toEqual([]);
    });

    it("reports the strokes of one drawing as one object, with the bounds of all of them", () => {
        const digest = digestFor({
            ops: [op("s1", "ana"), op("s2", "raj", 200)],
            current: { s1: box(0), s2: box(100) },
            objects: [{ ref: "drawing", name: "Dog sketch", memberElementIds: ["s1", "s2"] }],
        });
        expect(digest.changes).toHaveLength(1);
        expect(digest.changes[0]).toMatchObject({ name: "Dog sketch", kind: "added", elementIds: ["s1", "s2"], authorNames: ["Ana", "Raj"], at: 200 });
        expect(digest.changes[0].bounds).toEqual({ minX: 0, minY: 0, maxX: 110, maxY: 10 });
    });

    it("rolls up one person's removed unnamed elements into a single line", () => {
        const digest = digestFor({ ops: [op("a", "ana"), op("b", "ana")], before: { a: box(0), b: box(50) } });
        expect(digest.changes).toHaveLength(1);
        expect(digest.changes[0]).toMatchObject({ kind: "removed", name: "2 elements" });
    });

    it("marks an edit the assistant made on someone's behalf", () => {
        const digest = digestFor({ ops: [op("a", "ana", 100, { agentId: "mosaic-assistant" })], current: { a: box(0) } });
        expect(digest.changes[0].viaAssistant).toBe(true);
    });

    it("lists the newest changes first and counts what doesn't fit", () => {
        const ids = Array.from({ length: 35 }, (_, i) => `e${i}`);
        const digest = digestFor({
            ops: ids.map((id, i) => op(id, "ana", i)),
            current: Object.fromEntries(ids.map((id, i) => [id, box(i)])),
            objects: ids.map((id) => ({ ref: id, name: id, memberElementIds: [id] })),
        });
        expect(digest.changes).toHaveLength(30);
        expect(digest.changes[0].name).toBe("e34");
        expect(digest.moreChangeCount).toBe(5);
    });

    it("puts a comment mentioning the viewer first, and skips the viewer's own", () => {
        const digest = digestFor({
            comments: [
                { _id: "c1", authorId: "ana", authorName: "Ana", text: "Plain", createdAt: "2026-01-02T00:00:00.000Z", mentions: [] },
                { _id: "c2", authorId: "raj", authorName: "Raj", text: "Hey you", createdAt: "2026-01-01T12:00:00.000Z", mentions: ["me"] },
                { _id: "c3", authorId: "me", authorName: "Me", text: "Mine", createdAt: "2026-01-02T00:00:00.000Z", mentions: [] },
                { _id: "old", authorId: "ana", authorName: "Ana", text: "Before", createdAt: "2025-12-01T00:00:00.000Z", mentions: [] },
            ],
        });
        expect(digest.comments.map((comment) => comment.commentId)).toEqual(["c2", "c1"]);
        expect(digest.comments[0].mentionsYou).toBe(true);
    });

    it("includes a new reply on an old thread", () => {
        const digest = digestFor({
            comments: [
                {
                    _id: "c1",
                    authorId: "me",
                    authorName: "Me",
                    text: "Question",
                    createdAt: "2025-12-01T00:00:00.000Z",
                    replies: [
                        { authorId: "ana", authorName: "Ana", text: "Answer", createdAt: new Date("2026-01-02T00:00:00.000Z").getTime(), mentions: [] },
                        { authorId: "ana", authorName: "Ana", text: "Earlier", createdAt: new Date("2025-12-02T00:00:00.000Z").getTime(), mentions: [] },
                    ],
                },
            ],
        });
        expect(digest.comments).toEqual([expect.objectContaining({ commentId: "c1", kind: "reply", authorName: "Ana", text: "Answer" })]);
    });
});

describe("describeDigestForModel", () => {
    it("carries no element ids or coordinates to the model", () => {
        const digest = digestFor({
            ops: [op("secret-id", "ana")],
            current: { "secret-id": box(12345) },
            objects: [{ ref: "o", name: "Box", memberElementIds: ["secret-id"] }],
        });
        const text = JSON.stringify(describeDigestForModel(digest));
        expect(text).not.toContain("secret-id");
        expect(text).not.toContain("12345");
        expect(text).toContain("Box");
    });
});
