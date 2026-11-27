import { describe, it, expect } from "vitest";
import { serializeScene, parseSceneFile } from "../sceneSerializer.js";
import { ELEMENT_SCHEMA_VERSION, MAX_IMPORT_ELEMENTS, SCENE_FORMAT_VERSION } from "../../../../../../shared/canvas/elements/sceneFile.js";

const sampleElements = { "el-1": { type: "shape", shapeType: "Rectangle" } };
const sampleBackground = { type: "blank", colorToken: null };

describe("serializeScene", () => {
    it("stamps the container and element schema versions and carries the given elements/background", () => {
        const scene = serializeScene(sampleElements, sampleBackground, "My Board");
        expect(scene.mosaicSceneVersion).toBe(SCENE_FORMAT_VERSION);
        expect(scene.elementSchemaVersion).toBe(ELEMENT_SCHEMA_VERSION);
        expect(scene.elements).toBe(sampleElements);
        expect(scene.background).toBe(sampleBackground);
        expect(scene.title).toBe("My Board");
        expect(typeof scene.exportedAt).toBe("string");
    });

    it("defaults title to null when omitted", () => {
        const scene = serializeScene(sampleElements, sampleBackground);
        expect(scene.title).toBeNull();
    });
});

describe("parseSceneFile", () => {
    it("round-trips a scene produced by serializeScene with zero loss", () => {
        const scene = serializeScene(sampleElements, sampleBackground, "Board");
        const { scene: parsed, error } = parseSceneFile(JSON.stringify(scene));
        expect(error).toBeUndefined();
        expect(parsed).toEqual(scene);
    });

    it("rejects text that isn't valid JSON", () => {
        expect(parseSceneFile("not json{{{").error).toBe("invalid-json");
    });

    it("rejects valid JSON that isn't shaped like a scene file", () => {
        expect(parseSceneFile(JSON.stringify({ hello: "world" })).error).toBe("not-a-scene-file");
        expect(parseSceneFile(JSON.stringify([1, 2, 3])).error).toBe("invalid-json");
    });

    it("rejects a scene with no elements", () => {
        const scene = serializeScene({}, sampleBackground);
        expect(parseSceneFile(JSON.stringify(scene)).error).toBe("empty-scene");
    });

    it("rejects a scene file whose container version doesn't match, without silently accepting it", () => {
        const scene = { ...serializeScene(sampleElements, sampleBackground), mosaicSceneVersion: 99 };
        const result = parseSceneFile(JSON.stringify(scene));
        expect(result.error).toBe("unsupported-version");
        expect(result.version).toBe(99);
    });

    it("rejects a scene over the element count cap", () => {
        const tooMany = {};
        for (let i = 0; i < MAX_IMPORT_ELEMENTS + 1; i++) {
            tooMany[`el-${i}`] = { type: "shape", shapeType: "Rectangle" };
        }
        const scene = serializeScene(tooMany, sampleBackground);
        const result = parseSceneFile(JSON.stringify(scene));
        expect(result.error).toBe("too-many-elements");
        expect(result.count).toBe(MAX_IMPORT_ELEMENTS + 1);
    });
});
