"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faPalette,
    faChevronDown,
    faChevronUp,
    faSearch,
} from "@fortawesome/free-solid-svg-icons";
import styles from "./index.module.css";
import cx from "classnames";
import { COLOR_ARRAY, MENU_ITEMS } from "@/constants";
import { Slider } from "@/components/ui/slider";

const Toolbox = ({
    activeMenuItem = MENU_ITEMS.HAND,
    selectedColor = "#000000",
    selectedBrushSize = 4,
    opacity = 100,
    onColorChange,
    onBrushSizeChange,
    onOpacityChange,
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [showBrushTooltip, setShowBrushTooltip] = useState(false);
    const [tooltipValue, setTooltipValue] = useState(selectedBrushSize);
    const [tooltipPosition, setTooltipPosition] = useState(0);

    const showToolBoxItems = activeMenuItem === MENU_ITEMS.PENCIL;

    const showBrushToolBox =
        activeMenuItem === MENU_ITEMS.PENCIL ||
        activeMenuItem === MENU_ITEMS.ERASER ||
        activeMenuItem === MENU_ITEMS.RECTANGLE ||
        activeMenuItem === MENU_ITEMS.CIRCLE ||
        activeMenuItem === MENU_ITEMS.LINE ||
        activeMenuItem === MENU_ITEMS.ARROW;

    // Don't show toolbox for HAND tool
    if (activeMenuItem === MENU_ITEMS.HAND) {
        return null;
    }

    const handleColorClick = (color) => {
        onColorChange && onColorChange(color);
    };

    const handleBrushSizeChange = (value) => {
        const newSize = value[0];
        setTooltipValue(newSize);
        onBrushSizeChange && onBrushSizeChange(newSize);
    };

    const handleSliderMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const percentage = ((e.clientX - rect.left) / rect.width) * 100;
        setTooltipPosition(Math.max(0, Math.min(100, percentage)));
    };

    const handleOpacityChange = (value) => {
        onOpacityChange && onOpacityChange(value[0]);
    };

    const getToolSpecificColors = () => {
        if (activeMenuItem === MENU_ITEMS.ERASER) {
            return ["#FFFFFF"];
        }
        return COLOR_ARRAY.slice(0, 18); // Show more colors
    };

    // Calculate brush preview size with proper scaling
    const getBrushPreviewSize = (size) => {
        const minPreview = 4;
        const maxPreview = 24;
        const maxBrushSize = 50;
        const scaledSize =
            minPreview +
            ((size - 1) / (maxBrushSize - 1)) * (maxPreview - minPreview);
        return Math.max(minPreview, Math.min(maxPreview, scaledSize));
    };

    // Don't show tooltip for eraser
    const shouldShowTooltip =
        activeMenuItem !== MENU_ITEMS.ERASER && showBrushTooltip;

    return (
        <div className={styles.toolboxContainer}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerContent}>
                    <FontAwesomeIcon icon={faPalette} className={styles.headerIcon} />
                    <span className={styles.headerTitle}>Tools</span>
                </div>
                <button
                    className={styles.toggleButton}
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} />
                </button>
            </div>

            {/* Content */}
            <div className={cx(styles.content, { [styles.expanded]: isExpanded })}>
                {/* Colors */}
                {showToolBoxItems && (
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>Colors</div>
                        <div className={styles.colorsGrid}>
                            {getToolSpecificColors().map((color) => (
                                <button
                                    key={color}
                                    className={cx(styles.colorButton, {
                                        [styles.active]: selectedColor === color,
                                    })}
                                    style={{ backgroundColor: color }}
                                    onClick={() => handleColorClick(color)}
                                    title={color}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Brush Size */}
                {showBrushToolBox && (
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>Brush Size</div>
                        <div className={styles.sliderContainer}>
                            <div
                                className={styles.sliderWrapper}
                                onMouseEnter={() =>
                                    activeMenuItem !== MENU_ITEMS.ERASER &&
                                    setShowBrushTooltip(true)
                                }
                                onMouseLeave={() => setShowBrushTooltip(false)}
                                onMouseMove={handleSliderMouseMove}
                            >
                                <Slider
                                    value={[selectedBrushSize]}
                                    onValueChange={handleBrushSizeChange}
                                    max={50}
                                    min={1}
                                    step={1}
                                    className={styles.slider}
                                />
                                {shouldShowTooltip && (
                                    <div
                                        className={styles.brushTooltip}
                                        style={{
                                            left: `${tooltipPosition}%`,
                                        }}
                                    >
                                        <div className={styles.magnifier}>
                                            <FontAwesomeIcon
                                                icon={faSearch}
                                                className={styles.magnifierIcon}
                                            />
                                            <div className={styles.brushPreview}>
                                                <div
                                                    className={styles.brushDot}
                                                    style={{
                                                        width: `${getBrushPreviewSize(tooltipValue)}px`,
                                                        height: `${getBrushPreviewSize(tooltipValue)}px`,
                                                        backgroundColor: selectedColor,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className={styles.tooltipText}>{tooltipValue}</div>
                                    </div>
                                )}
                            </div>
                            <div className={styles.sizeValue}>{selectedBrushSize}</div>
                        </div>
                    </div>
                )}

                {/* Opacity */}
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>Opacity</div>
                    <div className={styles.sliderContainer}>
                        <div className={styles.sliderWrapper}>
                            <Slider
                                value={[opacity]}
                                onValueChange={handleOpacityChange}
                                max={100}
                                min={10}
                                step={10}
                                className={styles.slider}
                            />
                        </div>
                        <div className={styles.sizeValue}>{opacity}%</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Toolbox;
