import { MENU_ITEMS } from "../tools/toolSettings";
import { TOUR_TRACKS } from "@/features/tour/tourSteps";
import { buildCommandRegistry } from "../commands/commandRegistry";
import { getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { getPaintUnionBounds } from "../rendering/boundsCache";
import { isCommentUnreadFor } from "../comments/comments";
import { menuItemClick } from "@/store/menuSlice";
import { socket } from "@/lib/socket.js";
import { useEffect, useMemo } from "react";
import { worldToScreen } from "../camera/camera";
import { WHITEBOARD_TOUR_TRACK_IDS } from "./boardHelpers";

export const useBoardDerived = (board) => {
    const {
        editingElementId,
        activeMenuItem,
        aiEnabled,
        cameraStore,
        catchUp,
        comments,
        dismissedPresenterId,
        dispatch,
        duplicateBoard,
        duplicateSelection,
        elements,
        flipSelection,
        followingSocketId,
        pasteClipboardInPlace,
        selectAllLikeSelection,
        groupSelection,
        handleZoomIn,
        handleZoomToSelection,
        handleZoomOut,
        handleZoomReset,
        handleZoomToFit,
        hasEditAccess,
        isPresenting,
        onAdjustToolStyle,
        onSelectionRectChange,
        participants,
        performRedo,
        performUndo,
        presentingSocketIds,
        remoteCameraRef,
        remoteCursorsRef,
        role,
        roomJoined,
        router,
        selectedElementIds,
        selectedElements,
        session,
        setActiveTourTrack,
        setAiAssistantOpen,
        setArchitectureOpen,
        setBoardPropertiesOpen,
        setMermaidOpen,
        setPiecesOpen,
        setBranchesOpen,
        setClearBoardOpen,
        setExportDialogOpen,
        setHelpOpen,
        setAgentsDialogOpen,
        setEmbedBoardDialog,
        setImportDialogOpen,
        setReplayOpen,
        setTheme,
        setVersionHistoryOpen,
        spatialIndexRef,
        themes,
        tidyUpSelection,
        toggleLockSelection,
        ungroupSelection,
        copyAsPng,
        setFindOpen,
        canRunWorkshop,
        setWorkshopSetup,
    } = board;

    const contentBounds = spatialIndexRef.current.getFullExtent();
    // One element's box is drawn in its own rotated frame; several share a box
    // that has to reach around whatever each of them actually covers.
    const selectionBounds = useMemo(() => getUnionBounds(selectedElements), [selectedElements]);
    const selectionBox = useMemo(
        () => (selectedElements.length === 1 ? getUnionBounds(selectedElements) : getPaintUnionBounds(selectedElements)),
        [selectedElements],
    );
    const selectionScreenBounds = useMemo(() => getPaintUnionBounds(selectedElements), [selectedElements]);
    // Any locked member hides the selection's resize and rotate handles, as it stops the drag.
    const hasLockedSelection = selectedElements.some((element) => element.locked);
    // An off-screen selection gets its own indicator; with nothing selected, one points at the board's content.
    const offscreenTargets = selectionBounds
        ? [{ id: "__selection__", bounds: selectionBounds }]
        : contentBounds
          ? [{ id: "__content__", bounds: contentBounds }]
          : [];
    // Reports the selection's screen rect to the floating toolbar, and follows
    // the camera without re-rendering this component on every pan.
    useEffect(() => {
        if (!selectionScreenBounds || editingElementId) {
            onSelectionRectChange?.(null);
            return undefined;
        }
        let reportedKey = null;
        const reportRect = () => {
            const camera = cameraStore.get();
            const topLeft = worldToScreen(camera, selectionScreenBounds.minX, selectionScreenBounds.minY);
            const bottomRight = worldToScreen(camera, selectionScreenBounds.maxX, selectionScreenBounds.maxY);
            const rect = { left: Math.round(topLeft.x), top: Math.round(topLeft.y), right: Math.round(bottomRight.x), bottom: Math.round(bottomRight.y) };
            const key = `${rect.left},${rect.top},${rect.right},${rect.bottom}`;
            if (key === reportedKey) return;
            reportedKey = key;
            onSelectionRectChange?.(rect);
        };
        reportRect();
        return cameraStore.subscribe(reportRect);
    }, [selectionScreenBounds, editingElementId, onSelectionRectChange, cameraStore]);

    // Each collaborator off screen gets an indicator at their camera, or their cursor until a camera arrives.
    const participantOffscreenTargets = participants
        .filter((participant) => participant.socketId !== socket.id)
        .map((participant) => {
            const point = remoteCameraRef.current[participant.socketId] || remoteCursorsRef.current[participant.socketId];
            if (!point) return null;
            return { id: participant.socketId, bounds: { minX: point.x, minY: point.y, maxX: point.x, maxY: point.y }, participant };
        })
        .filter(Boolean);
    const participantById = new Map(participantOffscreenTargets.map((target) => [target.id, target.participant]));
    const unreadCommentCount = comments.filter((comment) => isCommentUnreadFor(comment, session?.user?.id)).length;

    // Everything the command palette can run, bound to the same functions as its button or shortcut.
    // A viewer's palette leaves edit commands out entirely.
    const commandActions = {
        selectTool: (tool) => dispatch(menuItemClick(tool)),
        undo: performUndo,
        redo: performRedo,
        duplicate: selectedElementIds.length > 0 ? duplicateSelection : null,
        flipHorizontal: selectedElementIds.length > 0 ? () => flipSelection("x") : null,
        flipVertical: selectedElementIds.length > 0 ? () => flipSelection("y") : null,
        pasteInPlace: pasteClipboardInPlace,
        selectAllLike: selectedElementIds.length > 0 ? selectAllLikeSelection : null,
        group: selectedElementIds.length >= 2 ? groupSelection : null,
        ungroup: selectedElementIds.some((id) => elements[id]?.groupId) ? ungroupSelection : null,
        toggleLock: selectedElementIds.length > 0 ? toggleLockSelection : null,
        tidyUp: selectedElementIds.length >= 2 ? tidyUpSelection : null,
        increaseSize: onAdjustToolStyle ? () => onAdjustToolStyle("size", 1) : null,
        decreaseSize: onAdjustToolStyle ? () => onAdjustToolStyle("size", -1) : null,
        increaseOpacity: onAdjustToolStyle ? () => onAdjustToolStyle("opacity", 1) : null,
        decreaseOpacity: onAdjustToolStyle ? () => onAdjustToolStyle("opacity", -1) : null,
        zoomIn: handleZoomIn,
        zoomOut: handleZoomOut,
        zoomReset: handleZoomReset,
        zoomToFit: handleZoomToFit,
        zoomToSelection: selectedElementIds.length > 0 ? handleZoomToSelection : null,
        openExport: () => setExportDialogOpen(true),
        openAgents: () => setAgentsDialogOpen(true),
        openEmbedBoard: (frameId = null) => setEmbedBoardDialog({ frameId }),
        openImport: () => setImportDialogOpen(true),
        openHistory: () => setVersionHistoryOpen(true),
        openCatchUp: () => {
            setArchitectureOpen(false);
            catchUp.open();
        },
        openArchitecture: () => {
            catchUp.close();
            setArchitectureOpen(true);
        },
        openReplay: () => setReplayOpen(true),
        openBranches: () => setBranchesOpen(true),
        openClearBoard: role === "owner" ? () => setClearBoardOpen(true) : null,
        copyBoard: duplicateBoard,
        openHelp: () => setHelpOpen(true),
        openShortcuts: () => setHelpOpen("shortcuts"),
        openFind: () => setFindOpen(true),
        openTimer: canRunWorkshop ? () => setWorkshopSetup("timer") : null,
        openVoting: canRunWorkshop ? () => setWorkshopSetup("voting") : null,
        copyAsPng,
        openBoardProperties: () => setBoardPropertiesOpen(true),
        openMermaid: hasEditAccess ? () => setMermaidOpen(true) : null,
        openPieces: () => {
            catchUp.close();
            setArchitectureOpen(false);
            setPiecesOpen(true);
        },
        openAiAssistant: aiEnabled ? () => setAiAssistantOpen(true) : null,
        goToDashboard: () => router.push("/dashboard"),
        startTour: (trackId) => setActiveTourTrack(trackId),
        tourTracks: WHITEBOARD_TOUR_TRACK_IDS.map((id) => ({ id, label: TOUR_TRACKS[id].label })),
        setTheme,
        themes,
    };
    const commands = buildCommandRegistry(commandActions);

    const otherParticipants = participants.filter((participant) => participant.socketId !== socket.id);
    const followedParticipant = otherParticipants.find((participant) => participant.socketId === followingSocketId);
    const presentingOther = otherParticipants.find((participant) => presentingSocketIds.has(participant.socketId));
    const followInvitePresenter = presentingOther && !followingSocketId && dismissedPresenterId !== presentingOther.socketId ? presentingOther : null;
    const boardHasContent = spatialIndexRef.current.size() > 0;
    const showEmptyBoard =
        roomJoined && hasEditAccess && !isPresenting && !boardHasContent && (activeMenuItem === MENU_ITEMS.SELECT || activeMenuItem === MENU_ITEMS.HAND);

    return {
        boardHasContent,
        commandActions,
        commands,
        contentBounds,
        followInvitePresenter,
        followedParticipant,
        hasLockedSelection,
        offscreenTargets,
        otherParticipants,
        participantById,
        participantOffscreenTargets,
        selectionBounds,
        selectionBox,
        showEmptyBoard,
        unreadCommentCount,
    };
};
