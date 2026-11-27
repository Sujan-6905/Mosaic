import { useMemo, useState } from "react";
import RecommendationCard from "@/components/vendor/beautifulUi/primitives/RecommendationCard";
import { ValuePill } from "@/components/vendor/beautifulUi/atoms/ValuePill";
import StaticCanvasPreview from "../rendering/StaticCanvasPreview.jsx";
import { diagramOf, lookFor, previewElementsFor, rankStructures, structureFor } from "../diagrams/diagramStyles";

const PREVIEW_WIDTH = 340;
const PREVIEW_HEIGHT = 190;
const MAX_OPTIONS = 4;
const SIGNAL_TONES = ["var(--green)", "var(--orange)", "var(--ink-3)", "var(--ink-3)"];

const keyOf = (style) => `${style.structure}:${style.look}`;

// The assistant's own shortlist when it wasn't sure; otherwise its pick plus
// the structures that fit this content next best, in the same look.
const candidatesFor = (message) => {
    const { style } = message;
    if (style.choices?.length > 1) return style.choices.slice(0, MAX_OPTIONS);
    const others = rankStructures("", diagramOf(message), MAX_OPTIONS + 1)
        .filter((structure) => structure !== style.structure)
        .map((structure) => ({ structure, look: style.look, why: structureFor(structure).bestFor }));
    return [{ structure: style.structure, look: style.look, why: style.why ?? structureFor(style.structure).bestFor }, ...others].slice(0, MAX_OPTIONS);
};

function StylePreview({ message, style }) {
    const elements = useMemo(() => previewElementsFor(diagramOf(message), style), [message, style]);
    return (
        <span className="block overflow-hidden rounded-control bg-inset">
            <StaticCanvasPreview
                elements={elements}
                background={{ type: "blank", colorToken: null }}
                width={PREVIEW_WIDTH}
                height={PREVIEW_HEIGHT}
                className="block h-auto w-full"
            />
        </span>
    );
}

const optionFor = (message, candidate, index) => ({
    key: keyOf(candidate),
    body: (
        <span className="flex flex-col gap-2">
            <StylePreview message={message} style={candidate} />
            <span className="flex flex-wrap items-center gap-1.5">
                <ValuePill>{structureFor(candidate.structure).name}</ValuePill>
                <ValuePill tone="accent">{lookFor(candidate.look).name}</ValuePill>
            </span>
            {candidate.why && <span className="text-[12.5px] text-ink-2">{candidate.why}</span>}
        </span>
    ),
    short: `${structureFor(candidate.structure).name} in ${lookFor(candidate.look).name}`,
    signal: Math.max(0, 3 - index),
    tone: SIGNAL_TONES[index] ?? "var(--ink-3)",
    label: index === 0 ? "Best fit" : "Close match",
    cta: "Use this style",
    ctaVariant: index === 0 ? "accent" : "primary",
});

// When the assistant couldn't choose between close candidates, the style choice is open from the start.
export default function DiagramStyleCard({ message, chosen, onChoose }) {
    const undecided = !message.style.certain && message.style.choices?.length > 1 && !chosen;
    const [browsing, setBrowsing] = useState(false);
    const current = chosen ?? message.style;
    const candidates = useMemo(() => candidatesFor(message), [message]);
    const options = useMemo(() => candidates.map((candidate, index) => optionFor(message, candidate, index)), [message, candidates]);

    if (undecided || browsing) {
        return (
            <div className="mt-3">
                <RecommendationCard
                    options={options}
                    labels={{ title: undecided ? "Which style fits best?" : "Try another style", accepted: "Chosen" }}
                    acceptedKey={chosen ? keyOf(chosen) : null}
                    onAccept={(option) => {
                        const picked = candidates.find((candidate) => keyOf(candidate) === option.key);
                        setBrowsing(false);
                        onChoose(picked);
                    }}
                />
            </div>
        );
    }
    return (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <ValuePill>{structureFor(current.structure).name}</ValuePill>
            <ValuePill tone="accent">{lookFor(current.look).name}</ValuePill>
            <button
                type="button"
                onClick={() => setBrowsing(true)}
                className="inline-flex min-h-8 cursor-pointer items-center rounded-full px-2.5 text-[12.5px] font-medium text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink"
            >
                Try another style
            </button>
        </div>
    );
}
