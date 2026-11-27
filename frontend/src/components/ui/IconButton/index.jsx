import { forwardRef } from "react";
import cx from "clsx";
import styles from "./index.module.css";

const IconButton = forwardRef(({ variant = "ghost", size = "md", active = false, className, children, ...props }, ref) => (
    <button ref={ref} className={cx(styles.iconButton, styles[variant], styles[size], { [styles.active]: active }, className)} aria-pressed={active} {...props}>
        {children}
    </button>
));
IconButton.displayName = "IconButton";

export default IconButton;
