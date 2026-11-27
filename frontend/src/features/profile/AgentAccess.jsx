import { useCallback, useEffect, useMemo, useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import Select from "@/components/ui/Select";
import BoardPicker from "@/components/BoardPicker";
import styles from "./profile.module.css";
import own from "./AgentAccess.module.css";

const SCOPE_CHOICES = [
    { value: "write", label: "Read and edit" },
    { value: "read", label: "Read only" },
];

const BOARD_CHOICES = [
    { value: "all", label: "All boards I can open" },
    { value: "picked", label: "Only boards I pick" },
];

const EXPIRY_CHOICES = [
    { value: 30, label: "30 days" },
    { value: 90, label: "90 days" },
    { value: 365, label: "1 year" },
];

const EMPTY_DRAFT = { name: "", scope: "write", days: 90, reach: "all", boards: [] };

const reachOf = (credential) => (credential.boards ? `${credential.boards.length} board${credential.boards.length === 1 ? "" : "s"}` : "all boards");

const dateOf = (time) => (time ? new Date(time).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "never");

// Credentials for agents and scripts, and the agent apps connected by
// signing in: both made, listed and revoked only here, by the person.
export default function AgentAccess({ token, showToast }) {
    const authHeaders = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
    const [tokens, setTokens] = useState([]);
    const [allowed, setAllowed] = useState(true);
    const [agents, setAgents] = useState([]);
    const [draft, setDraft] = useState(EMPTY_DRAFT);
    const limited = draft.reach === "picked";
    const [created, setCreated] = useState(null);
    const [busy, setBusy] = useState(false);
    // Read after mount: the server rendering this page doesn't know the address it's reached at.
    const [mcpAddress, setMcpAddress] = useState("");

    useEffect(() => {
        setMcpAddress(`${window.location.origin}/mcp`);
    }, []);

    const refresh = useCallback(async () => {
        if (!token) return;
        const [tokenList, agentList] = await Promise.all([
            axiosInstance.get("/api/auth/tokens", authHeaders),
            axiosInstance.get("/api/auth/agents", authHeaders),
        ]);
        setTokens(tokenList.data.tokens);
        setAllowed(tokenList.data.allowed);
        setAgents(agentList.data.agents);
    }, [token, authHeaders]);

    useEffect(() => {
        refresh().catch(() => showToast?.error("Couldn't load your agent access", "Reload the page to try again."));
    }, [refresh, showToast]);

    const createToken = async (event) => {
        event.preventDefault();
        if (!draft.name.trim()) return;
        setBusy(true);
        try {
            const { data } = await axiosInstance.post(
                "/api/auth/tokens",
                { name: draft.name.trim(), scope: draft.scope, days: draft.days, ...(limited ? { boards: draft.boards } : {}) },
                authHeaders,
            );
            setCreated(data.token);
            setDraft(EMPTY_DRAFT);
            await refresh();
        } catch (error) {
            showToast?.error("Couldn't create the token", error.response?.data?.message ?? "Try again.");
        } finally {
            setBusy(false);
        }
    };

    const revokeToken = async (id) => {
        try {
            await axiosInstance.delete(`/api/auth/tokens/${id}`, authHeaders);
            await refresh();
            showToast?.success("Token revoked", "Anything using it is signed out now.");
        } catch {
            showToast?.error("Couldn't revoke the token", "Try again in a moment.");
        }
    };

    const disconnectAgent = async (id) => {
        try {
            await axiosInstance.delete(`/api/auth/agents/${id}`, authHeaders);
            await refresh();
            showToast?.success("App disconnected", "It needs your permission again to come back.");
        } catch {
            showToast?.error("Couldn't disconnect the app", "Try again in a moment.");
        }
    };

    const copy = async (text) => {
        await navigator.clipboard.writeText(text);
        showToast?.success("Copied", "Paste it into your agent's settings.");
    };

    return (
        <>
            <section className={styles.card} data-rise style={{ "--rise-order": 3 }} aria-labelledby="agentAppsHeading">
                <div className={styles.cardHead}>
                    <h2 id="agentAppsHeading">Connected agents</h2>
                    <p>Apps such as Claude or Cursor that you let in by signing in. Each appears on boards as acting for you.</p>
                </div>
                {agents.length === 0 ? (
                    <p className={own.empty}>
                        No apps connected. Add Mosaic in an agent app with this address:<code className={own.address}>{mcpAddress}</code>
                    </p>
                ) : (
                    <ul className={own.list}>
                        {agents.map((agent) => (
                            <li key={agent.id} className={own.row}>
                                <span className={own.name}>{agent.agent}</span>
                                <span className={own.meta}>
                                    {agent.scope === "read" ? "Read only" : "Read and edit"}
                                    {`, ${reachOf(agent)}`}, since {dateOf(agent.startedAt)}
                                </span>
                                <button type="button" className={`${styles.outline} ${styles.destructive}`} onClick={() => disconnectAgent(agent.id)}>
                                    Disconnect
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className={styles.card} data-rise style={{ "--rise-order": 4 }} aria-labelledby="tokensHeading">
                <div className={styles.cardHead}>
                    <h2 id="tokensHeading">Personal access tokens</h2>
                    <p>
                        For agents and scripts that can&apos;t sign in through a browser. Treat a token like a password. Changing your password or signing out
                        other devices revokes them all.
                    </p>
                </div>
                {!allowed ? (
                    <p className={own.empty}>Personal access tokens are switched off on this server.</p>
                ) : (
                    <form className={own.create} onSubmit={createToken}>
                        <label className={styles.field}>
                            Name
                            <input
                                value={draft.name}
                                maxLength={60}
                                placeholder="Claude Code on my laptop"
                                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                            />
                        </label>
                        <div className={own.options}>
                            <div className={styles.field}>
                                <span>Access</span>
                                <Select
                                    ariaLabel="Access"
                                    className={own.select}
                                    value={draft.scope}
                                    onChange={(scope) => setDraft({ ...draft, scope })}
                                    options={SCOPE_CHOICES}
                                />
                            </div>
                            <div className={styles.field}>
                                <span>Expires after</span>
                                <Select
                                    ariaLabel="Expires after"
                                    className={own.select}
                                    value={draft.days}
                                    onChange={(days) => setDraft({ ...draft, days })}
                                    options={EXPIRY_CHOICES}
                                />
                            </div>
                            <div className={styles.field}>
                                <span>Boards</span>
                                <Select
                                    ariaLabel="Boards"
                                    className={own.select}
                                    value={draft.reach}
                                    onChange={(reach) => setDraft({ ...draft, reach })}
                                    options={BOARD_CHOICES}
                                />
                            </div>
                        </div>
                        {limited && <BoardPicker token={token} chosen={draft.boards} onChange={(boards) => setDraft({ ...draft, boards })} />}
                        <div className={styles.formActions}>
                            <button type="submit" className={styles.primary} disabled={busy || !draft.name.trim() || (limited && draft.boards.length === 0)}>
                                {busy ? "Creating" : "Create token"}
                            </button>
                        </div>
                    </form>
                )}
                {created && (
                    <div className={own.reveal} role="status">
                        <p>Copy this now. Mosaic keeps only a fingerprint of it, so it won&apos;t be shown again.</p>
                        <div className={own.secret}>
                            <code>{created.token}</code>
                            <button type="button" className={styles.outline} onClick={() => copy(created.token)}>
                                Copy
                            </button>
                        </div>
                    </div>
                )}
                {tokens.length > 0 && (
                    <ul className={own.list}>
                        {tokens.map((token) => (
                            <li key={token.id} className={own.row}>
                                <span className={own.name}>{token.name}</span>
                                <span className={own.meta}>
                                    {token.scope === "read" ? "Read only" : "Read and edit"}, {reachOf(token)}, expires {dateOf(token.expiresAt)},{" "}
                                    {token.lastUsedAt ? `last used ${dateOf(token.lastUsedAt)}` : "not used yet"}
                                </span>
                                <button type="button" className={`${styles.outline} ${styles.destructive}`} onClick={() => revokeToken(token.id)}>
                                    Revoke
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}
