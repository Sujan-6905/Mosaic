import { useState } from "react";
import Popover from "@/components/ui/Popover";
import StrokeIcon from "@/components/ui/StrokeIcon";
import { SHAPE_OPTIONS } from "../dock/shapeOptions";
import { BarButton } from "./popovers";
import styles from "./index.module.css";
import controls from "./controls.module.css";

// The name of the current shape is itself the control to change it.
export default function ShapePicker({ activeMenuItem, onPick }) {
    const [open, setOpen] = useState(false);
    const active = SHAPE_OPTIONS.find((shape) => shape.item === activeMenuItem) || SHAPE_OPTIONS[0];
    return (
        <Popover
            align="start"
            isOpen={open}
            onOpenChange={setOpen}
            trigger={
                <BarButton
                    label={`Shape: ${active.label}. Change shape`}
                    wide
                    className={`${styles.button} ${styles.wide} ${controls.shapeTrigger}`}
                    aria-expanded={open}
                >
                    <StrokeIcon name={active.icon} size={15} />
                    {active.label}
                    <StrokeIcon name="chevronDown" size={10} strokeWidth={3} />
                </BarButton>
            }
        >
            <div className={`${styles.pop} ${controls.shapeMenu}`} role="radiogroup" aria-label="Change shape">
                {SHAPE_OPTIONS.map((shape) => (
                    <button
                        key={shape.item}
                        type="button"
                        role="radio"
                        aria-checked={shape.item === activeMenuItem}
                        onClick={() => {
                            onPick(shape.item);
                            setOpen(false);
                        }}
                    >
                        <StrokeIcon name={shape.icon} size={17} />
                        {shape.label}
                    </button>
                ))}
            </div>
        </Popover>
    );
}
