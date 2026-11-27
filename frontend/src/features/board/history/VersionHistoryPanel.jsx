import { Fragment, useCallback, useEffect, useState } from "react";
import Panel from "@/components/ui/Panel";
import StrokeIcon from "@/components/ui/StrokeIcon";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import axiosInstance from "@/lib/axiosInstance";
import { socket } from "@/lib/socket.js";
import styles from "./VersionHistoryPanel.module.css";

const PANEL_WIDTH_PX = 340;

const formatTime = (iso) => new Date(iso).toLocaleTimeString(undefined, { timeStyle: "short" });
const dayLabel = (iso) => {
    const date = new Date(iso);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Today";
    today.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Yesterday";
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

// A selected version is shown full size through onPreview, on a read-only layer above the live board.
const VersionHistoryPanel = ({ isOpen, onClose, shareId, token, canEdit, onRestored, onForked, onPreview, showToast }) => {
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedSeq, setSelectedSeq] = useState(null);
    const [previewLoaded, setPreviewLoaded] = useState(false);
    const [nameDraft, setNameDraft] = useState("");
    const [busy, setBusy] = useState(false);

    const fetchVersions = useCallback(() => {
        if (!shareId || !token) return;
        setLoading(true);
        axiosInstance
            .get(`/api/drawing/${shareId}/versions`, { headers: { Authorization: `Bearer ${token}` } })
            .then(({ data }) => setVersions(data.versions))
            .catch(() => showToast?.error("Error", "Failed to load version history."))
            .finally(() => setLoading(false));
    }, [shareId, token, showToast]);

    useEffect(() => {
        if (isOpen) fetchVersions();
    }, [isOpen, fetchVersions]);

    const selectedVersion = versions.find((candidate) => candidate.seq === selectedSeq);
    const previewLabel = selectedVersion
        ? `Viewing ${selectedVersion.name || (selectedVersion.automatic ? "Autosave" : "Version")}, ${dayLabel(selectedVersion.createdAt)} ${formatTime(selectedVersion.createdAt)}`
        : "Viewing Version";

    useEffect(() => {
        if (!isOpen || selectedSeq === null) {
            setPreviewLoaded(false);
            onPreview?.(null);
            return;
        }
        axiosInstance
            .get(`/api/drawing/${shareId}/versions/${selectedSeq}/preview`, { headers: { Authorization: `Bearer ${token}` } })
            .then(({ data }) => {
                setPreviewLoaded(true);
                onPreview?.({
                    elements: data.elements,
                    background: data.background,
                    leftInset: window.innerWidth > 720 ? PANEL_WIDTH_PX : 0,
                    label: previewLabel,
                    onClose: () => setSelectedSeq(null),
                });
            })
            .catch(() => showToast?.error("Error", "Failed to load that version's preview."));
    }, [isOpen, selectedSeq, shareId, token, previewLabel, onPreview, showToast]);

    // The server restores as ordinary changes and tells only the requester, so this can add one undo step.
    useEffect(() => {
        const handleRestored = ({ shareId: restoredShareId, elementOps }) => {
            if (restoredShareId !== shareId) return;
            setBusy(false);
            setSelectedSeq(null);
            onRestored?.(elementOps);
            showToast?.success("Restored", "Version restored. Press Ctrl+Z to undo.");
        };
        socket.on("server:versionRestored", handleRestored);
        return () => socket.off("server:versionRestored", handleRestored);
    }, [shareId, onRestored, showToast]);

    const handleRestore = () => {
        if (selectedSeq === null) return;
        setBusy(true);
        socket.emit("client:restoreVersion", { shareId, seq: selectedSeq });
    };

    const handleNameVersion = () => {
        const name = nameDraft.trim();
        if (!name) return;
        setBusy(true);
        axiosInstance
            .post(`/api/drawing/${shareId}/versions`, { name }, { headers: { Authorization: `Bearer ${token}` } })
            .then(() => {
                setNameDraft("");
                showToast?.success("Version saved", `Named version "${name}" created.`);
                fetchVersions();
            })
            .catch((error) => showToast?.error("Error", error.response?.data?.message || "Failed to name version."))
            .finally(() => setBusy(false));
    };

    const handleFork = () => {
        setBusy(true);
        axiosInstance
            .post(`/api/drawing/${shareId}/fork`, { seq: selectedSeq }, { headers: { Authorization: `Bearer ${token}` } })
            .then(({ data }) => {
                showToast?.success("Forked", "A new board was created from this version.");
                onForked?.(data.data);
            })
            .catch((error) => showToast?.error("Error", error.response?.data?.message || "Failed to fork board."))
            .finally(() => setBusy(false));
    };

    if (!isOpen) return null;

    return (
        <Panel elevation="lg" padded={false} className={styles.panel} data-board-chrome data-tour="history-panel">
            <div className={styles.header}>
                <h2 className={styles.title}>Version history</h2>
                <button type="button" className={styles.close} aria-label="Close version history" onClick={onClose}>
                    <StrokeIcon name="close" size={14} strokeWidth={2.4} />
                </button>
            </div>

            {canEdit && (
                <div className={styles.nameRow} data-tour="history-name">
                    <Input
                        placeholder="Name this moment"
                        aria-label="Name this moment"
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !busy && handleNameVersion()}
                        maxLength={100}
                    />
                    <Button size="sm" disabled={busy || !nameDraft.trim()} onClick={handleNameVersion}>
                        Save
                    </Button>
                </div>
            )}

            <div className={styles.list} data-tour="history-list">
                {loading && <p className={styles.empty}>Loading…</p>}
                {!loading && versions.length === 0 && <p className={styles.empty}>No versions yet. Keep editing and one will appear automatically.</p>}
                {versions.map((version, index) => {
                    const day = dayLabel(version.createdAt);
                    const named = !!version.name;
                    return (
                        <Fragment key={version.seq}>
                            {(index === 0 || dayLabel(versions[index - 1].createdAt) !== day) && <p className={styles.day}>{day}</p>}
                            <button
                                type="button"
                                className={selectedSeq === version.seq ? `${styles.item} ${styles.selected}` : styles.item}
                                onClick={() => setSelectedSeq(version.seq)}
                            >
                                <span className={styles.dot} data-named={named} aria-hidden="true" />
                                <span className={styles.itemText}>
                                    <span className={styles.itemName}>{version.name || (version.automatic ? "Autosave" : "Version")}</span>
                                    <span className={styles.itemMeta}>
                                        {formatTime(version.createdAt)}
                                        {version.contributors?.length > 0
                                            ? ` · ${version.contributors.length} contributor${version.contributors.length > 1 ? "s" : ""}`
                                            : ""}
                                    </span>
                                </span>
                            </button>
                        </Fragment>
                    );
                })}
            </div>

            {previewLoaded && (
                <div className={styles.previewSection}>
                    <div className={styles.previewActions}>
                        {canEdit && (
                            <Button size="sm" disabled={busy} onClick={handleRestore}>
                                Restore
                            </Button>
                        )}
                        <Button size="sm" variant="secondary" disabled={busy} onClick={handleFork}>
                            Fork from here
                        </Button>
                    </div>
                </div>
            )}
        </Panel>
    );
};

export default VersionHistoryPanel;
