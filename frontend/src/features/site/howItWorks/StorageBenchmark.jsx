import { useCountUp, useRevealOnce } from "./useRevealOnce";
import cardStyles from "./HowItWorksNumbers.module.css";
import gridStyles from "./BenchmarkGrid.module.css";
import styles from "./StorageBenchmark.module.css";

// From benchmark/results/storage-benchmark.md: the median time each store added on top of a network round trip
// measured just before it, in milliseconds.
const PATHS = [
    { label: "20 people editing one board", couchbase: 3.0, mongodb: 12.1 },
    { label: "Autosave one changed element", couchbase: 0.6, mongodb: 1.0 },
    { label: "Append 25 operations to the log", couchbase: 4.6, mongodb: 6.5 },
    { label: "Open a board by its key", couchbase: 27.1, mongodb: 14.2 },
    { label: "Open a board by its share link", couchbase: 24.6, mongodb: 15.3 },
    { label: "Replay the operations after a version", couchbase: 22.0, mongodb: 5.4 },
    { label: "Find the version at a point in time", couchbase: 4.9, mongodb: 1.2 },
    { label: "List a person's boards", couchbase: 7.9, mongodb: 0.9 },
];
const CONTENDED_P95 = { couchbase: 73, mongodb: 861 };

// A store wins a path only by a clear margin; closer than this reads as a tie.
const CLEAR_RATIO = 1.5;
const CLEAR_MS = 1.5;
const verdictOf = ({ couchbase, mongodb }) => {
    const [fast, slow] = couchbase < mongodb ? [couchbase, mongodb] : [mongodb, couchbase];
    if (slow / fast < CLEAR_RATIO || slow - fast < CLEAR_MS) return "even";
    return couchbase < mongodb ? "couchbase" : "mongodb";
};
const VERDICT_LABEL = { couchbase: "Couchbase", mongodb: "MongoDB", even: "Too close" };
const tally = PATHS.reduce((counts, path) => ({ ...counts, [verdictOf(path)]: (counts[verdictOf(path)] ?? 0) + 1 }), {});

// Log scale from 0.3 ms to 100 ms, so a 1 ms difference and a 30 ms one both read.
const LOW_MS = 0.3;
const HIGH_MS = 100;
const logWidth = (ms) => Math.max(2, (Math.log10(Math.max(ms, LOW_MS) / LOW_MS) / Math.log10(HIGH_MS / LOW_MS)) * 100);
const formatMs = (ms) => (ms < 10 ? ms.toFixed(1) : Math.round(ms).toString());

function ContendedCard() {
    const [ref, reveal] = useRevealOnce();
    const mongodb = useCountUp(CONTENDED_P95.mongodb, reveal, 1600);
    const couchbase = useCountUp(CONTENDED_P95.couchbase, reveal, 900);

    return (
        <article ref={ref} className={`${cardStyles.card} ${styles.contended}`} data-reveal={reveal}>
            <span className={cardStyles.cardLabel}>Twenty people editing one board at once</span>
            <span className={cardStyles.cardHint}>The slowest one in twenty edits, measured at the client</span>
            <div className={styles.versus}>
                <div className={styles.side}>
                    <strong className={styles.sideValue}>{mongodb} ms</strong>
                    <span className={styles.sideName}>MongoDB</span>
                </div>
                <div className={styles.side} data-winner="true">
                    <strong className={`${cardStyles.stat} ${styles.sideValue}`}>{couchbase} ms</strong>
                    <span className={styles.sideName}>Couchbase</span>
                </div>
            </div>
            <p className={cardStyles.cardNote}>
                MongoDB lets one write change a document at a time and retries the ones that collide, so a busy board queues. Couchbase writes each element as
                its own path inside the board and got through 4.5 times as many rounds a second. Both kept every write.
            </p>
            <dl className={styles.tally}>
                {["couchbase", "mongodb", "even"].map((verdict) => (
                    <div key={verdict} data-verdict={verdict}>
                        <dt>{verdict === "even" ? "Too close to call" : `${VERDICT_LABEL[verdict]} faster`}</dt>
                        <dd>{tally[verdict] ?? 0}</dd>
                    </div>
                ))}
            </dl>
        </article>
    );
}

function PathsCard() {
    const [ref, reveal] = useRevealOnce();

    return (
        <article ref={ref} className={`${cardStyles.card} ${styles.paths}`} data-reveal={reveal} tabIndex={0} aria-label="Time the database adds, path by path">
            <div className={styles.pathsHead}>
                <span className={cardStyles.cardLabel}>Time the database adds, path by path</span>
                <span className={gridStyles.legend} aria-hidden="true">
                    <span data-accent="true">Couchbase</span>
                    <span>MongoDB</span>
                </span>
            </div>
            <span className={cardStyles.cardHint}>Median milliseconds above the network round trip. Lower is better, on a log scale.</span>
            <ol className={styles.rows}>
                {PATHS.map((path) => {
                    const verdict = verdictOf(path);
                    return (
                        <li
                            key={path.label}
                            className={styles.row}
                            aria-label={`${path.label}: Couchbase ${formatMs(path.couchbase)} ms, MongoDB ${formatMs(path.mongodb)} ms, ${VERDICT_LABEL[verdict]}`}
                        >
                            <span className={styles.rowLabel}>{path.label}</span>
                            <span className={styles.rowBars} aria-hidden="true">
                                {["couchbase", "mongodb"].map((store) => (
                                    <span key={store} className={styles.barLine}>
                                        <span className={styles.bar} data-store={store} style={{ width: `${logWidth(path[store])}%` }} />
                                        <span className={styles.barValue}>{formatMs(path[store])}</span>
                                    </span>
                                ))}
                            </span>
                            <span className={styles.verdict} data-verdict={verdict} aria-hidden="true">
                                {VERDICT_LABEL[verdict]}
                            </span>
                        </li>
                    );
                })}
            </ol>
            <p className={cardStyles.cardNote}>
                MongoDB answers every query faster: share links, dashboards, the history scrubber and replay. Opening a whole board by its key moves 300
                elements over the network and swung from Couchbase five times faster to MongoDB twice as fast between days, so it measures the route more than
                the store.
            </p>
        </article>
    );
}

export default function StorageBenchmark() {
    return (
        <div className={gridStyles.grid} role="group" aria-label="Storage benchmark" tabIndex={0}>
            <ContendedCard />
            <PathsCard />
            <p className={gridStyles.method}>
                <strong>Method:</strong> the same eight storage paths and the same seeded boards on MongoDB Atlas and Couchbase Capella free tiers, from one
                machine. Both stores run each path back to back, taking turns to go first, and every figure is the median of five passes. Source and full tables
                in <code>benchmark/</code>.
            </p>
        </div>
    );
}
