import { parseMermaidWith } from "../../../../../shared/canvas/mermaid/buildMermaidElements.js";
import "./layoutEngine";

let mermaidLoading = null;
const loadMermaid = () => {
    mermaidLoading ??= import("mermaid").then(({ default: mermaid }) => {
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
        return mermaid;
    });
    return mermaidLoading;
};

export const parseMermaid = async (text) => parseMermaidWith(await loadMermaid(), text);
