import cx from "clsx";
import styles from "./index.module.css";

const SegmentedControl = ({ options, value, onChange, "aria-label": ariaLabel }) => (
    <div className={styles.group} role="radiogroup" aria-label={ariaLabel}>
        {options.map((option) => (
            <button
                key={option.value}
                role="radio"
                aria-checked={option.value === value}
                className={cx(styles.segment, { [styles.active]: option.value === value })}
                onClick={() => onChange(option.value)}
                title={option.label}
            >
                {option.icon ?? option.label}
            </button>
        ))}
    </div>
);

export default SegmentedControl;
