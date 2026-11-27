import { forwardRef } from "react";
import cx from "clsx";
import styles from "./index.module.css";

const Input = forwardRef(({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
        <div className={styles.field}>
            {label && (
                <label className={styles.label} htmlFor={inputId}>
                    {label}
                </label>
            )}
            <input ref={ref} id={inputId} className={cx(styles.input, { [styles.error]: error }, className)} aria-invalid={!!error} {...props} />
            {error ? <span className={styles.errorText}>{error}</span> : hint && <span className={styles.hint}>{hint}</span>}
        </div>
    );
});
Input.displayName = "Input";

export default Input;
