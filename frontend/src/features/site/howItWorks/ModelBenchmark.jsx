import { SOURCE_URL } from "../siteContent";
import { useCountUp, useRevealOnce } from "./useRevealOnce";
import cardStyles from "./HowItWorksNumbers.module.css";
import gridStyles from "./BenchmarkGrid.module.css";
import styles from "./ModelBenchmark.module.css";

// From benchmark/results/model-benchmark.md. Each model drew the same ten tasks through the assistant's first version
// (raw coordinates) and through today's; arrows are the connections drawn per diagram, drawn counts the tasks that
// produced something to place.
const MODELS = [
    { name: "Claude Opus", route: "Claude CLI", first: { arrows: 6.4, drawn: 10 }, today: { arrows: 8.0, drawn: 10 } },
    { name: "Claude Sonnet", route: "Claude CLI", first: { arrows: 6.8, drawn: 10 }, today: { arrows: 8.8, drawn: 10 } },
    { name: "Claude Haiku", route: "Claude CLI", first: { arrows: 7.4, drawn: 10 }, today: { arrows: 8.4, drawn: 10 } },
    { name: "Gemini 3.8 Flash (Antigravity)", route: "Antigravity CLI", first: { arrows: 6.6, drawn: 10 }, today: { arrows: 6.8, drawn: 10 } },
    { name: "Gemini 3.5 Flash Lite", route: "Gemini API", first: { arrows: 6.6, drawn: 10 }, today: { arrows: 6.8, drawn: 10 } },
    { name: "gpt-oss-120b", route: "Groq", first: { arrows: 6.6, drawn: 10 }, today: { arrows: 7.8, drawn: 10 } },
    { name: "gpt-oss-20b", route: "Groq", first: { arrows: 4.2, drawn: 9 }, today: { arrows: 6.8, drawn: 9 } },
    { name: "Qwen3.8 27B", route: "Groq", first: { arrows: 4.6, drawn: 9 }, today: { arrows: 7.2, drawn: 10 } },
    { name: "Mistral Large 4", route: "NVIDIA", first: { arrows: 6.2, drawn: 10 }, today: { arrows: 7.2, drawn: 10 } },
    { name: "Nemotron 3 Ultra", route: "NVIDIA", first: { arrows: 6.0, drawn: 10 }, today: { arrows: 8.0, drawn: 9 } },
    { name: "ERNIE 5.5 Flash", route: "OpenRouter", first: { arrows: 6.6, drawn: 10 }, today: { arrows: 8.2, drawn: 10 } },
];
const OVERALL = { firstArrows: 6.2, todayArrows: 7.7, firstOverlaps: 2, todayOverlaps: 0, firstValid: 99.1, todayValid: 100 };
const TASKS_PER_MODEL = 10;
const ARROW_SCALE = 10;
const GALLERY_URL = `${SOURCE_URL}/blob/main/benchmark/results/model-gallery.md`;

function HeadlineCard() {
    const [ref, reveal] = useRevealOnce();
    const arrows = useCountUp(OVERALL.todayArrows, reveal, 1200, 1);

    return (
        <article ref={ref} className={`${cardStyles.card} ${styles.headline}`} data-reveal={reveal}>
            <span className={cardStyles.cardLabel}>Connections drawn per diagram</span>
            <span className={cardStyles.cardHint}>Average over {MODELS.length} models, same prompts, same words</span>
            <div className={styles.jump}>
                <span className={styles.jumpFrom}>{OVERALL.firstArrows.toFixed(1)}</span>
                <span className={styles.jumpArrow} aria-hidden="true">
                    to
                </span>
                <strong className={`${cardStyles.stat} ${styles.jumpTo}`}>{arrows}</strong>
            </div>
            <p className={cardStyles.cardNote}>
                The model names the parts and how they connect; the layout engine places them. The smallest models gain the most, since placing boxes was where
                they lost the thread.
            </p>
            <dl className={styles.facts}>
                <div>
                    <dt>Elements the board accepts</dt>
                    <dd>
                        {OVERALL.firstValid}% to {OVERALL.todayValid}%
                    </dd>
                </div>
                <div>
                    <dt>Labels covering each other</dt>
                    <dd>
                        {OVERALL.firstOverlaps} to {OVERALL.todayOverlaps}
                    </dd>
                </div>
                <div>
                    <dt>Tokens a task</dt>
                    <dd>1.6 to 9 times</dd>
                </div>
            </dl>
        </article>
    );
}

function ModelsCard() {
    const [ref, reveal] = useRevealOnce();

    return (
        <article
            ref={ref}
            className={`${cardStyles.card} ${styles.models}`}
            data-reveal={reveal}
            tabIndex={0}
            aria-label="Every model, first version and today"
        >
            <div className={styles.modelsHead}>
                <span className={cardStyles.cardLabel}>Every model, first version and today</span>
                <span className={gridStyles.legend} aria-hidden="true">
                    <span>First version</span>
                    <span data-accent="true">Today</span>
                </span>
            </div>
            <span className={cardStyles.cardHint}>Connections per diagram, and how many of the ten came back drawn.</span>
            <ol className={styles.rows}>
                {MODELS.map((model) => (
                    <li
                        key={model.name}
                        className={styles.row}
                        aria-label={`${model.name} through ${model.route}: ${model.first.arrows} connections per diagram at first, ${model.today.arrows} today; ${model.first.drawn} of ${TASKS_PER_MODEL} drawn at first, ${model.today.drawn} of ${TASKS_PER_MODEL} today`}
                    >
                        <span className={styles.modelName}>
                            {model.name}
                            <span className={styles.route}>{model.route}</span>
                        </span>
                        <span className={styles.rowBars} aria-hidden="true">
                            {["first", "today"].map((version) => (
                                <span key={version} className={styles.barLine}>
                                    <span className={styles.bar} data-version={version} style={{ width: `${(model[version].arrows / ARROW_SCALE) * 100}%` }} />
                                    <span className={styles.barValue}>{model[version].arrows.toFixed(1)}</span>
                                </span>
                            ))}
                        </span>
                        <span className={styles.drawn} data-short={model.today.drawn < TASKS_PER_MODEL} aria-hidden="true">
                            {model.today.drawn}/{TASKS_PER_MODEL}
                        </span>
                    </li>
                ))}
            </ol>
        </article>
    );
}

export default function ModelBenchmark() {
    return (
        <div className={gridStyles.grid} role="group" aria-label="Assistant model benchmark" tabIndex={0}>
            <HeadlineCard />
            <ModelsCard />
            <p className={gridStyles.method}>
                <strong>Method:</strong> five diagram and five drawing tasks per model, each run through the assistant&apos;s first version and through
                today&apos;s, on free tiers. Claude ran through the Claude CLI, and Gemini 3.8 Flash through Google&apos;s Antigravity CLI rather than the
                Gemini API. A task cut off by its answer limit counts as not drawn.{" "}
                <a className={styles.galleryLink} href={GALLERY_URL} target="_blank" rel="noreferrer">
                    Every drawing, side by side
                </a>
                .
            </p>
        </div>
    );
}
