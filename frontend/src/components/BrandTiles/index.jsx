import styles from "./index.module.css";

// The mark: two gold tiles and two ink tiles. Callers wrap it in the link or button it belongs to.
export default function BrandTiles() {
    return (
        <span className={styles.tiles} aria-hidden="true">
            <span data-tone="gold" />
            <span data-tone="ink" />
            <span data-tone="ink" />
            <span data-tone="gold" />
        </span>
    );
}
