import { forwardRef } from "react";
import cx from "clsx";
import styles from "./index.module.css";

const Button = forwardRef(({ variant = "primary", size = "md", className, children, ...props }, ref) => (
    <button ref={ref} className={cx(styles.button, styles[variant], styles[size], className)} {...props}>
        {children}
    </button>
));
Button.displayName = "Button";

export default Button;
