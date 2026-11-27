import { useEffect, useState } from "react";
import styles from "./ReadingTiles.module.css";

const TILE_COUNT = 32;

// A strip of tiles that turn gold as the page is read; the last one rises when the end is reached.
export default function ReadingTiles() {
    const [laid, setLaid] = useState(0);

    useEffect(() => {
        const measure = () => {
            const scrollable = document.documentElement.scrollHeight - window.innerHeight;
            const progress = scrollable > 0 ? window.scrollY / scrollable : 1;
            setLaid(Math.round(Math.min(1, Math.max(0, progress)) * TILE_COUNT));
        };
        measure();
        window.addEventListener("scroll", measure, { passive: true });
        window.addEventListener("resize", measure);
        return () => {
            window.removeEventListener("scroll", measure);
            window.removeEventListener("resize", measure);
        };
    }, []);

    return (
        <div className={styles.strip} role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={TILE_COUNT} aria-valuenow={laid}>
            {Array.from({ length: TILE_COUNT }, (_unused, index) => (
                <span key={index} data-laid={index < laid} data-last={index === TILE_COUNT - 1} />
            ))}
        </div>
    );
}
