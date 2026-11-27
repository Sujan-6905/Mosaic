import StaticCanvasPreview from "@/features/board/rendering/StaticCanvasPreview";
import styles from "./PiecesGallery.module.css";

const LICENSE_NAMES = { "CC0-1.0": "CC0, no rights reserved", "CC-BY-4.0": "CC BY 4.0, credit the author", MIT: "MIT licence" };

export default function PieceSetCard({ set, action }) {
    return (
        <article className={styles.setCard}>
            <ul className={styles.previews} aria-label={`Pieces in ${set.title}`}>
                {set.preview.map((piece) => (
                    <li key={piece.id}>
                        <StaticCanvasPreview elements={piece.elements} width={200} height={124} className={styles.preview} />
                    </li>
                ))}
            </ul>
            <div className={styles.setText}>
                <h3 className={styles.setTitle}>{set.title}</h3>
                {set.description && <p className={styles.setDescription}>{set.description}</p>}
                <p className={styles.meta}>
                    {[set.ownerName && `by ${set.ownerName}`, `${set.pieceCount} pieces`, set.installs ? `${set.installs} installs` : null]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
                {(set.tags.length > 0 || set.license) && (
                    <p className={styles.tags}>
                        {set.tags.map((tag) => (
                            <span key={tag} className={styles.tag}>
                                {tag}
                            </span>
                        ))}
                        {set.license && (
                            <span className={styles.license} title={LICENSE_NAMES[set.license]}>
                                {set.license}
                            </span>
                        )}
                    </p>
                )}
            </div>
            {action}
        </article>
    );
}
