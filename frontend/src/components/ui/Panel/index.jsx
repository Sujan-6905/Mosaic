import { forwardRef } from "react";
import cx from "clsx";
import styles from "./index.module.css";

const Panel = forwardRef(({ padded = true, elevation = "md", className, children, ...props }, ref) => (
    <div ref={ref} className={cx(styles.panel, styles[`elevation-${elevation}`], { [styles.padded]: padded }, className)} {...props}>
        {children}
    </div>
));
Panel.displayName = "Panel";

export default Panel;
