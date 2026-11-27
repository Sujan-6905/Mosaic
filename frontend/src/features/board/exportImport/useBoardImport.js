import { SCENE_IMPORT_ERROR_MESSAGES, parseSceneFile, serializeScene } from "./sceneSerializer";
import axiosInstance from "@/lib/axiosInstance";
import { buildDuplicatedElements } from "../../../../../shared/canvas/editing/duplication.js";
import { useCallback } from "react";
import { generateElementId } from "../state/boardHelpers";
import { getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { nextZIndex } from "../../../../../shared/canvas/editing/zOrder.js";

export const useBoardImport = (board) => {
    const { addGeneratedElements, background, boardTitle, clearRedoStack, elements, getVisibleCanvasBounds, pushUndoEntry, router, session, showToast } = board;

    // A separate board with everything this one holds now; unlike a branch it keeps no link back.
    const duplicateBoard = useCallback(async () => {
        try {
            const { data } = await axiosInstance.post(
                "/api/drawing/import",
                { title: `${boardTitle || "Untitled board"} (copy)`.slice(0, 100), scene: serializeScene(elements, background, boardTitle) },
                { headers: { Authorization: `Bearer ${session?.accessToken}` } },
            );
            showToast?.success("Copy made", "You're on the copy now.");
            router.push(`/?shareId=${data.data.shareId}`);
        } catch (err) {
            showToast?.error("Couldn't copy this board", err.response?.data?.message || "Try again in a moment.");
        }
    }, [background, boardTitle, elements, router, session?.accessToken, showToast]);

    // Into a brand-new board: the server validates the whole file in one
    // shot (sceneFileSchema) since there's no live room to insert into yet.
    const handleImportNewBoard = useCallback(
        async (file, title) => {
            const text = await file.text();
            const { scene, error } = parseSceneFile(text);
            if (error) {
                showToast?.error("Import failed", SCENE_IMPORT_ERROR_MESSAGES[error] || "Could not import that file.");
                return;
            }
            try {
                const { data } = await axiosInstance.post(
                    "/api/drawing/import",
                    { title, scene },
                    { headers: { Authorization: `Bearer ${session?.accessToken}` } },
                );
                showToast?.success("Imported", "New board created from file.");
                router.push(`/?shareId=${data.data.shareId}`);
            } catch (err) {
                showToast?.error("Import failed", err.response?.data?.message || "Could not import that file.");
            }
        },
        [session?.accessToken, router, showToast],
    );

    // Merges through the batch insert a paste uses, so the server validates each element as usual.
    const handleImportMerge = useCallback(
        async (file) => {
            const text = await file.text();
            const { scene, error } = parseSceneFile(text);
            if (error) {
                showToast?.error("Import failed", SCENE_IMPORT_ERROR_MESSAGES[error] || "Could not import that file.");
                return;
            }
            const visible = getVisibleCanvasBounds();
            const targetCenterX = visible.x + visible.width / 2;
            const targetCenterY = visible.y + visible.height / 2;
            const importedBounds = getUnionBounds(Object.values(scene.elements));
            const offset = importedBounds
                ? { dx: targetCenterX - (importedBounds.minX + importedBounds.maxX) / 2, dy: targetCenterY - (importedBounds.minY + importedBounds.maxY) / 2 }
                : { dx: 0, dy: 0 };
            const ids = Object.keys(scene.elements);
            const mapped = buildDuplicatedElements(scene.elements, ids, offset, generateElementId, nextZIndex(elements));
            addGeneratedElements(mapped);
            showToast?.success("Imported", `${mapped.length} element${mapped.length === 1 ? "" : "s"} merged into the board.`);
        },
        [elements, addGeneratedElements, getVisibleCanvasBounds, showToast],
    );

    // The server's broadcasts already applied the restore, so this only records one undo step.
    const handleVersionRestored = useCallback(
        (elementOps) => {
            if (!elementOps || elementOps.length === 0) return;
            const ops = elementOps.map(({ elementId, before, after }) => ({
                type: after === null ? "delete" : before === null ? "insert" : "update",
                elementId,
                before,
                after,
            }));
            pushUndoEntry(ops.length === 1 ? ops[0] : { type: "batch", ops });
            clearRedoStack();
        },
        [pushUndoEntry, clearRedoStack],
    );

    const handleForked = useCallback((fork) => {
        window.open(`/?shareId=${fork.shareId}`, "_blank", "noopener,noreferrer");
    }, []);

    return {
        handleForked,
        handleImportMerge,
        duplicateBoard,
        handleImportNewBoard,
        handleVersionRestored,
    };
};
