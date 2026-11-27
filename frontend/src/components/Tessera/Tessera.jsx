import { useMemo } from "react";
import { tesseraFor } from "./tessera";
import styles from "./Tessera.module.css";

// The tile turns stone by stone as the name changes, rippling out from its top-left corner.
export default function Tessera({ name, size = 28, className }) {
    const { color, cells } = useMemo(() => tesseraFor(name), [name]);
    return (
        <span className={`${styles.tessera} ${className ?? ""}`} style={{ "--size": `${size}px`, "--tone": color ?? "transparent" }} aria-hidden="true">
            {cells.map((on, index) => (
                <span key={index} data-on={on} style={{ "--i": index }} />
            ))}
        </span>
    );
}
