import { sanitizeIncomingElements } from "../../../../../shared/canvas/elements/links.js";
import { ELEMENT_SCHEMA_VERSION, MAX_IMPORT_ELEMENTS, SCENE_FORMAT_VERSION } from "../../../../../shared/canvas/elements/sceneFile.js";

export const serializeScene = (elements, background, title) => ({
    mosaicSceneVersion: SCENE_FORMAT_VERSION,
    elementSchemaVersion: ELEMENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    title: title || null,
    elements,
    background,
});

// Returns { scene }, or { error } with its own code, since the import dialog explains each failure differently.
export const parseSceneFile = (text) => {
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        return { error: "invalid-json" };
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { error: "invalid-json" };
    }
    if (!parsed.elements || typeof parsed.elements !== "object" || Array.isArray(parsed.elements)) {
        return { error: "not-a-scene-file" };
    }
    if (parsed.mosaicSceneVersion !== SCENE_FORMAT_VERSION) {
        return { error: "unsupported-version", version: parsed.mosaicSceneVersion };
    }

    const elementCount = Object.keys(parsed.elements).length;
    if (elementCount === 0) {
        return { error: "empty-scene" };
    }
    if (elementCount > MAX_IMPORT_ELEMENTS) {
        return { error: "too-many-elements", count: elementCount, max: MAX_IMPORT_ELEMENTS };
    }

    const ownOrigins = typeof window === "undefined" ? [] : [window.location.origin];
    const safeElements = Object.fromEntries(
        Object.entries(parsed.elements).flatMap(([id, element]) => sanitizeIncomingElements([element], ownOrigins).map((safe) => [id, safe])),
    );
    return { scene: { ...parsed, elements: safeElements } };
};

export const SCENE_IMPORT_ERROR_MESSAGES = {
    "invalid-json": "That file isn't valid JSON.",
    "not-a-scene-file": "That file doesn't look like a Mosaic scene file.",
    "unsupported-version": "This scene file was exported by a newer version of Mosaic and can't be opened here.",
    "empty-scene": "That scene file has no elements to import.",
    "too-many-elements": `A scene file can have at most ${MAX_IMPORT_ELEMENTS} elements.`,
};
