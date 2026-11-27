import { describe, expect, it } from "vitest";
import { elementsFromPiece, pieceFromSelection } from "../../../../../../shared/canvas/pieces/pieces.js";
import { readPieceSetFile, pieceSetFile, setIdFromLink } from "../piecesApi";
import { STARTER_SETS } from "../../../../../../shared/canvas/pieces/starterSets.js";

const box = (x, y) => ({ type: "shape", shapeType: "Rectangle", startX: x, startY: y, endX: x + 100, endY: y + 50, zIndex: 1, rotation: 0 });

describe("pieces", () => {
    const board = {
        a: box(200, 300),
        b: box(500, 300),
        arrow: { type: "connector", startX: 250, startY: 325, endX: 550, endY: 325, startElementId: "a", endElementId: "b", zIndex: 2, rotation: 0 },
        stray: { type: "connector", startX: 250, startY: 325, endX: 900, endY: 900, startElementId: "a", endElementId: "elsewhere", zIndex: 3, rotation: 0 },
    };

    it("stores a selection at the origin with arrows bound only inside it", () => {
        const piece = pieceFromSelection(board, ["a", "b", "arrow", "stray"]);
        expect(piece.p0).toMatchObject({ startX: 0, startY: 0 });
        expect(piece.p2).toMatchObject({ startElementId: "p0", endElementId: "p1" });
        expect(piece.p3).toMatchObject({ startElementId: "p0", endElementId: null, endAnchor: null });
    });

    it("places a piece as fresh, centred elements whose arrow joins the new shapes", () => {
        let n = 0;
        const placed = elementsFromPiece(pieceFromSelection(board, ["a", "b", "arrow"]), () => `new${n++}`);
        const ids = placed.map(({ elementId }) => elementId);
        const placedArrow = placed.find(({ element }) => element.type === "connector").element;
        expect(ids).toContain(placedArrow.startElementId);
        expect(ids).toContain(placedArrow.endElementId);
        const xs = placed.filter(({ element }) => element.type === "shape").flatMap(({ element }) => [element.startX, element.endX]);
        expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(0);
    });

    it("round-trips a set through its file and rejects anything else", () => {
        const file = pieceSetFile({ title: "Mine", pieces: [{ id: "x", name: "Box", elements: { p0: box(0, 0) } }] });
        expect(readPieceSetFile(file).pieces[0].name).toBe("Box");
        expect(() => readPieceSetFile(JSON.stringify({ nope: true }))).toThrow();
    });

    it("reads a set id from a share link or on its own", () => {
        expect(setIdFromLink("https://mosaic.app/pieces/abc123-def")).toBe("abc123-def");
        expect(setIdFromLink("abc123-def")).toBe("abc123-def");
        expect(setIdFromLink("not a link")).toBeNull();
    });

    it("ships starter sets whose arrows point at shapes in the same piece", () => {
        STARTER_SETS.forEach((set) =>
            set.pieces.forEach((piece) => {
                Object.values(piece.elements)
                    .filter((element) => element.type === "connector")
                    .forEach((connector) => {
                        expect(piece.elements[connector.startElementId]).toBeTruthy();
                        expect(piece.elements[connector.endElementId]).toBeTruthy();
                    });
            }),
        );
    });
});
