import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEyeDropper } from "@fortawesome/free-solid-svg-icons";
import cx from "clsx";
import Slider from "@/components/ui/Slider";
import Input from "@/components/ui/Input";
import IconButton from "@/components/ui/IconButton";
import { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, normalizeHex } from "./colorMath";
import { getRecentColors, pushRecentColor } from "./recentColors";
import { swatchColorValue } from "../../rendering/colorResolver";
import styles from "./index.module.css";

const WHEEL_SIZE = 160;
const WHEEL_RADIUS = WHEEL_SIZE / 2;
const BLACK = { r: 0, g: 0, b: 0 };

// Angle 0 (screen up) is hue 0, running clockwise; painting the wheel and reading the pointer share this mapping.
const angleToHue = (radians) => ((radians * 180) / Math.PI + 90 + 360) % 360;
const hueToAngle = (hue) => ((hue - 90) * Math.PI) / 180;

// Painted once at full value and cached; brightness is a black disc at alpha 1-v drawn over it, which equals
// scaling every channel by v and makes a brightness drag one putImageData and one fill.
const paintHueSaturationWheel = (context) => {
    const image = context.createImageData(WHEEL_SIZE, WHEEL_SIZE);
    for (let y = 0; y < WHEEL_SIZE; y++) {
        for (let x = 0; x < WHEEL_SIZE; x++) {
            const dx = x - WHEEL_RADIUS;
            const dy = y - WHEEL_RADIUS;
            const radius = Math.sqrt(dx * dx + dy * dy);
            const i = (y * WHEEL_SIZE + x) * 4;
            if (radius > WHEEL_RADIUS) continue; // stays fully transparent
            const { r, g, b } = hsvToRgb({ h: angleToHue(Math.atan2(dy, dx)), s: Math.min(1, radius / WHEEL_RADIUS), v: 1 });
            image.data[i] = r;
            image.data[i + 1] = g;
            image.data[i + 2] = b;
            image.data[i + 3] = 255;
        }
    }
    context.putImageData(image, 0, 0);
};

const supportsEyeDropper = typeof window !== "undefined" && "EyeDropper" in window;

// `onChange(hex, { transient })` fires with transient set throughout a drag, then once more when the pick settles.
const ColorPicker = ({ value, onChange }) => {
    const wheelRef = useRef(null);
    const baseImageRef = useRef(null);
    const draggingWheel = useRef(false);
    const draggingValue = useRef(false);

    const [hsv, setHsv] = useState(() => rgbToHsv(hexToRgb(value) || BLACK));
    const [hexInput, setHexInput] = useState(() => normalizeHex(value) || "#000000");
    const [recents, setRecents] = useState([]);
    const hsvRef = useRef(hsv);
    hsvRef.current = hsv;

    // Read once per opening, so the swatches never shuffle under the pointer.
    useEffect(() => {
        setRecents(getRecentColors());
    }, []);

    // Resync from an outside `value` change, but never mid-drag, where it would fight the pointer.
    useEffect(() => {
        if (draggingWheel.current || draggingValue.current) return;
        setHsv(rgbToHsv(hexToRgb(value) || BLACK));
        setHexInput(normalizeHex(value) || "#000000");
    }, [value]);

    useEffect(() => {
        const context = wheelRef.current?.getContext("2d");
        if (!context) return;
        if (!baseImageRef.current) {
            paintHueSaturationWheel(context);
            baseImageRef.current = context.getImageData(0, 0, WHEEL_SIZE, WHEEL_SIZE);
        } else {
            context.putImageData(baseImageRef.current, 0, 0);
        }

        // Capped below 1 so a black selection still shows the wheel to drag a new hue from.
        context.globalAlpha = Math.min(1 - hsv.v, 0.92);
        context.fillStyle = "#000000";
        context.beginPath();
        context.arc(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_RADIUS, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;

        const markerRadius = hsv.s * WHEEL_RADIUS;
        const markerAngle = hueToAngle(hsv.h);
        const markerX = WHEEL_RADIUS + markerRadius * Math.cos(markerAngle);
        const markerY = WHEEL_RADIUS + markerRadius * Math.sin(markerAngle);
        context.beginPath();
        context.arc(markerX, markerY, 5, 0, Math.PI * 2);
        context.lineWidth = 2;
        context.strokeStyle = hsv.v > 0.6 ? "#000000" : "#ffffff";
        context.stroke();
    }, [hsv]);

    const commit = useCallback(
        (hex) => {
            onChange?.(hex);
            pushRecentColor(hex);
        },
        [onChange],
    );

    const hsvFromWheelPoint = (clientX, clientY) => {
        const rect = wheelRef.current.getBoundingClientRect();
        const dx = clientX - rect.left - WHEEL_RADIUS;
        const dy = clientY - rect.top - WHEEL_RADIUS;
        return {
            h: angleToHue(Math.atan2(dy, dx)),
            s: Math.min(1, Math.sqrt(dx * dx + dy * dy) / WHEEL_RADIUS),
            v: hsvRef.current.v,
        };
    };

    const previewFromWheel = (e) => {
        const next = hsvFromWheelPoint(e.clientX, e.clientY);
        setHsv(next);
        onChange?.(rgbToHex(hsvToRgb(next)), { transient: true });
    };

    const handleWheelPointerDown = (e) => {
        e.preventDefault();
        draggingWheel.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        previewFromWheel(e);
    };
    const handleWheelPointerMove = (e) => {
        if (!draggingWheel.current) return;
        previewFromWheel(e);
    };
    const handleWheelPointerUp = () => {
        if (!draggingWheel.current) return;
        draggingWheel.current = false;
        commit(rgbToHex(hsvToRgb(hsvRef.current)));
    };

    const handleValueChange = ([percent]) => {
        draggingValue.current = true;
        const next = { ...hsvRef.current, v: percent / 100 };
        setHsv(next);
        onChange?.(rgbToHex(hsvToRgb(next)), { transient: true });
    };
    const handleValueCommit = () => {
        if (!draggingValue.current) return;
        draggingValue.current = false;
        commit(rgbToHex(hsvToRgb(hsvRef.current)));
    };

    const handleHexChange = (e) => setHexInput(e.target.value);
    const commitHexInput = () => {
        const normalized = normalizeHex(hexInput);
        if (!normalized) {
            setHexInput(normalizeHex(value) || "#000000"); // invalid entry: revert
            return;
        }
        setHsv(rgbToHsv(hexToRgb(normalized)));
        setHexInput(normalized);
        commit(normalized);
    };

    const handleEyedropper = async () => {
        if (!supportsEyeDropper) return;
        try {
            const result = await new window.EyeDropper().open();
            const normalized = normalizeHex(result?.sRGBHex);
            if (!normalized) return;
            setHsv(rgbToHsv(hexToRgb(normalized)));
            setHexInput(normalized);
            commit(normalized);
        } catch {
            // User cancelled the pick (e.g. pressed Escape): not an error.
        }
    };

    const handleRecentClick = (hex) => {
        setHsv(rgbToHsv(hexToRgb(hex)));
        setHexInput(hex);
        commit(hex);
    };

    return (
        <div className={styles.picker}>
            <canvas
                ref={wheelRef}
                width={WHEEL_SIZE}
                height={WHEEL_SIZE}
                className={styles.wheel}
                onPointerDown={handleWheelPointerDown}
                onPointerMove={handleWheelPointerMove}
                onPointerUp={handleWheelPointerUp}
                onPointerCancel={handleWheelPointerUp}
            />

            <div className={styles.valueRow}>
                <span className={styles.rowLabel}>Brightness</span>
                <Slider
                    value={[Math.round(hsv.v * 100)]}
                    onValueChange={handleValueChange}
                    onValueCommit={handleValueCommit}
                    min={0}
                    max={100}
                    step={1}
                    className={styles.valueSlider}
                />
            </div>

            <div className={styles.hexRow}>
                <Input
                    label="Hex"
                    name="hex"
                    value={hexInput}
                    onChange={handleHexChange}
                    onBlur={commitHexInput}
                    onKeyDown={(e) => e.key === "Enter" && commitHexInput()}
                    className={styles.hexInput}
                />
                <IconButton
                    aria-label="Pick colour from screen"
                    title={supportsEyeDropper ? "Pick colour from screen" : "Not supported in this browser"}
                    disabled={!supportsEyeDropper}
                    onClick={handleEyedropper}
                >
                    <FontAwesomeIcon icon={faEyeDropper} />
                </IconButton>
            </div>

            {recents.length > 0 && (
                <div className={styles.recentsRow}>
                    {recents.map((hex) => (
                        <button
                            key={hex}
                            className={cx(styles.recentSwatch, { [styles.active]: hex.toLowerCase() === (normalizeHex(value) || "").toLowerCase() })}
                            style={{ backgroundColor: swatchColorValue(hex) }}
                            title={hex}
                            onClick={() => handleRecentClick(hex)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default ColorPicker;
