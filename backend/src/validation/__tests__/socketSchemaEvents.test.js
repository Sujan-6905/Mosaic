import { describe, it, expect } from "vitest";
import {
    joinRoomSchema,
    cursorMoveSchema,
    laserPointSchema,
    textSyncSchema,
    backgroundSchema,
    updateBackgroundSchema,
    addCommentSchema,
    addCommentReplySchema,
    resolveCommentSchema,
    markCommentReadSchema,
    cameraMoveSchema,
    presentationUpdateSchema,
} from "../socketSchemas.js";

describe("joinRoomSchema", () => {
    it("accepts a valid shareId with no name", () => {
        expect(joinRoomSchema.safeParse({ shareId: "abc123XYZ0" }).success).toBe(true);
    });

    it("rejects a shareId with characters outside nanoid's alphabet", () => {
        expect(joinRoomSchema.safeParse({ shareId: "abc/../etc" }).success).toBe(false);
    });

    it("rejects a missing shareId", () => {
        expect(joinRoomSchema.safeParse({ name: "Ada" }).success).toBe(false);
    });
});

describe("cursorMoveSchema", () => {
    it("accepts numeric coordinates", () => {
        expect(cursorMoveSchema.safeParse({ shareId: "abc123", x: 12.5, y: -3 }).success).toBe(true);
    });

    it("rejects a non-numeric coordinate", () => {
        expect(cursorMoveSchema.safeParse({ shareId: "abc123", x: "12", y: 3 }).success).toBe(false);
    });
});

describe("laserPointSchema / textSyncSchema", () => {
    it("accepts a valid laser point payload", () => {
        expect(laserPointSchema.safeParse({ shareId: "abc123", x: 10, y: 20 }).success).toBe(true);
    });

    it("rejects a laser point payload missing a coordinate", () => {
        expect(laserPointSchema.safeParse({ shareId: "abc123", x: 10 }).success).toBe(false);
    });

    it("accepts a valid text sync payload", () => {
        expect(textSyncSchema.safeParse({ shareId: "abc123", elementId: "text-1", update: "QQ==" }).success).toBe(true);
    });

    it("rejects a text sync payload with an empty update string", () => {
        expect(textSyncSchema.safeParse({ shareId: "abc123", elementId: "text-1", update: "" }).success).toBe(false);
    });
});

describe("backgroundSchema / updateBackgroundSchema", () => {
    it("accepts every known background type with a null colorToken", () => {
        for (const type of ["blank", "dot", "square", "lined", "isometric", "solid"]) {
            expect(backgroundSchema.safeParse({ type, colorToken: null }).success).toBe(true);
        }
    });

    it("accepts a background with no colorToken at all", () => {
        expect(backgroundSchema.safeParse({ type: "blank" }).success).toBe(true);
    });

    it("rejects an unrecognized background type", () => {
        expect(backgroundSchema.safeParse({ type: "graph-paper", colorToken: null }).success).toBe(false);
    });

    it("accepts a valid client:updateBackground payload", () => {
        const result = updateBackgroundSchema.safeParse({
            shareId: "abc123",
            background: { type: "solid", colorToken: "bg-sunken" },
        });
        expect(result.success).toBe(true);
    });

    it("rejects a client:updateBackground payload with a malformed shareId", () => {
        const result = updateBackgroundSchema.safeParse({
            shareId: "../etc/passwd",
            background: { type: "solid", colorToken: "bg-sunken" },
        });
        expect(result.success).toBe(false);
    });
});

describe("addCommentSchema", () => {
    it("accepts a point-anchored comment with mentions", () => {
        const result = addCommentSchema.safeParse({
            shareId: "abc123",
            anchor: { type: "point", x: 10, y: 20 },
            text: "hey @ada",
            mentions: ["user-1", "user-2"],
        });
        expect(result.success).toBe(true);
    });

    it("accepts an element-anchored comment with mentions defaulting to empty", () => {
        const result = addCommentSchema.safeParse({
            shareId: "abc123",
            anchor: { type: "element", elementId: "el-1" },
            text: "what is this",
        });
        expect(result.success).toBe(true);
        expect(result.data.mentions).toEqual([]);
    });

    it("rejects an anchor with no discriminating type", () => {
        const result = addCommentSchema.safeParse({
            shareId: "abc123",
            anchor: { x: 10, y: 20 },
            text: "hey",
        });
        expect(result.success).toBe(false);
    });

    it("rejects an empty comment body", () => {
        const result = addCommentSchema.safeParse({
            shareId: "abc123",
            anchor: { type: "point", x: 0, y: 0 },
            text: "",
        });
        expect(result.success).toBe(false);
    });
});

describe("addCommentReplySchema / resolveCommentSchema / markCommentReadSchema", () => {
    it("accepts a valid reply", () => {
        expect(addCommentReplySchema.safeParse({ shareId: "abc123", commentId: "c1", text: "+1" }).success).toBe(true);
    });

    it("rejects a resolve payload with a non-boolean resolved flag", () => {
        expect(resolveCommentSchema.safeParse({ shareId: "abc123", commentId: "c1", resolved: "yes" }).success).toBe(false);
    });

    it("accepts a valid markCommentRead payload", () => {
        expect(markCommentReadSchema.safeParse({ shareId: "abc123", commentId: "c1" }).success).toBe(true);
    });
});

describe("cameraMoveSchema / presentationUpdateSchema", () => {
    it("accepts a valid camera position", () => {
        expect(cameraMoveSchema.safeParse({ shareId: "abc123", x: 10, y: 20, zoom: 1.5 }).success).toBe(true);
    });

    it("rejects a zoom of zero", () => {
        expect(cameraMoveSchema.safeParse({ shareId: "abc123", x: 10, y: 20, zoom: 0 }).success).toBe(false);
    });

    it("accepts a valid presentation toggle", () => {
        expect(presentationUpdateSchema.safeParse({ shareId: "abc123", presenting: true }).success).toBe(true);
    });
});
