import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import axiosInstance from "@/lib/axiosInstance";
import Radio from "@/components/ui/Radio";
import Select from "@/components/ui/Select";
import Switch from "@/components/ui/Switch";
import styles from "./EmbedBoardDialog.module.css";

const AGENT_CHOICES = [
    { value: "edit", label: "Edit" },
    { value: "comment", label: "Comment only" },
    { value: "read", label: "Read only" },
    { value: "none", label: "Not allowed" },
];

const normaliseSite = (input) => {
    const value = input.trim().toLowerCase().replace(/\/+$/, "");
    if (/^(https:\/\/(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d{1,5})?|http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?)$/.test(value)) return value;
    if (/^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(value)) return `https://${value}`;
    return null;
};

const HOST_API_EXAMPLE = `const frame = document.querySelector("iframe");
frame.contentWindow.postMessage({ type: "mosaic:goToFrame", frameId: "..." }, "*");
window.addEventListener("message", (event) => {
  if (event.data?.type === "mosaic:changed") console.log(event.data.elementIds);
});`;

// Link access, agent access and embedding sites are the owner's to change; anyone can copy the embed code.
// Invited people keep the role they were given; the link covers everyone else.
const LINK_CHOICES = [
    { value: "none", label: "Only people you invite", detail: "Everyone else is asked to sign in, and can request access." },
    { value: "viewer", label: "Can view", detail: "Signed in or not, read only." },
    { value: "commenter", label: "Can comment", detail: "Anyone signed in can comment. Signed-out visitors can view." },
    { value: "editor", label: "Can edit", detail: "Anyone signed in can edit. Signed-out visitors can view." },
];

export default function EmbedBoardDialog({ isOpen, onClose, shareId, token, isOwner, elements, initialFrameId, showToast }) {
    const [settings, setSettings] = useState(null);
    const [siteDraft, setSiteDraft] = useState("");
    const [frameId, setFrameId] = useState(initialFrameId ?? "");
    const [version, setVersion] = useState("");
    const [target, setTarget] = useState(shareId);
    const [comments, setComments] = useState(true);
    const [versions, setVersions] = useState([]);
    const [branches, setBranches] = useState([]);
    const headers = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
    const base = `/api/drawing/${encodeURIComponent(shareId)}`;

    useEffect(() => {
        if (!isOpen) return;
        setFrameId(initialFrameId ?? "");
        Promise.all([
            axiosInstance.get(`${base}/settings`, headers),
            axiosInstance.get(`${base}/versions`, headers).catch(() => ({ data: { versions: [] } })),
            axiosInstance.get(`${base}/branches`, headers).catch(() => ({ data: { branches: [] } })),
        ])
            .then(([settingsResponse, versionsResponse, branchesResponse]) => {
                setSettings(settingsResponse.data.data);
                setVersions(versionsResponse.data.versions.filter((entry) => entry.name));
                setBranches(branchesResponse.data.branches);
            })
            .catch(() => showToast?.error("Couldn't load sharing settings", "Try again in a moment."));
    }, [isOpen, base, headers, initialFrameId, showToast]);

    const save = async (change) => {
        try {
            const { data } = await axiosInstance.patch(`${base}/settings`, change, headers);
            setSettings(data.data);
        } catch (error) {
            showToast?.error("Couldn't save that", error.response?.data?.message ?? "Try again.");
        }
    };

    const addSite = () => {
        const site = normaliseSite(siteDraft);
        if (!site) return showToast?.error("That isn't a site address", "Use one like https://docs.example.com or *.example.com.");
        setSiteDraft("");
        return save({ embed: { ...settings.embed, sites: [...new Set([...settings.embed.sites, site])] } });
    };

    const frames = useMemo(() => Object.entries(elements ?? {}).filter(([, element]) => element.type === "frame"), [elements]);
    const targetOptions = [
        { value: "", label: "The whole board" },
        ...frames.map(([id, element]) => ({ value: id, label: `Frame: ${element.name || element.text || "Untitled"}` })),
        ...branches.map((branch) => ({ value: `branch:${branch.shareId}`, label: `Branch: ${branch.title || branch.shareId}` })),
    ];
    const versionOptions = [
        { value: "", label: "Latest, kept live" },
        ...versions.map((entry) => ({ value: String(entry.seq), label: `Saved version: ${entry.name}` })),
    ];
    const chooseTarget = (value) => {
        if (value.startsWith("branch:")) {
            setTarget(value.slice("branch:".length));
            setFrameId("");
        } else {
            setTarget(shareId);
            setFrameId(value);
        }
    };
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const query = new URLSearchParams(
        Object.entries({ frame: target === shareId ? frameId : "", version: target === shareId ? version : "", comments: comments ? "" : "off" }).filter(
            ([, value]) => value,
        ),
    );
    const embedUrl = `${origin}/embed/${encodeURIComponent(target)}${query.size ? `?${query}` : ""}`;
    const embedCode = `<iframe src="${embedUrl}" width="800" height="500" style="border:0" allow="storage-access" allowfullscreen title="Mosaic board"></iframe>`;
    const copy = (text, what) => navigator.clipboard.writeText(text).then(() => showToast?.success("Copied", what));

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Share and embed" size="lg">
            {!settings ? (
                <p className={styles.lead}>Loading</p>
            ) : (
                <div className={styles.body}>
                    {isOwner && (
                        <>
                            <fieldset className={styles.group}>
                                <legend>Anyone with the link</legend>
                                {LINK_CHOICES.map((choice) => (
                                    <label key={choice.value} className={styles.choice}>
                                        <Radio
                                            name="linkAccess"
                                            checked={settings.linkAccess === choice.value}
                                            onChange={() => save({ linkAccess: choice.value })}
                                        />
                                        <span>
                                            <strong>{choice.label}</strong>
                                            {choice.detail}
                                        </span>
                                    </label>
                                ))}
                            </fieldset>

                            <div className={styles.inline}>
                                <span>
                                    <strong>Agents on this board</strong>The most an agent acting for a collaborator may do here.
                                </span>
                                <Select
                                    ariaLabel="Agents on this board"
                                    className={styles.agentSelect}
                                    value={settings.agentAccess}
                                    onChange={(agentAccess) => save({ agentAccess })}
                                    options={AGENT_CHOICES}
                                />
                            </div>

                            <fieldset className={styles.group}>
                                <legend>Embedding on other sites</legend>
                                <Switch checked={settings.embed.enabled} onChange={(enabled) => save({ embed: { ...settings.embed, enabled } })}>
                                    Allow this board to be embedded on the sites below
                                </Switch>
                                {settings.embed.enabled && (
                                    <>
                                        <ul className={styles.sites}>
                                            {settings.embed.sites.map((site) => (
                                                <li key={site}>
                                                    <code>{site}</code>
                                                    <button
                                                        type="button"
                                                        className={styles.remove}
                                                        aria-label={`Remove ${site}`}
                                                        onClick={() =>
                                                            save({
                                                                embed: { ...settings.embed, sites: settings.embed.sites.filter((entry) => entry !== site) },
                                                            })
                                                        }
                                                    >
                                                        Remove
                                                    </button>
                                                </li>
                                            ))}
                                            {settings.embed.sites.length === 0 && (
                                                <li className={styles.muted}>No sites yet: browsers will refuse to show the embed anywhere.</li>
                                            )}
                                        </ul>
                                        <form
                                            className={styles.addSite}
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                addSite();
                                            }}
                                        >
                                            <input
                                                value={siteDraft}
                                                placeholder="docs.example.com or *.example.com"
                                                aria-label="Site to allow"
                                                onChange={(event) => setSiteDraft(event.target.value)}
                                            />
                                            <button type="submit" className={styles.ghost}>
                                                Add site
                                            </button>
                                        </form>
                                    </>
                                )}
                            </fieldset>
                        </>
                    )}

                    {!settings.embedEnabled ? (
                        <p className={styles.lead}>
                            {isOwner ? "Turn on embedding above to get the embed code." : "The board's owner hasn't turned on embedding."}
                        </p>
                    ) : (
                        <fieldset className={styles.group}>
                            <legend>Embed code</legend>
                            <div className={styles.options}>
                                <div className={styles.field}>
                                    <span>Show</span>
                                    <Select
                                        ariaLabel="Show"
                                        className="w-full"
                                        value={target === shareId ? frameId : `branch:${target}`}
                                        onChange={chooseTarget}
                                        options={targetOptions}
                                    />
                                </div>
                                <div className={styles.field}>
                                    <span>As of</span>
                                    <Select
                                        ariaLabel="As of"
                                        className="w-full"
                                        value={version}
                                        disabled={target !== shareId}
                                        onChange={setVersion}
                                        options={versionOptions}
                                    />
                                </div>
                                <Switch checked={comments} onChange={setComments} className={styles.commentsSwitch}>
                                    Show comments to signed-in viewers
                                </Switch>
                            </div>
                            <pre className={styles.snippet}>
                                <code>{embedCode}</code>
                            </pre>
                            <div className={styles.row}>
                                <button type="button" className={styles.primary} onClick={() => copy(embedCode, "Paste it into your page's HTML.")}>
                                    Copy embed code
                                </button>
                                <button type="button" className={styles.ghost} onClick={() => copy(embedUrl, "Paste it into Notion, Medium or WordPress.")}>
                                    Copy embed link
                                </button>
                            </div>
                            <details className={styles.details}>
                                <summary>Steer it from your page</summary>
                                <p className={styles.muted}>
                                    Your page can send mosaic:fit, zoomIn, zoomOut, setZoom, setCamera, goToFrame and focusElement, and hears mosaic:ready,
                                    changed, camera and click. It can never edit the board.
                                </p>
                                <pre className={styles.snippet}>
                                    <code>{HOST_API_EXAMPLE}</code>
                                </pre>
                            </details>
                        </fieldset>
                    )}
                </div>
            )}
        </Modal>
    );
}
