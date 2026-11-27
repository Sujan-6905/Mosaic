import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import axiosInstance from "@/lib/axiosInstance";
import { drawDiffMarker, drawSceneStatic } from "../rendering/staticSceneRenderer";
import { getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { cameraToFit } from "../camera/viewport";
import { resolveMerge } from "../../../../../shared/canvas/history/threeWayMerge.js";
import styles from "./MergeDialog.module.css";

const MARKS = { added: "#22c55e", changed: "#f97316", removed: "#ef4444", conflict: "#8b5cf6" };
const CONFLICT_WORDING = {
    "both-changed": "Changed on both boards",
    "removed-there": "Deleted on one, edited on the other",
    "removed-here": "Edited on one, deleted on the other",
    "both-added": "Different on both boards",
};
const PART_NAMES = {
    position: "position",
    attachment: "what it's attached to",
    label: "label position",
    text: "text",
    subtext: "subtitle",
    color: "colour",
    fillColor: "fill",
};

// What the receiving board would look like, with every change outlined.
const ResultCanvas = ({ target, ops, conflictIds }) => {
    const draw = useCallback(
        (canvas) => {
            if (!canvas) return;
            const width = 720;
            const height = 380;
            canvas.width = width;
            canvas.height = height;
            const result = { ...target };
            ops.forEach(({ elementId, after }) => {
                if (after) result[elementId] = after;
                else delete result[elementId];
            });
            const marked = ops.map(({ before, after }) => after ?? before).filter(Boolean);
            const camera = cameraToFit(getUnionBounds([...Object.values(result), ...marked]), width, height, 40, { clamp: false }) || { x: 0, y: 0, zoom: 1 };
            const context = canvas.getContext("2d");
            drawSceneStatic(context, result, { type: "blank", colorToken: null }, camera, width, height);
            context.setTransform(camera.zoom, 0, 0, camera.zoom, -camera.x * camera.zoom, -camera.y * camera.zoom);
            ops.forEach(({ elementId, before, after }) => {
                if (conflictIds.has(elementId)) return;
                drawDiffMarker(context, after ?? before, !before ? MARKS.added : !after ? MARKS.removed : MARKS.changed, { dashed: !after });
            });
            conflictIds.forEach((elementId) => {
                const shown = result[elementId] ?? target[elementId];
                if (shown) drawDiffMarker(context, shown, MARKS.conflict, { dashed: !result[elementId] });
            });
        },
        [target, ops, conflictIds],
    );
    return <canvas ref={draw} className={styles.canvas} aria-label="The board after merging, with each change outlined" />;
};

// Bringing one board's changes into another, with anything both changed laid
// out to choose between before it's applied.
const MergeDialog = ({ request, onClose, token, showToast, onMerged }) => {
    const [preview, setPreview] = useState(null);
    const [choices, setChoices] = useState({});
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState(null);
    const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

    const load = useCallback(() => {
        setPreview(null);
        setProblem(null);
        axiosInstance
            .get(`/api/drawing/${request.branchShareId}/merge`, { headers, params: { direction: request.direction } })
            .then(({ data }) => {
                setPreview(data);
                setChoices({});
            })
            .catch((error) => setProblem(error.response?.data?.message || "Couldn't work out this merge."));
    }, [request, headers]);

    useEffect(() => {
        if (request) load();
    }, [request, load]);

    const ops = useMemo(() => (preview ? resolveMerge(preview, choices, preview.target.elements) : []), [preview, choices]);
    const conflictIds = useMemo(() => new Set(preview?.conflicts.map((conflict) => conflict.elementId) ?? []), [preview]);
    const choose = (value) => setChoices(Object.fromEntries(preview.conflicts.map((conflict) => [conflict.id, value])));

    const merge = () => {
        setBusy(true);
        axiosInstance
            .post(`/api/drawing/${request.branchShareId}/merge`, { direction: request.direction, choices, expectedTargetSeq: preview.targetSeq }, { headers })
            .then(({ data }) => {
                const changes = data.counts.added + data.counts.changed + data.counts.removed;
                showToast?.success("Merged", `${changes} change${changes === 1 ? "" : "s"} went into "${data.target.title}".`);
                onMerged?.(data);
                onClose();
            })
            .catch((error) => {
                if (error.response?.status === 409) {
                    showToast?.info("Board changed", error.response.data.message);
                    load();
                } else {
                    showToast?.error("Merge failed", error.response?.data?.message || "Nothing was changed.");
                }
            })
            .finally(() => setBusy(false));
    };

    const nothingToDo = preview && preview.ops.length === 0 && preview.conflicts.length === 0;

    return (
        <Modal
            isOpen={Boolean(request)}
            onClose={onClose}
            title={preview ? `Merge "${preview.source.title}" into "${preview.target.title}"` : "Merge"}
            size="xl"
        >
            {problem && <p className={styles.problem}>{problem}</p>}
            {!preview && !problem && <p className={styles.note}>Comparing both boards with where they last agreed…</p>}
            {preview && (
                <div className={styles.layout}>
                    <div className={styles.side}>
                        <p className={styles.counts}>
                            <span style={{ "--mark": MARKS.added }}>{preview.counts.added} added</span>
                            <span style={{ "--mark": MARKS.changed }}>{preview.counts.changed} changed</span>
                            <span style={{ "--mark": MARKS.removed }}>{preview.counts.removed} removed</span>
                            {preview.conflicts.length > 0 && <span style={{ "--mark": MARKS.conflict }}>{preview.conflicts.length} to choose</span>}
                        </p>
                        {preview.approximateBase && (
                            <p className={styles.caution}>
                                This branch was made before Mosaic kept merge points, so every difference counts as a change. Check the choices below with care.
                            </p>
                        )}
                        {nothingToDo && <p className={styles.note}>Nothing to bring across. Both boards already agree.</p>}
                        {preview.conflicts.length > 0 && (
                            <section aria-label="Choices">
                                <div className={styles.bulk}>
                                    <span>For everything below</span>
                                    <button type="button" onClick={() => choose("keep")}>
                                        Keep &quot;{preview.target.title}&quot;
                                    </button>
                                    <button type="button" onClick={() => choose("take")}>
                                        Use &quot;{preview.source.title}&quot;
                                    </button>
                                </div>
                                <ul className={styles.conflicts}>
                                    {preview.conflicts.map((conflict) => (
                                        <li key={conflict.id} className={styles.conflict}>
                                            <strong>{conflict.label}</strong>
                                            <span className={styles.why}>
                                                {CONFLICT_WORDING[conflict.kind]}
                                                {conflict.parts.length > 0 && `: ${conflict.parts.map((part) => PART_NAMES[part] ?? part).join(", ")}`}
                                            </span>
                                            <div className={styles.choice} role="radiogroup" aria-label={`Which version of ${conflict.label}`}>
                                                <button
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={choices[conflict.id] !== "take"}
                                                    onClick={() => setChoices((prev) => ({ ...prev, [conflict.id]: "keep" }))}
                                                >
                                                    Keep {preview.target.title}&apos;s
                                                </button>
                                                <button
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={choices[conflict.id] === "take"}
                                                    onClick={() => setChoices((prev) => ({ ...prev, [conflict.id]: "take" }))}
                                                >
                                                    Use {preview.source.title}&apos;s
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                        {preview.overlaps.length > 0 && (
                            <section className={styles.overlaps} aria-label="Worth a look">
                                <p>Worth a look after merging. These now sit on top of each other:</p>
                                <ul>
                                    {preview.overlaps.slice(0, 6).map((overlap) => (
                                        <li key={`${overlap.sourceId}-${overlap.targetId}`}>{overlap.label}</li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </div>
                    <div className={styles.result}>
                        <ResultCanvas target={preview.target.elements} ops={ops} conflictIds={conflictIds} />
                        <p className={styles.legend}>
                            {Object.entries(MARKS).map(([name, colour]) => (
                                <span key={name} style={{ "--mark": colour }}>
                                    {name === "conflict" ? "Your choice" : name[0].toUpperCase() + name.slice(1)}
                                </span>
                            ))}
                        </p>
                    </div>
                </div>
            )}
            <div className={styles.footer}>
                <Button variant="secondary" onClick={onClose}>
                    Cancel
                </Button>
                <Button disabled={!preview || nothingToDo || busy} onClick={merge}>
                    {busy ? "Merging…" : `Merge ${ops.length} change${ops.length === 1 ? "" : "s"}`}
                </Button>
            </div>
        </Modal>
    );
};

export default MergeDialog;
