import cx from "clsx";
import styles from "./index.module.css";

const HUES = [355, 25, 45, 145, 175, 205, 260, 320];

// Hue derived from the username, so a collaborator keeps one colour everywhere without a server-assigned value.
const hueFor = (seed = "") => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    return HUES[hash % HUES.length];
};

const Avatar = ({ name = "?", size = "md", className }) => {
    const initial = name.trim().charAt(0).toUpperCase() || "?";
    const hue = hueFor(name);
    return (
        <span className={cx(styles.avatar, styles[size], className)} style={{ background: `hsl(${hue} 55% 42%)` }} title={name}>
            {initial}
        </span>
    );
};

export default Avatar;
