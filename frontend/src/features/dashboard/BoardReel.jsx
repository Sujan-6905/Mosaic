import { useEffect, useRef, useState } from "react";
import StaticCanvasPreview from "@/features/board/rendering/StaticCanvasPreview";
import styles from "./BoardCard.module.css";

const HOVER_INTENT_MS = 220;
const reels = new Map();

// One request per board per edit: a card hovered twice replays from memory.
const reelFor = (board, loadReel) => {
    const key = `${board.shareId}:${board.updatedAt}`;
    if (!reels.has(key))
        reels.set(
            key,
            loadReel(board).catch(() => null),
        );
    return reels.get(key);
};

// While a mouse rests on the thumbnail it replays how the board was made, the pointer's place across the card
// choosing the place in its history.
export default function BoardReel({ board, loadReel, width, height, className }) {
    const [reel, setReel] = useState(null);
    const [hovering, setHovering] = useState(false);
    const [position, setPosition] = useState(1);
    const intentRef = useRef(0);

    useEffect(() => () => clearTimeout(intentRef.current), []);

    const enter = (event) => {
        if (event.pointerType !== "mouse") return;
        intentRef.current = setTimeout(() => {
            setHovering(true);
            reelFor(board, loadReel).then(setReel);
        }, HOVER_INTENT_MS);
    };
    const move = (event) => {
        const box = event.currentTarget.getBoundingClientRect();
        setPosition(Math.max(0, Math.min(1, (event.clientX - box.left - 10) / (box.width - 20))));
    };
    const leave = () => {
        clearTimeout(intentRef.current);
        setHovering(false);
        setPosition(1);
    };

    const playing = hovering && reel?.frames?.length > 1;
    const frames = reel?.frames ?? [];
    const frame = playing ? frames[Math.round(position * (frames.length - 1))] : null;
    const elements = frame ? frame.elements : board.previewElements || {};
    const hasContent = Object.keys(elements).length > 0 || playing;

    return (
        <span className={className} onPointerEnter={enter} onPointerMove={move} onPointerLeave={leave} data-reel={playing || undefined}>
            {hasContent && (
                <StaticCanvasPreview
                    elements={elements}
                    background={frame?.background ?? board.background}
                    fitElements={playing ? frames.at(-1).elements : undefined}
                    width={width}
                    height={height}
                    className={styles.thumbCanvas}
                />
            )}
            {playing && (
                <>
                    <span className={styles.reelCount}>
                        {frame.seq} of {reel.latestSeq} changes
                    </span>
                    <span className={styles.reelHead} style={{ left: `${position * 100}%` }} aria-hidden="true" />
                    <span className={styles.reelTrack} style={{ transform: `scaleX(${position})` }} aria-hidden="true" />
                </>
            )}
        </span>
    );
}
