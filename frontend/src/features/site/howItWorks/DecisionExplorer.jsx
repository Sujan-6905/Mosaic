import { useLayoutEffect, useRef, useState } from "react";
import { DECISIONS } from "../siteContent";
import LiveDiagram from "./LiveDiagram";
import styles from "./DecisionExplorer.module.css";

const HOVER_INTENT_MS = 90;

// The design decisions as tabs, each with its diagram as a live board beside the explanation.
export default function DecisionExplorer({ onSignIn }) {
    const [activeId, setActiveId] = useState(DECISIONS[0].id);
    const [direction, setDirection] = useState(1);
    const [indicator, setIndicator] = useState(null);
    const tabRefs = useRef({});
    const hoverTimer = useRef(null);
    const activeIndex = DECISIONS.findIndex((decision) => decision.id === activeId);
    const active = DECISIONS[activeIndex];

    const choose = (id) => {
        clearTimeout(hoverTimer.current);
        const nextIndex = DECISIONS.findIndex((decision) => decision.id === id);
        setDirection(nextIndex >= activeIndex ? 1 : -1);
        setActiveId(id);
    };

    useLayoutEffect(() => {
        const measure = () => {
            const tab = tabRefs.current[activeId];
            if (tab) setIndicator({ x: tab.offsetLeft, y: tab.offsetTop, width: tab.offsetWidth, height: tab.offsetHeight });
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [activeId]);

    const handleTabKey = (event, index) => {
        const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const next = DECISIONS[(index + step + DECISIONS.length) % DECISIONS.length];
        choose(next.id);
        document.getElementById(`decision-${next.id}`)?.focus();
    };

    return (
        <div className={styles.explorer}>
            <div className={styles.tabs} role="tablist" aria-orientation="vertical" aria-label="Decisions">
                {indicator && (
                    <span
                        className={styles.tabIndicator}
                        aria-hidden="true"
                        style={{ width: indicator.width, height: indicator.height, transform: `translate3d(${indicator.x}px, ${indicator.y}px, 0)` }}
                    />
                )}
                {DECISIONS.map((decision, index) => (
                    <button
                        key={decision.id}
                        ref={(element) => {
                            tabRefs.current[decision.id] = element;
                        }}
                        id={`decision-${decision.id}`}
                        type="button"
                        role="tab"
                        className={styles.tab}
                        aria-selected={decision.id === activeId}
                        aria-controls="decision-panel"
                        tabIndex={decision.id === activeId ? 0 : -1}
                        onClick={() => choose(decision.id)}
                        onPointerEnter={(event) => {
                            if (event.pointerType !== "mouse") return;
                            clearTimeout(hoverTimer.current);
                            hoverTimer.current = setTimeout(() => choose(decision.id), HOVER_INTENT_MS);
                        }}
                        onPointerLeave={() => clearTimeout(hoverTimer.current)}
                        onKeyDown={(event) => handleTabKey(event, index)}
                    >
                        <span className={styles.tabKicker}>{decision.kicker}</span>
                        <span className={styles.tabTitle}>{decision.title}</span>
                    </button>
                ))}
            </div>
            <div id="decision-panel" role="tabpanel" aria-labelledby={`decision-${active.id}`} className={styles.panel}>
                <div className={styles.diagram}>
                    <LiveDiagram key={active.id} id={active.id} title={active.title} onSignIn={onSignIn} />
                </div>
                <div key={active.id} className={styles.panelText} data-direction={direction}>
                    <span className={styles.badge}>{active.kicker}</span>
                    <h3 className={styles.panelTitle}>{active.title}</h3>
                    <p className={styles.panelBody}>{active.body}</p>
                </div>
            </div>
        </div>
    );
}
