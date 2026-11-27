import cx from "clsx";
import styles from "./index.module.css";

const Switch = ({ checked, onChange, children, className }) => (
    <button type="button" role="switch" aria-checked={checked} className={cx(styles.row, className)} onClick={() => onChange(!checked)}>
        {children}
        <span className={styles.track}>
            <span className={styles.knob} />
        </span>
    </button>
);

export default Switch;
