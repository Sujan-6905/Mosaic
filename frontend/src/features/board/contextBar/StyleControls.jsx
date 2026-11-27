import Popover from "@/components/ui/Popover";
import Slider from "@/components/ui/Slider";
import StrokeIcon from "@/components/ui/StrokeIcon";
import { DEFAULT_DRAW_STYLE } from "../tools/toolSettings";
import { BarButton } from "./popovers";
import styles from "./index.module.css";
import controls from "./controls.module.css";

const STROKE_PRESETS = [
    { label: "Thin", size: 2 },
    { label: "Medium", size: 4 },
    { label: "Thick", size: 8 },
    { label: "Extra", size: 16 },
];
const strokeLabel = (size) => [...STROKE_PRESETS].reverse().find((preset) => size >= preset.size)?.label || "Thin";
export { STROKE_PRESETS };

const DASHES = [
    { value: "solid", label: "Solid", dash: undefined },
    { value: "dashed", label: "Dashed", dash: "6 4" },
    { value: "dotted", label: "Dotted", dash: "1 4" },
];
const FILLS = [
    { value: "solid", label: "Solid" },
    { value: "hachure", label: "Hatch" },
    { value: "crosshatch", label: "Cross" },
    { value: "dots", label: "Dots" },
];
// How steady the hand that draws a line is, from a ruler to a wild scrawl.
const HANDS = [
    { value: 0, label: "Ruled" },
    { value: 0.7, label: "Steady" },
    { value: 1.6, label: "Loose" },
    { value: 2.8, label: "Wild" },
];
const nearestHand = (roughness) =>
    HANDS.reduce((best, hand) => (Math.abs(hand.value - (roughness || 0)) < Math.abs(best.value - (roughness || 0)) ? hand : best)).value;

const HandSample = ({ value }) => {
    const wobble = value * 1.6;
    const d = `M2 7 C7 ${7 - wobble} 11 ${7 + wobble} 15 7 S24 ${7 - wobble} 28 7`;
    return (
        <svg width="30" height="14" viewBox="0 0 30 14" aria-hidden="true">
            <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            {value >= 1.6 && (
                <path
                    d={`M2 8 C8 ${8 + wobble} 12 ${8 - wobble} 16 8 S25 ${8 + wobble} 28 7.5`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                />
            )}
        </svg>
    );
};

const PRESSURES = [
    { value: 0, label: "Even" },
    { value: 0.4, label: "Light" },
    { value: 0.75, label: "Deep" },
];
const STEADYING = [
    { value: 0.25, label: "Raw" },
    { value: 0.55, label: "Steady" },
    { value: 0.85, label: "Silky" },
];
const MAX_CORNER_RADIUS = 60;

const FillSample = ({ kind }) => (
    <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true">
        <rect x="1" y="1" width="24" height="16" rx="3" fill={kind === "solid" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1" />
        {kind === "hachure" && <path d="M3 15L15 3M9 15L21 3M15 15L24 6" stroke="currentColor" strokeWidth="1" />}
        {kind === "crosshatch" && <path d="M3 15L15 3M9 15L21 3M15 15L24 6M3 3L15 15M9 3L21 15M15 3L24 12" stroke="currentColor" strokeWidth="0.8" />}
        {kind === "dots" && [6, 13, 20].flatMap((x) => [6, 12].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill="currentColor" />))}
    </svg>
);

const Segments = ({ label, options, value, onChange, renderOption }) => (
    <div className={controls.styleRow}>
        <span className={controls.styleLabel}>{label}</span>
        <div className={controls.segments} role="radiogroup" aria-label={label}>
            {options.map((option) => (
                <button
                    key={option.label}
                    type="button"
                    role="radio"
                    aria-checked={value === option.value}
                    aria-label={option.label}
                    title={option.label}
                    onClick={() => onChange(option.value)}
                >
                    {renderOption ? renderOption(option) : option.label}
                </button>
            ))}
        </div>
    </div>
);

// Everything about how a stroke and its fill look, in one place.
export function StylePopover({ size, max, style, canFill, canRound, canSketch, canPress, opacity, onSize, onStyle, onOpacity }) {
    return (
        <Popover
            align="start"
            trigger={
                <BarButton label={`Stroke width: ${size}`} wide>
                    {strokeLabel(size)}
                    <StrokeIcon name="chevronDown" size={10} strokeWidth={3} />
                </BarButton>
            }
        >
            <div className={`${styles.pop} ${controls.stylePop}`}>
                <div className={styles.presets} role="radiogroup" aria-label="Stroke width">
                    {STROKE_PRESETS.filter((preset) => preset.size <= max).map((preset) => (
                        <button key={preset.label} type="button" role="radio" aria-checked={size === preset.size} onClick={() => onSize(preset.size)}>
                            <span className={styles.strokeSample} style={{ height: Math.max(1, Math.min(preset.size, 10)) }} />
                            {preset.label}
                        </button>
                    ))}
                </div>
                <label className={styles.sliderRow}>
                    <span className={styles.sliderHead}>
                        Width <span>{size} px</span>
                    </span>
                    <Slider
                        value={[size]}
                        onValueChange={([next]) => onSize(next, { transient: true })}
                        onValueCommit={([next]) => onSize(next)}
                        min={1}
                        max={max}
                        aria-label="Stroke width"
                    />
                </label>
                {onStyle && !canPress && (
                    <Segments
                        label="Line"
                        options={DASHES}
                        value={style.strokeStyle || "solid"}
                        onChange={(strokeStyle) => onStyle({ strokeStyle })}
                        renderOption={(option) => (
                            <svg width="30" height="10" viewBox="0 0 30 10" aria-hidden="true">
                                <path d="M2 5H28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={option.dash} />
                            </svg>
                        )}
                    />
                )}
                {onStyle && canFill && (
                    <Segments
                        label="Fill"
                        options={FILLS}
                        value={style.fillStyle || "solid"}
                        onChange={(fillStyle) => onStyle({ fillStyle })}
                        renderOption={(option) => <FillSample kind={option.value} />}
                    />
                )}
                {onStyle && canRound && (
                    <label className={styles.sliderRow}>
                        <span className={styles.sliderHead}>
                            Curved edges <span>{style.cornerRadius || 0} px</span>
                        </span>
                        <Slider
                            value={[Math.min(style.cornerRadius || 0, MAX_CORNER_RADIUS)]}
                            onValueChange={([cornerRadius]) => onStyle({ cornerRadius }, { transient: true })}
                            onValueCommit={([cornerRadius]) => onStyle({ cornerRadius })}
                            min={0}
                            max={MAX_CORNER_RADIUS}
                            aria-label="Curved edges"
                        />
                    </label>
                )}
                {onStyle && canSketch && (
                    <Segments
                        label="Hand"
                        options={HANDS}
                        value={nearestHand(style.roughness)}
                        onChange={(roughness) => onStyle({ roughness })}
                        renderOption={(option) => <HandSample value={option.value} />}
                    />
                )}
                {onStyle && canPress && (
                    <Segments
                        label="Pressure"
                        options={PRESSURES}
                        value={style.pressure ?? DEFAULT_DRAW_STYLE.pressure}
                        onChange={(pressure) => onStyle({ pressure })}
                    />
                )}
                {onStyle && canPress && (
                    <Segments
                        label="Steadying"
                        options={STEADYING}
                        value={style.steadying ?? DEFAULT_DRAW_STYLE.steadying}
                        onChange={(steadying) => onStyle({ steadying })}
                    />
                )}
                {opacity != null && onOpacity && (
                    <label className={styles.sliderRow}>
                        <span className={styles.sliderHead}>
                            Opacity <span>{opacity}%</span>
                        </span>
                        <Slider
                            value={[opacity]}
                            onValueChange={([next]) => onOpacity(next, { transient: true })}
                            onValueCommit={([next]) => onOpacity(next)}
                            min={1}
                            max={100}
                            aria-label="Opacity"
                        />
                    </label>
                )}
                <p className={styles.hint}>
                    <kbd>[</kbd> and <kbd>]</kbd> step the width from the keyboard
                </p>
            </div>
        </Popover>
    );
}
