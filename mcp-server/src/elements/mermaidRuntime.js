import dagre from "dagre";
import { JSDOM } from "jsdom";
import { provideDagre } from "../../../shared/canvas/layoutEngine.js";

provideDagre(dagre);

let loading = null;

// Mermaid's DOMPurify binds to a window on first import, so jsdom stands in during the import only.
export const loadMermaid = () => {
    loading ??= (async () => {
        const { window } = new JSDOM("");
        const browserGlobals = { window, document: window.document, DOMParser: window.DOMParser, Element: window.Element };
        const absent = Object.keys(browserGlobals).filter((key) => !(key in globalThis));
        Object.assign(globalThis, Object.fromEntries(absent.map((key) => [key, browserGlobals[key]])));
        try {
            const { default: mermaid } = await import("mermaid");
            mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
            return mermaid;
        } finally {
            absent.forEach((key) => delete globalThis[key]);
        }
    })();
    return loading;
};
