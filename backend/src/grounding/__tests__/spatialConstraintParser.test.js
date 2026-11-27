import { describe, it, expect } from "vitest";
import { parseSpatialConstraint } from "../spatialConstraintParser.js";

describe("parseSpatialConstraint", () => {
    it("splits a directional phrase into subject, relation and anchor", () => {
        expect(parseSpatialConstraint("the box under the auth flow")).toEqual({
            subjectText: "the box",
            relation: "below",
            anchorText: "the auth flow",
        });
    });

    it("recognizes left-of and right-of phrasing", () => {
        expect(parseSpatialConstraint("the sticky to the left of the database")).toMatchObject({ relation: "left-of" });
        expect(parseSpatialConstraint("the sticky to the right of the database")).toMatchObject({ relation: "right-of" });
    });

    it("recognizes containment and connector phrasing", () => {
        expect(parseSpatialConstraint("the note inside the frame")).toMatchObject({ relation: "inside" });
        expect(parseSpatialConstraint("the shape connected to the login box")).toMatchObject({ relation: "connected-to" });
    });

    it("falls back to a plain query with no relation when nothing directional is present", () => {
        expect(parseSpatialConstraint("the login box")).toEqual({
            subjectText: "the login box",
            relation: null,
            anchorText: null,
        });
    });

    it("falls back when a directional word has nothing after it to anchor against", () => {
        expect(parseSpatialConstraint("what's below")).toEqual({
            subjectText: "what's below",
            relation: null,
            anchorText: null,
        });
    });
});
