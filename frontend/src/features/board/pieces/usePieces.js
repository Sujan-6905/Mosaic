import { useCallback, useEffect, useState } from "react";
import { generateElementId } from "../state/boardHelpers";
import { translateElement } from "../../../../../shared/canvas/geometry/elementGeometry.js";
import { elementsFromPiece, pieceFromSelection } from "../../../../../shared/canvas/pieces/pieces.js";
import { piecesApi, pieceSetFile, PIECE_FILE_EXTENSION, readPieceSetFile, setIdFromLink } from "./piecesApi";
import { downloadBlob } from "@/lib/downloadFile";
import { nextZIndex } from "../../../../../shared/canvas/editing/zOrder.js";

const MY_SET_TITLE = "My pieces";
const messageOf = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

// The Pieces library on the board: someone's own sets, saving a selection into
// one, placing a piece, and sharing, exporting, importing and installing sets.
export const usePieces = (board) => {
    const { addGeneratedElements, elements, piecesOpen, selectedElementIds, session, setAiPlacement, setSelectedElementIds, showToast } = board;
    const token = session?.accessToken;
    const [sets, setSets] = useState(null);

    const refreshPieces = useCallback(async () => {
        if (!token) return;
        try {
            setSets(await piecesApi(token).list());
        } catch (error) {
            setSets([]);
            showToast?.error("Pieces", messageOf(error, "Couldn't load your pieces."));
        }
        // showToast changes identity every render; reloading on it would loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    useEffect(() => {
        if (piecesOpen && sets === null) refreshPieces();
    }, [piecesOpen, sets, refreshPieces]);

    const run = useCallback(
        async (work, failure) => {
            try {
                await work(piecesApi(token));
                await refreshPieces();
                return true;
            } catch (error) {
                showToast?.error("Pieces", messageOf(error, failure));
                return false;
            }
        },
        [token, refreshPieces, showToast],
    );

    // Into the named set, or a new "My pieces" set the first time.
    const saveSelectionAsPiece = useCallback(
        (name, setId) => {
            const pieceElements = pieceFromSelection(elements, selectedElementIds);
            if (!pieceElements) return Promise.resolve(false);
            return run(async (api) => {
                const target =
                    setId ||
                    (sets ?? []).find((set) => set.title === MY_SET_TITLE && !set.installedFrom)?._id ||
                    (await api.createSet({ title: MY_SET_TITLE }))._id;
                await api.addPiece(target, { name, elements: pieceElements });
                showToast?.success("Saved", `"${name}" is in your pieces.`);
            }, "Couldn't save that piece.");
        },
        [elements, selectedElementIds, sets, run, showToast],
    );

    const placePiece = useCallback((piece) => setAiPlacement({ mapped: elementsFromPiece(piece.elements, generateElementId) }), [setAiPlacement]);

    // A piece dragged from the panel lands where it's dropped.
    const dropPiece = useCallback(
        (piece, point) => {
            const zIndexBase = nextZIndex(elements);
            const placed = elementsFromPiece(piece.elements, generateElementId).map(({ elementId, element }) => ({
                elementId,
                element: { ...translateElement(element, point.x, point.y), zIndex: zIndexBase + element.zIndex },
            }));
            addGeneratedElements(placed);
            setSelectedElementIds(placed.map(({ elementId }) => elementId));
        },
        [elements, addGeneratedElements, setSelectedElementIds],
    );

    const shareSet = useCallback(
        async (set) => {
            const link = `${window.location.origin}/pieces/${set._id}`;
            const shared = await run((api) => (set.published ? Promise.resolve() : api.updateSet(set._id, { published: true })), "Couldn't share that set.");
            if (!shared) return;
            await navigator.clipboard?.writeText(link).catch(() => {});
            showToast?.success("Link copied", "Anyone signed in with the link can install this set.");
        },
        [run, showToast],
    );

    const stopSharingSet = useCallback((set) => run((api) => api.updateSet(set._id, { published: false }), "Couldn't stop sharing that set."), [run]);
    const listSet = useCallback(
        async (set, { license, tags }) => {
            const listed = await run((api) => api.updateSet(set._id, { listed: true, license, tags }), "Couldn't list that set.");
            if (listed) showToast?.success("Listed", "Your set is in the Pieces gallery.");
            return listed;
        },
        [run, showToast],
    );
    const unlistSet = useCallback((set) => run((api) => api.updateSet(set._id, { listed: false }), "Couldn't take that set out of the gallery."), [run]);
    const deleteSet = useCallback((set) => run((api) => api.deleteSet(set._id), "Couldn't delete that set."), [run]);
    const removePiece = useCallback((set, piece) => run((api) => api.removePiece(set._id, piece.id), "Couldn't remove that piece."), [run]);
    const renameSet = useCallback((set, title) => run((api) => api.updateSet(set._id, { title }), "Couldn't rename that set."), [run]);

    const exportSet = useCallback((set) => {
        downloadBlob(
            new Blob([pieceSetFile(set)], { type: "application/json" }),
            `${set.title.replace(/[^\w -]+/g, "").trim() || "pieces"}${PIECE_FILE_EXTENSION}`,
        );
    }, []);

    const importSetFile = useCallback(
        async (file) => {
            let parsed;
            try {
                parsed = readPieceSetFile(await file.text(), file.name);
            } catch (error) {
                showToast?.error("Pieces", messageOf(error, "That file couldn't be read."));
                return;
            }
            const done = await run((api) => api.createSet(parsed), "Some pieces in that file aren't valid board elements.");
            if (done) showToast?.success("Imported", `"${parsed.title}" is ready to use.`);
        },
        [run, showToast],
    );

    const installFromLink = useCallback(
        async (link) => {
            const setId = setIdFromLink(link);
            if (!setId) {
                showToast?.error("Pieces", "That doesn't look like a piece set link.");
                return false;
            }
            return run(async (api) => {
                const installed = await api.install(setId);
                showToast?.success("Installed", `"${installed.title}" is in your pieces.`);
            }, "Couldn't install that set.");
        },
        [run, showToast],
    );

    return {
        deleteSet,
        dropPiece,
        exportSet,
        importSetFile,
        installFromLink,
        pieceSets: sets,
        placePiece,
        refreshPieces,
        removePiece,
        renameSet,
        saveSelectionAsPiece,
        shareSet,
        stopSharingSet,
        listSet,
        unlistSet,
    };
};
