import axiosInstance from "@/lib/axiosInstance";
import { isExcalidrawLibrary, piecesFromExcalidrawLibrary } from "./excalidrawLibrary.js";

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const piecesApi = (token) => ({
    list: () => axiosInstance.get("/api/pieces", auth(token)).then(({ data }) => data.sets),
    createSet: (body) => axiosInstance.post("/api/pieces", body, auth(token)).then(({ data }) => data.set),
    updateSet: (setId, patch) => axiosInstance.patch(`/api/pieces/${setId}`, patch, auth(token)).then(({ data }) => data.set),
    deleteSet: (setId) => axiosInstance.delete(`/api/pieces/${setId}`, auth(token)),
    addPiece: (setId, piece) => axiosInstance.post(`/api/pieces/${setId}/pieces`, piece, auth(token)).then(({ data }) => data.piece),
    removePiece: (setId, pieceId) => axiosInstance.delete(`/api/pieces/${setId}/pieces/${pieceId}`, auth(token)),
    shared: (setId) => axiosInstance.get(`/api/pieces/shared/${setId}`, auth(token)).then(({ data }) => data.set),
    install: (setId) => axiosInstance.post(`/api/pieces/shared/${setId}/install`, {}, auth(token)).then(({ data }) => data.set),
});

export const PIECE_FILE_EXTENSION = ".mosaicpieces";
export const EXCALIDRAW_LIBRARY_EXTENSION = ".excalidrawlib";
export const PIECE_DRAG_TYPE = "application/x-mosaic-piece";

// A set as a file someone else can import: the pieces and nothing about who made them.
export const pieceSetFile = (set) =>
    JSON.stringify(
        {
            kind: "mosaic-pieces",
            version: 1,
            title: set.title,
            description: set.description || "",
            pieces: set.pieces.map(({ name, elements }) => ({ name, elements })),
        },
        null,
        2,
    );

export const readPieceSetFile = (text, fileName = "") => {
    const parsed = JSON.parse(text);
    if (isExcalidrawLibrary(parsed)) {
        const pieces = piecesFromExcalidrawLibrary(parsed);
        if (pieces.length === 0) throw new Error("That Excalidraw library has nothing a board can hold.");
        return {
            title: (fileName.replace(/\.excalidrawlib$/i, "") || "Excalidraw library").slice(0, 60),
            description: "Imported from an Excalidraw library.",
            pieces,
        };
    }
    if (parsed?.kind !== "mosaic-pieces" || !Array.isArray(parsed.pieces)) throw new Error("This isn't a Mosaic pieces file or an Excalidraw library.");
    return {
        title: String(parsed.title || "Imported pieces").slice(0, 60),
        description: String(parsed.description || "").slice(0, 300),
        pieces: parsed.pieces,
    };
};

// Accepts a set's share link or its bare id.
export const setIdFromLink = (value) => {
    const trimmed = (value || "").trim();
    const fromPath = trimmed.match(/\/pieces\/([A-Za-z0-9_-]+)/);
    if (fromPath) return fromPath[1];
    return /^[A-Za-z0-9_-]{6,}$/.test(trimmed) ? trimmed : null;
};
