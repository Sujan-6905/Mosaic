import { useRef, useState } from "react";
import Popover from "@/components/ui/Popover";
import Tooltip from "@/components/ui/Tooltip";
import StrokeIcon from "@/components/ui/StrokeIcon";
import { MENU_ITEMS, MENU_ITEM_SHORTCUTS, SHAPE_TOOLS } from "../tools/toolSettings";
import { SHAPE_OPTIONS } from "./shapeOptions";
import StampRow from "./StampRow";
import CompactDock from "./CompactDock";
import { INSERTS, INSERT_TOOLS, createItems } from "./dockMenus";
import useCompactBoard from "../chrome/useCompactBoard";
import styles from "./index.module.css";

const PEN_TOOLS = [MENU_ITEMS.PENCIL, MENU_ITEMS.PEN, MENU_ITEMS.HIGHLIGHTER];

export function ToolButton({ label, short, icon, active, onClick, shortcut, ...rest }) {
    const button = (
        <button type="button" className={styles.tool} aria-pressed={active} aria-label={label} onClick={onClick} {...rest}>
            <StrokeIcon name={icon} size={19} />
            <span className={styles.toolLabel}>{short}</span>
        </button>
    );
    // An open pop-out already says what this tool is; the tooltip would sit on top of it.
    if (rest["aria-expanded"]) return button;
    return (
        <Tooltip label={label} shortcut={shortcut} side="top">
            {button}
        </Tooltip>
    );
}

export default function Dock(props) {
    const compact = useCompactBoard();
    return compact ? <CompactDock {...props} /> : <WideDock {...props} />;
}

const MenuRow = ({ icon, label, note, shortcut, onClick, active }) => (
    <button type="button" role="menuitem" className={styles.row} data-active={active} onClick={onClick}>
        <span className={styles.rowIcon}>
            <StrokeIcon name={icon} size={17} />
        </span>
        <span className={styles.rowText}>
            <span>{label}</span>
            <span className={styles.rowNote}>{note}</span>
        </span>
        {shortcut && <kbd className={styles.kbd}>{shortcut}</kbd>}
    </button>
);

function WideDock({
    activeMenuItem,
    onMenuItemClick,
    onActionItemClick,
    shapeAssistEnabled,
    onToggleShapeAssist,
    canEdit = true,
    canComment = true,
    aiEnabled = false,
    onOpenAiAssistant,
    onOpenArchitecture,
    onOpenMermaid,
    onOpenPieces,
    stampKind,
    onPickStamp,
    disabled = false,
}) {
    const [openPopout, setOpenPopout] = useState(null);
    const pick = (item) => onMenuItemClick?.(item);

    const isPen = PEN_TOOLS.includes(activeMenuItem);
    const isShape = SHAPE_TOOLS.includes(activeMenuItem);
    const isInsert = INSERT_TOOLS.includes(activeMenuItem);
    // Coming back to a tool picks up the pen or shape last used, not the first in the list.
    const lastPenRef = useRef(MENU_ITEMS.PENCIL);
    const lastShapeRef = useRef(SHAPE_OPTIONS[0]);
    if (isPen) lastPenRef.current = activeMenuItem;
    if (isShape) lastShapeRef.current = SHAPE_OPTIONS.find((shape) => shape.item === activeMenuItem) || SHAPE_OPTIONS[0];
    const activeShape = lastShapeRef.current;
    const isMoreActive = activeMenuItem === MENU_ITEMS.LASER;
    const creates = createItems({ canEdit, aiEnabled, onOpenAiAssistant, onOpenArchitecture, onOpenMermaid, onOpenPieces });

    return (
        <nav className={styles.dock} aria-label="Tools" data-tour="tool-rail" data-disabled={disabled}>
            {canEdit ? (
                <>
                    <div className={styles.group} data-tour="undo-redo">
                        <Tooltip label="Undo" shortcut={MENU_ITEM_SHORTCUTS[MENU_ITEMS.UNDO]} side="top">
                            <button type="button" className={styles.iconButton} aria-label="Undo" onClick={() => onActionItemClick?.(MENU_ITEMS.UNDO)}>
                                <StrokeIcon name="undo" />
                            </button>
                        </Tooltip>
                        <Tooltip label="Redo" shortcut={MENU_ITEM_SHORTCUTS[MENU_ITEMS.REDO]} side="top">
                            <button type="button" className={styles.iconButton} aria-label="Redo" onClick={() => onActionItemClick?.(MENU_ITEMS.REDO)}>
                                <StrokeIcon name="redo" />
                            </button>
                        </Tooltip>
                    </div>
                    <span className={styles.rule} aria-hidden="true" />
                </>
            ) : (
                <>
                    <span className={styles.accessBadge}>{canComment ? "Can comment" : "View only"}</span>
                    <span className={styles.rule} aria-hidden="true" />
                </>
            )}
            <div className={styles.group}>
                <ToolButton
                    label="Select"
                    short="Select"
                    icon="select"
                    shortcut="V"
                    active={activeMenuItem === MENU_ITEMS.SELECT}
                    onClick={() => pick(MENU_ITEMS.SELECT)}
                />
                <ToolButton
                    label="Lasso select"
                    short="Lasso"
                    icon="lasso"
                    shortcut="Q"
                    active={activeMenuItem === MENU_ITEMS.LASSO}
                    onClick={() => pick(MENU_ITEMS.LASSO)}
                />
                <ToolButton
                    label="Hand"
                    short="Hand"
                    icon="hand"
                    shortcut="H"
                    active={activeMenuItem === MENU_ITEMS.HAND}
                    onClick={() => pick(MENU_ITEMS.HAND)}
                />
            </div>
            <span className={styles.rule} aria-hidden="true" />
            {canEdit && (
                <>
                    <div className={styles.group}>
                        <ToolButton label="Pencil" short="Draw" icon="pencil" shortcut="P" active={isPen} onClick={() => pick(lastPenRef.current)} />
                        <ToolButton
                            label="Eraser"
                            short="Erase"
                            icon="eraser"
                            shortcut="E"
                            active={activeMenuItem === MENU_ITEMS.ERASER}
                            onClick={() => pick(MENU_ITEMS.ERASER)}
                        />
                        <ToolButton
                            label="Fill bucket"
                            short="Fill"
                            icon="bucket"
                            shortcut="B"
                            active={activeMenuItem === MENU_ITEMS.BUCKET}
                            onClick={() => pick(MENU_ITEMS.BUCKET)}
                        />
                        <ToolButton
                            label="Shapes"
                            short="Shapes"
                            icon={activeShape.icon}
                            shortcut="R"
                            active={isShape}
                            onClick={() => pick(activeShape.item)}
                        />
                        <ToolButton
                            label="Sticky note"
                            short="Sticky"
                            icon="sticky"
                            shortcut="S"
                            active={activeMenuItem === MENU_ITEMS.STICKY}
                            onClick={() => pick(MENU_ITEMS.STICKY)}
                        />
                        <ToolButton
                            label="Text"
                            short="Text"
                            icon="text"
                            shortcut="T"
                            active={activeMenuItem === MENU_ITEMS.TEXT}
                            onClick={() => pick(MENU_ITEMS.TEXT)}
                        />
                        <Popover
                            align="center"
                            className={styles.popoverRoot}
                            isOpen={openPopout === "insert"}
                            onOpenChange={(next) => setOpenPopout(next ? "insert" : null)}
                            trigger={
                                <ToolButton
                                    label="Insert"
                                    short="Insert"
                                    icon="insert"
                                    active={isInsert}
                                    aria-haspopup="menu"
                                    aria-expanded={openPopout === "insert"}
                                />
                            }
                        >
                            <div className={styles.pop} role="menu" aria-label="Insert">
                                {INSERTS.map((insert) => (
                                    <MenuRow
                                        key={insert.item}
                                        icon={insert.icon}
                                        label={insert.label}
                                        note={insert.note}
                                        shortcut={MENU_ITEM_SHORTCUTS[insert.item]}
                                        active={activeMenuItem === insert.item}
                                        onClick={() => {
                                            pick(insert.item);
                                            setOpenPopout(null);
                                        }}
                                    />
                                ))}
                                <StampRow
                                    activeKind={stampKind}
                                    isActive={activeMenuItem === MENU_ITEMS.STAMP}
                                    onPick={(kind) => {
                                        onPickStamp?.(kind);
                                        setOpenPopout(null);
                                    }}
                                />
                            </div>
                        </Popover>
                    </div>
                    <span className={styles.rule} aria-hidden="true" />
                </>
            )}
            <div className={styles.group}>
                {canComment && (
                    <ToolButton
                        label="Comment"
                        short="Comment"
                        icon="comment"
                        shortcut="M"
                        active={activeMenuItem === MENU_ITEMS.COMMENT}
                        onClick={() => pick(MENU_ITEMS.COMMENT)}
                    />
                )}
                {creates.length > 0 && (
                    <Popover
                        align="center"
                        className={styles.popoverRoot}
                        isOpen={openPopout === "create"}
                        onOpenChange={(next) => setOpenPopout(next ? "create" : null)}
                        trigger={
                            <ToolButton
                                label="Create"
                                short="Create"
                                icon="sparkle"
                                aria-haspopup="menu"
                                aria-expanded={openPopout === "create"}
                                data-tour="create"
                            />
                        }
                    >
                        <div className={styles.pop} role="menu" aria-label="Create">
                            {creates.map((create) => (
                                <MenuRow
                                    key={create.key}
                                    icon={create.icon}
                                    label={create.label}
                                    note={create.note}
                                    shortcut={create.shortcut}
                                    onClick={() => {
                                        setOpenPopout(null);
                                        create.onSelect?.();
                                    }}
                                />
                            ))}
                        </div>
                    </Popover>
                )}
                <Popover
                    align="end"
                    className={styles.popoverRoot}
                    isOpen={openPopout === "more"}
                    onOpenChange={(next) => setOpenPopout(next ? "more" : null)}
                    trigger={
                        <ToolButton
                            label="More tools"
                            short="More"
                            icon="more"
                            active={isMoreActive}
                            aria-haspopup="menu"
                            aria-expanded={openPopout === "more"}
                        />
                    }
                >
                    <div className={styles.pop} role="menu" aria-label="More tools">
                        <button
                            type="button"
                            role="menuitemradio"
                            aria-checked={activeMenuItem === MENU_ITEMS.LASER}
                            className={styles.row}
                            data-active={activeMenuItem === MENU_ITEMS.LASER}
                            onClick={() => {
                                pick(MENU_ITEMS.LASER);
                                setOpenPopout(null);
                            }}
                        >
                            <span className={styles.rowIcon}>
                                <StrokeIcon name="laser" size={17} />
                            </span>
                            <span className={styles.rowText}>
                                <span>Laser pointer</span>
                                <span className={styles.rowNote}>Point at things; the trail fades</span>
                            </span>
                            <kbd className={styles.kbd}>K</kbd>
                        </button>
                        {canEdit && (
                            <button
                                type="button"
                                role="menuitemcheckbox"
                                aria-checked={shapeAssistEnabled}
                                className={styles.row}
                                data-active={shapeAssistEnabled}
                                onClick={() => onToggleShapeAssist?.()}
                            >
                                <span className={styles.rowIcon}>
                                    <StrokeIcon name="assist" size={17} />
                                </span>
                                <span className={styles.rowText}>
                                    <span>Shape Assist {shapeAssistEnabled ? "on" : "off"}</span>
                                    <span className={styles.rowNote}>Rough strokes snap to clean shapes</span>
                                </span>
                            </button>
                        )}
                    </div>
                </Popover>
            </div>
        </nav>
    );
}
