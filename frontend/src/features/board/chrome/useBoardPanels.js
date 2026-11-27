import { boundsOfChanges } from "../history/catchUp";
import { boundsOfDiff, staleElementIds } from "../assistant/editReview";
import { hasCompletedAnyTour, markTourCompleted } from "@/features/tour/tourCompletion";
import { useCallback, useEffect, useMemo } from "react";
import useCatchUp from "../history/useCatchUp";
import useEverOpened from "./useEverOpened";

export const useBoardPanels = (board) => {
    const {
        activeTourTrack,
        aiAssistantOpen,
        aiPreview,
        branchesOpen,
        elements,
        hasAutoLaunchedTourRef,
        previewHiddenIdsRef,
        registerAiAssistantOpen,
        replayOpen,
        roomJoined,
        session,
        setActiveTourTrack,
        setAiAssistantOpen,
        setTourSurface,
        shareId,
        showWorldBounds,
        staticNeedsFullRepaintRef,
        versionHistoryOpen,
    } = board;

    const catchUp = useCatchUp({ shareId, token: session?.accessToken, roomJoined });
    const showCatchUpChange = useCallback((change) => change.bounds && showWorldBounds(change.bounds), [showWorldBounds]);
    const showAllCatchUpChanges = useCallback(() => {
        const bounds = boundsOfChanges(catchUp.digest?.changes ?? []);
        if (bounds) showWorldBounds(bounds);
    }, [catchUp.digest, showWorldBounds]);
    const aiPreviewIsStale = useMemo(() => Boolean(aiPreview) && staleElementIds(aiPreview.fullDiff, elements).length > 0, [aiPreview, elements]);
    // A proposal's real look replaces what it changes, until someone holds to compare.
    useEffect(() => {
        const replaced =
            aiPreview && !aiPreview.comparing
                ? [...aiPreview.diff.moved, ...aiPreview.diff.modified, ...aiPreview.diff.removed].map(({ elementId }) => elementId)
                : [];
        previewHiddenIdsRef.current = new Set(replaced);
        staticNeedsFullRepaintRef.current = true;
    }, [aiPreview, previewHiddenIdsRef, staticNeedsFullRepaintRef]);
    const showPreviewElements = useCallback(
        (fullDiff, elementIds) => {
            const bounds = boundsOfDiff(fullDiff, elementIds);
            if (bounds) showWorldBounds(bounds);
        },
        [showWorldBounds],
    );

    useEffect(() => {
        registerAiAssistantOpen?.(() => setAiAssistantOpen(true));
    }, [registerAiAssistantOpen, setAiAssistantOpen]);

    // Each code-split panel mounts on first open and then stays, keeping its state when closed.
    const versionHistoryEverOpened = useEverOpened(versionHistoryOpen);
    const replayEverOpened = useEverOpened(replayOpen);
    const branchesEverOpened = useEverOpened(branchesOpen);
    const aiAssistantEverOpened = useEverOpened(aiAssistantOpen);
    const finishTour = useCallback(() => {
        if (activeTourTrack && session?.user?.id) markTourCompleted(session.user.id, activeTourTrack);
        setActiveTourTrack(null);
        setTourSurface(null);
    }, [activeTourTrack, session?.user?.id, setActiveTourTrack, setTourSurface]);

    // Someone who has never finished a tour gets the basics once, after the room joins,
    // because the dock and bar it points at only exist from then.
    useEffect(() => {
        if (!roomJoined || hasAutoLaunchedTourRef.current || !session?.user?.id) return;
        hasAutoLaunchedTourRef.current = true;
        if (!hasCompletedAnyTour(session.user.id)) {
            setActiveTourTrack("basics");
        }
    }, [roomJoined, session?.user?.id, hasAutoLaunchedTourRef, setActiveTourTrack]);

    return {
        aiAssistantEverOpened,
        aiPreviewIsStale,
        branchesEverOpened,
        catchUp,
        finishTour,
        replayEverOpened,
        showAllCatchUpChanges,
        showCatchUpChange,
        showPreviewElements,
        versionHistoryEverOpened,
    };
};
