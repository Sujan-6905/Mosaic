import Popover from "@/components/ui/Popover";
import StrokeIcon from "@/components/ui/StrokeIcon";
import { ARROWHEADS, withConnectorHeads } from "../../../../../shared/canvas/elements/connectors";
import { BarButton } from "./popovers";
import styles from "./index.module.css";
import controls from "./controls.module.css";

const ROUTINGS = [
    { value: "straight", label: "Straight line", icon: "routeStraight" },
    { value: "curved", label: "Curved line", icon: "routeCurved" },
    { value: "elbow", label: "Elbow line", icon: "routeElbow" },
];
const HEAD_LABELS = {
    none: "None",
    arrow: "Open arrow",
    triangle: "Triangle",
    triangle_outline: "Hollow triangle",
    diamond: "Diamond",
    diamond_outline: "Hollow diamond",
    dot: "Dot",
    circle_outline: "Hollow circle",
    bar: "Bar",
    crowfoot_one: "One",
    crowfoot_many: "Many",
    crowfoot_one_many: "One or many",
};

// Each head drawn pointing right at x=30, so `flip` shows it for the line's start.
const HeadGlyph = ({ kind, flip }) => {
    const shapes = {
        arrow: <path d="M22 4l8 6-8 6" fill="none" />,
        triangle: <path d="M30 10l-9-6v12z" fill="currentColor" />,
        triangle_outline: <path d="M30 10l-9-6v12z" fill="var(--color-bg-surface)" />,
        diamond: <path d="M30 10l-6-4-6 4 6 4z" fill="currentColor" />,
        diamond_outline: <path d="M30 10l-6-4-6 4 6 4z" fill="var(--color-bg-surface)" />,
        dot: <circle cx="26" cy="10" r="3.500" fill="currentColor" />,
        circle_outline: <circle cx="26" cy="10" r="3.500" fill="var(--color-bg-surface)" />,
        bar: <path d="M30 4v12" />,
        crowfoot_one: <path d="M25 4v12" />,
        crowfoot_many: <path d="M22 10l8-6M22 10l8 6M22 10h8" />,
        crowfoot_one_many: <path d="M22 10l8-6M22 10l8 6M19 4v12" />,
    };
    return (
        <svg
            width="34"
            height="20"
            viewBox="0 0 32 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.600"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={flip ? { transform: "scaleX(-1)" } : undefined}
        >
            <path d={kind === "none" ? "M2 10h28" : "M2 10h20"} />
            {shapes[kind]}
        </svg>
    );
};

const HeadPicker = ({ end, value, onPick }) => (
    <Popover
        align="start"
        trigger={
            <BarButton label={`${end === "start" ? "Start" : "End"} of line: ${HEAD_LABELS[value]}`} wide>
                <HeadGlyph kind={value} flip={end === "start"} />
                <StrokeIcon name="chevronDown" size={10} strokeWidth={3} />
            </BarButton>
        }
    >
        <div className={styles.pop}>
            <p className={styles.menuHeading}>{end === "start" ? "Line start" : "Line end"}</p>
            <div className={controls.headGrid} role="radiogroup" aria-label={end === "start" ? "Line start" : "Line end"}>
                {ARROWHEADS.map((kind) => (
                    <button
                        key={kind}
                        type="button"
                        role="radio"
                        aria-checked={value === kind}
                        aria-label={HEAD_LABELS[kind]}
                        title={HEAD_LABELS[kind]}
                        onClick={() => onPick(kind)}
                    >
                        <HeadGlyph kind={kind} flip={end === "start"} />
                    </button>
                ))}
            </div>
        </div>
    </Popover>
);

// How an arrow gets from one end to the other, and what each end looks like.
export default function ArrowControls({ routing, startHead, endHead, onChange }) {
    const set = (patch) => onChange(withConnectorHeads(patch));
    return (
        <>
            <div className={controls.routeGroup} role="radiogroup" aria-label="Line path">
                {ROUTINGS.map((route) => (
                    <BarButton
                        key={route.value}
                        label={route.label}
                        role="radio"
                        aria-checked={routing === route.value}
                        pressed={routing === route.value}
                        onClick={() =>
                            onChange(
                                route.value === "straight" || route.value === "curved" ? { routing: route.value } : { routing: route.value, waypoints: null },
                            )
                        }
                    >
                        <StrokeIcon name={route.icon} size={15} />
                    </BarButton>
                ))}
            </div>
            <span className={styles.rule} aria-hidden="true" />
            <HeadPicker end="start" value={startHead} onPick={(startHead_) => set({ startHead: startHead_ })} />
            <BarButton label="Swap line ends" onClick={() => set({ startHead: endHead, endHead: startHead })}>
                <StrokeIcon name="swap" size={14} />
            </BarButton>
            <HeadPicker end="end" value={endHead} onPick={(endHead_) => set({ endHead: endHead_ })} />
        </>
    );
}
