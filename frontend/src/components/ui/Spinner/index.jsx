import styles from "./index.module.css";

// `label` is visually hidden but announced, since a bare spinner has no accessible name.
const Spinner = ({ label = "Loading", size = "md", className }) => (
    <div className={className} role="status">
        <div className={size === "sm" ? styles.spinnerSm : styles.spinner} />
        <span className={styles.srOnly}>{label}</span>
    </div>
);

export default Spinner;
