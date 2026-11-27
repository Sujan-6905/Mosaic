import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import StrokeIcon from "@/components/ui/StrokeIcon";
import { CHANGE_KIND_COLORS, describeChange } from "../history/catchUp";
import { comparisonToChanges, describeSyncResult } from "./architectureBoard";
import styles from "../history/CatchUpPanel.module.css";
import ownStyles from "./ArchitecturePanel.module.css";

// Reading a large repository takes tens of seconds, on top of naming its modules.
const REPOSITORY_TIMEOUT_MS = 120_000;

const shortSha = (sha) => sha?.slice(0, 7);

const failureMessage = (error) => error.response?.data?.message || "That didn't work. Try again in a moment.";

// Keeps a diagram in step with a GitHub repository: draws it, syncs it without moving anyone's layout,
// and shows what a pull request or branch would change.
const ArchitecturePanel = ({
    isOpen,
    onClose,
    shareId,
    token,
    canEdit,
    elements,
    onPlaceGraph,
    onApplySync,
    onRemoveElements,
    onCompareChanges,
    onShowBounds,
}) => {
    const [repoLink, setRepoLink] = useState(null);
    const [url, setUrl] = useState("");
    const [target, setTarget] = useState("");
    const [busy, setBusy] = useState(null);
    const [message, setMessage] = useState(null);
    const [markedElementIds, setMarkedElementIds] = useState([]);
    const [comparison, setComparison] = useState(null);
    const [focusedChangeId, setFocusedChangeId] = useState(null);
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => {
        if (!isOpen || !shareId || !token) return;
        axiosInstance
            .get(`/api/architecture/${shareId}`, authHeaders)
            .then(({ data }) => setRepoLink(data.repoLink))
            .catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, shareId, token]);

    useEffect(() => {
        onCompareChanges(isOpen && comparison ? { changes: comparison.changes, focusedChangeId } : null);
    }, [isOpen, comparison, focusedChangeId, onCompareChanges]);

    if (!isOpen) return null;

    const run = async (activity, action) => {
        setBusy(activity);
        setMessage(null);
        try {
            await action();
        } catch (error) {
            setMessage({ tone: "error", text: failureMessage(error) });
        } finally {
            setBusy(null);
        }
    };

    const importRepository = (event) => {
        event.preventDefault();
        run("import", async () => {
            const { data } = await axiosInstance.post(`/api/architecture/${shareId}/import`, { url }, { ...authHeaders, timeout: REPOSITORY_TIMEOUT_MS });
            setRepoLink(data.repoLink);
            setComparison(null);
            onPlaceGraph(data.graph);
            setMessage(data.notice ? { tone: "note", text: data.notice } : { tone: "note", text: "Click on the board to place the diagram." });
        });
    };

    const sync = () =>
        run("sync", async () => {
            const { data } = await axiosInstance.post(`/api/architecture/${shareId}/sync`, {}, { ...authHeaders, timeout: REPOSITORY_TIMEOUT_MS });
            setRepoLink(data.repoLink);
            setComparison(null);
            const { addedCount, removedElementIds } = onApplySync(data.graph);
            setMarkedElementIds(removedElementIds);
            const result = describeSyncResult({ addedCount, removedCount: removedElementIds.length, unchanged: data.unchanged });
            setMessage({ tone: "note", text: data.notice ? `${result} ${data.notice}` : result });
        });

    const compare = (event) => {
        event.preventDefault();
        run("compare", async () => {
            const { data } = await axiosInstance.post(`/api/architecture/${shareId}/compare`, { target }, { ...authHeaders, timeout: REPOSITORY_TIMEOUT_MS });
            const changes = comparisonToChanges(data.diff, elements);
            setFocusedChangeId(null);
            setComparison({ label: data.label, changes });
            if (changes.length === 0) setMessage({ tone: "note", text: "This doesn't change the structure." });
        });
    };

    const focusChange = (change) => {
        setFocusedChangeId(change.id);
        if (change.bounds) onShowBounds(change.bounds);
    };

    const removeMarked = () => {
        onRemoveElements(markedElementIds);
        setMarkedElementIds([]);
    };

    return (
        <aside className={styles.panel} aria-label="Repository architecture" data-board-chrome data-tour="architecture-panel">
            <header className={styles.header}>
                <h2 className={styles.title}>Architecture</h2>
                <button type="button" className={styles.iconButton} aria-label="Close architecture" onClick={onClose}>
                    <StrokeIcon name="close" size={16} />
                </button>
            </header>

            <div className={styles.body}>
                {repoLink && (
                    <p className={ownStyles.repo}>
                        <a href={`https://github.com/${repoLink.owner}/${repoLink.repo}`} target="_blank" rel="noreferrer">
                            {repoLink.owner}/{repoLink.repo}
                        </a>
                        <span>
                            {repoLink.ref} at {shortSha(repoLink.sha)}
                        </span>
                    </p>
                )}

                {canEdit && (
                    <form className={ownStyles.form} onSubmit={importRepository}>
                        <label className={ownStyles.label} htmlFor="architecture-url">
                            {repoLink ? "Map a different repository" : "Public GitHub repository"}
                        </label>
                        <input
                            id="architecture-url"
                            data-tour="architecture-url"
                            className={ownStyles.input}
                            value={url}
                            onChange={(event) => setUrl(event.target.value)}
                            placeholder="https://github.com/owner/repo"
                            autoComplete="off"
                            spellCheck={false}
                        />
                        <button type="submit" className={ownStyles.primary} disabled={Boolean(busy) || !url.trim()}>
                            {busy === "import" ? "Reading the repository…" : "Draw the architecture"}
                        </button>
                    </form>
                )}

                {repoLink && canEdit && (
                    <button type="button" className={styles.summarize} disabled={Boolean(busy)} onClick={sync}>
                        <StrokeIcon name="history" size={14} />
                        {busy === "sync" ? "Syncing…" : "Sync with latest code"}
                    </button>
                )}

                {repoLink && (
                    <form className={ownStyles.form} onSubmit={compare}>
                        <label className={ownStyles.label} htmlFor="architecture-target">
                            Compare a pull request or branch
                        </label>
                        <div className={ownStyles.inline}>
                            <input
                                id="architecture-target"
                                className={ownStyles.input}
                                value={target}
                                onChange={(event) => setTarget(event.target.value)}
                                placeholder="#123 or feature/login"
                                autoComplete="off"
                                spellCheck={false}
                            />
                            <button type="submit" className={ownStyles.secondary} disabled={Boolean(busy) || !target.trim()}>
                                {busy === "compare" ? "Comparing…" : "Compare"}
                            </button>
                        </div>
                    </form>
                )}

                {message && (
                    <p className={message.tone === "error" ? ownStyles.error : styles.note} role={message.tone === "error" ? "alert" : "status"}>
                        {message.text}
                    </p>
                )}

                {markedElementIds.length > 0 && (
                    <button type="button" className={styles.summarize} onClick={removeMarked}>
                        Remove the {markedElementIds.length} marked in red
                    </button>
                )}

                {comparison?.changes.length > 0 && (
                    <section aria-label="Structure changes">
                        <div className={styles.sectionHead}>
                            <h3 className={styles.sectionTitle}>{comparison.label}</h3>
                            <button type="button" className={styles.textButton} onClick={() => setComparison(null)}>
                                Clear
                            </button>
                        </div>
                        <ul className={styles.list}>
                            {comparison.changes.map((change) => (
                                <li key={change.id}>
                                    <button
                                        type="button"
                                        className={styles.row}
                                        aria-current={change.id === focusedChangeId}
                                        onClick={() => focusChange(change)}
                                    >
                                        <span className={styles.rowText}>
                                            <span className={styles.kindDot} style={{ background: CHANGE_KIND_COLORS[change.kind] }} aria-hidden="true" />
                                            {describeChange(change)}
                                        </span>
                                        {!change.bounds && <span className={styles.rowDetail}>Not on the diagram yet. Sync after it merges to add it.</span>}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </aside>
    );
};

export default ArchitecturePanel;
