import { buildStyledDiagram, centreDiagramOn } from "../diagrams/diagramStyles";
import { MENU_ITEMS } from "../tools/toolSettings";
import { buildConnectorBetween, findModuleBoxId, planDiagramSync } from "../diagrams/architectureBoard";
import { buildArchitectureDiagram } from "../diagrams/architectureDiagram";
import { buildElementsFromSketch } from "../../../../../shared/canvas/strokes/sketchStrokes.js";
import { colorTokenFor } from "../rendering/colorResolver";
import { translateElement } from "../../../../../shared/canvas/geometry/elementGeometry.js";
import { getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { menuItemClick } from "@/store/menuSlice";
import { useCallback } from "react";
import { cameraToFit } from "../camera/viewport";
import { DEFAULT_VIEW_WIDTH, generateElementId, generateStressTestElements } from "../state/boardHelpers";
import { nextZIndex } from "../../../../../shared/canvas/editing/zOrder.js";

// Clears the top bar and the dock, which sit over the board.
const FIT_PADDING = 110;

export const useAiPlacement = (board) => {
    const {
        addGeneratedElements,
        setCamera,
        aiPlacement,
        applyElementUpdates,
        color,
        dispatch,
        elements,
        getCanvasCoordinates,
        getVisibleCanvasBounds,
        jumpToOffscreenBounds,
        setAiPlacement,
        setSelectedElementIds,
        spatialIndexRef,
        viewportSize,
    } = board;

    const placeAiDrawing = useCallback(
        (clientX, clientY) => {
            const { mapped, onPlaced, fitAfterPlacing } = aiPlacement;
            const { x, y } = getCanvasCoordinates(clientX, clientY);
            const bounds = getUnionBounds(mapped.map(({ element }) => element));
            const [dx, dy] = [x - (bounds.minX + bounds.maxX) / 2, y - (bounds.minY + bounds.maxY) / 2];
            const zIndexBase = nextZIndex(elements);
            addGeneratedElements(
                mapped.map(({ elementId, element }) => ({ elementId, element: { ...translateElement(element, dx, dy), zIndex: zIndexBase + element.zIndex } })),
            );
            dispatch(menuItemClick(MENU_ITEMS.SELECT));
            setSelectedElementIds(fitAfterPlacing ? [] : mapped.map(({ elementId }) => elementId));
            setAiPlacement(null);
            onPlaced?.();
            if (fitAfterPlacing)
                setCamera(
                    cameraToFit(
                        { minX: bounds.minX + dx, minY: bounds.minY + dy, maxX: bounds.maxX + dx, maxY: bounds.maxY + dy },
                        viewportSize.width,
                        viewportSize.height,
                        FIT_PADDING,
                    ),
                );
        },
        [setCamera, viewportSize, aiPlacement, elements, addGeneratedElements, getCanvasCoordinates, dispatch, setAiPlacement, setSelectedElementIds],
    );
    const cancelAiPlacement = useCallback(() => setAiPlacement(null), [setAiPlacement]);

    // A new diagram follows the pointer to be placed; one that replaces objects lands where they were,
    // in one undo step with their removal.
    const acceptAiGraph = useCallback(
        (diagram, { recipe = {}, replaces = [], onPlaced } = {}) => {
            const built = buildStyledDiagram({ diagram, recipe, generateElementId });
            if (replaces.length === 0) {
                setAiPlacement({ mapped: centreDiagramOn(built, 0, 0), onPlaced });
                return;
            }
            const visible = getVisibleCanvasBounds();
            const replacedIds = replaces.filter((id) => elements[id]);
            const replacedBounds = getUnionBounds(replacedIds.map((id) => elements[id]));
            const centre = replacedBounds
                ? { x: (replacedBounds.minX + replacedBounds.maxX) / 2, y: (replacedBounds.minY + replacedBounds.maxY) / 2 }
                : { x: visible.x + visible.width / 2, y: visible.y + visible.height / 2 };
            const zIndexBase = nextZIndex(elements);
            const mapped = centreDiagramOn(built, centre.x, centre.y).map(({ elementId, element }) => ({
                elementId,
                element: { ...element, zIndex: zIndexBase + element.zIndex },
            }));
            addGeneratedElements(mapped, { replacing: replacedIds });

            const placed = getUnionBounds(mapped.map(({ element }) => element));
            const inView =
                placed &&
                placed.minX >= visible.x &&
                placed.minY >= visible.y &&
                placed.maxX <= visible.x + visible.width &&
                placed.maxY <= visible.y + visible.height;
            if (placed && !inView) jumpToOffscreenBounds(placed);
            onPlaced?.();
        },
        [getVisibleCanvasBounds, addGeneratedElements, jumpToOffscreenBounds, elements, setAiPlacement],
    );

    const placeArchitectureGraph = useCallback(
        (graph, title) => {
            setAiPlacement({ mapped: buildArchitectureDiagram({ graph, title, generateElementId }), fitAfterPlacing: true });
        },
        [setAiPlacement],
    );

    // Everything arranged by hand stays put: only new modules and links are added,
    // beside what's there, and anything gone is marked for someone to decide on.
    const applyArchitectureSync = useCallback(
        (graph) => {
            const { updates, removedElementIds, newNodes, newInternalEdges, crossEdges } = planDiagramSync(elements, graph);
            if (Object.keys(updates).length > 0) applyElementUpdates(updates);

            const bounds = spatialIndexRef.current.getFullExtent();
            // New parts land beside the diagram in the same style, leaving what's there alone.
            const added =
                newNodes.length > 0
                    ? (() => {
                          const drawn = buildArchitectureDiagram({ graph: { ...graph, nodes: newNodes, edges: newInternalEdges }, generateElementId });
                          const drawnBounds = getUnionBounds(drawn.map(({ element }) => element));
                          const dx = (bounds ? bounds.maxX + 200 : 0) - (drawnBounds?.minX ?? 0);
                          const dy = (bounds ? bounds.minY : 0) - (drawnBounds?.minY ?? 0);
                          const base = nextZIndex(elements);
                          return drawn.map(({ elementId, element }) => ({
                              elementId,
                              element: { ...translateElement(element, dx, dy), zIndex: base + element.zIndex },
                          }));
                      })()
                    : [];
            const afterAdding = { ...elements, ...Object.fromEntries(added.map(({ elementId, element }) => [elementId, element])) };
            let zIndex = nextZIndex(afterAdding);
            const connectors = crossEdges.flatMap((edge) => {
                const startElementId = findModuleBoxId(afterAdding, edge.from);
                const endElementId = findModuleBoxId(afterAdding, edge.to);
                if (!startElementId || !endElementId) return [];
                zIndex += 1;
                const element = buildConnectorBetween({
                    edge,
                    startElementId,
                    endElementId,
                    startElement: afterAdding[startElementId],
                    endElement: afterAdding[endElementId],
                    color,
                    zIndex,
                });
                return [{ elementId: generateElementId(), element }];
            });
            if (added.length + connectors.length > 0) addGeneratedElements([...added, ...connectors]);
            return { addedCount: newNodes.length, removedElementIds };
        },
        [elements, applyElementUpdates, addGeneratedElements, color, spatialIndexRef],
    );

    const acceptAiSketch = useCallback(
        (parts, { onPlaced, title } = {}) => {
            setAiPlacement({
                mapped: buildElementsFromSketch({
                    parts,
                    title,
                    targetCenterX: 0,
                    targetCenterY: 0,
                    color,
                    zIndexBase: 0,
                    generateElementId,
                    schemaVersionExtras: { colorToken: colorTokenFor(color) ?? null },
                }),
                onPlaced,
            });
        },
        [color, setAiPlacement],
    );

    // The ?debug=1 stress test, inserted as one batch so all 3,000 elements draw in a single frame.
    const handleInsertStressTestElements = useCallback(() => {
        const visible = getVisibleCanvasBounds();
        const spawnOrigin = Math.max(visible.width, visible.height, DEFAULT_VIEW_WIDTH);
        addGeneratedElements(generateStressTestElements(3000, spawnOrigin, nextZIndex(elements)));
    }, [addGeneratedElements, elements, getVisibleCanvasBounds]);

    return {
        acceptAiGraph,
        acceptAiSketch,
        applyArchitectureSync,
        cancelAiPlacement,
        handleInsertStressTestElements,
        placeAiDrawing,
        placeArchitectureGraph,
    };
};
