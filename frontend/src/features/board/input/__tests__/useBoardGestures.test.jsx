import { StrictMode, act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBoardGestures } from "../useBoardGestures";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const Board = ({ handlePointerDown }) => {
    const containerRef = useRef(null);
    useBoardGestures({ containerRef, elements: {}, selectedElementIds: [], handlePointerDown, handlePointerMove: vi.fn(), handlePointerUp: vi.fn() });
    return <div ref={containerRef} data-testid="board" />;
};

describe("useBoardGestures", () => {
    let root;
    let host;

    afterEach(() => {
        act(() => root.unmount());
        host.remove();
    });

    it("still hears presses after StrictMode remounts its effects", () => {
        const handlePointerDown = vi.fn();
        host = document.body.appendChild(document.createElement("div"));
        root = createRoot(host);
        act(() =>
            root.render(
                <StrictMode>
                    <Board handlePointerDown={handlePointerDown} />
                </StrictMode>,
            ),
        );

        host.querySelector("[data-testid=board]").dispatchEvent(new Event("pointerdown", { bubbles: true }));

        expect(handlePointerDown).toHaveBeenCalledTimes(1);
    });
});
