import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import Tabs from "@/components/ui/Tabs";
import axiosInstance from "@/lib/axiosInstance";
import { AGENT_SETUPS } from "./agentSetups";
import styles from "./AgentsDialog.module.css";

const mcpUrl = () => (typeof window === "undefined" ? "" : `${window.location.origin}/mcp`);

const timeOf = (at) => new Date(at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const describeCounts = ({ added, changed, removed }) =>
    [added && `${added} added`, changed && `${changed} changed`, removed && `${removed} removed`].filter(Boolean).join(", ") || "no element changes";

export default function AgentsDialog({ isOpen, onClose, shareId, token, canEdit, showToast }) {
    const [tab, setTab] = useState("connect");
    const [app, setApp] = useState(AGENT_SETUPS[0].id);
    const [turns, setTurns] = useState(null);
    const [undoing, setUndoing] = useState(null);
    const headers = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
    const setup = AGENT_SETUPS.find((entry) => entry.id === app);
    const snippet = setup.snippet(mcpUrl());

    const loadActivity = useCallback(async () => {
        try {
            const { data } = await axiosInstance.get(`/api/drawing/${encodeURIComponent(shareId)}/agent-activity`, headers);
            setTurns(data.turns);
        } catch {
            setTurns([]);
            showToast?.error("Couldn't load agent activity", "Try again in a moment.");
        }
    }, [shareId, headers, showToast]);

    useEffect(() => {
        if (isOpen && tab === "activity") loadActivity();
    }, [isOpen, tab, loadActivity]);

    const undo = async (turnId) => {
        setUndoing(turnId);
        try {
            const { data } = await axiosInstance.post(`/api/drawing/${encodeURIComponent(shareId)}/agent-activity/${turnId}/undo`, {}, headers);
            const skipped = data.skipped.length ? ` ${data.skipped.length} left alone because someone changed them since.` : "";
            showToast?.success(
                "Agent turn undone",
                `${data.restored + data.removed} element${data.restored + data.removed === 1 ? "" : "s"} put back.${skipped}`,
            );
            await loadActivity();
        } catch (error) {
            showToast?.error("Couldn't undo that turn", error.response?.data?.message ?? "Try again.");
        } finally {
            setUndoing(null);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Agents on this board" size="lg">
            <Tabs
                value={tab}
                onChange={setTab}
                ariaLabel="Agents"
                tabs={[
                    { value: "connect", label: "Connect an agent" },
                    { value: "activity", label: "Activity" },
                ]}
            />
            {tab === "connect" ? (
                <div className={styles.body}>
                    <p className={styles.lead}>
                        Agents join the board like a collaborator: you see their cursor, and their changes arrive live. Point your agent app at Mosaic&apos;s
                        address and sign in when it asks.
                    </p>
                    <div className={styles.apps} role="radiogroup" aria-label="Agent app">
                        {AGENT_SETUPS.map((entry) => (
                            <button
                                key={entry.id}
                                type="button"
                                role="radio"
                                aria-checked={entry.id === app}
                                className={styles.app}
                                onClick={() => setApp(entry.id)}
                            >
                                {entry.label}
                            </button>
                        ))}
                    </div>
                    <pre className={styles.snippet}>
                        <code>{snippet}</code>
                    </pre>
                    <div className={styles.row}>
                        <button
                            type="button"
                            className={styles.primary}
                            onClick={() => navigator.clipboard.writeText(snippet).then(() => showToast?.success("Copied", `Paste it into ${setup.label}.`))}
                        >
                            Copy
                        </button>
                        <span className={styles.hint}>
                            Then ask it to work on board <code>{shareId}</code>.
                            {app === "codex" ? " Set MOSAIC_TOKEN to a personal access token from Profile." : ""}
                        </span>
                    </div>
                </div>
            ) : (
                <div className={styles.body}>
                    {turns === null ? (
                        <p className={styles.lead}>Loading</p>
                    ) : turns.length === 0 ? (
                        <p className={styles.lead}>No agent has changed this board yet.</p>
                    ) : (
                        <ul className={styles.turns}>
                            {turns.map((turn) => (
                                <li key={turn.turnId} className={styles.turn}>
                                    <span className={styles.turnWho}>{turn.authorName ?? turn.agent}</span>
                                    <span className={styles.turnWhat}>
                                        {describeCounts(turn.counts)} · {timeOf(turn.at)}
                                    </span>
                                    {canEdit && (
                                        <button type="button" className={styles.ghost} disabled={undoing === turn.turnId} onClick={() => undo(turn.turnId)}>
                                            {undoing === turn.turnId ? "Undoing" : "Undo"}
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </Modal>
    );
}
