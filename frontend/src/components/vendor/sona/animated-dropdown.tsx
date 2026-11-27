"use client";

import { Menu } from "@base-ui/react/menu";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useId,
  useState,
} from "react";
import { motionTransition } from "./sona-motion";
import { cn } from "@/lib/utils";

// ─── Context ─────────────────────────────────────────────────────────────────

interface DropdownContextValue {
  /** Unique layoutId prefix for the hover highlight: scoped per Root instance. */
  layoutId: string;
  /** Currently highlighted item id (for keyboard + mouse parity). */
  activeId: string | null;
  setActiveId: (id: string | null) => void;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdownContext() {
  const ctx = useContext(DropdownContext);
  if (!ctx)
    throw new Error(
      "AnimatedDropdown subcomponents must be used within <AnimatedDropdown>",
    );
  return ctx;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnimatedDropdownProps {
  children: ReactNode;
  /** Controlled open state. */
  open?: boolean;
  /** Initial open state for uncontrolled usage. @default false */
  defaultOpen?: boolean;
  /** Callback when open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Whether the menu ignores user interaction. @default false */
  disabled?: boolean;
  /** Whether the open menu limits interaction to the menu. @default true */
  modal?: boolean;
}

export interface AnimatedDropdownContentProps {
  children: ReactNode;
  className?: string;
  /**
   * Side the menu opens on.
   * @default "bottom"
   */
  side?: "bottom" | "top" | "left" | "right";
  /**
   * Alignment along the side.
   * @default "center"
   */
  align?: "start" | "center" | "end";
  /**
   * Gap between trigger and popup in px.
   * @default 6
   */
  sideOffset?: number;
}

export interface AnimatedDropdownItemProps {
  children: ReactNode;
  /** Icon to display before the label (any ReactNode: no HugeIcons dependency). */
  icon?: ReactNode;
  /**
   * Visual variant.
   * @default "default"
   */
  variant?: "default" | "danger" | "danger-on-hover";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  /** Keep the menu open after this item is chosen. @default true */
  closeOnClick?: boolean;
}

export interface AnimatedDropdownTriggerProps {
  children?: ReactNode;
  className?: string;
  /** Associates the trigger with an external visible label. */
  "aria-labelledby"?: string;
  "aria-label"?: string;
  /** Use an existing element as the trigger instead of the default button styling. */
  render?: ReactElement;
}

export interface AnimatedDropdownTriggerIndicatorProps {
  className?: string;
}

// ─── Root ─────────────────────────────────────────────────────────────────────

/**
 * Root dropdown: owns open state and the hover-highlight layout group.
 * Wrap all other AnimatedDropdown subcomponents inside this.
 */
export function AnimatedDropdown({
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  modal = true,
}: AnimatedDropdownProps) {
  const layoutId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setActiveId(null);
    onOpenChange?.(nextOpen);
  };

  return (
    <DropdownContext.Provider value={{ layoutId, activeId, setActiveId }}>
      <LayoutGroup id={layoutId}>
        <Menu.Root
          open={open}
          defaultOpen={defaultOpen}
          disabled={disabled}
          modal={modal}
          onOpenChange={handleOpenChange}
        >
          {children}
        </Menu.Root>
      </LayoutGroup>
    </DropdownContext.Provider>
  );
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

/**
 * The element that opens the dropdown when clicked.
 * Renders as a `<button>` by default via Base UI.
 */
export function AnimatedDropdownTrigger({
  children,
  className,
  "aria-labelledby": ariaLabelledBy,
  "aria-label": ariaLabel,
  render,
}: AnimatedDropdownTriggerProps) {
  if (render) {
    // Only labels actually given, so the rendered element keeps its own.
    const labels = {
      ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
      ...(ariaLabelledBy ? { "aria-labelledby": ariaLabelledBy } : {}),
    };
    return <Menu.Trigger render={render} className={className} {...labels} />;
  }
  return (
    <Menu.Trigger
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabel}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5",
        "bg-secondary text-secondary-foreground text-sm font-medium",
        "hover:cursor-pointer hover:bg-popover transition-colors duration-150",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      {children}
    </Menu.Trigger>
  );
}

/**
 * A state-aware chevron for the dropdown trigger.
 * Rotates when Base UI marks the parent trigger as open.
 */
export function AnimatedDropdownTriggerIndicator({
  className,
}: AnimatedDropdownTriggerIndicatorProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        "size-4 shrink-0 text-secondary-foreground",
        "transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "group-data-[popup-open]:rotate-180 motion-reduce:transition-none",
        className,
      )}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// ─── Content ──────────────────────────────────────────────────────────────────

/**
 * The animated popup panel containing menu items.
 * Scales in from its trigger origin using Base UI's `--transform-origin` variable.
 */
export function AnimatedDropdownContent({
  children,
  className,
  side = "bottom",
  align = "center",
  sideOffset = 6,
}: AnimatedDropdownContentProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <Menu.Portal>
      <Menu.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        className="z-[3050]"
      >
        <Menu.Popup
          className={cn(
            // Layout (`bui` scopes the component base styles to this portal)
            "bui z-50 min-w-[160px] rounded-xl p-1",
            // Surface
            "bg-popover text-popover-foreground shadow-lg",
            "border border-border/60",
            // Origin-aware transform: Base UI injects --transform-origin
            "origin-[var(--transform-origin)]",
            // Enter animation (CSS @starting-style + transition)
            "transition-[opacity,transform]",
            "starting:scale-95 starting:opacity-0",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            shouldReduceMotion
              ? "duration-0 starting:scale-100 starting:opacity-100 data-[ending-style]:scale-100"
              : "duration-150",
            className,
          )}
        >
          {children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
}

// ─── Item ─────────────────────────────────────────────────────────────────────

/**
 * A single menu item with an animated hover-highlight background.
 * The highlight uses a shared `layoutId` so it glides between items on mouse-over.
 */
export function AnimatedDropdownItem({
  children,
  icon,
  variant = "default",
  disabled,
  onClick,
  className,
  closeOnClick = true,
}: AnimatedDropdownItemProps) {
  const { layoutId, activeId, setActiveId } = useDropdownContext();
  const itemId = useId();
  const shouldReduceMotion = useReducedMotion();

  const isActive = activeId === itemId;

  return (
    <Menu.Item
      disabled={disabled}
      onClick={onClick}
      closeOnClick={closeOnClick}
      className={cn(
        "group relative flex cursor-pointer select-none items-center gap-2.5",
        "rounded-lg px-2.5 py-2 text-sm outline-none",
        "transition-colors duration-75",
        variant === "danger" && "text-destructive focus:text-destructive-foreground",
        variant === "danger-on-hover" && "text-popover-foreground focus:text-destructive-foreground",
        variant === "default" && "text-popover-foreground",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      onMouseEnter={() => setActiveId(itemId)}
      onFocus={() => setActiveId(itemId)}
      onMouseLeave={() => setActiveId(null)}
      onBlur={() => setActiveId(null)}
    >
      {/* Animated highlight: shared across all items in this dropdown instance */}
      <AnimatePresence>
        {isActive && (
          <motion.span
            layoutId={shouldReduceMotion ? undefined : `${layoutId}-highlight`}
            className={cn(
              "absolute inset-0 rounded-lg",
              variant === "default" ? "bg-muted" : "bg-destructive",
            )}
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              shouldReduceMotion
                ? motionTransition.reduced
                : motionTransition.spatial
            }
          />
        )}
      </AnimatePresence>

      {/* Icon */}
      {icon && (
        <span
          className={cn(
            "relative z-10 shrink-0 [&_svg]:size-4 text-muted-foreground",
            variant === "danger" && "text-destructive group-focus:text-destructive-foreground",
            variant === "danger-on-hover" && "text-popover-foreground group-focus:text-destructive-foreground",
            variant === "default" && "text-popover-foreground",
          )}
        >
          {icon}
        </span>
      )}

      {/* Label */}
      <span className="relative z-10 flex-1">{children}</span>
    </Menu.Item>
  );
}

// ─── Separator ────────────────────────────────────────────────────────────────

/** A thin visual divider between groups of items. */
export function AnimatedDropdownSeparator({
  className,
}: {
  className?: string;
}) {
  return (
    <Menu.Separator className={cn("my-1 h-px bg-border/60 mx-1", className)} />
  );
}
