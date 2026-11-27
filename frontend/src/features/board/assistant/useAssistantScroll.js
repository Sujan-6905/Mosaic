import { useCallback, useEffect, useRef, useState } from "react";

// The thread follows new content while the reader is at the bottom, and the composer's height is tracked
// so the thread can leave room for it.
export default function useAssistantScroll({ isOpen, activeId, loading, threadIsEmpty }) {
    const [pinned, setPinned] = useState(true);
    const [composerHeight, setComposerHeight] = useState(120);
    const stickRef = useRef(true);
    const scrollRef = useRef(null);
    const contentRef = useRef(null);
    const composerRef = useRef(null);

    // Keep the newest content in view while the reader is at the bottom;
    // scrolling up to re-read releases the pin until they come back down.
    useEffect(() => {
        const el = scrollRef.current;
        const content = contentRef.current;
        if (!el || !content) return undefined;
        let raf = 0;
        // Growth doesn't fire scroll events, so the flag only changes when
        // the reader (or a pin below) actually scrolls.
        const onScroll = () => {
            stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
            setPinned(stickRef.current);
        };
        const pin = () => {
            if (!stickRef.current) return;
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                el.scrollTop = el.scrollHeight;
            });
        };
        el.addEventListener("scroll", onScroll, { passive: true });
        const resize = new ResizeObserver(pin);
        resize.observe(content);
        return () => {
            el.removeEventListener("scroll", onScroll);
            resize.disconnect();
            cancelAnimationFrame(raf);
        };
    }, [isOpen, activeId]);

    useEffect(() => {
        const el = scrollRef.current;
        stickRef.current = true;
        if (el) el.scrollTop = el.scrollHeight;
    }, [activeId, loading]);

    useEffect(() => {
        const el = composerRef.current;
        if (!el) return undefined;
        const measure = () => setComposerHeight(el.offsetHeight);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, [isOpen, threadIsEmpty]);

    // Sending a message follows the reply even if the reader had scrolled up.
    const pinToBottom = useCallback(() => {
        stickRef.current = true;
        setPinned(true);
    }, []);

    return { scrollRef, contentRef, composerRef, composerHeight, pinned, pinToBottom };
}
