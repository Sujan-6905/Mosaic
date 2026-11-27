import { useState, useRef, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";

import { changeColor, changeDrawStyle, changeFillColor, changeBrushSize, changeOpacity, changeStampKind } from "@/store/toolboxSlice";
import { menuItemClick, actionItemClick, setToolLocked } from "@/store/menuSlice";
import axiosInstance from "@/lib/axiosInstance";
import Whiteboard from ".";
import Dock from "./dock";
import ContextBar from "./contextBar";
import { COLORS, MENU_ITEMS, SIZE_ADJUSTABLE_TOOLS, OPACITY_ADJUSTABLE_TOOLS, maxSizeForTool } from "./tools/toolSettings";
import { hasCommentAccess, hasEditAccess } from "./state/roles";
import { saveToolLockPreference } from "./tools/useToolLifecycle";

// The board with its dock and contextual bar, which talk to it through this component rather than its tree.
export default function BoardWorkspace({ shareId, showToast }) {
    const dispatch = useDispatch();
    const canvasRef = useRef(null);

    const { activeMenuItem, toolLocked } = useSelector((state) => state.menu);
    const drawStyle = useSelector((state) => state.toolbox.drawStyle);
    const stampKind = useSelector((state) => state.toolbox.stampKind);
    const { isConnected } = useSelector((state) => state.connection);

    // Each tool keeps its own style, and a tool the user has never touched has no entry yet.
    const toolboxState = useSelector((state) => state.toolbox[activeMenuItem]);
    const color = toolboxState?.color || COLORS.BLACK;
    const fillColor = toolboxState?.fillColor || null;
    const size = toolboxState?.size || 3;
    const opacity = toolboxState?.opacity || 100;

    const [aiEnabled, setAiEnabled] = useState(false);
    // Off until asked for: on by default it turned ordinary scribbles into shapes.
    const [shapeAssistEnabled, setShapeAssistEnabled] = useState(false);
    // Reported up on join and rejoin so the dock can hide the Comment tool for a viewer.
    const [role, setRole] = useState(null);
    const [selectionRect, setSelectionRect] = useState(null);

    // Whiteboard reports the selection by callback and hands up an updater and actions once; both live in refs,
    // since they are stable and calling them must not re-render the workspace.
    const [selectedElements, setSelectedElements] = useState([]);
    const selectionUpdaterRef = useRef(null);
    const selectionActionsRef = useRef(null);
    const aiAssistantOpenRef = useRef(null);
    const handleSelectionChange = useCallback((_elementIds, elements) => setSelectedElements(elements), []);
    const handleRegisterSelectionUpdater = useCallback((updater) => {
        selectionUpdaterRef.current = updater;
    }, []);
    const handleRegisterSelectionActions = useCallback((actions) => {
        selectionActionsRef.current = actions;
    }, []);
    const handleRegisterAiAssistantOpen = useCallback((open) => {
        aiAssistantOpenRef.current = open;
    }, []);
    const handleUpdateSelectedElement = useCallback((patch, options) => selectionUpdaterRef.current?.(patch, options), []);
    const handleSelectionAction = useCallback((actionName, actionArg) => selectionActionsRef.current?.[actionName]?.(actionArg), []);
    const handleOpenAiAssistant = useCallback(() => aiAssistantOpenRef.current?.(), []);

    // A deployment without an AI key shows no AI affordance at all, so any error leaves it off.
    useEffect(() => {
        axiosInstance
            .get("/api/config")
            .then(({ data }) => setAiEnabled(Boolean(data?.aiEnabled)))
            .catch(() => setAiEnabled(false));
    }, []);

    const handleMenuItemClick = (item) => dispatch(menuItemClick(item));
    const handleActionItemClick = (item) => dispatch(actionItemClick(item));
    const handleColorChange = (newColor) => dispatch(changeColor({ item: activeMenuItem, color: newColor }));
    const handleFillColorChange = (newFillColor) => dispatch(changeFillColor({ item: activeMenuItem, fillColor: newFillColor }));
    const handleBrushSizeChange = useCallback(
        (newSize) => {
            dispatch(changeBrushSize({ item: activeMenuItem, size: newSize }));
        },
        [dispatch, activeMenuItem],
    );
    const handleOpacityChange = useCallback(
        (newOpacity) => {
            dispatch(changeOpacity({ item: activeMenuItem, opacity: newOpacity }));
        },
        [dispatch, activeMenuItem],
    );

    // Steps the active tool's size or opacity by one increment for both the [ / ] keys and the command palette.
    // With a selection under the Select tool it steps the selection's style; returns whether anything changed.
    const adjustToolStyle = useCallback(
        (kind, direction, options) => {
            const isEditingSelection = activeMenuItem === MENU_ITEMS.SELECT && selectedElements.length > 0;
            const primarySelected = selectedElements[0] || null;
            const selectionHasSize = isEditingSelection && ["shape", "path", "connector"].includes(primarySelected?.type);

            if (kind === "size") {
                const canAdjust = selectionHasSize || (!isEditingSelection && SIZE_ADJUSTABLE_TOOLS.includes(activeMenuItem));
                if (!canAdjust) return false;
                const currentSize = selectionHasSize ? primarySelected.size : size;
                const nextSize = Math.max(1, Math.min(maxSizeForTool(activeMenuItem), currentSize + direction));
                if (nextSize === currentSize) return false;
                if (selectionHasSize) handleUpdateSelectedElement({ size: nextSize }, options);
                else handleBrushSizeChange(nextSize);
                return true;
            }

            const canAdjustOpacity = selectionHasSize || (!isEditingSelection && OPACITY_ADJUSTABLE_TOOLS.includes(activeMenuItem));
            if (!canAdjustOpacity) return false;
            const currentOpacity = selectionHasSize ? (primarySelected.opacity ?? 100) : opacity;
            const nextOpacity = Math.max(1, Math.min(100, currentOpacity + direction * 10));
            if (nextOpacity === currentOpacity) return false;
            if (selectionHasSize) handleUpdateSelectedElement({ opacity: nextOpacity }, options);
            else handleOpacityChange(nextOpacity);
            return true;
        },
        [activeMenuItem, selectedElements, size, opacity, handleUpdateSelectedElement, handleBrushSizeChange, handleOpacityChange],
    );

    useEffect(() => {
        const handleKeyDown = (e) => {
            const tag = e.target?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            // e.code and e.shiftKey stay layout-neutral, unlike the shifted character in e.key.
            const growing = e.code === "BracketRight";
            const shrinking = e.code === "BracketLeft";
            if (!growing && !shrinking) return;

            const applied = adjustToolStyle(e.shiftKey ? "opacity" : "size", growing ? 1 : -1, { transient: true });
            if (applied) e.preventDefault();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [adjustToolStyle]);

    return (
        <>
            <Whiteboard
                canvasRef={canvasRef}
                showToast={showToast}
                shareId={shareId}
                aiEnabled={aiEnabled}
                shapeAssistEnabled={shapeAssistEnabled}
                onSelectionChange={handleSelectionChange}
                registerSelectionUpdater={handleRegisterSelectionUpdater}
                registerSelectionActions={handleRegisterSelectionActions}
                registerAiAssistantOpen={handleRegisterAiAssistantOpen}
                onRoleChange={setRole}
                onAdjustToolStyle={adjustToolStyle}
                onSelectionRectChange={setSelectionRect}
            />

            <Dock
                activeMenuItem={activeMenuItem}
                onMenuItemClick={handleMenuItemClick}
                onActionItemClick={handleActionItemClick}
                canEdit={hasEditAccess(role)}
                canComment={hasCommentAccess(role)}
                shapeAssistEnabled={shapeAssistEnabled}
                onToggleShapeAssist={() => setShapeAssistEnabled((prev) => !prev)}
                aiEnabled={aiEnabled}
                onOpenAiAssistant={handleOpenAiAssistant}
                onOpenArchitecture={() => handleSelectionAction("openArchitecture")}
                onOpenMermaid={() => handleSelectionAction("openMermaid")}
                onOpenPieces={() => handleSelectionAction("openPieces")}
                stampKind={stampKind}
                onPickStamp={(kind) => {
                    dispatch(changeStampKind(kind));
                    handleMenuItemClick(MENU_ITEMS.STAMP);
                }}
                disabled={!isConnected}
            />

            <ContextBar
                activeMenuItem={activeMenuItem}
                selectedColor={color}
                selectedFillColor={fillColor}
                selectedBrushSize={size}
                selectedOpacity={opacity}
                onColorChange={handleColorChange}
                onFillColorChange={handleFillColorChange}
                onBrushSizeChange={handleBrushSizeChange}
                onOpacityChange={handleOpacityChange}
                selectedElements={selectedElements}
                selectionRect={selectionRect}
                onUpdateSelectedElement={handleUpdateSelectedElement}
                onSelectionAction={handleSelectionAction}
                aiEnabled={aiEnabled}
                onAskAi={handleOpenAiAssistant}
                canEdit={hasEditAccess(role)}
                canComment={hasCommentAccess(role)}
                onComment={() => handleMenuItemClick(MENU_ITEMS.COMMENT)}
                onUndo={() => handleActionItemClick(MENU_ITEMS.UNDO)}
                onRedo={() => handleActionItemClick(MENU_ITEMS.REDO)}
                drawStyle={drawStyle}
                onDrawStyleChange={(patch) => dispatch(changeDrawStyle(patch))}
                onToolChange={handleMenuItemClick}
                toolLocked={toolLocked}
                onToggleToolLock={() => {
                    saveToolLockPreference(!toolLocked);
                    dispatch(setToolLocked(!toolLocked));
                }}
            />
        </>
    );
}
