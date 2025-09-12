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
import { COLOR_ARRAY, MENU_ITEMS, LINE_STYLES, COLORS } from "@/constants";
import { Slider } from "@/components/ui/slider";

const Toolbox = ({
    activeMenuItem,
    selectedColor,
    selectedFillColor,
    selectedBrushSize,
    selectedOpacity,
    onColorChange,
    onFillColorChange,
    onBrushSizeChange,
    onOpacityChange,
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isBorderColorsExpanded, setIsBorderColorsExpanded] = useState(false);
    const [isFillColorsExpanded, setIsFillColorsExpanded] = useState(false);
    const [showBrushTooltip, setShowBrushTooltip] = useState(false);
    const [tooltipValue, setTooltipValue] = useState(selectedBrushSize);
    const [tooltipPosition, setTooltipPosition] = useState(0);

    const isDrawingTool =
        activeMenuItem === MENU_ITEMS.PENCIL_PENCIL ||
        activeMenuItem === MENU_ITEMS.PENCIL_PEN ||
        activeMenuItem === MENU_ITEMS.PENCIL_HIGHLIGHTER;

    const isShapeTool = [
        MENU_ITEMS.RECTANGLE,
        MENU_ITEMS.CIRCLE,
        MENU_ITEMS.ELLIPSE,
        MENU_ITEMS.TRIANGLE,
        MENU_ITEMS.STAR,
        MENU_ITEMS.ARROW,
        MENU_ITEMS.LINE,
    ].includes(activeMenuItem);

    const isEraser = activeMenuItem === MENU_ITEMS.ERASER;
    const isHand = activeMenuItem === MENU_ITEMS.HAND;

    if (isHand) {
        return null;
    }

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

    const getBrushPreviewSize = (size) => {
        const minPreview = 4;
        const maxPreview = 24;
        const maxBrushSize = 50;
        const scaledSize =
            minPreview +
            ((size - 1) / (maxBrushSize - 1)) * (maxPreview - minPreview);
        return Math.max(minPreview, Math.min(maxPreview, scaledSize));
    };

    const shouldShowTooltip = !isEraser && showBrushTooltip;
    const isLineShape =
        activeMenuItem === MENU_ITEMS.LINE || activeMenuItem === MENU_ITEMS.ARROW;
    const isClosedShape = [
        MENU_ITEMS.RECTANGLE,
        MENU_ITEMS.CIRCLE,
        MENU_ITEMS.ELLIPSE,
        MENU_ITEMS.TRIANGLE,
        MENU_ITEMS.STAR,
    ].includes(activeMenuItem);

    const renderColorPalette = (colors, onClick, selectedColor, includeNoneOption = false) => (
        <div className={styles.colorsGrid}>
            {includeNoneOption && (
                <button
                    key="none"
                    className={cx(styles.colorButton, styles.transparent, {
                        [styles.active]: selectedColor === null,
                    })}
                    onClick={() => onClick(null)}
                    title="No Color"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2" />
                    </svg>
                </button>
            )}
            {colors.map((color) => (
                <button
                    key={color}
                    className={cx(styles.colorButton, {
                        [styles.active]: selectedColor === color,
                    })}
                    style={{ backgroundColor: color }}
                    onClick={() => onClick(color)}
                    title={color}
                />
            ))}
        </div>
    );

    const renderColorSection = (title, colors, selectedColor, onColorChange, isExpanded, setIsExpanded, includeNoneOption = false) => {
        const colorsInCollapsedView = includeNoneOption ? 5 : 6;
        const collapsedColors = colors.slice(0, colorsInCollapsedView);
        const expandedColors = colors.slice(colorsInCollapsedView);

        return (
            <div className={styles.section}>
                <div className={styles.sectionTitle}>{title}</div>
                <div className={styles.colorPaletteWrapper}>
                    {renderColorPalette(collapsedColors, onColorChange, selectedColor, includeNoneOption)}
                    {colors.length > colorsInCollapsedView && (
                        <button
                            className={styles.expandColorsButton}
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? "Collapse Colors" : "Expand All Colors"}
                        </button>
                    )}
                    {isExpanded && colors.length > colorsInCollapsedView && (
                        <div className={styles.colorsGrid}>
                            {renderColorPalette(expandedColors, onColorChange, selectedColor)}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Determine the max slider value based on the active tool
    const maxBrushSize = isEraser ? 20 : 50;

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
                {/* Border Color */}
                {(isDrawingTool || isShapeTool) && renderColorSection(
                    isShapeTool ? "Border Color" : "Color",
                    COLOR_ARRAY,
                    selectedColor,
                    onColorChange,
                    isBorderColorsExpanded,
                    setIsBorderColorsExpanded,
                    isClosedShape
                )}

                {/* Fill Color */}
                {isShapeTool && isClosedShape && renderColorSection(
                    "Fill Color",
                    COLOR_ARRAY,
                    selectedFillColor,
                    onFillColorChange,
                    isFillColorsExpanded,
                    setIsFillColorsExpanded,
                    true
                )}
                
                {/* Opacity Slider */}
                {(isDrawingTool || isShapeTool) && (
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>Opacity</div>
                        <div className={styles.sliderContainer}>
                            <div className={styles.sliderWrapper}>
                                <Slider
                                    value={[selectedOpacity]}
                                    onValueChange={onOpacityChange}
                                    max={100}
                                    min={1}
                                    step={1}
                                    className={styles.slider}
                                />
                            </div>
                            <div className={styles.sizeValue}>{selectedOpacity}%</div>
                        </div>
                    </div>
                )}

                {/* Size Slider */}
                {(isDrawingTool || isShapeTool || isEraser) && (
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>
                            {isEraser ? "Eraser Size" : isShapeTool ? "Border Size" : "Brush Size"}
                        </div>
                        <div className={styles.sliderContainer}>
                            <div
                                className={styles.sliderWrapper}
                                onMouseEnter={() => !isEraser && setShowBrushTooltip(true)}
                                onMouseLeave={() => setShowBrushTooltip(false)}
                                onMouseMove={handleSliderMouseMove}
                            >
                                <Slider
                                    value={[selectedBrushSize]}
                                    onValueChange={handleBrushSizeChange}
                                    max={maxBrushSize} // Use the dynamic max value
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
                                                        backgroundColor: isShapeTool ? selectedFillColor : selectedColor,
                                                        border: isShapeTool && selectedColor ? `2px solid ${selectedColor}` : 'none',
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
            </div>
        </div>
    );
};

export default Toolbox;