import { Check } from "iconoir-react";
import { cn } from "@/lib/utils";
import {
    AnimatedDropdown,
    AnimatedDropdownContent,
    AnimatedDropdownItem,
    AnimatedDropdownTrigger,
    AnimatedDropdownTriggerIndicator,
} from "@/components/vendor/sona/animated-dropdown";

// A single-choice picker on Sona's dropdown, in place of a native <select>:
// the trigger shows the current choice, the open menu ticks it.
const Select = ({ value, onChange, options, placeholder = "Choose…", ariaLabel, disabled = false, className = "" }) => {
    const current = options.find((option) => option.value === value);
    const shown = current?.label ?? placeholder;

    return (
        <AnimatedDropdown modal={false} disabled={disabled}>
            <AnimatedDropdownTrigger
                aria-label={ariaLabel ? `${ariaLabel}: ${shown}` : undefined}
                className={cn(
                    "bui h-9 min-w-0 justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-popover px-3 text-[13px] font-normal text-popover-foreground hover:bg-muted data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[disabled]:hover:bg-popover",
                    className,
                )}
            >
                <span className={`min-w-0 truncate ${current ? "" : "text-muted-foreground"}`}>{shown}</span>
                <AnimatedDropdownTriggerIndicator className="text-muted-foreground" />
            </AnimatedDropdownTrigger>
            <AnimatedDropdownContent align="start" className="max-h-72 min-w-[var(--anchor-width)] overflow-y-auto">
                {options.map((option) => (
                    <AnimatedDropdownItem key={option.value} disabled={option.disabled} onClick={() => onChange(option.value)}>
                        <span className="flex items-center justify-between gap-3">
                            {option.label}
                            {option.value === value && <Check width={14} height={14} strokeWidth={2} aria-hidden />}
                        </span>
                    </AnimatedDropdownItem>
                ))}
            </AnimatedDropdownContent>
        </AnimatedDropdown>
    );
};

export default Select;
