import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { TOUR_TRACKS } from "./tourSteps";
import { findNextVisibleStepIndex, findPreviousVisibleStepIndex, placeCallout } from "./tourNavigation";
import styles from "./TourOverlay.module.css";

const TARGET_PADDING = 6;
const SURFACE_WAIT_MS = 2500;
const TRACK_INTERVAL_MS = 150;
const FALLBACK_CALLOUT = { width: 380, height: 240 };

const isTyping = (target) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA"].includes(target.tagName));

// The dim layer ignores pointer events, so a "try it" step can really be tried. A step with a `surface` opens
// that code-split panel and waits for its anchor; a step whose anchor never appears is skipped.
const TourOverlay = ({ trackId, onFinish, onSurfaceChange }) => {
    const steps = useMemo(() => TOUR_TRACKS[trackId]?.steps || [], [trackId]);
    const [index, setIndex] = useState(-1);
    const [rect, setRect] = useState(null);
    const [calloutSize, setCalloutSize] = useState(FALLBACK_CALLOUT);
    const directionRef = useRef(1);
    const calloutRef = useRef(null);

    const isReachable = useCallback((step) => Boolean(step.surface) || Boolean(document.querySelector(step.target)), []);

    // Keyed on trackId alone: steps and onFinish get new identities every render and must not restart the tour.
    useEffect(() => {
        const start = findNextVisibleStepIndex(steps, 0, isReachable);
        if (start === -1) {
            onFinish();
            return;
        }
        directionRef.current = 1;
        setIndex(start);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trackId]);

    const goNext = useCallback(() => {
        directionRef.current = 1;
        const next = findNextVisibleStepIndex(steps, index + 1, isReachable);
        if (next === -1) onFinish();
        else setIndex(next);
    }, [steps, index, onFinish, isReachable]);

    const goBack = useCallback(() => {
        directionRef.current = -1;
        const previous = findPreviousVisibleStepIndex(steps, index - 1, isReachable);
        if (previous !== -1) setIndex(previous);
    }, [steps, index, isReachable]);

    const step = steps[index];

    useEffect(() => {
        if (step) onSurfaceChange?.(step.surface ?? null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);

    // Kept polling rather than measured once, because the target can be mid-way
    // through a panel's entrance animation or inside a list that is still loading.
    useEffect(() => {
        if (!step) return undefined;
        const startedAt = Date.now();
        let scrolled = false;
        const measure = () => {
            const element = document.querySelector(step.target);
            if (!element) {
                setRect(null);
                if (Date.now() - startedAt < SURFACE_WAIT_MS) return;
                if (directionRef.current > 0) goNext();
                else goBack();
                return;
            }
            if (!scrolled) {
                element.scrollIntoView?.({ block: "nearest" });
                scrolled = true;
            }
            const next = element.getBoundingClientRect();
            setRect((current) =>
                current && current.top === next.top && current.left === next.left && current.width === next.width && current.height === next.height
                    ? current
                    : next,
            );
        };
        measure();
        const timer = setInterval(measure, TRACK_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [step, goNext, goBack]);

    useLayoutEffect(() => {
        const element = calloutRef.current;
        if (element) setCalloutSize({ width: element.offsetWidth, height: element.offsetHeight });
    }, [step]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === "Escape") onFinish();
            else if (isTyping(event.target)) return;
            else if (event.key === "ArrowRight") goNext();
            else if (event.key === "ArrowLeft") goBack();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [goNext, goBack, onFinish]);

    if (!step) return null;

    const ring = rect && {
        top: rect.top - TARGET_PADDING,
        left: rect.left - TARGET_PADDING,
        width: rect.width + TARGET_PADDING * 2,
        height: rect.height + TARGET_PADDING * 2,
    };
    const calloutStyle = rect
        ? placeCallout(
              { top: ring.top, left: ring.left, right: ring.left + ring.width, bottom: ring.top + ring.height, width: ring.width, height: ring.height },
              calloutSize,
              { width: window.innerWidth, height: window.innerHeight },
          )
        : { top: 24, left: 24 };

    return (
        <div className={styles.root}>
            {ring ? <div className={styles.highlightRing} style={ring} /> : <div className={styles.dimAll} />}
            <div ref={calloutRef} className={styles.callout} style={calloutStyle}>
                <span className={styles.calloutHeader}>
                    {TOUR_TRACKS[trackId].label}
                    <span className={styles.stepCount}>
                        {index + 1} of {steps.length}
                    </span>
                </span>
                <div key={step.id} className={styles.calloutCopy}>
                    <h2 className={styles.calloutTitle}>{step.title}</h2>
                    <p className={styles.calloutBody}>{step.body}</p>
                    {step.tryIt && (
                        <p className={styles.tryIt}>
                            <strong>Try it</strong> {step.tryIt}
                        </p>
                    )}
                </div>
                <div className={styles.calloutFooter}>
                    <span className={styles.dots} aria-hidden="true">
                        <span className={styles.dotsFill} style={{ transform: `scaleX(${(index + 1) / steps.length})` }} />
                    </span>
                    <button type="button" className={styles.skip} onClick={onFinish}>
                        Skip
                    </button>
                    <button type="button" className={styles.navButton} disabled={index === 0} onClick={goBack}>
                        Back
                    </button>
                    <button type="button" className={styles.navButtonPrimary} onClick={goNext}>
                        {index === steps.length - 1 ? "Done" : "Next"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TourOverlay;
