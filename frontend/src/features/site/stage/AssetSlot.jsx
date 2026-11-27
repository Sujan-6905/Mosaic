import { useCallback, useEffect, useRef, useState } from "react";
import { useStage } from "./context";

// An empty layout box claiming a rectangle of the shared 3D canvas; models load once it nears the viewport.
// A clickable slot's hit target is the model's projected bounds, and there is none until they're known.

// Models with no bounds to measure: no WebGL, or a load that failed: fall
// back to the middle of the slot, which is where every fallback draws itself.
const FALLBACK_HIT = { left: 0.22, top: 0.12, width: 0.56, height: 0.76 };

export default function AssetSlot({
    kind,
    className,
    fallback = null,
    eager = false,
    onAsset,
    onClick,
    hitClassName,
    hitLabel,
    "data-cursor": cursorWord,
    children,
    ...rest
}) {
    const { controller, unavailable } = useStage();
    const element = useRef(null);
    const asset = useRef(null);
    const [near, setNear] = useState(eager);
    const [hit, setHit] = useState(null);
    const report = useRef(onAsset);
    report.current = onAsset;

    const measure = useCallback(() => {
        const box = element.current?.getBoundingClientRect();
        if (!asset.current || !box?.height) {
            setHit(null);
            return;
        }
        setHit(asset.current.footprint?.(box.width / box.height) || null);
    }, []);

    useEffect(() => {
        if (near) return undefined;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return;
                setNear(true);
                observer.disconnect();
            },
            { rootMargin: "80% 0px" },
        );
        observer.observe(element.current);
        return () => observer.disconnect();
    }, [near]);

    useEffect(() => {
        if (!controller || !near) return undefined;
        let handle = null;
        let cancelled = false;

        controller
            .mount(kind, element.current)
            .then((mounted) => {
                if (cancelled) {
                    mounted.release();
                    return;
                }
                handle = mounted;
                asset.current = mounted.asset;
                report.current?.(mounted.asset);
                measure();
            })
            .catch(() => {
                if (cancelled) return;
                report.current?.(null);
                setHit(FALLBACK_HIT);
            });

        return () => {
            cancelled = true;
            handle?.release();
            asset.current = null;
            setHit(null);
            report.current?.(null);
        };
    }, [controller, near, kind, measure]);

    // The slot's own aspect ratio decides how much of it the model covers, so
    // the hit area is only valid for the size it was measured at.
    useEffect(() => {
        if (!onClick) return undefined;
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [onClick, measure]);

    const box = unavailable ? FALLBACK_HIT : hit;

    return (
        <div ref={element} className={className} {...rest}>
            {unavailable ? fallback : null}
            {children}
            {onClick && box && (
                <button
                    type="button"
                    className={hitClassName}
                    style={{
                        left: `${box.left * 100}%`,
                        top: `${box.top * 100}%`,
                        width: `${box.width * 100}%`,
                        height: `${box.height * 100}%`,
                    }}
                    onClick={(event) => {
                        // Keyboard activation (Enter/Space) reports detail 0; a real
                        // pointer click should not leave a focus ring behind.
                        if (event.detail !== 0) event.currentTarget.blur();
                        onClick(event);
                    }}
                    aria-label={hitLabel}
                    data-cursor={cursorWord}
                />
            )}
        </div>
    );
}
