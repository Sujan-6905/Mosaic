import axiosInstance from "@/lib/axiosInstance";
import { socket } from "@/lib/socket.js";
import { useCallback, useEffect, useRef } from "react";
import useEverOpened from "./useEverOpened";

export const useBoardClearing = (board) => {
    const {
        catchUp,
        setArchitectureOpen,
        clearBoardOpen,
        handleVersionRestored,
        helpOpen,
        session,
        setAiAssistantOpen,
        setBranchesOpen,
        setClearBoardBusy,
        setClearBoardOpen,
        setClearBoardTitle,
        setBoardPropertiesOpen,
        setCommentsPanelOpen,
        setExportDialogOpen,
        setHelpOpen,
        setImportDialogOpen,
        setMermaidOpen,
        setPiecesOpen,
        setReplayOpen,
        setVersionHistoryOpen,
        shareId,
        showToast,
        tourSurface,
    } = board;

    const helpEverOpened = useEverOpened(helpOpen);

    const catchUpRef = useRef(catchUp);
    catchUpRef.current = catchUp;

    // What a tutorial step has opened, so the next step can close it again.
    // Each step asks for one surface and the previous one goes away with it.
    useEffect(() => {
        const setters = {
            assistant: setAiAssistantOpen,
            history: setVersionHistoryOpen,
            replay: setReplayOpen,
            branches: setBranchesOpen,
            export: setExportDialogOpen,
            import: setImportDialogOpen,
            comments: setCommentsPanelOpen,
            shortcuts: setHelpOpen,
            architecture: setArchitectureOpen,
            pieces: setPiecesOpen,
            mermaid: setMermaidOpen,
            properties: setBoardPropertiesOpen,
            catchUp: (open) => (open ? catchUpRef.current.open() : catchUpRef.current.close()),
        };
        const setter = setters[tourSurface];
        setter?.(true);
        return () => setter?.(false);
    }, [
        tourSurface,
        setAiAssistantOpen,
        setBoardPropertiesOpen,
        setBranchesOpen,
        setCommentsPanelOpen,
        setExportDialogOpen,
        setHelpOpen,
        setImportDialogOpen,
        setMermaidOpen,
        setPiecesOpen,
        setReplayOpen,
        setVersionHistoryOpen,
        setArchitectureOpen,
    ]);

    // The title is fetched only when the dialog opens, its one use here.
    useEffect(() => {
        if (!clearBoardOpen || !shareId || !session?.accessToken) return;
        axiosInstance
            .get(`/api/drawing/getById/${shareId}`, { headers: { Authorization: `Bearer ${session.accessToken}` } })
            .then(({ data }) => setClearBoardTitle(data.data.title || "Untitled Drawing"))
            .catch(() => setClearBoardTitle(""));
    }, [clearBoardOpen, shareId, session?.accessToken, setClearBoardTitle]);

    useEffect(() => {
        const handleBoardCleared = ({ shareId: clearedShareId, elementOps }) => {
            if (clearedShareId !== shareId) return;
            setClearBoardBusy(false);
            setClearBoardOpen(false);
            handleVersionRestored(elementOps);
            showToast?.success("Board cleared", "Every element was removed. Press Ctrl+Z to undo.");
        };
        socket.on("server:boardCleared", handleBoardCleared);
        return () => socket.off("server:boardCleared", handleBoardCleared);
    }, [shareId, handleVersionRestored, showToast, setClearBoardBusy, setClearBoardOpen]);

    const handleConfirmClearBoard = useCallback(() => {
        setClearBoardBusy(true);
        socket.emit("client:clearBoard", { shareId });
    }, [shareId, setClearBoardBusy]);

    return {
        handleConfirmClearBoard,
        helpEverOpened,
    };
};
