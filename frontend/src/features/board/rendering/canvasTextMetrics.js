// Measures with a real canvas and the same wrap as text rendering, so diagram nodes fit their labels.
import { wrapTextForRender } from "../text/textWrap";
import { estimatedTextMetrics } from "../diagrams/layoutEngine";

let context = null;
const getContext = () => {
    if (!context && typeof document !== "undefined") context = document.createElement("canvas").getContext("2d");
    return context;
};

export const createCanvasTextMetrics = (fontFamily) => {
    const measure = getContext();
    if (!measure) return estimatedTextMetrics;
    const setFont = (fontSize) => {
        measure.font = `${fontSize}px ${fontFamily}`;
    };
    return {
        textWidth: (text, fontSize) => {
            setFont(fontSize);
            return Math.max(...(text || " ").split("\n").map((line) => measure.measureText(line).width));
        },
        lineCount: (text, width, fontSize) => {
            setFont(fontSize);
            return Math.max(1, wrapTextForRender(measure, text || "", width).length);
        },
    };
};
