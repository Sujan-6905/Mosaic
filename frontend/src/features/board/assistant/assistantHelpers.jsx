import { diagramOf, previewElementsFor, recipeOf } from "../diagrams/diagramStyles";
import { buildElementsFromSketch } from "../../../../../shared/canvas/strokes/sketchStrokes.js";

export const AUTO_APPLY_STORAGE_KEY = "mosaic:ai-auto-apply";

export const TURN_TIMEOUT_MS = 60_000;
export const PANEL_EXIT_MS = 150;

export const COMMANDS = [
    { key: "summarize", name: "/summarize", desc: "Summarise what's on the board", prompt: "Summarise what's on this board" },
    { key: "tidy", name: "/tidy", desc: "Lay everything out cleanly", prompt: "Tidy everything into a clean top-down layout" },
    { key: "convert", name: "/convert", desc: "Turn the selection into a clean diagram", prompt: "Turn the selected objects into a clean flowchart" },
    { key: "cleanup", name: "/cleanup", desc: "Straighten hand-drawn shapes in place", prompt: "Clean up my hand-drawn shapes" },
    { key: "align", name: "/align", desc: "Line up the selected objects", prompt: "Align the selected objects to the left" },
    { key: "connect", name: "/connect", desc: "Draw an arrow between two objects", prompt: "Connect the " },
    { key: "color", name: "/color", desc: "Recolour objects", prompt: "Make the selected shapes " },
    { key: "note", name: "/note", desc: "Add a sticky note", prompt: "Add a sticky note saying " },
    { key: "flowchart", name: "/flowchart", desc: "A new flowchart from a description", prompt: "A flowchart of " },
    { key: "mindmap", name: "/mindmap", desc: "A new mind map around a topic", prompt: "A mind map of " },
    { key: "sketch", name: "/sketch", desc: "A freehand drawing", prompt: "Sketch " },
];

export const suggestionsFor = ({ boardHasContent, selectionCount }) => {
    if (selectionCount > 0) {
        return ["Turn the selected objects into a clean flowchart", "Clean up my hand-drawn shapes", "What does this part of the board say?"];
    }
    if (boardHasContent) {
        return ["Summarise what's on this board", "Tidy everything into a clean top-down layout", "What can you help me with?"];
    }
    return ["A user sign-up flow with email verification", "A mind map for a product launch", "What can you help me with?"];
};

// No response at all is a network failure or the free-tier backend still waking up past the 10s timeout.
export const describeRequestFailure = (error, fallback) => {
    if (error.response) return error.response.data?.message || fallback;
    if (error.code === "ECONNABORTED") return "That took too long and was stopped. Your board hasn't changed, so it's safe to try again.";
    return "The server may be waking up from sleep (up to a minute on the free tier). Please try again shortly.";
};

export const isAbort = (error) => error?.name === "CanceledError" || error?.code === "ERR_CANCELED";

// Laid out exactly as placing it will lay it out, in the style chosen for it.
export const buildPreviewElements = (message, style = message.style) => previewElementsFor(diagramOf(message), recipeOf(style));

// Threads saved before sketches had named parts hold one flat list of strokes.
export const sketchPartsOf = ({ parts, strokes }) =>
    parts ?? (strokes?.length ? [{ name: "sketch", fill: null, strokes: strokes.map((stroke) => ({ ...stroke, smooth: true })) }] : null);

export const buildSketchPreviewElements = (parts) => {
    let n = 0;
    return Object.fromEntries(
        buildElementsFromSketch({ parts, targetCenterX: 0, targetCenterY: 0, color: "#000000", zIndexBase: 0, generateElementId: () => `preview-${n++}` }).map(
            ({ elementId, element }) => [elementId, element],
        ),
    );
};

export const readAutoApply = () => {
    try {
        return window.localStorage.getItem(AUTO_APPLY_STORAGE_KEY) === "true";
    } catch {
        return false;
    }
};

export const HeaderButton = ({ label, onClick, children, pressed }) => (
    <button
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={pressed}
        onClick={onClick}
        className="flex size-7 shrink-0 items-center justify-center rounded-[7px] text-ink-3 transition-colors duration-100 hover:bg-hover hover:text-ink"
    >
        {children}
    </button>
);

export const iconProps = { width: 16, height: 16, strokeWidth: 1.8, "aria-hidden": true };
