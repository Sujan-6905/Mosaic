import StrokeIcon from "@/components/ui/StrokeIcon";
import PreviewSidePanels from "./PreviewSidePanels";
import styles from "./PreviewBoard.module.css";

const DOCK_GROUPS = [
    ["undo", "redo"],
    ["select", "hand"],
    ["pencil", "eraser", "shapes", "sticky", "text", "insert"],
    ["comment", "sparkle", "more"],
];

const STICKIES = [
    { left: 6, top: 24, tone: "gold", tilt: -2, text: "Ship branching" },
    { left: 6, top: 43, tone: "coral", tilt: 1.5 },
    { left: 6, top: 62, tone: "mint", tilt: -1 },
    { left: 33, top: 24, tone: "sky", tilt: 1, text: "Templates" },
    { left: 33, top: 43, tone: "lilac", tilt: -2 },
];

const FLOW_NODES = [
    [60, 24],
    [60, 44],
    [78, 34],
    [78, 52],
];

const box = (left, top, width, height) => ({
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`,
});

export const MosaicMark = ({ size }) => (
    <span className={styles.mark} data-size={size}>
        <i />
        <i />
        <i />
        <i />
    </span>
);

const Cursor = ({ name, tone, left, top }) => (
    <span className={styles.cursor} data-tone={tone} data-part="cursor" style={{ left: `${left}%`, top: `${top}%` }} aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M4 3l16 7-7 2.5L10 20z" />
        </svg>
        <span>{name}</span>
    </span>
);

export default function PreviewBoard() {
    return (
        <div className={styles.board} aria-hidden="true">
            <div className={styles.topBar}>
                <span className={styles.pill}>
                    <MosaicMark />
                    <span className={styles.boardName}>Q4 roadmap</span>
                </span>
                <span className={`${styles.pill} ${styles.actions}`}>
                    <span className={styles.avatars}>
                        <span data-tone="sky">AK</span>
                        <span data-tone="mint">RM</span>
                    </span>
                    <span className={styles.barIcon}>
                        <StrokeIcon name="comment" size={16} />
                    </span>
                    <span className={styles.present}>Present</span>
                    <span className={styles.share}>Share</span>
                    <span className={styles.account}>SP</span>
                </span>
            </div>

            <div className={styles.canvas}>
                <span className={styles.column} style={{ left: "6%" }}>
                    Now
                </span>
                <span className={styles.column} style={{ left: "33%" }}>
                    Next
                </span>
                <span className={styles.column} style={{ left: "60%" }}>
                    Signup flow
                </span>
                {STICKIES.map((sticky) => (
                    <span
                        key={`${sticky.left}-${sticky.top}`}
                        className={styles.sticky}
                        data-tone={sticky.tone}
                        style={{ ...box(sticky.left, sticky.top, 21, 15), transform: `rotate(${sticky.tilt}deg)` }}
                    >
                        {sticky.text}
                    </span>
                ))}
                <span className={styles.selection} data-part="selection" style={box(32, 22.5, 23, 18)} />
                <span className={styles.selectionBar} data-part="selection" style={{ left: "43.5%", top: "43%" }}>
                    <span className={styles.swatch} />
                    <span className={styles.barDivider} />
                    <StrokeIcon name="align" size={14} />
                    <StrokeIcon name="more" size={14} />
                    <span className={styles.barDivider} />
                    <span className={styles.askAi}>
                        <StrokeIcon name="sparkle" size={13} />
                        Ask AI
                    </span>
                </span>
                {FLOW_NODES.map(([left, top]) => (
                    <span key={`${left}-${top}`} className={styles.flowNode} data-part="flow" style={box(left, top, 14, 12)} />
                ))}
                <span className={styles.flowEdge} data-part="flow" style={box(74, 35, 4, 0.4)} />
                <span className={styles.flowEdge} data-part="flow" style={box(74, 54, 4, 0.4)} />
                <span className={styles.proposal} data-part="proposal" style={box(58, 21, 37, 51)} />
                <span className={styles.commentPin} data-part="selection" style={{ left: "24%", top: "22%" }}>
                    2
                </span>
                <Cursor name="Akash" tone="sky" left={50} top={62} />
                <Cursor name="Riya" tone="mint" left={20} top={78} />
            </div>

            <div className={styles.dock}>
                {DOCK_GROUPS.map((group) => (
                    <span key={group.join()} className={styles.dockGroup}>
                        {group.map((tool) => (
                            <span key={tool} className={styles.tool} data-active={tool === "select"} data-tool={tool}>
                                <StrokeIcon name={tool} size={17} />
                            </span>
                        ))}
                    </span>
                ))}
            </div>

            <PreviewSidePanels />
        </div>
    );
}
