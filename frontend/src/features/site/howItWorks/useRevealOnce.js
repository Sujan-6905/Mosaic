import { useEffect, useRef, useState } from "react";
import { isCalm } from "@/lib/calmMode";

// "static" until mounted, so server-rendered and reduced-motion pages show the
// finished state. "armed" hides what is about to animate, "in" plays it.
export function useRevealOnce(threshold = 0.12) {
    const ref = useRef(null);
    const [state, setState] = useState("static");

    useEffect(() => {
        if (isCalm() || !ref.current) return undefined;
        setState("armed");
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return;
                setState("in");
                observer.disconnect();
            },
            { threshold },
        );
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [threshold]);

    return [ref, state];
}

const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

// The number on screen climbing to its real value. Shows the real value outright
// until a reveal starts, so nothing but the animation ever displays a partial one.
export function useCountUp(target, state, durationMs, decimals = 0) {
    const [value, setValue] = useState(target);

    useEffect(() => {
        if (state === "static") return undefined;
        if (state === "armed") {
            setValue(0);
            return undefined;
        }
        let frame = 0;
        const startedAt = performance.now();
        const tick = (now) => {
            const progress = Math.min(1, (now - startedAt) / durationMs);
            setValue(Number((target * easeOutExpo(progress)).toFixed(decimals)));
            if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [target, state, durationMs, decimals]);

    return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
