import { describe, it, expect } from "vitest";
import { buildGroundedScene } from "../buildGroundedScene.js";
import { resolveReference } from "../referenceResolver.js";

const board = {
    "login-box": {
        type: "shape",
        shapeType: "rectangle",
        startX: 0,
        startY: 40,
        endX: 160,
        endY: 100,
        color: "#000",
        size: 2,
        opacity: 100,
        zIndex: 1,
        rotation: 0,
    },
    "login-label": { type: "text", x: 0, y: 10, width: 160, text: "Login", color: "#000", size: 16, zIndex: 2, rotation: 0 },
    "signup-box": {
        type: "shape",
        shapeType: "rectangle",
        startX: 300,
        startY: 40,
        endX: 460,
        endY: 100,
        color: "#000",
        size: 2,
        opacity: 100,
        zIndex: 3,
        rotation: 0,
    },
    "signup-label": { type: "text", x: 300, y: 10, width: 160, text: "Signup", color: "#000", size: 16, zIndex: 4, rotation: 0 },
};

describe("resolveReference", () => {
    it("ranks the object whose attached label lexically matches the query highest", async () => {
        // The box and its label merge into one object, so elementIds holds both and elementId is null.
        const scene = await buildGroundedScene("test-board", board);
        const ranked = resolveReference(scene, "the login box");
        expect(ranked[0].elementIds).toContain("login-box");
        expect(ranked[0].elementIds).toContain("login-label");
        expect(ranked[0].elementId).toBeNull();
    });

    it("prefers a candidate in the current selection when the description is otherwise generic", async () => {
        const scene = await buildGroundedScene("test-board", board);
        const signupObject = scene.objects.find((object) => object.memberElementIds.includes("signup-box"));
        const ranked = resolveReference(scene, "that box", { selection: [signupObject.ref] });
        expect(ranked[0].elementIds).toContain("signup-box");
    });

    it("returns every object ranked, not just a single guess", async () => {
        const scene = await buildGroundedScene("test-board", board);
        const ranked = resolveReference(scene, "the login box");
        expect(ranked).toHaveLength(scene.objects.length);
    });
});
