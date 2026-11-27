import ChangeMarkersOverlay from "../history/ChangeMarkersOverlay.jsx";
import EditPreviewOverlay from "../assistant/EditPreviewOverlay.jsx";
import ConnectorOverlay from "../tools/ConnectorOverlay.jsx";
import EmbedLayer from "../embeds/EmbedLayer.jsx";
import { FrameRenameInput, LinkHoverCard } from "../chrome/BoardInlineCards.jsx";
import VoteBadges from "../workshop/VoteBadges";
import Clink from "../moments/Clink";
import BoardRituals from "../moments/BoardRituals";
import { socket } from "@/lib/socket.js";
import { MENU_ITEMS } from "../tools/toolSettings";
import { canQuickConnect } from "../tools/useConnectorTools";
import ReferenceHighlightOverlay from "../assistant/ReferenceHighlightOverlay.jsx";
import SelectionOverlay from "../selection/SelectionOverlay.jsx";
import TextEditorOverlay from "../text/TextEditorOverlay.jsx";
import { WithCamera } from "../camera/cameraStore";
import cx from "clsx";
import { getOffscreenIndicators } from "../camera/viewport";
import styles from "../index.module.css";
import { worldToScreen } from "../camera/camera";
import { LASER_TRAIL_MS } from "../state/boardHelpers";

// A triangle centred in its own box, so an off-screen indicator rotated to any angle points at its target.
const DirectionArrowIcon = () => (
    <svg viewBox="0 0 24 24" width="0.85em" height="0.85em" fill="currentColor" aria-hidden="true">
        <path d="M4 3 L21 12 L4 21 Z" />
    </svg>
);

const TEXT_HANDLE_IDS = ["nw", "ne", "e", "se", "sw", "w"];

export const BoardCanvasLayers = ({ board }) => {
    const {
        activeEmbedId,
        spatialIndexRef,
        applyElementUpdates,
        beginBendDrag,
        beginElbowDrag,
        beginEndpointDrag,
        beginQuickConnect,
        hoveredLinkId,
        renamingFrameId,
        selectionBox,
        setActiveEmbedId,
        setRenamingFrameId,
        activeMenuItem,
        aiDisambiguation,
        aiPreview,
        architectureComparison,
        cameraStore,
        canvasRef,
        catchUp,
        closeTextEditor,
        editTableCell,
        editingCell,
        editingDraft,
        editingElementId,
        elements,
        handleResizeHandleStart,
        handleRotateHandleStart,
        handleTextEditorChange,
        handleTextEditorFormatChange,
        hasLockedSelection,
        isDrawing,
        jumpToOffscreenBounds,
        localLaserTrailRef,
        offscreenTargets,
        overlayCanvasRef,
        participantById,
        participantOffscreenTargets,
        participantsRef,
        remoteCursorsRef,
        remoteLaserTrailsRef,
        selectedElementIds,
        toggleFollow,
        viewportSize,
        voting,
        myVotes,
        castVote,
        shareId,
    } = board;

    const onlySelected = selectedElementIds.length === 1 ? elements[selectedElementIds[0]] : null;

    return (
        <>
            <div
                className={cx(styles.canvasWrapper, {
                    [styles.drawing]: isDrawing.current,
                    [styles.erasing]: activeMenuItem === MENU_ITEMS.ERASER,
                    [styles.panning]: activeMenuItem === MENU_ITEMS.HAND,
                    [styles.commenting]: activeMenuItem === MENU_ITEMS.COMMENT,
                    [styles.selecting]: activeMenuItem === MENU_ITEMS.SELECT,
                    [styles.typing]: activeMenuItem === MENU_ITEMS.TEXT,
                    [styles.filling]: activeMenuItem === MENU_ITEMS.BUCKET,
                })}
            >
                <canvas ref={canvasRef} className={styles.whiteboardCanvas} />
                <canvas ref={overlayCanvasRef} className={styles.whiteboardOverlayCanvas} />
                <WithCamera store={cameraStore}>
                    {(camera) => (
                        <>
                            <div className={styles.cursorLayer}>
                                {Object.entries(remoteCursorsRef.current).map(([socketId, cursor]) => {
                                    const screen = worldToScreen(camera, cursor.x, cursor.y);
                                    return (
                                        <div
                                            key={socketId}
                                            className={styles.remoteCursor}
                                            style={{
                                                transform: `translate(${screen.x}px, ${screen.y}px)`,
                                            }}
                                        >
                                            <svg className={styles.cursorPointer} viewBox="0 0 24 24" width="20" height="20" fill={cursor.color}>
                                                <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36z" />
                                            </svg>
                                            <span className={styles.cursorLabel} style={{ backgroundColor: cursor.color }}>
                                                {cursor.name}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            <Clink
                                cursors={remoteCursorsRef.current}
                                toScreen={(cursor) => worldToScreen(camera, cursor.x, cursor.y)}
                                color={participantsRef.current[socket.id]?.color ?? "#ffb43c"}
                            />
                            <BoardRituals elements={elements} camera={camera} shareId={shareId} />
                            <svg className={styles.laserLayer} width={viewportSize.width} height={viewportSize.height}>
                                {[
                                    { key: "local", color: "#f43f5e", points: localLaserTrailRef.current },
                                    ...Object.entries(remoteLaserTrailsRef.current).map(([socketId, points]) => ({
                                        key: socketId,
                                        color: participantsRef.current[socketId]?.color || "#f43f5e",
                                        points,
                                    })),
                                ].map(({ key, color, points }) => (
                                    <g key={key}>
                                        {points.map((point, i) => {
                                            const screen = worldToScreen(camera, point.x, point.y);
                                            const opacity = Math.max(0, 1 - (Date.now() - point.t) / LASER_TRAIL_MS);
                                            return <circle key={i} cx={screen.x} cy={screen.y} r={4} fill={color} opacity={opacity} />;
                                        })}
                                    </g>
                                ))}
                            </svg>
                            <EmbedLayer
                                elements={elements}
                                spatialIndex={spatialIndexRef.current}
                                camera={camera}
                                viewportWidth={viewportSize.width}
                                viewportHeight={viewportSize.height}
                                activeEmbedId={activeEmbedId}
                                selectedIds={selectedElementIds}
                                onActivate={setActiveEmbedId}
                                onDeactivate={() => setActiveEmbedId(null)}
                            />
                            {onlySelected?.type === "connector" && !editingElementId && !hasLockedSelection && (
                                <ConnectorOverlay
                                    connector={onlySelected}
                                    elements={elements}
                                    camera={camera}
                                    onEndpointStart={beginEndpointDrag}
                                    onBendStart={beginBendDrag}
                                    onElbowStart={beginElbowDrag}
                                    onRemoveBend={(index) =>
                                        applyElementUpdates({
                                            [selectedElementIds[0]]: { ...onlySelected, waypoints: onlySelected.waypoints.filter((_, i) => i !== index) },
                                        })
                                    }
                                />
                            )}
                            {selectionBox && !editingElementId && onlySelected?.type !== "connector" && (
                                <SelectionOverlay
                                    bounds={selectionBox}
                                    camera={camera}
                                    showResizeHandles={!hasLockedSelection}
                                    locked={hasLockedSelection}
                                    rotation={selectedElementIds.length === 1 ? elements[selectedElementIds[0]]?.rotation || 0 : 0}
                                    handleIds={onlySelected?.type === "text" ? TEXT_HANDLE_IDS : null}
                                    onResizeStart={handleResizeHandleStart}
                                    onRotateStart={hasLockedSelection ? undefined : handleRotateHandleStart}
                                    onQuickConnectStart={
                                        !hasLockedSelection && activeMenuItem === MENU_ITEMS.SELECT && canQuickConnect(onlySelected)
                                            ? beginQuickConnect
                                            : undefined
                                    }
                                />
                            )}
                            {hoveredLinkId && elements[hoveredLinkId]?.link && <LinkHoverCard element={elements[hoveredLinkId]} camera={camera} />}
                            <VoteBadges
                                elements={elements}
                                camera={camera}
                                voting={voting}
                                myVotes={myVotes}
                                onTakeBack={(elementId) => castVote(elementId, false)}
                            />
                            {renamingFrameId && elements[renamingFrameId] && (
                                <FrameRenameInput
                                    frame={elements[renamingFrameId]}
                                    camera={camera}
                                    onCommit={(name) => {
                                        const frame = elements[renamingFrameId];
                                        if (name && name !== frame.name) applyElementUpdates({ [renamingFrameId]: { ...frame, name } });
                                        setRenamingFrameId(null);
                                    }}
                                />
                            )}
                            <ChangeMarkersOverlay
                                changes={architectureComparison?.changes ?? (catchUp.isOpen ? (catchUp.digest?.changes ?? null) : null)}
                                focusedChangeId={architectureComparison?.focusedChangeId ?? catchUp.focusedChangeId}
                                camera={camera}
                                viewportWidth={viewportSize.width}
                                viewportHeight={viewportSize.height}
                            />
                            <EditPreviewOverlay
                                diff={aiPreview && !aiPreview.comparing ? aiPreview.diff : null}
                                elements={elements}
                                focusedIds={aiPreview?.focusedIds ?? null}
                                camera={camera}
                                viewportWidth={viewportSize.width}
                                viewportHeight={viewportSize.height}
                            />
                            {aiDisambiguation && (
                                <ReferenceHighlightOverlay
                                    candidates={aiDisambiguation.candidates}
                                    focusedRef={aiDisambiguation.focusedRef}
                                    camera={camera}
                                    onChoose={aiDisambiguation.onChoose}
                                />
                            )}
                            {editingElementId && elements[editingElementId] && editingDraft && (
                                <TextEditorOverlay
                                    key={editingCell ? `${editingCell.row}:${editingCell.col}` : "text"}
                                    element={{ ...elements[editingElementId], ...editingDraft }}
                                    cell={editingCell}
                                    onCellStep={editTableCell}
                                    elements={elements}
                                    camera={camera}
                                    onTextChange={handleTextEditorChange}
                                    onFormatChange={handleTextEditorFormatChange}
                                    onClose={closeTextEditor}
                                />
                            )}
                            <div className={styles.offscreenIndicatorLayer}>
                                {getOffscreenIndicators(offscreenTargets, camera, viewportSize.width, viewportSize.height).map((indicator) => (
                                    <button
                                        key={indicator.id}
                                        className={styles.offscreenIndicator}
                                        style={{
                                            left: indicator.x,
                                            top: indicator.y,
                                            transform: `translate(-50%, -50%) rotate(${indicator.angle}rad)`,
                                        }}
                                        onClick={() => jumpToOffscreenBounds(indicator.bounds)}
                                        title="Content is this way. Click to jump there"
                                    >
                                        <DirectionArrowIcon />
                                    </button>
                                ))}
                                {getOffscreenIndicators(participantOffscreenTargets, camera, viewportSize.width, viewportSize.height).map((indicator) => (
                                    <button
                                        key={indicator.id}
                                        className={styles.offscreenIndicator}
                                        style={{
                                            left: indicator.x,
                                            top: indicator.y,
                                            transform: `translate(-50%, -50%) rotate(${indicator.angle}rad)`,
                                            backgroundColor: participantById.get(indicator.id)?.color,
                                        }}
                                        onClick={() => toggleFollow(indicator.id)}
                                        title={`${participantById.get(indicator.id)?.name || "Collaborator"} is this way. Click to follow`}
                                    >
                                        <DirectionArrowIcon />
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </WithCamera>
            </div>
        </>
    );
};
