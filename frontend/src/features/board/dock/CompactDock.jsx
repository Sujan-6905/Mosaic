import { useRef, useState } from "react";
import BottomSheet from "@/components/ui/BottomSheet";
import StrokeIcon from "@/components/ui/StrokeIcon";
import { STAMP_KINDS } from "../../../../../shared/canvas/elements/stamps.js";
import { MENU_ITEMS, SHAPE_TOOLS } from "../tools/toolSettings";
import { SHAPE_OPTIONS } from "./shapeOptions";
import { INSERTS, createItems } from "./dockMenus";
import styles from "./index.module.css";

const PEN_TOOLS = [MENU_ITEMS.PENCIL, MENU_ITEMS.PEN, MENU_ITEMS.HIGHLIGHTER];

const Slot = ({ label, icon, active, onClick, ...rest }) => (
    <button type="button" className={styles.tool} aria-pressed={active} aria-label={label} onClick={onClick} {...rest}>
        <StrokeIcon name={icon} size={20} />
    </button>
);

// A phone's dock: the six things reached for most, and one Tools button for every other tool, insert and generator.
export default function CompactDock({
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
    const [sheetOpen, setSheetOpen] = useState(false);
    const pick = (item) => onMenuItemClick?.(item);
    const lastPenRef = useRef(MENU_ITEMS.PENCIL);
    const lastShapeRef = useRef(SHAPE_OPTIONS[0]);
    const isPen = PEN_TOOLS.includes(activeMenuItem);
    const isShape = SHAPE_TOOLS.includes(activeMenuItem);
    if (isPen) lastPenRef.current = activeMenuItem;
    if (isShape) lastShapeRef.current = SHAPE_OPTIONS.find((shape) => shape.item === activeMenuItem) || SHAPE_OPTIONS[0];

    const onDock = new Set([MENU_ITEMS.SELECT, ...PEN_TOOLS, ...SHAPE_TOOLS, MENU_ITEMS.STICKY, MENU_ITEMS.TEXT]);
    if (!canEdit) onDock.add(MENU_ITEMS.HAND);
    const toolTile = (item, label, icon) => ({ key: item, label, icon, active: activeMenuItem === item, onSelect: () => pick(item) });

    const sections = [
        {
            title: "Tools",
            items: [
                ...(canEdit ? [{ key: "redo", label: "Redo", icon: "redo", keepOpen: true, onSelect: () => onActionItemClick?.(MENU_ITEMS.REDO) }] : []),
                toolTile(MENU_ITEMS.LASSO, "Lasso", "lasso"),
                ...(canEdit ? [toolTile(MENU_ITEMS.HAND, "Hand", "hand")] : []),
                ...(canEdit ? [toolTile(MENU_ITEMS.ERASER, "Eraser", "eraser"), toolTile(MENU_ITEMS.BUCKET, "Fill", "bucket")] : []),
                ...(canComment && canEdit ? [toolTile(MENU_ITEMS.COMMENT, "Comment", "comment")] : []),
                toolTile(MENU_ITEMS.LASER, "Laser pointer", "laser"),
                ...(canEdit
                    ? [
                          {
                              key: "assist",
                              label: `Shape Assist ${shapeAssistEnabled ? "on" : "off"}`,
                              icon: "assist",
                              active: shapeAssistEnabled,
                              keepOpen: true,
                              onSelect: () => onToggleShapeAssist?.(),
                          },
                      ]
                    : []),
            ],
        },
        {
            title: "Insert",
            items: canEdit
                ? [
                      ...INSERTS.map((insert) => toolTile(insert.item, insert.label, insert.icon)),
                      ...STAMP_KINDS.map((kind) => ({
                          key: `stamp-${kind.id}`,
                          label: `${kind.label} stamp`,
                          swatch: kind.color,
                          active: activeMenuItem === MENU_ITEMS.STAMP && stampKind === kind.id,
                          onSelect: () => onPickStamp?.(kind.id),
                      })),
                  ]
                : [],
        },
        {
            title: "Create",
            items: createItems({ canEdit, aiEnabled, onOpenAiAssistant, onOpenArchitecture, onOpenMermaid, onOpenPieces }).map((create) => ({
                key: create.key,
                label: create.key === "architecture" ? "From GitHub" : create.key === "mermaid" ? "Mermaid" : create.label,
                icon: create.icon,
                onSelect: () => create.onSelect?.(),
            })),
        },
    ];
    const toolsActive = !onDock.has(activeMenuItem);

    return (
        <>
            <nav className={styles.dock} aria-label="Tools" data-tour="tool-rail" data-disabled={disabled} data-compact>
                {canEdit ? (
                    <Slot label="Undo" icon="undo" onClick={() => onActionItemClick?.(MENU_ITEMS.UNDO)} />
                ) : (
                    <span className={styles.accessBadge}>{canComment ? "Can comment" : "View only"}</span>
                )}
                <Slot label="Select" icon="select" active={activeMenuItem === MENU_ITEMS.SELECT} onClick={() => pick(MENU_ITEMS.SELECT)} />
                {canEdit ? (
                    <>
                        <Slot label="Pencil" icon="pencil" active={isPen} onClick={() => pick(lastPenRef.current)} />
                        <Slot label="Shapes" icon={lastShapeRef.current.icon} active={isShape} onClick={() => pick(lastShapeRef.current.item)} />
                        <Slot label="Sticky note" icon="sticky" active={activeMenuItem === MENU_ITEMS.STICKY} onClick={() => pick(MENU_ITEMS.STICKY)} />
                        <Slot label="Text" icon="text" active={activeMenuItem === MENU_ITEMS.TEXT} onClick={() => pick(MENU_ITEMS.TEXT)} />
                    </>
                ) : (
                    <>
                        <Slot label="Hand" icon="hand" active={activeMenuItem === MENU_ITEMS.HAND} onClick={() => pick(MENU_ITEMS.HAND)} />
                        {canComment && (
                            <Slot label="Comment" icon="comment" active={activeMenuItem === MENU_ITEMS.COMMENT} onClick={() => pick(MENU_ITEMS.COMMENT)} />
                        )}
                    </>
                )}
                <Slot label="All tools" icon="tools" active={toolsActive} aria-haspopup="dialog" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)} />
            </nav>
            <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="All tools" sections={sections} />
        </>
    );
}
