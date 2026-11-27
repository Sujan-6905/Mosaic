import ArchitecturePanel from "../diagrams/ArchitecturePanel.jsx";
import BoardTopBar from "../chrome/BoardTopBar";
import BoardUnavailable from "../chrome/BoardUnavailable";
import CatchUpPanel from "../history/CatchUpPanel.jsx";
import CommandPalette from "../commands/CommandPalette.jsx";
import CommentsPanel from "../comments/CommentsPanel.jsx";
import ErrorBoundary from "@/components/ErrorBoundary";
import { FollowInvite, FollowingFrame, PresenterBar, ReconnectBanner } from "../chrome/BoardStates";
import BoardArrival from "../moments/Kiln";
import { useState } from "react";
import Mend, { MergeSeam } from "../moments/Mend";
import { isCalm } from "@/lib/calmMode";
import SkyGesture from "../moments/SkyGesture";
import { useKilnStrokes } from "../collaboration/useKilnStrokes";
import { useRoomFavicon } from "../moments/useRoomFavicon";
import { MENU_ITEMS } from "../tools/toolSettings";
import PlacementGhost from "../tools/PlacementGhost";
import { WithCamera } from "../camera/cameraStore";
import BoardDialogs from "./BoardDialogs";
import dynamic from "next/dynamic";
import { menuItemClick } from "@/store/menuSlice";
import { socket } from "@/lib/socket.js";
import styles from "../index.module.css";
import { WHITEBOARD_TOUR_TRACK_IDS } from "../state/boardHelpers";

const BoardSceneOverlay = dynamic(() => import("../history/BoardSceneOverlay.jsx"), { ssr: false });
const VersionHistoryPanel = dynamic(() => import("../history/VersionHistoryPanel.jsx"), { ssr: false });

// Panels many sessions never open load on first use, and only in the browser.
const HelpMenu = dynamic(() => import("@/components/HelpMenu/index.jsx"), { ssr: false });
const ReplayPanel = dynamic(() => import("../history/ReplayPanel.jsx"), { ssr: false });
import { getElementBounds } from "../../../../../shared/canvas/geometry/bounds.js";
const FindBar = dynamic(() => import("../text/FindBar.jsx"), { ssr: false });
const WorkshopBar = dynamic(() => import("../workshop/WorkshopBar.jsx"), { ssr: false });
const BranchesDiffPanel = dynamic(() => import("../history/BranchesDiffPanel.jsx"), { ssr: false });
const AssistantPanel = dynamic(() => import("../assistant/AssistantPanel.jsx"), { ssr: false });
const TourOverlay = dynamic(() => import("@/features/tour/TourOverlay.jsx"), { ssr: false });

export const BoardPanels = ({ board }) => {
    const {
        acceptAiGraph,
        acceptAiSketch,
        activeCommentId,
        activeTourTrack,
        agentActivityByUserId,
        aiAssistantEverOpened,
        aiAssistantOpen,
        aiEnabled,
        aiPlacement,
        aiPreviewIsStale,
        applyArchitectureSync,
        architectureOpen,
        boardHasContent,
        branchesEverOpened,
        branchesOpen,
        cameraStore,
        canComment,
        canManageComment,
        cancelAiPlacement,
        catchUp,
        setBoardTitle,
        collaborators,
        commandActions,
        commandPaletteOpen,
        commands,
        comments,
        commentsPanelOpen,
        deleteCommentThread,
        dispatch,
        elements,
        fileInputRef,
        finishTour,
        followInvitePresenter,
        followedParticipant,
        followerSocketIds,
        followingSocketId,
        getViewportBounds,
        handleAiDisambiguationChange,
        handleForked,
        handleImageFileSelected,
        handleVersionRestored,
        hasEditAccess,
        hasJoinedOnce,
        helpEverOpened,
        helpOpen,
        isConnected,
        isPresenting,
        jumpToComment,
        openCommentThread,
        otherParticipants,
        participants,
        placeAiDrawing,
        placeArchitectureGraph,
        presentingSocketIds,
        removeElements,
        replayEverOpened,
        replayOpen,
        role,
        saveStatus,
        selectedElementIds,
        session,
        setActiveCommentId,
        setActiveTourTrack,
        setAiAssistantOpen,
        setAiPreview,
        setArchitectureComparison,
        setArchitectureOpen,
        setBackgroundPickerOpen,
        setBranchesOpen,
        setCommandPaletteOpen,
        setCommentsPanelOpen,
        setDismissedPresenterId,
        setHelpOpen,
        setMinimapOpen,
        setReplayOpen,
        setTimeScene,
        setTourSurface,
        setVersionHistoryOpen,
        shareId,
        showAllCatchUpChanges,
        showCatchUpChange,
        showPreviewElements,
        showToast,
        showWorldBounds,
        submitCommentReply,
        timeScene,
        toggleCommentResolved,
        toggleFollow,
        togglePresenting,
        tourSurface,
        unavailableReason,
        unreadCommentCount,
        versionHistoryEverOpened,
        versionHistoryOpen,
        findOpen,
        findQuery,
        changeFindQuery,
        findIndex,
        findMatches,
        stepFind,
        setFindOpen,
    } = board;
    const placeKilnStrokes = useKilnStrokes(board);
    useRoomFavicon(participants);
    const [mergeSeam, setMergeSeam] = useState(0);

    return (
        <>
            <input ref={fileInputRef} type="file" accept="image/*" className={styles.hiddenFileInput} onChange={handleImageFileSelected} />
            {!unavailableReason && <BoardArrival joined={hasJoinedOnce} canKeep={!hasJoinedOnce || hasEditAccess} onArrive={placeKilnStrokes} />}
            {unavailableReason && (
                <BoardUnavailable reason={unavailableReason} username={session?.user?.username} shareId={shareId} token={session?.accessToken} />
            )}
            {!isConnected && hasJoinedOnce && <ReconnectBanner onTryNow={() => socket.connect()} />}
            {hasJoinedOnce && <Mend offline={!isConnected} />}
            {hasJoinedOnce && <SkyGesture />}
            {mergeSeam > 0 && <MergeSeam key={mergeSeam} onDone={() => setMergeSeam(0)} />}
            {timeScene && <BoardSceneOverlay {...timeScene} />}
            <WorkshopBar
                workshop={board}
                elements={elements}
                onShowElement={(elementId) => {
                    const bounds = getElementBounds(elements[elementId]);
                    if (bounds) showWorldBounds(bounds);
                }}
            />
            <FindBar
                isOpen={findOpen}
                query={findQuery}
                onQueryChange={changeFindQuery}
                index={findIndex}
                count={findMatches.length}
                onStep={stepFind}
                onClose={() => setFindOpen(false)}
                belowWorkshop={Boolean(board.timer || board.voting || board.workshopSetup)}
            />
            {isPresenting && <PresenterBar audience={otherParticipants} followerSocketIds={followerSocketIds} onStop={togglePresenting} />}
            {followedParticipant && <FollowingFrame person={followedParticipant} onStop={() => toggleFollow(followedParticipant.socketId)} />}
            {followInvitePresenter && (
                <FollowInvite
                    presenter={followInvitePresenter}
                    onFollow={() => toggleFollow(followInvitePresenter.socketId)}
                    onDismiss={() => setDismissedPresenterId(followInvitePresenter.socketId)}
                />
            )}
            <BoardTopBar
                onTitleChange={setBoardTitle}
                shareOpenRequested={tourSurface === "share"}
                shareId={shareId}
                session={session}
                role={role}
                showToast={showToast}
                isConnected={isConnected}
                saveStatus={saveStatus}
                participants={participants}
                presentingSocketIds={presentingSocketIds}
                followingSocketId={followingSocketId}
                onToggleFollow={toggleFollow}
                agentActivityByUserId={agentActivityByUserId}
                isPresenting={isPresenting}
                onTogglePresent={togglePresenting}
                commentsPanelOpen={commentsPanelOpen}
                unreadCommentCount={unreadCommentCount}
                onToggleComments={() => setCommentsPanelOpen((prev) => !prev)}
                catchUpOpen={catchUp.isOpen}
                onToggleCatchUp={catchUp.isOpen ? catchUp.close : catchUp.open}
                historyOpen={versionHistoryOpen}
                onToggleHistory={() => setVersionHistoryOpen((prev) => !prev)}
                actions={commandActions}
                onToggleBackground={() => {
                    setMinimapOpen(false);
                    setBackgroundPickerOpen((prev) => !prev);
                }}
                onToggleMinimap={() => {
                    setBackgroundPickerOpen(false);
                    setMinimapOpen((prev) => !prev);
                }}
            />
            <ArchitecturePanel
                isOpen={architectureOpen}
                onClose={() => setArchitectureOpen(false)}
                shareId={shareId}
                token={session?.accessToken}
                canEdit={role === "editor" || role === "owner"}
                elements={elements}
                onPlaceGraph={placeArchitectureGraph}
                onApplySync={applyArchitectureSync}
                onRemoveElements={removeElements}
                onCompareChanges={setArchitectureComparison}
                onShowBounds={showWorldBounds}
            />
            <CatchUpPanel
                catchUp={catchUp}
                aiEnabled={aiEnabled && hasEditAccess}
                onShowChange={showCatchUpChange}
                onShowAll={showAllCatchUpChanges}
                onOpenComment={openCommentThread}
            />
            <CommentsPanel
                isOpen={commentsPanelOpen}
                onToggle={() => setCommentsPanelOpen((prev) => !prev)}
                comments={comments}
                elements={elements}
                currentUserId={session?.user?.id}
                activeCommentId={activeCommentId}
                onSelectComment={jumpToComment}
                onNewComment={() => dispatch(menuItemClick(MENU_ITEMS.COMMENT))}
                collaborators={collaborators}
                canComment={canComment}
                canManageComment={canManageComment}
                onReply={submitCommentReply}
                onToggleResolve={toggleCommentResolved}
                onDelete={deleteCommentThread}
                onCloseThread={() => setActiveCommentId(null)}
            />
            {versionHistoryEverOpened && (
                <ErrorBoundary label="Something went wrong loading version history.">
                    <VersionHistoryPanel
                        isOpen={versionHistoryOpen}
                        onClose={() => setVersionHistoryOpen(false)}
                        shareId={shareId}
                        token={session?.accessToken}
                        canEdit={role === "editor" || role === "owner"}
                        onRestored={handleVersionRestored}
                        onForked={handleForked}
                        onPreview={setTimeScene}
                        showToast={showToast}
                    />
                </ErrorBoundary>
            )}
            <BoardDialogs board={board} />
            {helpEverOpened && (
                <ErrorBoundary label="Something went wrong loading the help menu.">
                    <HelpMenu
                        isOpen={Boolean(helpOpen)}
                        onClose={() => setHelpOpen(false)}
                        commands={commands}
                        tourTrackIds={WHITEBOARD_TOUR_TRACK_IDS}
                        onStartTour={setActiveTourTrack}
                        openOnTab={tourSurface === "shortcuts" || helpOpen === "shortcuts" ? "shortcuts" : null}
                        toolsNote="Comment and AI sit on the dock. The laser pointer and Shape Assist are under More, at its right end."
                    />
                </ErrorBoundary>
            )}
            {replayEverOpened && (
                <ErrorBoundary label="Something went wrong loading the replay scrubber.">
                    <ReplayPanel
                        isOpen={replayOpen}
                        onClose={() => setReplayOpen(false)}
                        shareId={shareId}
                        token={session?.accessToken}
                        onScene={setTimeScene}
                        showToast={showToast}
                    />
                </ErrorBoundary>
            )}
            {branchesEverOpened && (
                <ErrorBoundary label="Something went wrong loading the branch diff view.">
                    <BranchesDiffPanel
                        isOpen={branchesOpen}
                        onClose={() => setBranchesOpen(false)}
                        shareId={shareId}
                        token={session?.accessToken}
                        showToast={showToast}
                        onForked={handleForked}
                        onMerged={(result) => {
                            if (result.target.shareId !== shareId) return;
                            handleVersionRestored(result.ops);
                            if (!isCalm()) setMergeSeam(Date.now());
                        }}
                    />
                </ErrorBoundary>
            )}
            {aiAssistantEverOpened && (
                <ErrorBoundary label="Something went wrong loading the AI assistant.">
                    <AssistantPanel
                        shareId={shareId}
                        token={session?.accessToken}
                        userId={session?.user?.id}
                        userName={session?.user?.name}
                        aiEnabled={aiEnabled}
                        canEdit={role === "editor" || role === "owner"}
                        isOpen={aiAssistantOpen}
                        onClose={() => setAiAssistantOpen(false)}
                        onAccept={acceptAiGraph}
                        onAcceptSketch={acceptAiSketch}
                        placing={Boolean(aiPlacement)}
                        showToast={showToast}
                        boardHasContent={boardHasContent}
                        selectedElementIds={selectedElementIds}
                        getViewportBounds={getViewportBounds}
                        onDisambiguationChange={handleAiDisambiguationChange}
                        onPreviewChange={setAiPreview}
                        previewIsStale={aiPreviewIsStale}
                        onShowPreviewElements={showPreviewElements}
                        onOpenHelp={() => setHelpOpen(true)}
                    />
                </ErrorBoundary>
            )}
            <CommandPalette
                isOpen={commandPaletteOpen}
                onClose={() => setCommandPaletteOpen(false)}
                commands={commands}
                token={session?.accessToken}
                showToast={showToast}
            />
            {aiPlacement && (
                <WithCamera store={cameraStore}>
                    {(camera) => <PlacementGhost elements={aiPlacement.mapped} zoom={camera.zoom} onPlace={placeAiDrawing} onCancel={cancelAiPlacement} />}
                </WithCamera>
            )}
            {activeTourTrack && (
                <ErrorBoundary label="Something went wrong loading the tour.">
                    <TourOverlay trackId={activeTourTrack} onFinish={finishTour} onSurfaceChange={setTourSurface} />
                </ErrorBoundary>
            )}
        </>
    );
};
