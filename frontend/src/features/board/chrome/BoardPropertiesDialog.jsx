import { useEffect, useMemo, useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import Modal from "@/components/ui/Modal";
import { swatchColorValue } from "../rendering/colorResolver";
import { boardStatistics, formatBytes } from "./boardStatistics";
import styles from "./BoardPropertiesDialog.module.css";

const number = (value) => value.toLocaleString();

const formatDate = (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Not known";
};

const Row = ({ label, value }) => (
    <div className={styles.row}>
        <dt>{label}</dt>
        <dd>{value}</dd>
    </div>
);

const BoardPropertiesDialog = ({ isOpen, onClose, shareId, token, elements, comments, collaboratorCount, selectionCount, zoom }) => {
    const [meta, setMeta] = useState(null);
    useEffect(() => {
        if (!isOpen) return undefined;
        let cancelled = false;
        axiosInstance
            .get(`/api/drawing/getById/${shareId}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(({ data }) => !cancelled && setMeta(data.data))
            .catch(() => !cancelled && setMeta(null));
        return () => {
            cancelled = true;
        };
    }, [isOpen, shareId, token]);

    const stats = useMemo(() => (isOpen ? boardStatistics(elements) : null), [isOpen, elements]);
    if (!stats) return null;
    const openComments = comments.filter((comment) => !comment.resolved).length;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Board properties" size="md">
            <p className={styles.boardTitle}>{meta?.title || "Untitled board"}</p>
            <div className={styles.headline}>
                <span>
                    <strong>{number(stats.total)}</strong> element{stats.total === 1 ? "" : "s"}
                </span>
                <span>
                    <strong>{number(stats.words)}</strong> word{stats.words === 1 ? "" : "s"}
                </span>
                <span>
                    <strong>{formatBytes(stats.sizeBytes)}</strong> of content
                </span>
            </div>
            <div className={styles.columns}>
                <section>
                    <h3 className={styles.sectionTitle}>On this board</h3>
                    <dl className={styles.list}>
                        {stats.kinds.length === 0 && <Row label="Nothing yet" value="0" />}
                        {stats.kinds.map(({ label, count }) => (
                            <Row key={label} label={label} value={number(count)} />
                        ))}
                    </dl>
                    {stats.shapeKinds.length > 1 && (
                        <>
                            <h3 className={styles.sectionTitle}>Shapes</h3>
                            <dl className={styles.list}>
                                {stats.shapeKinds.map(({ label, count }) => (
                                    <Row key={label} label={label} value={number(count)} />
                                ))}
                            </dl>
                        </>
                    )}
                </section>
                <section>
                    <h3 className={styles.sectionTitle}>Details</h3>
                    <dl className={styles.list}>
                        <Row label="Groups" value={number(stats.groups)} />
                        <Row label="Locked" value={number(stats.locked)} />
                        <Row label="With a link" value={number(stats.linked)} />
                        <Row label="Attached arrows" value={number(stats.attachedArrows)} />
                        <Row label="Loose arrows" value={number(stats.looseArrows)} />
                        <Row label="Ink points" value={number(stats.inkPoints)} />
                        <Row label="Used area" value={stats.extent ? `${number(stats.extent.width)} x ${number(stats.extent.height)}` : "None"} />
                    </dl>
                    <h3 className={styles.sectionTitle}>This board</h3>
                    <dl className={styles.list}>
                        <Row label="Comments" value={`${number(comments.length)} (${number(openComments)} open)`} />
                        <Row label="People with access" value={number(collaboratorCount)} />
                        <Row label="Created" value={formatDate(meta?.createdAt)} />
                        <Row label="Last changed" value={formatDate(meta?.updatedAt)} />
                        <Row label="Selected now" value={number(selectionCount)} />
                        <Row label="Zoom" value={`${Math.round(zoom * 100)}%`} />
                    </dl>
                </section>
            </div>
            {stats.topColours.length > 0 && (
                <section>
                    <h3 className={styles.sectionTitle}>Most used colours</h3>
                    <ul className={styles.colours}>
                        {stats.topColours.map(({ label, count }) => (
                            <li key={label} title={`${label}, used ${count} time${count === 1 ? "" : "s"}`}>
                                <span style={{ background: swatchColorValue(label) }} />
                                {number(count)}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </Modal>
    );
};

export default BoardPropertiesDialog;
