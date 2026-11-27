import { DEFAULT_BACKGROUND } from "../rendering/backgroundRenderer";
import { createCameraStore } from "../camera/cameraStore";
import { createPaintOrder } from "../rendering/paintOrder";
import { hasCommentAccess, hasEditAccess as roleCanEdit } from "./roles";
import { socket } from "@/lib/socket.js";
import { useDispatch, useSelector } from "react-redux";
import useFullscreen from "@/hooks/useFullscreen";
import { useReducer, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useTheme } from "@/theme/ThemeProvider";

export const useBoardState = (board) => {
    const { cameraRef } = board;

    // Which text/sticky element (if any) is currently showing its inline
    // editor: see openTextEditor/closeTextEditor below.
    const [editingElementId, setEditingElementId] = useState(null);
    const [renamingFrameId, setRenamingFrameId] = useState(null);
    const [debugStats, setDebugStats] = useState({
        fps: 0,
        staticRepaintsPerSec: 0,
        staticInsertDrainsPerSec: 0,
        visibleElementCount: 0,
        totalElementCount: 0,
        lodLevel: { simplifyTolerance: null, hideFineDetail: false },
    });

    const [elements, setElements] = useState({});
    // Every selected id. Resize works on one element; everything else works on the whole selection.
    const [selectedElementIds, setSelectedElementIds] = useState([]);
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [cameraStore] = useState(() => createCameraStore(cameraRef.current));
    // The participant whose camera this view follows, mirrored to a ref for the camera code outside rendering.
    const [followingSocketId, setFollowingSocketId] = useState(null);
    const [minimapOpen, setMinimapOpen] = useState(false);
    const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false);
    // Changes rarely (a menu pick or a remote update), unlike camera: a
    // plain state closure in paintStaticFull is enough, no ref needed.
    const [background, setBackground] = useState(DEFAULT_BACKGROUND);
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
    // The socket is shared across boards and may already be connected when this mounts.
    const [isConnected, setIsConnected] = useState(() => socket.connected);
    const [roomJoined, setRoomJoined] = useState(false);
    const [hasJoinedOnce, setHasJoinedOnce] = useState(false);
    const [dismissedPresenterId, setDismissedPresenterId] = useState(null);
    // Set when the board can't be opened at all: "noAccess", "missing" or "deleted".
    const [unavailableReason, setUnavailableReason] = useState(null);
    const [role, setRole] = useState(null);
    const hasEditAccess = roleCanEdit(role);
    const [saveStatus, setSaveStatus] = useState("saved");

    const [eraserPosition, setEraserPosition] = useState(null);

    // Threads load fresh on every join and stay live by socket; collaborators feed mention autocomplete.
    const [comments, setComments] = useState([]);
    const [collaborators, setCollaborators] = useState([]);
    const [activeCommentId, setActiveCommentId] = useState(null);
    const [pendingCommentAnchor, setPendingCommentAnchor] = useState(null);
    const [boardPropertiesOpen, setBoardPropertiesOpen] = useState(false);
    const [mermaidOpen, setMermaidOpen] = useState(false);
    const [piecesOpen, setPiecesOpen] = useState(false);
    const [restyleOpen, setRestyleOpen] = useState(false);
    const [piecesSaving, setPiecesSaving] = useState(false);
    const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
    const canComment = hasCommentAccess(role);
    const [presentingSocketIds, setPresentingSocketIds] = useState(() => new Set());
    const [followerSocketIds, setFollowerSocketIds] = useState([]);
    const [isPresenting, setIsPresenting] = useState(false);

    // Remote cursors live in a ref; cursorTick re-reads them once a frame.
    const [participants, setParticipants] = useState([]);
    const [, bumpCursorTick] = useReducer((tick) => tick + 1, 0);

    const { activeMenuItem, actionMenuItem } = useSelector((state) => state.menu);
    const toolboxState = useSelector((state) => state.toolbox[activeMenuItem]);
    const { color, fillColor, size, opacity, style } = toolboxState || {};

    const { data: session, status } = useSession();
    const dispatch = useDispatch();

    const router = useRouter();
    const [isFullscreen, toggleFullscreen] = useFullscreen();
    const { setTheme, themes } = useTheme();
    const debugMode = router.query.debug === "1";
    const perfMode = router.query.perf === "1";
    const [paintOrder] = useState(createPaintOrder);

    // Typing goes into this draft, not elements, until the editor commits, so undo's before is the text as it was.
    const [editingDraft, setEditingDraft] = useState(null);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [agentsDialogOpen, setAgentsDialogOpen] = useState(false);
    // null while closed; otherwise which frame, if any, the embed code starts on.
    const [embedBoardDialog, setEmbedBoardDialog] = useState(null);

    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
    const [replayOpen, setReplayOpen] = useState(false);
    const [timeScene, setTimeScene] = useState(null);
    const [branchesOpen, setBranchesOpen] = useState(false);
    const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

    // What the assistant panel shows on the board: a question's candidate highlights, with the panel's own
    // onChoose and onCancel, and the preview of a proposed edit.
    const [aiDisambiguation, setAiDisambiguation] = useState(null);
    const [architectureOpen, setArchitectureOpen] = useState(false);
    const [architectureComparison, setArchitectureComparison] = useState(null);
    const [aiPreview, setAiPreview] = useState(null); // { diff, fullDiff, focusedIds, comparing }
    // userId -> { stage, label, turnId } - who (if anyone) currently has an
    // agent turn in flight, for the presence bar's own activity chip.
    const [agentActivityByUserId, setAgentActivityByUserId] = useState(new Map());

    const [activeTourTrack, setActiveTourTrack] = useState(null);
    const [tourSurface, setTourSurface] = useState(null);

    const [clearBoardOpen, setClearBoardOpen] = useState(false);
    const [clearBoardBusy, setClearBoardBusy] = useState(false);
    const [clearBoardTitle, setClearBoardTitle] = useState("");
    const [boardTitle, setBoardTitle] = useState("");
    const [helpOpen, setHelpOpen] = useState(false);

    // An assistant diagram waiting to be placed. One that replaces objects lands where they were
    // and goes in as one undo step with their removal.
    const [aiPlacement, setAiPlacement] = useState(null); // { mapped, onPlaced }

    return {
        renamingFrameId,
        setRenamingFrameId,
        actionMenuItem,
        activeCommentId,
        activeMenuItem,
        activeTourTrack,
        agentActivityByUserId,
        aiAssistantOpen,
        aiDisambiguation,
        aiPlacement,
        aiPreview,
        architectureComparison,
        architectureOpen,
        background,
        backgroundPickerOpen,
        branchesOpen,
        bumpCursorTick,
        cameraStore,
        canComment,
        clearBoardBusy,
        clearBoardOpen,
        clearBoardTitle,
        boardTitle,
        collaborators,
        color,
        commandPaletteOpen,
        comments,
        commentsPanelOpen,
        debugMode,
        debugStats,
        dismissedPresenterId,
        dispatch,
        editingDraft,
        editingElementId,
        elements,
        eraserPosition,
        exportDialogOpen,
        agentsDialogOpen,
        embedBoardDialog,
        fillColor,
        followerSocketIds,
        followingSocketId,
        hasEditAccess,
        hasJoinedOnce,
        helpOpen,
        importDialogOpen,
        isConnected,
        isFullscreen,
        isPresenting,
        minimapOpen,
        opacity,
        paintOrder,
        participants,
        pendingCommentAnchor,
        boardPropertiesOpen,
        mermaidOpen,
        piecesOpen,
        restyleOpen,
        piecesSaving,
        perfMode,
        presentingSocketIds,
        replayOpen,
        role,
        roomJoined,
        router,
        saveStatus,
        selectedElementIds,
        session,
        setActiveCommentId,
        setActiveTourTrack,
        setAgentActivityByUserId,
        setAiAssistantOpen,
        setAiDisambiguation,
        setAiPlacement,
        setAiPreview,
        setArchitectureComparison,
        setArchitectureOpen,
        setBackground,
        setBackgroundPickerOpen,
        setBranchesOpen,
        setClearBoardBusy,
        setClearBoardOpen,
        setClearBoardTitle,
        setBoardTitle,
        setCollaborators,
        setCommandPaletteOpen,
        setComments,
        setCommentsPanelOpen,
        setDebugStats,
        setDismissedPresenterId,
        setEditingDraft,
        setEditingElementId,
        setElements,
        setEraserPosition,
        setExportDialogOpen,
        setAgentsDialogOpen,
        setEmbedBoardDialog,
        setFollowerSocketIds,
        setFollowingSocketId,
        setHasJoinedOnce,
        setHelpOpen,
        setImportDialogOpen,
        setIsConnected,
        setIsPresenting,
        setMinimapOpen,
        setParticipants,
        setPendingCommentAnchor,
        setBoardPropertiesOpen,
        setMermaidOpen,
        setPiecesOpen,
        setRestyleOpen,
        setPiecesSaving,
        setPresentingSocketIds,
        setRedoStack,
        setReplayOpen,
        setRole,
        setRoomJoined,
        setSaveStatus,
        setSelectedElementIds,
        setTheme,
        setTimeScene,
        setTourSurface,
        setUnavailableReason,
        setUndoStack,
        setVersionHistoryOpen,
        setViewportSize,
        size,
        status,
        style,
        themes,
        timeScene,
        toggleFullscreen,
        tourSurface,
        unavailableReason,
        versionHistoryOpen,
        viewportSize,
    };
};
