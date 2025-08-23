"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faHand,
    faPencil,
    faEraser,
    faSquare,
    faRotateLeft,
    faRotateRight,
    faChevronDown,
    faChevronUp,
} from "@fortawesome/free-solid-svg-icons";
import styles from "./index.module.css";
import cx from "classnames";
import { MENU_ITEMS } from "@/constants";

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
            // Expand the tool panel if it has additional options
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
        try {
            if (
                toolId === MENU_ITEMS.HAND ||
                toolId === MENU_ITEMS.PENCIL ||
                toolId === MENU_ITEMS.ERASER
            ) {
                handleClick(toolId);
            } else {
                showToast?.info(
                    "Coming Soon",
                    `${toolId} tool is yet to be implemented`,
                );
            }
        } catch (error) {
            console.log("Tool click error:", error);
            showToast?.error("Error", "Something went wrong. Please try again.");
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
            tooltip: "Pencil",
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
            icon: faSquare,
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
                                [styles.active]: activeMenuItem === tool.id,
                            })}
                            onClick={() => handleToolClick(tool.id)}
                            title={tool.tooltip}
                        >
                            <FontAwesomeIcon icon={tool.icon} />
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
                                            <div className={styles.optionLabel}>Pencil Options</div>
                                            <button
                                                className={styles.optionButton}
                                                onClick={() =>
                                                    showToast?.info(
                                                        "Coming Soon",
                                                        "Pencil styles coming soon",
                                                    )
                                                }
                                            >
                                                Styles
                                            </button>
                                        </div>
                                    )}
                                    {tool.id === MENU_ITEMS.RECTANGLE && (
                                        <div className={styles.optionGroup}>
                                            <div className={styles.optionLabel}>Shape Options</div>
                                            <button
                                                className={styles.optionButton}
                                                onClick={() =>
                                                    showToast?.info(
                                                        "Coming Soon",
                                                        "Rectangle coming soon",
                                                    )
                                                }
                                            >
                                                Rectangle
                                            </button>
                                            <button
                                                className={styles.optionButton}
                                                onClick={() =>
                                                    showToast?.info("Coming Soon", "Circle coming soon")
                                                }
                                            >
                                                Circle
                                            </button>
                                            <button
                                                className={styles.optionButton}
                                                onClick={() =>
                                                    showToast?.info("Coming Soon", "Triangle coming soon")
                                                }
                                            >
                                                Triangle
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
