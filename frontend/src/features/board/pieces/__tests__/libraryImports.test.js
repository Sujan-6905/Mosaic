import { describe, expect, it } from "vitest";
import { iconFromSvgBody, isValidIcon, iconTransform } from "../../../../../../shared/canvas/elements/iconPaths.js";
import { piecesFromExcalidrawLibrary, isExcalidrawLibrary } from "../excalidrawLibrary.js";
import { STARTER_SETS } from "../../../../../../shared/canvas/pieces/starterSets.js";
import { elementSchema } from "../../../../../../backend/src/validation/socketSchemas.js";
import { readPieceSetFile } from "../piecesApi";

describe("icon paths", () => {
    it("turns circles, rects, lines and polylines into paths, inheriting paint from a group", () => {
        const icon = iconFromSvgBody(
            '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><rect x="2" y="2" width="6" height="4" rx="1"/><line x1="0" y1="0" x2="5" y2="5"/><polyline points="1 1 2 2 3 1"/></g>',
        );
        expect(icon.paths).toHaveLength(4);
        icon.paths.forEach((path) => expect(path).toMatchObject({ fill: "none", stroke: "ink", width: 2, cap: "round" }));
        expect(isValidIcon(icon)).toBe(true);
    });

    it("keeps a logo's own colours and a gradient's first stop", () => {
        const icon = iconFromSvgBody(
            '<defs><linearGradient id="g"><stop stop-color="#ff9900"/></linearGradient></defs><path fill="url(#g)" d="M0 0h10v10z"/><path fill="#ffffff" d="M2 2h2v2z"/>',
        );
        expect(icon.paths.map((path) => path.fill)).toEqual(["#ff9900", "#ffffff"]);
    });

    it("leaves out icons it can't draw faithfully", () => {
        expect(iconFromSvgBody('<g transform="rotate(45)"><path d="M0 0h1"/></g>')).toBeNull();
        expect(iconFromSvgBody('<image href="x.png"/>')).toBeNull();
    });

    it("refuses path data carrying anything but path commands", () => {
        expect(isValidIcon({ viewBox: [0, 0, 24, 24], paths: [{ d: "M0 0<script>", fill: "ink", stroke: "none" }] })).toBe(false);
        expect(isValidIcon({ viewBox: [0, 0, 24, 24], paths: [{ d: "M0 0h4", fill: "url(#x)", stroke: "none" }] })).toBe(false);
        expect(isValidIcon({ viewBox: [0, 0, 24, 24], paths: [{ d: "M0 0h4", fill: "ink", stroke: "ink", cap: 'round" onload="alert(1)' }] })).toBe(false);
        expect(isValidIcon({ viewBox: [0, 0, 24, 24], paths: [{ d: "M0 0h4", fill: "ink", stroke: "ink", join: "<x>" }] })).toBe(false);
    });

    it("fits a view box into a box, centred", () => {
        expect(iconTransform({ viewBox: [0, 0, 24, 24] }, { minX: 0, minY: 0, maxX: 48, maxY: 96 })).toEqual({ scale: 2, x: 0, y: 24 });
    });
});

describe("Excalidraw libraries", () => {
    const library = {
        type: "excalidrawlib",
        version: 2,
        libraryItems: [
            {
                name: "Service",
                elements: [
                    {
                        id: "r",
                        type: "rectangle",
                        x: 10,
                        y: 10,
                        width: 120,
                        height: 60,
                        strokeColor: "#1e1e1e",
                        backgroundColor: "#a5d8ff",
                        fillStyle: "hachure",
                        strokeWidth: 2,
                        strokeStyle: "solid",
                        roughness: 1,
                        opacity: 100,
                        angle: 0,
                        roundness: { type: 3 },
                        groupIds: [],
                    },
                    {
                        id: "t",
                        type: "text",
                        x: 30,
                        y: 30,
                        width: 60,
                        height: 20,
                        text: "API",
                        fontSize: 20,
                        fontFamily: 1,
                        textAlign: "center",
                        containerId: "r",
                        strokeColor: "#1e1e1e",
                    },
                    {
                        id: "d",
                        type: "ellipse",
                        x: 300,
                        y: 10,
                        width: 80,
                        height: 60,
                        strokeColor: "#1e1e1e",
                        backgroundColor: "transparent",
                        strokeWidth: 1,
                        angle: 0,
                    },
                    {
                        id: "a",
                        type: "arrow",
                        x: 130,
                        y: 40,
                        points: [
                            [0, 0],
                            [80, 20],
                            [170, 0],
                        ],
                        startBinding: { elementId: "r" },
                        endBinding: { elementId: "d" },
                        endArrowhead: "triangle",
                        strokeColor: "#1e1e1e",
                        strokeWidth: 2,
                    },
                    {
                        id: "f",
                        type: "freedraw",
                        x: 0,
                        y: 100,
                        points: [
                            [0, 0],
                            [5, 5],
                            [10, 0],
                        ],
                        strokeColor: "#e03131",
                        strokeWidth: 1,
                    },
                    { id: "gone", type: "rectangle", x: 0, y: 0, width: 5, height: 5, isDeleted: true },
                    { id: "img", type: "image", x: 0, y: 0, width: 5, height: 5 },
                ],
            },
        ],
    };

    it("brings shapes, words in boxes, bound arrows and freehand lines across as board elements", () => {
        expect(isExcalidrawLibrary(library)).toBe(true);
        const [piece] = piecesFromExcalidrawLibrary(library);
        expect(piece.name).toBe("Service");
        const elements = Object.values(piece.elements);
        expect(elements.map((element) => element.type).sort()).toEqual(["connector", "path", "shape", "shape"]);
        const box = elements.find((element) => element.shapeType === "Rectangle");
        expect(box).toMatchObject({ text: "API", fillColor: "#a5d8ff", fillStyle: "hachure", startY: 0 });
        const arrow = elements.find((element) => element.type === "connector");
        expect(arrow.endHead).toBe("triangle");
        expect(piece.elements[arrow.startElementId]).toBe(box);
        elements.forEach((element) => expect(elementSchema.safeParse(element).success).toBe(true));
    });

    it("reads the older version too, and imports a library file as a piece set", () => {
        const older = { type: "excalidrawlib", version: 1, library: [library.libraryItems[0].elements] };
        expect(piecesFromExcalidrawLibrary(older)[0].name).toBe("Item 1");
        const set = readPieceSetFile(JSON.stringify(library), "cloud bits.excalidrawlib");
        expect(set.title).toBe("cloud bits");
        expect(set.pieces).toHaveLength(1);
    });
});

describe("built-in kits", () => {
    it("are made only of elements a board accepts, with arrows joined inside each piece", () => {
        const kits = STARTER_SETS.filter((set) => set.kit);
        expect(kits.length).toBeGreaterThanOrEqual(10);
        STARTER_SETS.forEach((set) =>
            set.pieces.forEach((piece) =>
                Object.entries(piece.elements).forEach(([id, element]) => {
                    const parsed = elementSchema.safeParse(element);
                    expect({ piece: `${set.title}/${piece.name}/${id}`, valid: parsed.success }).toEqual({
                        piece: `${set.title}/${piece.name}/${id}`,
                        valid: true,
                    });
                    if (element.type === "connector")
                        [element.startElementId, element.endElementId].filter(Boolean).forEach((bound) => expect(piece.elements[bound]).toBeDefined());
                }),
            ),
        );
    });
});
