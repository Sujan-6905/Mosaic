"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faHand,
    faPencil,
    faEraser,
    faRotateLeft,
    faRotateRight,
    faChevronDown,
    faChevronUp,
    faPencil as faPencilSolid,
    faPen,
    faHighlighter,
    faArrowRight,
    faMinus,
} from "@fortawesome/free-solid-svg-icons";
import {
    faSquare as faSquareOutline,
    faCircle as faCircleOutline,
    faStar as faStarOutline,
} from "@fortawesome/free-regular-svg-icons";
import styles from "./index.module.css";
import cx from "classnames";
import { MENU_ITEMS, LINE_STYLES } from "@/constants";

const TriangleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-triangle">
        <path d="M10.29 3.86L1.87 18a2 2 0 0 0 1.73 3h16.8a2 2 0 0 0 1.73-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
);


const Menu = ({
    activeMenuItem,
    onMenuItemClick,
    onActionItemClick,
    showToast,
}) => {
    const [expandedTool, setExpandedTool] = useState(null);

    const handleClick = (item) => {
        try {
            onMenuItemClick && onMenuItemClick(item);
            if (item === MENU_ITEMS.PENCIL || item === MENU_ITEMS.RECTANGLE) {
                setExpandedTool(expandedTool === item ? null : item);
            } else {
                setExpandedTool(null);
            }
        } catch (error) {
            console.log("Menu click error:", error);
            showToast?.error("Error", "Something went wrong. Please try again.");
        }
    };

    const handleActionItemClick = (item) => {
        try {
            if (item === MENU_ITEMS.UNDO || item === MENU_ITEMS.REDO) {
                onActionItemClick && onActionItemClick(item);
            } else {
                showToast?.info(
                    "Coming Soon",
                    `${item} feature is yet to be implemented`,
                );
            }
        } catch (error) {
            console.log("Action click error:", error);
            showToast?.error("Error", "Something went wrong. Please try again.");
        }
    };

    const handleToolClick = (toolId) => {
        onMenuItemClick(toolId);
    };

    const getShapeIcon = (shapeId) => {
        switch (shapeId) {
            case MENU_ITEMS.RECTANGLE:
                return faSquareOutline;
            case MENU_ITEMS.CIRCLE:
            case MENU_ITEMS.ELLIPSE:
                return faCircleOutline;
            case MENU_ITEMS.TRIANGLE:
                // Return the component itself, not an object.
                return TriangleIcon;
            case MENU_ITEMS.STAR:
                return faStarOutline;
            case MENU_ITEMS.ARROW:
                return faArrowRight;
            case MENU_ITEMS.LINE:
                return faMinus;
            default:
                return faSquareOutline;
        }
    };

    const drawingTools = [
        {
            id: MENU_ITEMS.HAND,
            icon: faHand,
            tooltip: "Hand",
            hasOptions: false,
        },
        {
            id: MENU_ITEMS.PENCIL,
            icon: faPencil,
            tooltip: "Pen",
            hasOptions: true,
        },
        {
            id: MENU_ITEMS.ERASER,
            icon: faEraser,
            tooltip: "Eraser",
            hasOptions: false,
        },
        {
            id: MENU_ITEMS.RECTANGLE,
            icon: getShapeIcon(activeMenuItem),
            tooltip: "Shapes",
            hasOptions: true,
        },
    ];

    const actionItems = [
        { id: MENU_ITEMS.UNDO, icon: faRotateLeft, tooltip: "Undo" },
        { id: MENU_ITEMS.REDO, icon: faRotateRight, tooltip: "Redo" },
    ];

    return (
        <div className={styles.menuContainer}>
            {/* Drawing Tools */}
            <div className={styles.toolsSection}>
                {drawingTools.map((tool) => (
                    <div key={tool.id} className={styles.toolGroup}>
                        <button
                            className={cx(styles.toolButton, {
                                [styles.active]:
                                    activeMenuItem === tool.id ||
                                    (tool.id === MENU_ITEMS.PENCIL &&
                                        (activeMenuItem === MENU_ITEMS.PENCIL_PEN ||
                                            activeMenuItem === MENU_ITEMS.PENCIL_PENCIL ||
                                            activeMenuItem === MENU_ITEMS.PENCIL_HIGHLIGHTER)) ||
                                    (tool.id === MENU_ITEMS.RECTANGLE &&
                                        (activeMenuItem === MENU_ITEMS.RECTANGLE ||
                                            activeMenuItem === MENU_ITEMS.CIRCLE ||
                                            activeMenuItem === MENU_ITEMS.ELLIPSE ||
                                            activeMenuItem === MENU_ITEMS.STAR ||
                                            activeMenuItem === MENU_ITEMS.TRIANGLE ||
                                            activeMenuItem === MENU_ITEMS.ARROW ||
                                            activeMenuItem === MENU_ITEMS.LINE)),
                            })}
                            onClick={() => handleClick(tool.id)}
                            title={tool.tooltip}
                        >
                            {/* Corrected logic to handle the custom TriangleIcon component */}
                            {tool.id === MENU_ITEMS.RECTANGLE && activeMenuItem === MENU_ITEMS.TRIANGLE ? (
                                <TriangleIcon />
                            ) : (
                                <FontAwesomeIcon icon={tool.icon} />
                            )}
                            {tool.hasOptions && (
                                <FontAwesomeIcon
                                    icon={expandedTool === tool.id ? faChevronUp : faChevronDown}
                                    className={styles.expandIcon}
                                />
                            )}
                        </button>
                        {/* Expanded Options */}
                        {tool.hasOptions && expandedTool === tool.id && (
                            <div className={styles.expandedPanel}>
                                <div className={styles.panelContent}>
                                    {tool.id === MENU_ITEMS.PENCIL && (
                                        <div className={styles.optionGroup}>
                                            <div className={styles.optionLabel}>Line Styles</div>
                                            <button
                                                className={cx(styles.optionButton, {
                                                    [styles.activeOption]: activeMenuItem === MENU_ITEMS.PENCIL_PENCIL,
                                                })}
                                                onClick={() => onMenuItemClick(MENU_ITEMS.PENCIL_PENCIL)}
                                            >
                                                <FontAwesomeIcon icon={faPencilSolid} />
                                                Pencil
                                            </button>
                                            <button
                                                className={cx(styles.optionButton, {
                                                    [styles.activeOption]: activeMenuItem === MENU_ITEMS.PENCIL_PEN,
                                                })}
                                                onClick={() => onMenuItemClick(MENU_ITEMS.PENCIL_PEN)}
                                            >
                                                <FontAwesomeIcon icon={faPen} />
                                                Pen
                                            </button>
                                            <button
                                                className={cx(styles.optionButton, {
                                                    [styles.activeOption]: activeMenuItem === MENU_ITEMS.PENCIL_HIGHLIGHTER,
                                                })}
                                                onClick={() => onMenuItemClick(MENU_ITEMS.PENCIL_HIGHLIGHTER)}
                                            >
                                                <FontAwesomeIcon icon={faHighlighter} />
                                                Highlighter
                                            </button>
                                        </div>
                                    )}
                                    {tool.id === MENU_ITEMS.RECTANGLE && (
                                        <div className={styles.optionGroup}>
                                            <div className={styles.optionLabel}>Shape Options</div>
                                            <button
                                                className={cx(styles.optionButton, {
                                                    [styles.activeOption]: activeMenuItem === MENU_ITEMS.RECTANGLE,
                                                })}
                                                onClick={() => onMenuItemClick(MENU_ITEMS.RECTANGLE)}
                                            >
                                                <FontAwesomeIcon icon={faSquareOutline} />
                                                Rectangle
                                            </button>
                                            <button
                                                className={cx(styles.optionButton, {
                                                    [styles.activeOption]: activeMenuItem === MENU_ITEMS.CIRCLE,
                                                })}
                                                onClick={() => onMenuItemClick(MENU_ITEMS.CIRCLE)}
                                            >
                                                <FontAwesomeIcon icon={faCircleOutline} />
                                                Circle
                                            </button>
                                            <button
                                                className={cx(styles.optionButton, {
                                                    [styles.activeOption]: activeMenuItem === MENU_ITEMS.ELLIPSE,
                                                })}
                                                onClick={() => onMenuItemClick(MENU_ITEMS.ELLIPSE)}
                                            >
                                                <FontAwesomeIcon icon={faCircleOutline} />
                                                Ellipse
                                            </button>
                                            <button
                                                className={cx(styles.optionButton, {
                                                    [styles.activeOption]: activeMenuItem === MENU_ITEMS.TRIANGLE,
                                                })}
                                                onClick={() => onMenuItemClick(MENU_ITEMS.TRIANGLE)}
                                            >
                                                <TriangleIcon />
                                                Triangle
                                            </button>
                                            <button
                                                className={cx(styles.optionButton, {
                                                    [styles.activeOption]: activeMenuItem === MENU_ITEMS.STAR,
                                                })}
                                                onClick={() => onMenuItemClick(MENU_ITEMS.STAR)}
                                            >
                                                <FontAwesomeIcon icon={faStarOutline} />
                                                Star
                                            </button>
                                            <button
                                                className={cx(styles.optionButton, {
                                                    [styles.activeOption]: activeMenuItem === MENU_ITEMS.ARROW,
                                                })}
                                                onClick={() => onMenuItemClick(MENU_ITEMS.ARROW)}
                                            >
                                                <FontAwesomeIcon icon={faArrowRight} />
                                                Arrow
                                            </button>
                                            <button
                                                className={cx(styles.optionButton, {
                                                    [styles.activeOption]: activeMenuItem === MENU_ITEMS.LINE,
                                                })}
                                                onClick={() => onMenuItemClick(MENU_ITEMS.LINE)}
                                            >
                                                <FontAwesomeIcon icon={faMinus} />
                                                Line
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Divider */}
            <div className={styles.divider}></div>

            {/* Action Items */}
            <div className={styles.actionsSection}>
                {actionItems.map((item) => (
                    <button
                        key={item.id}
                        className={styles.actionButton}
                        onClick={() => handleActionItemClick(item.id)}
                        title={item.tooltip}
                    >
                        <FontAwesomeIcon icon={item.icon} />
                    </button>
                ))}
            </div>
        </div>
    );
};

export default Menu;
