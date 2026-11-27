import { buildDuplicatedElements } from "../../../../../shared/canvas/editing/duplication.js";
import { flipElements } from "./flip";
import { buildTidyPositionUpdates } from "../diagrams/tidyUp";
import { getBoundConnectorUpdates } from "../../../../../shared/canvas/elements/connectors";
import { socket } from "@/lib/socket.js";
import { translateElement } from "../../../../../shared/canvas/geometry/elementGeometry.js";
import { useCallback, useEffect } from "react";
import { DUPLICATE_OFFSET, TIDY_ANIMATION_MS, generateElementId } from "../state/boardHelpers";
import { nextZIndex } from "../../../../../shared/canvas/editing/zOrder.js";

export const useSelectionCommands = (board) => {
    const {
        addGeneratedElements,
        applyElementUpdates,
        clearRedoStack,
        elements,
        pushUndoEntry,
        redoStackRef,
        requestStaticFullRepaint,
        selectedElementIds,
        session,
        setAgentActivityByUserId,
        setElements,
        setRedoStack,
        setSelectedElementIds,
        setUndoStack,
        lastDuplicateRef,
        shareId,
        tidyAnimationFrameRef,
        undoStackRef,
        unlockedIds,
    } = board;

    // One undo step for an agent's whole edit. Every client already applied it from the broadcasts before
    // this marker, so only the person who asked gets the undo entry.
    const applyAgentEditBatch = useCallback(
        ({ requestedByUserId, diff, batchId }) => {
            if (requestedByUserId !== session?.user?.id) return;
            const ops = [
                ...diff.added.map(({ elementId, element }) => ({ type: "insert", elementId, before: null, after: element })),
                ...diff.removed.map(({ elementId, element }) => ({ type: "delete", elementId, before: element, after: null })),
                ...diff.moved.map(({ elementId, before, after }) => ({ type: "update", elementId, before, after })),
                ...diff.modified.map(({ elementId, before, after }) => ({ type: "update", elementId, before, after })),
            ];
            if (ops.length === 0) return;
            pushUndoEntry({ type: "batch", ops, agentBatchId: batchId });
            clearRedoStack();
        },
        [session?.user?.id, pushUndoEntry, clearRedoStack],
    );

    useEffect(() => {
        const handleAgentEditApplied = (payload) => {
            if (payload.shareId !== shareId) return;
            applyAgentEditBatch(payload);
        };
        // Once a batch is undone from the chat, its undo entry would replay stale state.
        const handleAgentEditReverted = ({ shareId: revertedShareId, batchId }) => {
            if (revertedShareId !== shareId) return;
            const withoutBatch = (stack) => stack.filter((entry) => entry.agentBatchId !== batchId);
            undoStackRef.current = withoutBatch(undoStackRef.current);
            redoStackRef.current = withoutBatch(redoStackRef.current);
            setUndoStack(undoStackRef.current);
            setRedoStack(redoStackRef.current);
        };
        socket.on("server:agentEditApplied", handleAgentEditApplied);
        socket.on("server:agentEditReverted", handleAgentEditReverted);
        return () => {
            socket.off("server:agentEditApplied", handleAgentEditApplied);
            socket.off("server:agentEditReverted", handleAgentEditReverted);
        };
    }, [shareId, applyAgentEditBatch, redoStackRef, setRedoStack, setUndoStack, undoStackRef]);

    // Every collaborator sees who has an assistant turn running.
    useEffect(() => {
        const handleAgentActivity = (payload) => {
            if (payload.shareId !== shareId) return;
            setAgentActivityByUserId((prev) => {
                const next = new Map(prev);
                next.set(payload.userId, { stage: payload.stage, label: payload.label, turnId: payload.turnId });
                return next;
            });
        };
        const handleAgentActivityDone = (payload) => {
            if (payload.shareId !== shareId) return;
            setAgentActivityByUserId((prev) => {
                if (!prev.has(payload.userId)) return prev;
                const next = new Map(prev);
                next.delete(payload.userId);
                return next;
            });
        };
        socket.on("server:agentActivity", handleAgentActivity);
        socket.on("server:agentActivityDone", handleAgentActivityDone);
        return () => {
            socket.off("server:agentActivity", handleAgentActivity);
            socket.off("server:agentActivityDone", handleAgentActivityDone);
        };
    }, [shareId, setAgentActivityByUserId]);

    // Locks or unlocks the whole selection: all locked becomes unlocked, anything else becomes locked.
    // Locked elements stay selectable so they can always be found again.
    const toggleLockSelection = useCallback(() => {
        const ids = selectedElementIds.filter((id) => elements[id]);
        if (ids.length === 0) return;
        const nextLocked = !ids.every((id) => elements[id].locked);
        const updatedById = {};
        ids.forEach((id) => {
            updatedById[id] = { ...elements[id], locked: nextLocked };
        });
        applyElementUpdates(updatedById);
    }, [selectedElementIds, elements, applyElementUpdates]);

    // Duplicating the copy just made repeats the step that made it, so a row or a
    // ladder of copies comes from Alt-drag once and Ctrl D after.
    const duplicateSelection = useCallback(() => {
        if (selectedElementIds.length === 0) return;
        const last = lastDuplicateRef.current;
        const repeats = last && last.ids.length === selectedElementIds.length && last.ids.every((id) => selectedElementIds.includes(id));
        const offset = repeats ? last.offset : DUPLICATE_OFFSET;
        const duplicates = buildDuplicatedElements(elements, selectedElementIds, offset, generateElementId, nextZIndex(elements));
        if (duplicates.length === 0) return;
        addGeneratedElements(duplicates);
        const copyIds = duplicates.map(({ elementId }) => elementId);
        lastDuplicateRef.current = { ids: copyIds, offset };
        setSelectedElementIds(copyIds);
    }, [selectedElementIds, elements, addGeneratedElements, setSelectedElementIds, lastDuplicateRef]);

    const flipSelection = useCallback(
        (axis) => applyElementUpdates(flipElements(elements, unlockedIds(selectedElementIds), axis)),
        [elements, selectedElementIds, unlockedIds, applyElementUpdates],
    );

    // Everything of the same kind as the selection's first element: every star,
    // every sticky, every arrow.
    const selectAllLikeSelection = useCallback(() => {
        const model = elements[selectedElementIds[0]];
        if (!model) return;
        setSelectedElementIds(
            Object.keys(elements).filter((id) => elements[id].type === model.type && elements[id].shapeType === model.shapeType && !elements[id].locked),
        );
    }, [elements, selectedElementIds, setSelectedElementIds]);

    const applyAlignmentCommand = useCallback(
        (computeUpdates) => {
            const updatedById = computeUpdates(elements, unlockedIds(selectedElementIds));
            applyElementUpdates(updatedById);
        },
        [elements, selectedElementIds, unlockedIds, applyElementUpdates],
    );

    // The keyboard path for "move"; a held arrow previews transiently and the
    // key release settles the whole run into one undo step.
    const nudgeSelection = useCallback(
        (dx, dy) => {
            const ids = unlockedIds(selectedElementIds);
            const updatedById = {};
            ids.forEach((id) => {
                updatedById[id] = translateElement(elements[id], dx, dy);
            });
            applyElementUpdates(updatedById, { transient: true });
        },
        [elements, selectedElementIds, unlockedIds, applyElementUpdates],
    );

    // Animates the selection to its tidied positions locally, then commits once: one undo step, one broadcast.
    // Bound connectors follow every frame of the preview.
    const tidyUpSelection = useCallback(
        (direction) => {
            const targetUpdates = buildTidyPositionUpdates(elements, unlockedIds(selectedElementIds), direction);
            const ids = Object.keys(targetUpdates);
            if (ids.length === 0) return;

            if (tidyAnimationFrameRef.current) cancelAnimationFrame(tidyAnimationFrameRef.current);
            const startPositions = ids.reduce((acc, id) => ({ ...acc, [id]: elements[id] }), {});
            const startTime = performance.now();
            const lerp = (a, b, t) => a + (b - a) * t;
            const easeOutCubic = (t) => 1 - (1 - t) ** 3;

            const step = (now) => {
                const t = Math.min(1, (now - startTime) / TIDY_ANIMATION_MS);
                const eased = easeOutCubic(t);
                const frameUpdates = {};
                ids.forEach((id) => {
                    const from = startPositions[id];
                    const to = targetUpdates[id];
                    frameUpdates[id] =
                        from.type === "shape"
                            ? {
                                  ...to,
                                  startX: lerp(from.startX, to.startX, eased),
                                  startY: lerp(from.startY, to.startY, eased),
                                  endX: lerp(from.endX, to.endX, eased),
                                  endY: lerp(from.endY, to.endY, eased),
                              }
                            : { ...to, x: lerp(from.x, to.x, eased), y: lerp(from.y, to.y, eased) };
                });

                setElements((prev) => {
                    const merged = { ...prev, ...frameUpdates };
                    const next = { ...merged, ...getBoundConnectorUpdates(merged, ids) };
                    requestStaticFullRepaint(next);
                    return next;
                });

                if (t < 1) {
                    tidyAnimationFrameRef.current = requestAnimationFrame(step);
                } else {
                    tidyAnimationFrameRef.current = null;
                    applyElementUpdates(targetUpdates);
                }
            };
            tidyAnimationFrameRef.current = requestAnimationFrame(step);
        },
        [elements, selectedElementIds, unlockedIds, applyElementUpdates, requestStaticFullRepaint, setElements, tidyAnimationFrameRef],
    );

    useEffect(
        () => () => {
            if (tidyAnimationFrameRef.current) cancelAnimationFrame(tidyAnimationFrameRef.current);
        },
        [tidyAnimationFrameRef],
    );

    return {
        applyAlignmentCommand,
        duplicateSelection,
        flipSelection,
        nudgeSelection,
        selectAllLikeSelection,
        tidyUpSelection,
        toggleLockSelection,
    };
};
