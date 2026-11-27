import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import cx from "clsx";
import styles from "./index.module.css";

// onValueChange fires on every drag step; onValueCommit fires once the value settles (release or a key step).
const Slider = forwardRef(({ className, value, onValueChange, onValueCommit, max = 100, min = 1, step = 1, ...props }, ref) => {
    const inputRef = useRef(null);
    useImperativeHandle(ref, () => inputRef.current);

    const commitRef = useRef(onValueCommit);
    commitRef.current = onValueCommit;
    useEffect(() => {
        const input = inputRef.current;
        const handleChange = () => commitRef.current?.([Number(input.value)]);
        input.addEventListener("change", handleChange);
        return () => input.removeEventListener("change", handleChange);
    }, []);

    return (
        <input
            ref={inputRef}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value?.[0] ?? min}
            onChange={(e) => onValueChange?.([Number(e.target.value)])}
            className={cx(styles.slider, className)}
            {...props}
        />
    );
});
Slider.displayName = "Slider";

export default Slider;
