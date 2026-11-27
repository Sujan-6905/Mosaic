import { buildSvgDocument, listFramePages, resolveExportScope } from "./sceneExport";
import { serializeScene } from "./sceneSerializer";
import { downloadBlob, downloadUrl } from "@/lib/downloadFile";
import { paintBackground } from "../rendering/backgroundRenderer";
import { resolveElementColor } from "../rendering/colorResolver";
import { resolveStrokePressures } from "../rendering/strokeRenderer";
import { useCallback } from "react";
import { tessellatePoster } from "./tessellate";
import { recordTimelapse } from "./timelapse";
import axiosInstance from "@/lib/axiosInstance";

const UNSAFE_FILENAME_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f]+/g;

// "Q3 roadmap 2026-11-11": the board's own name, made safe for every OS's file system.
export const exportFileBase = (title, date) => {
    const name = (title || "").replace(UNSAFE_FILENAME_CHARACTERS, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Mosaic board";
    return `${name} ${date.toISOString().slice(0, 10)}`;
};

export const useBoardExport = (board) => {
    const {
        background,
        boardTitle,
        collaborators,
        currentPath,
        currentStrokeStyleRef,
        currentStrokeUsesRealPressureRef,
        drawElement,
        elements,
        getVisibleCanvasBounds,
        isDrawing,
        paintOrder,
        selectedElementIds,
        setExportDialogOpen,
        session,
        shareId,
        showToast,
    } = board;

    // Exports redraw every element into an off-screen canvas framed to the content, since the live canvases
    // hold only what's in view. PDF embeds this raster; SVG has its own vector path.
    const EXPORT_PADDING = 40;
    const EXPORT_MAX_DIMENSION = 8000;
    // Stones are laid from a double-resolution render so each one samples real detail.
    const STONE_SCALE = 2;

    const inProgressStrokeEntry = useCallback(() => {
        if (!isDrawing.current || currentPath.current.length <= 1 || !currentStrokeStyleRef.current) return null;
        const resolvedPoints = resolveStrokePressures(currentPath.current, currentStrokeUsesRealPressureRef.current);
        return ["__in-progress-stroke__", { type: "path", points: resolvedPoints, ...currentStrokeStyleRef.current }];
    }, [currentPath, currentStrokeStyleRef, currentStrokeUsesRealPressureRef, isDrawing]);

    const renderElementsToCanvas = useCallback(
        (scopedElements, bounds, { scale = 1, transparent = false } = {}) => {
            const width = Math.min(EXPORT_MAX_DIMENSION, Math.max(1, (bounds.maxX - bounds.minX + EXPORT_PADDING * 2) * scale));
            const height = Math.min(EXPORT_MAX_DIMENSION, Math.max(1, (bounds.maxY - bounds.minY + EXPORT_PADDING * 2) * scale));
            const exportCanvas = document.createElement("canvas");
            exportCanvas.width = width;
            exportCanvas.height = height;
            const exportContext = exportCanvas.getContext("2d");
            if (!transparent) {
                exportContext.fillStyle = resolveElementColor("bg-canvas", "#ffffff");
                exportContext.fillRect(0, 0, width, height);
            }
            const exportCamera = { x: bounds.minX - EXPORT_PADDING, y: bounds.minY - EXPORT_PADDING, zoom: scale };
            exportContext.setTransform(exportCamera.zoom, 0, 0, exportCamera.zoom, -exportCamera.x * scale, -exportCamera.y * scale);
            if (!transparent) paintBackground(exportContext, exportCamera, width, height, background);
            paintOrder.allEntries(scopedElements).forEach(([, element]) => drawElement(exportContext, element));
            return exportCanvas;
        },
        [paintOrder, drawElement, background],
    );

    // One frame of a time-lapse, drawn the way the board draws itself.
    const paintFrame = useCallback(
        (context, frameElements, frameBackground, camera) => {
            const { width, height } = context.canvas;
            context.fillStyle = resolveElementColor("bg-canvas", "#ffffff");
            context.fillRect(0, 0, width, height);
            context.setTransform(camera.zoom, 0, 0, camera.zoom, -camera.x * camera.zoom, -camera.y * camera.zoom);
            paintBackground(context, camera, width, height, frameBackground);
            paintOrder.allEntries(frameElements).forEach(([, element]) => drawElement(context, element));
        },
        [paintOrder, drawElement],
    );

    const exportTimelapse = useCallback(
        async (filenameBase) => {
            const { data } = await axiosInstance.get(`/api/drawing/${shareId}/replay/reel`, {
                params: { frames: 120 },
                headers: { Authorization: `Bearer ${session?.accessToken}` },
            });
            if (data.frames.length < 2) throw new Error("This board has no history to play back yet.");
            setExportDialogOpen(false);
            showToast?.info("Recording the time-lapse", "About twenty seconds. Keep this tab open.");
            const { blob, extension } = await recordTimelapse({ frames: data.frames, latestSeq: data.latestSeq, title: boardTitle, paint: paintFrame });
            const filename = `${filenameBase} time-lapse.${extension}`;
            downloadBlob(blob, filename);
            return filename;
        },
        [shareId, session?.accessToken, boardTitle, paintFrame, setExportDialogOpen, showToast],
    );

    const boardElementsWithInProgressStroke = useCallback(() => {
        const stroke = inProgressStrokeEntry();
        return stroke ? { ...elements, [stroke[0]]: stroke[1] } : elements;
    }, [elements, inProgressStrokeEntry]);

    const scopedExportBounds = useCallback(
        (scopeElements, bounds) => {
            if (bounds) return bounds;
            // An empty scope still exports something sane: the current
            // viewport's content, rather than a 0x0 canvas.
            const visible = getVisibleCanvasBounds();
            return { minX: visible.x, minY: visible.y, maxX: visible.x + visible.width, maxY: visible.y + visible.height };
        },
        [getVisibleCanvasBounds],
    );

    const handleExport = useCallback(
        async ({ format, scope, frameId, scale, transparent, cell }) => {
            const liveElements = boardElementsWithInProgressStroke();
            const filenameBase = exportFileBase(boardTitle, new Date());

            try {
                let savedAs = `${filenameBase}${format === "stone" ? " in stone.png" : `.${format}`}`;
                if (format === "timelapse") {
                    savedAs = await exportTimelapse(filenameBase);
                } else if (format === "mosaic") {
                    const { elements: scoped } = resolveExportScope(liveElements, scope, { selectionIds: selectedElementIds, frameId });
                    downloadBlob(
                        new Blob([JSON.stringify(serializeScene(scoped, background), null, 2)], { type: "application/json" }),
                        `${filenameBase}.mosaic`,
                    );
                } else if (format === "svg") {
                    const { elements: scoped, bounds } = resolveExportScope(liveElements, scope, { selectionIds: selectedElementIds, frameId });
                    const svg = buildSvgDocument(scoped, background, scopedExportBounds(scoped, bounds), { transparent });
                    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${filenameBase}.svg`);
                } else if (format === "png") {
                    const { elements: scoped, bounds } = resolveExportScope(liveElements, scope, { selectionIds: selectedElementIds, frameId });
                    const canvas = renderElementsToCanvas(scoped, scopedExportBounds(scoped, bounds), { scale, transparent });
                    downloadUrl(canvas.toDataURL("image/png", 1.0), `${filenameBase}.png`);
                } else if (format === "stone") {
                    const { elements: scoped, bounds } = resolveExportScope(liveElements, scope, { selectionIds: selectedElementIds, frameId });
                    const raster = renderElementsToCanvas(scoped, scopedExportBounds(scoped, bounds), { scale: STONE_SCALE, transparent: false });
                    const poster = tessellatePoster(raster, {
                        cell: cell * STONE_SCALE,
                        title: boardTitle,
                        makers: collaborators.map((person) => person.username).filter(Boolean),
                    });
                    downloadUrl(poster.toDataURL("image/png"), `${filenameBase} in stone.png`);
                } else if (format === "pdf") {
                    const { jsPDF } = await import("jspdf");
                    const pages =
                        scope === "frames"
                            ? listFramePages(liveElements)
                            : [{ ...resolveExportScope(liveElements, scope, { selectionIds: selectedElementIds, frameId }) }];
                    let doc = null;
                    for (const page of pages) {
                        const bounds = scopedExportBounds(page.elements, page.bounds);
                        const canvas = renderElementsToCanvas(page.elements, bounds, { scale: 1, transparent: false });
                        const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
                        if (!doc) doc = new jsPDF({ orientation, unit: "px", format: [canvas.width, canvas.height] });
                        else doc.addPage([canvas.width, canvas.height], orientation);
                        doc.addImage(canvas.toDataURL("image/png", 1.0), "PNG", 0, 0, canvas.width, canvas.height);
                    }
                    doc?.save(`${filenameBase}.pdf`);
                }
                showToast?.success("Exported", `Saved as ${savedAs}`);
            } catch (error) {
                showToast?.error("Export failed", error.message || "Could not export the board");
            }
            setExportDialogOpen(false);
        },
        [
            boardElementsWithInProgressStroke,
            background,
            boardTitle,
            collaborators,
            selectedElementIds,
            renderElementsToCanvas,
            scopedExportBounds,
            showToast,
            setExportDialogOpen,
            exportTimelapse,
        ],
    );

    // The export dialog's live Stone preview reads the same render the poster is laid from.
    const rasterForExport = useCallback(
        ({ scope, frameId }) => {
            const { elements: scoped, bounds } = resolveExportScope(elements, scope, { selectionIds: selectedElementIds, frameId });
            return renderElementsToCanvas(scoped, scopedExportBounds(scoped, bounds), { scale: 1, transparent: false });
        },
        [elements, selectedElementIds, renderElementsToCanvas, scopedExportBounds],
    );

    // The selection, or the whole board when nothing is selected, as a picture
    // to paste into a chat or document.
    const copyAsPng = useCallback(async () => {
        const liveElements = boardElementsWithInProgressStroke();
        const scope = selectedElementIds.length > 0 ? "selection" : "board";
        const { elements: scoped, bounds } = resolveExportScope(liveElements, scope, { selectionIds: selectedElementIds });
        const canvas = renderElementsToCanvas(scoped, scopedExportBounds(scoped, bounds), { scale: 2, transparent: false });
        try {
            const png = new Promise((resolve, reject) =>
                canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The picture couldn't be made"))), "image/png"),
            );
            await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
            showToast?.success(
                "Copied",
                scope === "selection" ? "The selection is on your clipboard as a picture" : "The board is on your clipboard as a picture",
            );
        } catch (error) {
            showToast?.error("Couldn't copy", error.message || "This browser didn't allow copying a picture");
        }
    }, [boardElementsWithInProgressStroke, selectedElementIds, renderElementsToCanvas, scopedExportBounds, showToast]);

    return {
        copyAsPng,
        handleExport,
        rasterForExport,
    };
};
