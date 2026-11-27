import styles from "../index.module.css";
import { BoardPanels } from "./BoardPanels";
import { BoardCanvasLayers } from "./BoardCanvasLayers";
import { BoardChrome } from "./BoardChrome";

export const BoardView = ({ board }) => {
    const { containerRef, roomJoined, spatialIndexRef } = board;
    return (
        <main
            id="main"
            ref={containerRef}
            className={styles.whiteboardContainer}
            data-room-joined={roomJoined}
            data-element-count={spatialIndexRef.current.size()}
        >
            <BoardPanels board={board} />
            <BoardCanvasLayers board={board} />
            <BoardChrome board={board} />
        </main>
    );
};
