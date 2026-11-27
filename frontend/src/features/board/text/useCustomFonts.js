import { useEffect, useRef } from "react";
import { familyOf, loadFontSource } from "../rendering/fontLoader";

// Loads the fonts the board's text uses. Text measured before its font arrived is re-issued as a fresh
// object, which drops its caches, and the board repaints.
export const useCustomFonts = (board) => {
    const { elements, requestStaticFullRepaint, setElements } = board;
    const requestedUrlsRef = useRef(new Set());

    useEffect(() => {
        const requested = requestedUrlsRef.current;
        for (const id in elements) {
            const element = elements[id];
            const source = element?.fontSource;
            if (!source?.url || requested.has(source.url)) continue;
            requested.add(source.url);
            const family = familyOf(element.fontFamily);
            loadFontSource(family, source)
                .then(() => {
                    setElements((prev) => {
                        const next = { ...prev };
                        for (const key in next) {
                            if (next[key]?.fontSource?.url === source.url) next[key] = { ...next[key] };
                        }
                        requestStaticFullRepaint(next);
                        return next;
                    });
                })
                .catch((error) => console.error(`Board font "${family}" failed to load:`, error.message));
        }
    }, [elements, requestStaticFullRepaint, setElements]);
};
