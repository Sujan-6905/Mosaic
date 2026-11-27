import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import axiosInstance from "@/lib/axiosInstance";
import { drawSceneStatic, drawDiffMarker } from "../rendering/staticSceneRenderer";
import { getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { cameraToFit } from "../camera/viewport";
import MergeDialog from "./MergeDialog.jsx";
import styles from "./BranchesDiffPanel.module.css";

const LEGEND = [
    { key: "added", color: "#22c55e", label: "Added" },
    { key: "removed", color: "#ef4444", label: "Removed" },
    { key: "moved", color: "#3b82f6", label: "Moved" },
    { key: "modified", color: "#f97316", label: "Modified" },
];

const DiffCanvas = ({ diff, baseElements }) => {
    const canvasRef = (canvas) => {
        if (!canvas || !diff) return;
        canvas.width = 720;
        canvas.height = 400;
        const context = canvas.getContext("2d");
        const allElements = [
            ...Object.values(baseElements || {}),
            ...diff.added.map((e) => e.element),
            ...diff.removed.map((e) => e.element),
            ...diff.moved.map((e) => e.after),
            ...diff.modified.map((e) => e.after),
        ];
        const bounds = getUnionBounds(allElements);
        const camera = cameraToFit(bounds, 720, 400, 60, { clamp: false }) || { x: 0, y: 0, zoom: 1 };
        // The board as the branch has it, so a new or changed element shows itself, with each change outlined over it.
        const branchScene = {
            ...(baseElements || {}),
            ...Object.fromEntries([
                ...diff.added.map(({ elementId, element }) => [elementId, element]),
                ...[...diff.moved, ...diff.modified].map(({ elementId, after }) => [elementId, after]),
            ]),
        };
        drawSceneStatic(context, branchScene, { type: "blank", colorToken: null }, camera, 720, 400);

        context.setTransform(camera.zoom, 0, 0, camera.zoom, -camera.x * camera.zoom, -camera.y * camera.zoom);
        diff.added.forEach(({ element }) => drawDiffMarker(context, element, "#22c55e"));
        diff.removed.forEach(({ element }) => drawDiffMarker(context, element, "#ef4444", { dashed: true }));
        diff.moved.forEach(({ before, after }) => {
            drawDiffMarker(context, before, "#3b82f6", { dashed: true });
            drawDiffMarker(context, after, "#3b82f6");
        });
        diff.modified.forEach(({ after }) => drawDiffMarker(context, after, "#f97316"));
    };

    return <canvas ref={canvasRef} className={styles.canvas} />;
};

// Branches and their visual diff. Creating a branch is the same fork as Version History's Fork from here.
const BranchesDiffPanel = ({ isOpen, onClose, shareId, token, showToast, onForked, onMerged }) => {
    const [mergeRequest, setMergeRequest] = useState(null);
    const [branches, setBranches] = useState([]);
    const [parentShareId, setParentShareId] = useState(null);
    const [compareShareId, setCompareShareId] = useState(null);
    const [diff, setDiff] = useState(null);
    const [baseElements, setBaseElements] = useState({});
    const [busy, setBusy] = useState(false);
    const [comparing, setComparing] = useState(false);

    useEffect(() => {
        if (!isOpen || !shareId || !token) return;
        const headers = { Authorization: `Bearer ${token}` };
        axiosInstance
            .get(`/api/drawing/${shareId}/branches`, { headers })
            .then(({ data }) => setBranches(data.branches))
            .catch(() => showToast?.error("Error", "Failed to load branches."));
        axiosInstance
            .get(`/api/drawing/getById/${shareId}`, { headers })
            .then(({ data }) => {
                setParentShareId(data.data.parentShareId);
                setBaseElements(data.data.elements || {});
            })
            .catch(() => {});
    }, [isOpen, shareId, token, showToast]);

    const compareOptions = useMemo(() => {
        const options = branches.map((b) => ({ value: b.shareId, label: b.title }));
        if (parentShareId) options.unshift({ value: parentShareId, label: "Parent board" });
        return options;
    }, [branches, parentShareId]);

    useEffect(() => {
        setDiff(null);
        if (!compareShareId || !token) return undefined;
        let current = true;
        setComparing(true);
        axiosInstance
            .get(`/api/drawing/${shareId}/diff`, { headers: { Authorization: `Bearer ${token}` }, params: { compareShareId } })
            .then(({ data }) => current && setDiff(data))
            .catch(() => current && showToast?.error("Error", "Failed to compute diff."))
            .finally(() => current && setComparing(false));
        return () => {
            current = false;
        };
    }, [compareShareId, shareId, token, showToast]);

    const handleForkBranch = () => {
        setBusy(true);
        axiosInstance
            .post(`/api/drawing/${shareId}/fork`, {}, { headers: { Authorization: `Bearer ${token}` } })
            .then(({ data }) => {
                showToast?.success("Branch created", "A new branch board was created.");
                onForked?.(data.data);
            })
            .catch((error) => showToast?.error("Error", error.response?.data?.message || "Failed to create branch."))
            .finally(() => setBusy(false));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Branches and diff" size="xl">
            <div className={styles.layout}>
                <div className={styles.branchList} data-tour="branch-list">
                    <p className={styles.listHeading}>Compare this board with</p>
                    {compareOptions.map((option, index) => (
                        <button
                            key={option.value}
                            type="button"
                            className={styles.branch}
                            data-rise
                            style={{ "--rise-order": index + 1 }}
                            aria-pressed={option.value === compareShareId}
                            onClick={() => setCompareShareId(option.value)}
                        >
                            {option.label}
                        </button>
                    ))}
                    {compareOptions.length === 0 && <p className={styles.empty}>No branches yet. Branching makes a copy you can change and compare.</p>}
                    <Button variant="secondary" size="sm" data-tour="branch-fork" disabled={busy} onClick={handleForkBranch} className={styles.branchButton}>
                        Branch this board
                    </Button>
                </div>
                <div className={styles.diffArea} data-tour="branch-diff">
                    {comparing ? (
                        <div className={`${styles.diffEmpty} ${styles.diffLoading}`}>
                            <Spinner size="sm" label="Comparing the two boards" />
                            <span aria-hidden="true">Comparing the two boards</span>
                        </div>
                    ) : diff ? (
                        <>
                            <div className={styles.legend}>
                                {LEGEND.map(({ key, color, label }, index) => (
                                    <span key={key} className={styles.legendItem} data-rise style={{ "--rise-order": index }}>
                                        <span className={styles.swatch} style={{ borderColor: color }} />
                                        {label} <strong>{diff.summary.byType[key] || 0}</strong>
                                    </span>
                                ))}
                            </div>
                            <DiffCanvas diff={diff} baseElements={baseElements} />
                            <div className={styles.authorSummary}>
                                {Object.entries(diff.summary.byAuthor).map(([author, count]) => (
                                    <span key={author} className={styles.authorChip} data-rise style={{ "--rise-order": 4 }}>
                                        {author}: {count} change{count === 1 ? "" : "s"}
                                    </span>
                                ))}
                                <a className={styles.openLink} href={`/?shareId=${compareShareId}`}>
                                    Open this board
                                </a>
                            </div>
                            <div className={styles.mergeActions} data-tour="branch-merge">
                                {compareShareId === parentShareId ? (
                                    <>
                                        <Button size="sm" onClick={() => setMergeRequest({ branchShareId: shareId, direction: "intoParent" })}>
                                            Merge this board into the parent
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setMergeRequest({ branchShareId: shareId, direction: "fromParent" })}
                                        >
                                            Bring the parent&apos;s changes here
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button size="sm" onClick={() => setMergeRequest({ branchShareId: compareShareId, direction: "intoParent" })}>
                                            Merge this branch in
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setMergeRequest({ branchShareId: compareShareId, direction: "fromParent" })}
                                        >
                                            Send this board&apos;s changes to the branch
                                        </Button>
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <p className={styles.diffEmpty} data-rise>
                            Pick a board on the left to see what changed.
                        </p>
                    )}
                </div>
            </div>
            <MergeDialog
                request={mergeRequest}
                onClose={() => setMergeRequest(null)}
                token={token}
                showToast={showToast}
                onMerged={(result) => {
                    onMerged?.(result);
                    setCompareShareId(null);
                }}
            />
        </Modal>
    );
};

export default BranchesDiffPanel;
