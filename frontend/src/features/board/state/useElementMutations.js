import { getBoundConnectorUpdates, releaseConnectorsFrom } from "../../../../../shared/canvas/elements/connectors";
import { useCallback, useRef } from "react";
import { generateElementId } from "./boardHelpers";

const MAX_HISTORY_SIZE = 100;

export const pushHistoryEntry = (stack, entry) => (stack.length >= MAX_HISTORY_SIZE ? [...stack.slice(1), entry] : [...stack, entry]);

export const useElementMutations = (board) => {
    const {
        elements,
        elementsRef,
        emitCanvasUpdate,
        enqueueStaticInsert,
        redoStackRef,
        requestStaticFullRepaint,
        roomJoined,
        selectedElementIds,
        setElements,
        setRedoStack,
        setSelectedElementIds,
        setUndoStack,
        shareId,
        spatialIndexRef,
        undoStackRef,
    } = board;

    // The refs are the source of truth; the mirrored state only drives renders.
    const pushUndoEntry = useCallback(
        (entry) => {
            undoStackRef.current = pushHistoryEntry(undoStackRef.current, entry);
            setUndoStack(undoStackRef.current);
        },
        [setUndoStack, undoStackRef],
    );
    const pushRedoEntry = useCallback(
        (entry) => {
            redoStackRef.current = pushHistoryEntry(redoStackRef.current, entry);
            setRedoStack(redoStackRef.current);
        },
        [redoStackRef, setRedoStack],
    );
    const clearRedoStack = useCallback(() => {
        redoStackRef.current = [];
        setRedoStack([]);
    }, [redoStackRef, setRedoStack]);

    const addElement = useCallback(
        (elementId, element) => {
            setElements((prev) => ({
                ...prev,
                [elementId]: element,
            }));
            enqueueStaticInsert(elementId, element);
            pushUndoEntry({ type: "insert", elementId, before: null, after: element });
            clearRedoStack();
            if (roomJoined && shareId) {
                emitCanvasUpdate({
                    shareId,
                    operation: "insert",
                    elementId,
                    element,
                });
            }
        },
        [roomJoined, shareId, emitCanvasUpdate, enqueueStaticInsert, pushUndoEntry, clearRedoStack, setElements],
    );

    // Shape assist swaps a stroke for the shape it looked like under the same id, recorded as an update,
    // so undo brings the hand-drawn stroke back rather than deleting it.
    const replaceWithRecognizedShape = useCallback(
        (elementId, strokeElement, shapeElement) => {
            setElements((prev) => ({
                ...prev,
                [elementId]: shapeElement,
            }));
            // The stroke only ever lived on the overlay, so the shape is a fresh insert to the board layer.
            enqueueStaticInsert(elementId, shapeElement);
            pushUndoEntry({
                type: "update",
                elementId,
                before: strokeElement,
                after: shapeElement,
            });
            clearRedoStack();
            if (roomJoined && shareId) {
                emitCanvasUpdate({
                    shareId,
                    operation: "update",
                    elementId,
                    element: shapeElement,
                });
            }
        },
        [roomJoined, shareId, emitCanvasUpdate, enqueueStaticInsert, pushUndoEntry, clearRedoStack, setElements],
    );
    const removeElement = useCallback(
        (elementId) => {
            const elementToRemove = elements[elementId];
            if (!elementToRemove) return;
            // Connectors bound to the element are freed in the same undo step, so undo restores both.
            const connectorUnbinds = releaseConnectorsFrom(elements, [elementId]);
            spatialIndexRef.current.remove(elementId);
            Object.entries(connectorUnbinds).forEach(([id, element]) => spatialIndexRef.current.update(id, element));
            setElements((prev) => {
                const next = { ...prev, ...connectorUnbinds };
                delete next[elementId];
                requestStaticFullRepaint(next);
                return next;
            });
            const deleteOp = { type: "delete", elementId, before: elementToRemove, after: null };
            const unbindOps = Object.entries(connectorUnbinds).map(([id, element]) => ({
                type: "update",
                elementId: id,
                before: elements[id],
                after: element,
            }));
            pushUndoEntry(unbindOps.length === 0 ? deleteOp : { type: "batch", ops: [deleteOp, ...unbindOps] });
            clearRedoStack();
            setSelectedElementIds((prev) => prev.filter((id) => id !== elementId));
            if (roomJoined && shareId) {
                emitCanvasUpdate({
                    shareId,
                    operation: "delete",
                    elementId,
                });
                Object.entries(connectorUnbinds).forEach(([id, element]) => {
                    emitCanvasUpdate({ shareId, operation: "update", elementId: id, element });
                });
            }
        },
        [
            elements,
            roomJoined,
            shareId,
            emitCanvasUpdate,
            requestStaticFullRepaint,
            pushUndoEntry,
            clearRedoStack,
            setElements,
            setSelectedElementIds,
            spatialIndexRef,
        ],
    );

    // Locked elements stay selectable, so they can be unlocked, but no action below changes them.
    const unlockedIds = useCallback((ids) => ids.filter((id) => elements[id] && !elements[id].locked), [elements]);

    // Deletes the whole selection as one batch, so one undo brings it all back.
    const removeElements = useCallback(
        (elementIds) => {
            const existingIds = unlockedIds(elementIds);
            if (existingIds.length === 0) return;
            const connectorUnbinds = releaseConnectorsFrom(elements, existingIds);
            existingIds.forEach((id) => spatialIndexRef.current.remove(id));
            Object.entries(connectorUnbinds).forEach(([id, element]) => spatialIndexRef.current.update(id, element));
            setElements((prev) => {
                const next = { ...prev, ...connectorUnbinds };
                existingIds.forEach((id) => delete next[id]);
                requestStaticFullRepaint(next);
                return next;
            });
            const deleteOps = existingIds.map((id) => ({ type: "delete", elementId: id, before: elements[id], after: null }));
            const unbindOps = Object.entries(connectorUnbinds).map(([id, element]) => ({
                type: "update",
                elementId: id,
                before: elements[id],
                after: element,
            }));
            pushUndoEntry({ type: "batch", ops: [...deleteOps, ...unbindOps] });
            clearRedoStack();
            setSelectedElementIds((prev) => prev.filter((id) => !existingIds.includes(id)));
            if (roomJoined && shareId) {
                existingIds.forEach((id) => emitCanvasUpdate({ shareId, operation: "delete", elementId: id }));
                Object.entries(connectorUnbinds).forEach(([id, element]) => {
                    emitCanvasUpdate({ shareId, operation: "update", elementId: id, element });
                });
            }
        },
        [
            elements,
            unlockedIds,
            roomJoined,
            shareId,
            emitCanvasUpdate,
            requestStaticFullRepaint,
            pushUndoEntry,
            clearRedoStack,
            setElements,
            setSelectedElementIds,
            spatialIndexRef,
        ],
    );

    // Each element as it was before a continuous edit such as a slider drag: the live steps only preview,
    // and the settling commit records one history step from here.
    const gestureBaselineRef = useRef(new Map());

    const applyElementUpdates = useCallback(
        (updatedById, { transient = false } = {}) => {
            const changedIds = Object.keys(updatedById);
            if (changedIds.length === 0) return;
            // Bound connectors are re-derived against the post-update map so
            // they stay attached; every edit path funnels through here.
            const connectorUpdates = getBoundConnectorUpdates({ ...elements, ...updatedById }, changedIds);
            const fullUpdatedById = { ...updatedById, ...connectorUpdates };
            const ids = Object.keys(fullUpdatedById);
            ids.forEach((id) => spatialIndexRef.current.update(id, fullUpdatedById[id]));
            setElements((prev) => {
                const next = { ...prev, ...fullUpdatedById };
                requestStaticFullRepaint(next);
                return next;
            });
            const baseline = gestureBaselineRef.current;
            if (transient) {
                ids.forEach((id) => {
                    if (!baseline.has(id)) baseline.set(id, elements[id]);
                });
            } else {
                const ops = ids.map((id) => ({
                    type: "update",
                    elementId: id,
                    before: baseline.has(id) ? baseline.get(id) : elements[id],
                    after: fullUpdatedById[id],
                }));
                ids.forEach((id) => baseline.delete(id));
                pushUndoEntry(ops.length === 1 ? ops[0] : { type: "batch", ops });
                clearRedoStack();
            }
            if (roomJoined && shareId) {
                ids.forEach((id) => emitCanvasUpdate({ shareId, operation: "update", elementId: id, element: fullUpdatedById[id] }));
            }
        },
        [elements, roomJoined, shareId, emitCanvasUpdate, requestStaticFullRepaint, pushUndoEntry, clearRedoStack, setElements, spatialIndexRef],
    );

    // Records whatever transient edits are still open as one undo step, for
    // continuous inputs that have no final value of their own (a held key).
    const settleTransientEdits = useCallback(() => {
        const baseline = gestureBaselineRef.current;
        if (baseline.size === 0) return;
        const current = elementsRef.current;
        const ops = [...baseline].filter(([id]) => current[id]).map(([id, before]) => ({ type: "update", elementId: id, before, after: current[id] }));
        baseline.clear();
        if (ops.length === 0) return;
        pushUndoEntry(ops.length === 1 ? ops[0] : { type: "batch", ops });
        clearRedoStack();
    }, [elementsRef, pushUndoEntry, clearRedoStack]);

    // Gives the selection one new groupId, so clicking any member selects them all.
    const groupSelection = useCallback(() => {
        const ids = unlockedIds(selectedElementIds);
        if (ids.length < 2) return;
        const groupId = generateElementId();
        const updatedById = {};
        ids.forEach((id) => {
            updatedById[id] = { ...elements[id], groupId };
        });
        applyElementUpdates(updatedById);
    }, [selectedElementIds, unlockedIds, elements, applyElementUpdates]);

    const ungroupSelection = useCallback(() => {
        const updatedById = {};
        unlockedIds(selectedElementIds).forEach((id) => {
            if (elements[id]?.groupId) updatedById[id] = { ...elements[id], groupId: null };
        });
        applyElementUpdates(updatedById);
    }, [selectedElementIds, unlockedIds, elements, applyElementUpdates]);

    const applyZOrderCommand = useCallback(
        (computeUpdates) => {
            const zIndexUpdates = computeUpdates(elements, unlockedIds(selectedElementIds));
            const updatedById = {};
            Object.entries(zIndexUpdates).forEach(([id, zIndex]) => {
                if (elements[id]) updatedById[id] = { ...elements[id], zIndex };
            });
            applyElementUpdates(updatedById);
        },
        [elements, selectedElementIds, unlockedIds, applyElementUpdates],
    );

    // A generated batch is one undo step; each element still syncs on its own, since the server has no batch insert.
    const addGeneratedElements = useCallback(
        (elementsToAdd, { replacing = [] } = {}) => {
            const removedOps = replacing.map((elementId) => ({ type: "delete", elementId, before: elements[elementId], after: null }));
            setElements((prev) => {
                const next = { ...prev };
                replacing.forEach((elementId) => {
                    delete next[elementId];
                });
                elementsToAdd.forEach(({ elementId, element }) => {
                    next[elementId] = element;
                });
                return next;
            });
            elementsToAdd.forEach(({ elementId, element }) => enqueueStaticInsert(elementId, element));
            const ops = elementsToAdd.map(({ elementId, element }) => ({
                type: "insert",
                elementId,
                before: null,
                after: element,
            }));
            pushUndoEntry({ type: "batch", ops: [...removedOps, ...ops] });
            clearRedoStack();
            if (roomJoined && shareId) {
                replacing.forEach((elementId) => emitCanvasUpdate({ shareId, operation: "delete", elementId }));
                elementsToAdd.forEach(({ elementId, element }) => {
                    emitCanvasUpdate({ shareId, operation: "insert", elementId, element });
                });
            }
        },
        [elements, roomJoined, shareId, emitCanvasUpdate, enqueueStaticInsert, pushUndoEntry, clearRedoStack, setElements],
    );

    return {
        addElement,
        addGeneratedElements,
        applyElementUpdates,
        applyZOrderCommand,
        clearRedoStack,
        groupSelection,
        pushRedoEntry,
        pushUndoEntry,
        removeElement,
        removeElements,
        replaceWithRecognizedShape,
        settleTransientEdits,
        ungroupSelection,
        unlockedIds,
    };
};
