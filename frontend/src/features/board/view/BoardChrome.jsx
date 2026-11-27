import BoardContextMenu from "../commands/BoardContextMenu.jsx";
import { boardMenuItems } from "../commands/boardMenuItems";
import BackgroundPicker from "../chrome/BackgroundPicker.jsx";
import CommentComposer from "../comments/CommentComposer.jsx";
import CommentMark from "../comments/CommentMark.jsx";
import CommentPin from "../comments/CommentPin.jsx";
import { EmptyBoard } from "../chrome/BoardStates";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { MAX_ZOOM, MIN_ZOOM, viewportWorldBounds, worldToScreen } from "../camera/camera";
import { MENU_ITEMS } from "../tools/toolSettings";

const COMPOSER_WIDTH = 320;
const COMPOSER_CLEARANCE = 220;

// Beside the pin, but pulled back inside the screen near its right and bottom edges.
const pendingComposerPosition = ({ screenX, screenY }, viewport) => {
    const width = Math.min(COMPOSER_WIDTH, viewport.width - 32);
    return {
        left: Math.max(32, Math.min(screenX, viewport.width - width)),
        top: Math.max(0, Math.min(screenY, viewport.height - COMPOSER_CLEARANCE)),
    };
};
import Minimap from "../camera/Minimap.jsx";
import StrokeIcon from "@/components/ui/StrokeIcon";
import Tooltip from "@/components/ui/Tooltip";
import { WithCamera } from "../camera/cameraStore";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { isCommentUnreadFor, resolveCommentWorldPosition } from "../comments/comments";
import styles from "../index.module.css";

export const BoardChrome = ({ board }) => {
    const {
        closeContextMenu,
        contextMenu,
        activeCommentId,
        activeMenuItem,
        aiEnabled,
        aiPlacement,
        background,
        backgroundPickerOpen,
        cameraStore,
        canComment,
        canManageComment,
        collaborators,
        comments,
        commentsPanelOpen,
        contentBounds,
        debugMode,
        debugStats,
        deleteCommentThread,
        elements,
        eraserPosition,
        getCanvasCoordinates,
        handleInsertStressTestElements,
        handleZoomIn,
        handleZoomOut,
        handleZoomReset,
        handleZoomToFit,
        handleZoomToSelection,
        isFullscreen,
        minimapOpen,
        moveCommentAnchor,
        openCommentThread,
        pendingCommentAnchor,
        recenterCameraOn,
        selectedElementIds,
        session,
        setActiveCommentId,
        setActiveTourTrack,
        setAiAssistantOpen,
        setBackgroundPickerOpen,
        setImportDialogOpen,
        setMinimapOpen,
        setPendingCommentAnchor,
        showEmptyBoard,
        size,
        spatialIndexRef,
        submitCommentReply,
        submitNewComment,
        toggleFullscreen,
        toggleCommentResolved,
        updateBackground,
        viewportSize,
    } = board;

    return (
        <>
            {/* Siblings of canvasWrapper rather than children: it has no z-index, so anything inside it loses to
                later layered siblings such as .welcomeMessage. */}
            <WithCamera store={cameraStore}>
                {(camera) =>
                    comments.map((comment) => {
                        const position = resolveCommentWorldPosition(comment, elements);
                        if (!position) return null;
                        const screen = worldToScreen(camera, position.x, position.y);
                        const manageable = canManageComment(comment);
                        return (
                            <CommentPin
                                key={comment._id}
                                comment={comment}
                                x={screen.x}
                                y={screen.y}
                                unread={isCommentUnreadFor(comment, session?.user?.id)}
                                isOpen={activeCommentId === comment._id && !commentsPanelOpen}
                                onOpenChange={(open) => (open ? openCommentThread(comment._id) : setActiveCommentId(null))}
                                collaborators={collaborators}
                                canComment={canComment}
                                canManage={manageable}
                                onReply={(text, mentions) => submitCommentReply(comment._id, text, mentions)}
                                onToggleResolve={(resolved) => toggleCommentResolved(comment._id, resolved)}
                                onDelete={manageable ? () => deleteCommentThread(comment._id) : undefined}
                                onMoveTo={
                                    manageable
                                        ? (clientX, clientY) => {
                                              const { x: worldX, y: worldY } = getCanvasCoordinates(clientX, clientY);
                                              moveCommentAnchor(comment._id, worldX, worldY);
                                          }
                                        : undefined
                                }
                            />
                        );
                    })
                }
            </WithCamera>
            {pendingCommentAnchor && (
                <>
                    <span className={styles.pendingPin} aria-hidden="true" style={{ left: pendingCommentAnchor.screenX, top: pendingCommentAnchor.screenY }}>
                        <CommentMark>
                            <span className={styles.pendingDots}>
                                <i />
                                <i />
                                <i />
                            </span>
                        </CommentMark>
                    </span>
                    <div className={styles.pendingCommentComposer} style={pendingComposerPosition(pendingCommentAnchor, viewportSize)}>
                        <button
                            type="button"
                            className={styles.pendingCommentCancel}
                            aria-label="Discard this comment"
                            title="Discard without creating a comment"
                            onClick={() => setPendingCommentAnchor(null)}
                        >
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                        <CommentComposer
                            collaborators={collaborators}
                            placeholder="Add a comment…"
                            autoFocus
                            onSubmit={(text, mentions) => submitNewComment(pendingCommentAnchor.anchor, text, mentions)}
                        />
                    </div>
                </>
            )}
            {contextMenu && <BoardContextMenu x={contextMenu.x} y={contextMenu.y} items={boardMenuItems(board, contextMenu)} onClose={closeContextMenu} />}
            {activeMenuItem === MENU_ITEMS.ERASER && eraserPosition && (
                <div
                    className={styles.eraserHighlight}
                    style={{
                        left: eraserPosition.x,
                        top: eraserPosition.y,
                        width: `${size * 2}px`,
                        height: `${size * 2}px`,
                        transform: `translate(-50%, -50%)`,
                    }}
                />
            )}
            {showEmptyBoard && !aiPlacement && (
                <EmptyBoard
                    canStartWithAi={aiEnabled}
                    onStartWithAi={() => setAiAssistantOpen(true)}
                    onImport={() => setImportDialogOpen(true)}
                    onTakeTour={() => setActiveTourTrack("basics")}
                />
            )}
            <WithCamera store={cameraStore}>
                {(camera) => (
                    <Minimap
                        isOpen={minimapOpen}
                        onToggle={() => setMinimapOpen((prev) => !prev)}
                        contentBounds={contentBounds}
                        viewportWorldBounds={viewportWorldBounds(camera, viewportSize.width, viewportSize.height)}
                        elements={elements}
                        onRecenter={recenterCameraOn}
                    />
                )}
            </WithCamera>
            <BackgroundPicker
                isOpen={backgroundPickerOpen}
                onToggle={() => setBackgroundPickerOpen((prev) => !prev)}
                background={background}
                onChange={updateBackground}
            />
            <div className={styles.cornerLeft} data-board-chrome>
                <Tooltip label="Canvas background" side="top">
                    <button
                        type="button"
                        className={styles.cornerButton}
                        aria-label="Canvas background"
                        aria-pressed={backgroundPickerOpen}
                        onClick={() => {
                            setMinimapOpen(false);
                            setBackgroundPickerOpen((prev) => !prev);
                        }}
                    >
                        <StrokeIcon name="grid" />
                    </button>
                </Tooltip>
                <Tooltip label={minimapOpen ? "Hide minimap" : "Show minimap"} side="top">
                    <button
                        type="button"
                        className={styles.cornerButton}
                        aria-label={minimapOpen ? "Hide minimap" : "Show minimap"}
                        aria-pressed={minimapOpen}
                        onClick={() => {
                            setBackgroundPickerOpen(false);
                            setMinimapOpen((prev) => !prev);
                        }}
                    >
                        <StrokeIcon name="map" />
                    </button>
                </Tooltip>
            </div>
            <div className={styles.zoomControls} data-board-chrome data-tour="zoom">
                {selectedElementIds.length > 0 && (
                    <Tooltip label="Zoom to selection" side="top">
                        <button type="button" className={styles.cornerButton} onClick={handleZoomToSelection} aria-label="Zoom to selection">
                            <StrokeIcon name="crop" size={16} />
                        </button>
                    </Tooltip>
                )}
                <WithCamera store={cameraStore}>
                    {(camera) => (
                        <>
                            <Tooltip label="Zoom out" side="top">
                                <button
                                    type="button"
                                    className={styles.cornerButton}
                                    onClick={handleZoomOut}
                                    disabled={camera.zoom <= MIN_ZOOM}
                                    aria-label="Zoom out"
                                >
                                    <StrokeIcon name="minus" size={16} />
                                </button>
                            </Tooltip>
                            <Tooltip label="Reset view" side="top">
                                <button
                                    type="button"
                                    className={styles.zoomDisplay}
                                    onClick={handleZoomReset}
                                    aria-label={`Reset view (${Math.round(camera.zoom * 100)}%)`}
                                >
                                    {Math.round(camera.zoom * 100)}%
                                </button>
                            </Tooltip>
                            <Tooltip label="Zoom in" side="top">
                                <button
                                    type="button"
                                    className={styles.cornerButton}
                                    onClick={handleZoomIn}
                                    disabled={camera.zoom >= MAX_ZOOM}
                                    aria-label="Zoom in"
                                >
                                    <StrokeIcon name="plus" size={16} />
                                </button>
                            </Tooltip>
                        </>
                    )}
                </WithCamera>
                <Tooltip label="Zoom to fit" side="top">
                    <button type="button" className={styles.cornerButton} onClick={handleZoomToFit} disabled={!contentBounds} aria-label="Zoom to fit">
                        <StrokeIcon name="fit" size={16} />
                    </button>
                </Tooltip>
                <Tooltip label={isFullscreen ? "Exit full screen" : "Full screen"} side="top">
                    <button
                        type="button"
                        className={styles.cornerButton}
                        onClick={toggleFullscreen}
                        aria-pressed={isFullscreen}
                        aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
                    >
                        <StrokeIcon name="fullscreen" size={16} />
                    </button>
                </Tooltip>
            </div>
            {debugMode && (
                <div className={styles.debugHud}>
                    <div className={styles.debugRow}>
                        <span>FPS</span>
                        <span>{debugStats.fps}</span>
                    </div>
                    <div className={styles.debugRow}>
                        <span>Elements</span>
                        <span>{spatialIndexRef.current.size()}</span>
                    </div>
                    <div className={styles.debugRow}>
                        <span>Static repaints/sec</span>
                        <span>{debugStats.staticRepaintsPerSec}</span>
                    </div>
                    <div className={styles.debugRow}>
                        <span>Static insert drains/sec</span>
                        <span>{debugStats.staticInsertDrainsPerSec}</span>
                    </div>
                    <div className={styles.debugRow}>
                        <span>Visible / total</span>
                        <span>
                            {debugStats.visibleElementCount} / {debugStats.totalElementCount}
                        </span>
                    </div>
                    <div className={styles.debugRow}>
                        <span>LOD</span>
                        <span>
                            {debugStats.lodLevel.simplifyTolerance || debugStats.lodLevel.hideFineDetail
                                ? [debugStats.lodLevel.simplifyTolerance && "simplify", debugStats.lodLevel.hideFineDetail && "no-fill"]
                                      .filter(Boolean)
                                      .join(", ")
                                : "off"}
                        </span>
                    </div>
                    <button className={styles.debugButton} onClick={handleInsertStressTestElements}>
                        Insert 3,000 elements
                    </button>
                </div>
            )}
        </>
    );
};
