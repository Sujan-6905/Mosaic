import { useCallback, useRef, useState } from "react";

const DRAG_THRESHOLD = 6;
const NARROW_LAYOUT = "(max-width: 900px)";

// The pointer is captured from the press so nothing else claims the gesture, and a drag never reads as a
// click that opens the board.
export default function useTileDrag({ slots, count, disabled, boardRef, onSwap }) {
    const [drag, setDrag] = useState(null);
    const [hoverSlot, setHoverSlot] = useState(null);
    const pressRef = useRef(null);
    const justDraggedRef = useRef(false);

    const nearestSlot = useCallback(
        (clientX, clientY, fallback) => {
            const area = boardRef.current.getBoundingClientRect();
            let best = fallback;
            let bestDistance = Infinity;
            slots.slice(0, count).forEach(([left, top, width, height], slotIndex) => {
                const scale = Math.min(1, area.width / 1440, area.height / 1000);
                const centerX = area.left + (left / 100) * area.width + (width * scale) / 2;
                const centerY = area.top + (top / 100) * area.height + (height * scale) / 2;
                const distance = Math.hypot(centerX - clientX, centerY - clientY);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    best = slotIndex;
                }
            });
            return best;
        },
        [boardRef, slots, count],
    );

    const dragHandlersFor = (index) => ({
        onPointerDown: (event) => {
            if (event.button !== 0 || disabled || window.matchMedia(NARROW_LAYOUT).matches) return;
            pressRef.current = { index, x: event.clientX, y: event.clientY, moved: false };
            event.currentTarget.setPointerCapture(event.pointerId);
        },
        onPointerMove: (event) => {
            const press = pressRef.current;
            if (!press || press.index !== index) return;
            const dx = event.clientX - press.x;
            const dy = event.clientY - press.y;
            if (!press.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
            press.moved = true;
            setDrag({ index, dx, dy });
            setHoverSlot(nearestSlot(event.clientX, event.clientY, index));
        },
        onPointerUp: (event) => {
            const press = pressRef.current;
            pressRef.current = null;
            setDrag(null);
            setHoverSlot(null);
            if (!press?.moved) return;
            justDraggedRef.current = true;
            event.preventDefault();
            const target = nearestSlot(event.clientX, event.clientY, index);
            if (target !== index) onSwap(index, target);
        },
        onPointerCancel: () => {
            pressRef.current = null;
            setDrag(null);
            setHoverSlot(null);
        },
        onClickCapture: (event) => {
            if (!justDraggedRef.current) return;
            justDraggedRef.current = false;
            event.preventDefault();
            event.stopPropagation();
        },
    });

    return { dragHandlersFor, drag, hoverSlot };
}
