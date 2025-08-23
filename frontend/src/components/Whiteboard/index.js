"use client";

import {
    memo,
    useEffect,
    useRef,
    useLayoutEffect,
    useState,
    useCallback,
} from "react";
import { useSelector, useDispatch } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMinus, faPlus, faExpand } from "@fortawesome/free-solid-svg-icons";
import { MENU_ITEMS } from "@/constants";
import { actionItemClick } from "@/slice/menuSlice";
import { headerItemClick } from "@/slice/headerSlice";
import styles from "./index.module.css";
import cx from "classnames";
import { socket } from "../../socket.js";
import axiosInstance from "@/axiosInstance";
import { useSession } from "next-auth/react";

// Generate unique element ID
const generateElementId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const Whiteboard = ({ className, onCanvasReady, showToast, shareId }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const contextRef = useRef(null);
    const shouldDraw = useRef(false);
    const isDrawing = useRef(false);
    const isPanning = useRef(false);
    const lastPanPoint = useRef({ x: 0, y: 0 });
    const currentPath = useRef([]);
    const currentElementId = useRef(null);

    const [isLoading, setIsLoading] = useState(true);
    const [elements, setElements] = useState({});
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [zoom, setZoom] = useState(100);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const [hasDrawn, setHasDrawn] = useState(false);
    const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
    const [isConnected, setIsConnected] = useState(false);
    const [roomJoined, setRoomJoined] = useState(false);
    const [elementCount, setElementCount] = useState(0);

    const { activeMenuItem, actionMenuItem } = useSelector((state) => state.menu);
    const { actionHeaderItem } = useSelector((state) => state.header);
    const { color, size } = useSelector((state) => state.toolbox[activeMenuItem]);

    // Use NextAuth's useSession hook
    const { data: session, status } = useSession();

    const dispatch = useDispatch();

    const MIN_ZOOM = 80;
    const MAX_ZOOM = 400;
    const CANVAS_SIZE = 1500;

    // Get visible canvas bounds for export
    const getVisibleCanvasBounds = useCallback(() => {
        if (!containerRef.current)
            return { x: 0, y: 0, width: CANVAS_SIZE, height: CANVAS_SIZE };

        const containerRect = containerRef.current.getBoundingClientRect();
        const scale = zoom / 100;

        const visibleX = Math.max(0, (-panX - canvasOffset.x) / scale);
        const visibleY = Math.max(0, (-panY - canvasOffset.y) / scale);
        const visibleWidth = Math.min(
            CANVAS_SIZE - visibleX,
            containerRect.width / scale,
        );
        const visibleHeight = Math.min(
            CANVAS_SIZE - visibleY,
            containerRect.height / scale,
        );

        return {
            x: visibleX,
            y: visibleY,
            width: visibleWidth,
            height: visibleHeight,
        };
    }, [zoom, panX, panY, canvasOffset]);

    useEffect(() => {
        if (shareId) {
            socket.emit("client:joinRoom", { shareId });
        }
    }, [shareId]);

    // Socket connection and room management
    useEffect(() => {
        const handleConnect = () => {
            setIsConnected(true);

            if (shareId) {
                // Try to join existing room or create new one
                socket.emit("client:joinRoom", { shareId });
            }
        };

        const handleDisconnect = () => {
            setIsConnected(false);
            setRoomJoined(false);
            console.log("Disconnected from server");
        };

        const handleJoinedRoom = (canvasElements) => {
            setRoomJoined(true);
            setElements(canvasElements || {});
            showToast?.success("Connected", "Joined collaborative session");
            console.log("Joined room with elements:", canvasElements);
        };

        const handleCanvasNotFound = () => {
            // Create new canvas
            socket.emit("client:createCanvas", { shareId });
            showToast?.info("New Canvas", "Created new collaborative canvas");
        };

        const handleCanvasAccessDenied = () => {
            showToast?.error(
                "Access Denied",
                "You don't have permission to edit this canvas",
            );
        };

        const handleAddNewElement = ({ elementId, element }) => {
            console.log("added New Element");
            setElements((prev) => ({
                ...prev,
                [elementId]: element,
            }));
        };

        const handleDeleteElement = ({ elementId }) => {
            setElements((prev) => {
                const newElements = { ...prev };
                delete newElements[elementId];
                return newElements;
            });

            // Remove from local undo/redo stacks if it exists
            setUndoStack((prev) => prev.filter((id) => id !== elementId));
            setRedoStack((prev) => prev.filter((id) => id !== elementId));
        };

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.on("server:joinedRoom", handleJoinedRoom);
        socket.on("server:canvasNotFound", handleCanvasNotFound);
        socket.on("server:canvasAccessDenied", handleCanvasAccessDenied);
        socket.on("server:addNewElement", handleAddNewElement);
        socket.on("server:deleteElement", handleDeleteElement);

        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            socket.off("server:joinedRoom", handleJoinedRoom);
            socket.off("server:canvasNotFound", handleCanvasNotFound);
            socket.off("server:canvasAccessDenied", handleCanvasAccessDenied);
            socket.off("server:addNewElement", handleAddNewElement);
            socket.off("server:deleteElement", handleDeleteElement);
        };
    }, [shareId, showToast]);

    const renderElements = () => {
        if (!contextRef.current) return;

        const context = contextRef.current;

        // Clear canvas
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // Render all elements
        Object.entries(elements).forEach(([elementId, element]) => {
            if (element?.type === "path") {
                renderPath(context, element);
            }

            setElementCount(Object.keys(elements).length);

            if (Object.keys(elements).length > 0) {
                setHasDrawn(true);
            }
        });
    };

    // Render all elements on canvas
    useEffect(() => {
        renderElements();
    }, [renderElements]);

    // Render a single path element
    const renderPath = useCallback((context, element) => {
        if (!element.points || element.points.length < 2) return;

        context.save();
        context.strokeStyle = element.color;
        context.lineWidth = element.size;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.globalCompositeOperation = "source-over"; // Always source-over for drawing existing elements

        context.beginPath();
        context.moveTo(element.points[0].x, element.points[0].y);

        for (let i = 1; i < element.points.length; i++) {
            context.lineTo(element.points[i].x, element.points[i].y);
        }

        context.stroke();
        context.restore();
    }, []);

    // Handle zoom controls
    const handleZoomIn = useCallback(() => {
        setZoom((prev) => Math.min(prev + 25, MAX_ZOOM));
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoom((prev) => Math.max(prev - 25, MIN_ZOOM));
    }, []);

    const handleZoomReset = useCallback(() => {
        setZoom(100);
        setPanX(0);
        setPanY(0);
    }, []);

    // Get canvas coordinates
    const getCanvasCoordinates = useCallback(
        (clientX, clientY) => {
            if (!canvasRef.current || !containerRef.current) return { x: 0, y: 0 };

            const rect = containerRef.current.getBoundingClientRect();
            const x = (clientX - rect.left - panX - canvasOffset.x) / (zoom / 100);
            const y = (clientY - rect.top - panY - canvasOffset.y) / (zoom / 100);

            return { x, y };
        },
        [zoom, panX, panY, canvasOffset],
    );

    // Check if point is inside any element (for eraser)
    const getElementAtPoint = useCallback(
        (x, y) => {
            const tolerance = 10; // Pixel tolerance for hit detection

            for (const [elementId, element] of Object.entries(elements)) {
                if (element?.type === "path" && element.points) {
                    for (const point of element.points) {
                        const distance = Math.sqrt(
                            Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2),
                        );
                        if (distance <= tolerance + (element.size || 1) / 2) {
                            return elementId;
                        }
                    }
                }
            }
            return null;
        },
        [elements],
    );

    // Add element to undo stack and emit to socket
    const addElement = useCallback(
        (elementId, element) => {
            setElements((prev) => ({
                ...prev,
                [elementId]: element,
            }));

            setUndoStack((prev) => [...prev, elementId]);
            setRedoStack([]); // Clear redo stack when new action is performed

            // Emit to socket
            if (roomJoined && shareId) {
                socket.emit("client:updateCanvas", {
                    shareId,
                    operation: "insert",
                    elementId,
                    element,
                });
            }
        },
        [roomJoined, shareId],
    );

    // Remove element and emit to socket
    const removeElement = useCallback(
        (elementId) => {
            const elementToRemove = elements[elementId];
            if (!elementToRemove) return;

            setElements((prev) => {
                const newElements = { ...prev };
                delete newElements[elementId];
                return newElements;
            });

            // Add to undo stack for eraser (as a 'delete' operation)
            setUndoStack((prev) => [
                ...prev,
                { id: elementId, element: elementToRemove, operation: "delete" },
            ]);
            setRedoStack([]); // Clear redo stack

            // Emit to socket
            if (roomJoined && shareId) {
                socket.emit("client:updateCanvas", {
                    shareId,
                    operation: "delete",
                    elementId,
                });
            }
        },
        [elements, roomJoined, shareId],
    );

    // Handle action items (undo/redo)
    useEffect(() => {
        if (!actionMenuItem) return;
        console.log(actionMenuItem);

        switch (actionMenuItem) {
            case MENU_ITEMS.UNDO:
                if (undoStack.length > 0) {
                    const lastAction = undoStack[undoStack.length - 1];
                    setUndoStack((prev) => prev.slice(0, -1));

                    if (lastAction.operation === "delete") {
                        // If the last action was a delete, re-add the element
                        setElements((prev) => ({
                            ...prev,
                            [lastAction.id]: lastAction.element,
                        }));
                        setRedoStack((prev) => [
                            ...prev,
                            { id: lastAction.id, operation: "insert" },
                        ]); // Redo will delete it again
                        if (roomJoined && shareId) {
                            socket.emit("client:updateCanvas", {
                                shareId,
                                operation: "redo", // Treat as redo for other clients to re-add
                                elementId: lastAction.id,
                                element: lastAction.element,
                            });
                        }
                    } else {
                        // Default undo (remove last drawn element)
                        const elementId = lastAction; // Assuming it's just the ID for drawing
                        const elementToRedo = elements[elementId]; // Get element data before removing
                        setElements((prev) => {
                            const newElements = { ...prev };
                            delete newElements[elementId];
                            return newElements;
                        });
                        setRedoStack((prev) => [
                            ...prev,
                            { id: elementId, element: elementToRedo, operation: "delete" },
                        ]); // Redo will re-add it
                        if (roomJoined && shareId) {
                            socket.emit("client:updateCanvas", {
                                shareId,
                                operation: "undo",
                                elementId: elementId,
                            });
                        }
                    }
                } else {
                    showToast?.info("Nothing to Undo", "No more actions to undo");
                }
                break;

            case MENU_ITEMS.REDO:
                if (redoStack.length > 0) {
                    const lastRedoAction = redoStack[redoStack.length - 1];
                    setRedoStack((prev) => prev.slice(0, -1));

                    if (lastRedoAction.operation === "insert") {
                        // If redo action is to insert, re-add the element
                        setElements((prev) => ({
                            ...prev,
                            [lastRedoAction.id]: lastRedoAction.element,
                        }));
                        setUndoStack((prev) => [...prev, lastRedoAction.id]); // Undo will remove it again
                        if (roomJoined && shareId) {
                            socket.emit("client:updateCanvas", {
                                shareId,
                                operation: "insert", // Treat as insert for other clients
                                elementId: lastRedoAction.id,
                                element: lastRedoAction.element,
                            });
                        }
                    } else {
                        // Default redo (re-add last undone element)
                        const elementId = lastRedoAction.id; // Assuming it's just the ID for drawing
                        const elementToUndo = lastRedoAction.element; // Get element data from redo stack
                        setElements((prev) => ({ ...prev, [elementId]: elementToUndo }));
                        setUndoStack((prev) => [...prev, elementId]);
                        if (roomJoined && shareId) {
                            socket.emit("client:updateCanvas", {
                                shareId,
                                operation: "redo", // Treat as redo for other clients
                                elementId: elementId,
                                element: elementToUndo,
                            });
                        }
                    }
                } else {
                    showToast?.info("Nothing to Redo", "No more actions to redo");
                }
                break;

            default:
                break;
        }

        dispatch(actionItemClick(null));
    }, [
        actionMenuItem,
        undoStack,
        redoStack,
        elements,
        roomJoined,
        shareId,
        dispatch,
        showToast,
    ]);

    // Handle header item clicks
    useEffect(() => {
        if (!canvasRef.current || !actionHeaderItem) return;

        const canvas = canvasRef.current;

        switch (actionHeaderItem) {
            case "Export":
                console.log("export button clicked");
                // Create a temporary canvas for the full export
                const exportCanvas = document.createElement("canvas");
                const exportContext = exportCanvas.getContext("2d");

                // Set the temporary canvas dimensions to match the full whiteboard size
                exportCanvas.width = CANVAS_SIZE;
                exportCanvas.height = CANVAS_SIZE;

                // Fill with white background
                exportContext.fillStyle = "#ffffff";
                exportContext.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

                // Draw the entire original canvas onto the temporary canvas
                exportContext.drawImage(
                    canvas,
                    0, // Source X
                    0, // Source Y
                    CANVAS_SIZE, // Source Width
                    CANVAS_SIZE, // Source Height
                    0, // Destination X
                    0, // Destination Y
                    CANVAS_SIZE, // Destination Width
                    CANVAS_SIZE, // Destination Height
                );

                const URL = exportCanvas.toDataURL("image/png", 1.0);
                const anchor = document.createElement("a");
                anchor.href = URL;
                anchor.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.png`;
                anchor.click();

                showToast?.success("Downloaded", "Whiteboard exported successfully");
                break;

            case "Share":
                /*if (shareId) {
                    navigator.clipboard.writeText(
                        `${window.location.origin}?shareId=${shareId}`,
                    );
                    showToast?.success("Link Copied", "Share link copied to clipboard");
                }*/
                // no need for this as it will itself come with a copy button. let the user copy manually by clicking the button
                break;

            case "Collaborators":
                //showToast?.info("Collaborators", `Canvas ID: ${shareId}`);
                break;

            default:
                break;
        }

        dispatch(headerItemClick(null));
    }, [actionHeaderItem, shareId, showToast, dispatch]);

    // Initialize canvas
    useLayoutEffect(() => {
        if (!canvasRef.current || !containerRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        contextRef.current = context;

        const container = containerRef.current;

        canvas.width = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;

        // This block is what caused the scaling issue for CSS elements
        // by making the drawing buffer a different size. To ensure a consistent
        // 1500x1500px experience across all devices, we will force the DPR to 1
        // for the drawing buffer size, while retaining the CSS size.
        // This means the canvas will not be "retina-ready" but will be
        // a fixed size as requested.

        // const dpr = window.devicePixelRatio || 1;
        // if (dpr > 1) {
        //     canvas.width = CANVAS_SIZE * dpr;
        //     canvas.height = CANVAS_SIZE * dpr;
        //     context.scale(dpr, dpr);
        // }

        canvas.style.width = CANVAS_SIZE + "px";
        canvas.style.height = CANVAS_SIZE + "px";

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        const containerRect = container.getBoundingClientRect();
        const initialOffsetX = -(CANVAS_SIZE - containerRect.width) / 2;
        const initialOffsetY = -(CANVAS_SIZE - containerRect.height) / 2;

        setCanvasOffset({ x: initialOffsetX, y: initialOffsetY });
        setPanX(0);
        setPanY(0);

        setIsLoading(false);

        if (onCanvasReady) {
            onCanvasReady(canvas);
        }
    }, [onCanvasReady]);

    // Mouse event handlers
    const handleMouseDown = useCallback(
        (e) => {
            if (!canvasRef.current) return;

            const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);

            if (e.button === 1 || (e.button === 0 && e.ctrlKey) || e.button === 2) {
                e.preventDefault();
                isPanning.current = true;
                lastPanPoint.current = { x: e.clientX, y: e.clientY };
                return;
            }

            if (activeMenuItem === MENU_ITEMS.HAND) {
                isPanning.current = true;
                lastPanPoint.current = { x: e.clientX, y: e.clientY };
                return;
            }

            if (activeMenuItem === MENU_ITEMS.ERASER) {
                const elementId = getElementAtPoint(x, y);
                if (elementId) {
                    removeElement(elementId);
                    showToast?.info("Element Erased", "Element removed from canvas");
                }
                return;
            }

            if (activeMenuItem === MENU_ITEMS.PENCIL) {
                shouldDraw.current = true;
                isDrawing.current = true;

                currentElementId.current = generateElementId();
                currentPath.current = [{ x, y }];
            } else {
                showToast?.info(
                    "Coming Soon",
                    `${activeMenuItem} tool is yet to be implemented`,
                );
            }
        },
        [
            activeMenuItem,
            getCanvasCoordinates,
            getElementAtPoint,
            removeElement,
            showToast,
        ],
    );

    const handleMouseMove = useCallback(
        (e) => {
            if (isPanning.current) {
                const deltaX = e.clientX - lastPanPoint.current.x;
                const deltaY = e.clientY - lastPanPoint.current.y;

                setPanX((prev) => prev + deltaX);
                setPanY((prev) => prev + deltaY);

                lastPanPoint.current = { x: e.clientX, y: e.clientY };
                return;
            }

            if (!shouldDraw.current || activeMenuItem !== MENU_ITEMS.PENCIL) return;

            const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
            currentPath.current.push({ x, y });

            // Create temporary element for real-time drawing
            if (currentElementId.current) {
                const tempElement = {
                    type: "path",
                    points: [...currentPath.current], // Use a copy to avoid mutation issues
                    color: color,
                    size: size,
                    operation: "source-over",
                };

                setElements((prev) => ({
                    ...prev,
                    [currentElementId.current]: tempElement,
                }));
            }
        },
        [getCanvasCoordinates, activeMenuItem, color, size],
    );

    const handleMouseUp = useCallback(() => {
        if (isPanning.current) {
            isPanning.current = false;
            return;
        }

        if (!shouldDraw.current || activeMenuItem !== MENU_ITEMS.PENCIL) return;

        shouldDraw.current = false;
        isDrawing.current = false;

        if (currentElementId.current && currentPath.current.length > 1) {
            const element = {
                type: "path",
                points: [...currentPath.current],
                color: color,
                size: size,
                operation: "source-over",
                timestamp: Date.now(),
            };

            addElement(currentElementId.current, element);
        }

        currentElementId.current = null;
        currentPath.current = [];
    }, [activeMenuItem, color, size, addElement]);

    // Touch event handlers
    const handleTouchStart = useCallback(
        (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            handleMouseDown({
                clientX: touch.clientX,
                clientY: touch.clientY,
                button: 0,
            });
        },
        [handleMouseDown],
    );

    const handleTouchMove = useCallback(
        (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
        },
        [handleMouseMove],
    );

    const handleTouchEnd = useCallback(
        (e) => {
            e.preventDefault();
            handleMouseUp();
        },
        [handleMouseUp],
    );

    // Wheel event for zooming
    const handleWheel = useCallback((e) => {
        e.preventDefault();

        // Check for touchpad pinch gesture (e.ctrlKey on Mac/Windows)
        const isPinch = e.ctrlKey || e.metaKey;
        // Set the zoom step size. A smaller step is better for pinches.
        const zoomStep = isPinch ? 5 : 25;

        // Normalize the mouse wheel delta.
        const delta = Math.sign(e.deltaY) * -1;
        // Calculate the new zoom level, clamping it between the min and max values.
        const newZoom = Math.max(
            MIN_ZOOM,
            Math.min(MAX_ZOOM, zoom + delta * zoomStep),
        );

        // If the zoom level doesn't change, there's no need to proceed.
        if (newZoom === zoom) {
            return;
        }

        // Get the bounding rectangle of the main container.
        const containerRect = containerRef.current.getBoundingClientRect();

        // Calculate the cursor's position relative to the container.
        const cursorX = e.clientX - containerRect.left;
        const cursorY = e.clientY - containerRect.top;

        // Calculate the old and new scaling factors.
        const oldScale = zoom / 100;
        const newScale = newZoom / 100;

        // Calculate the cursor's position on the canvas's original coordinate system.
        // This is the key change. We now include the canvasOffset in the calculation
        // to find the true "world" coordinates under the cursor.
        const worldXBefore = (cursorX - panX - canvasOffset.x) / oldScale;
        const worldYBefore = (cursorY - panY - canvasOffset.y) / oldScale;

        // Calculate the new pan position to keep the content under the cursor stable.
        const newPanX = cursorX - (worldXBefore * newScale + canvasOffset.x);
        const newPanY = cursorY - (worldYBefore * newScale + canvasOffset.y);

        // Update the state with the new zoom and pan values.
        setZoom(newZoom);
        setPanX(newPanX);
        setPanY(newPanY);
    }, [zoom, panX, panY, canvasOffset]);

    // Prevent context menu
    const handleContextMenu = useCallback((e) => {
        e.preventDefault();
    }, []);

    // Add event listeners
    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;

        container.addEventListener("mousedown", handleMouseDown, {
            passive: false,
        });
        container.addEventListener("mousemove", handleMouseMove, {
            passive: false,
        });
        container.addEventListener("mouseup", handleMouseUp, { passive: false });
        container.addEventListener("wheel", handleWheel, { passive: false });
        container.addEventListener("contextmenu", handleContextMenu, {
            passive: false,
        });
        container.addEventListener("touchstart", handleTouchStart, {
            passive: false,
        });
        container.addEventListener("touchmove", handleTouchMove, {
            passive: false,
        });
        container.addEventListener("touchend", handleTouchEnd, { passive: false });

        return () => {
            container.removeEventListener("mousedown", handleMouseDown);
            container.removeEventListener("mousemove", handleMouseMove);
            container.removeEventListener("mouseup", handleMouseUp);
            container.removeEventListener("wheel", handleWheel);
            container.removeEventListener("contextmenu", handleContextMenu);
            container.removeEventListener("touchstart", handleTouchStart);
            container.removeEventListener("touchmove", handleTouchMove);
            container.removeEventListener("touchend", handleTouchEnd);
        };
    }, [
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleWheel,
        handleContextMenu,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
    ]);

    return (
        <div ref={containerRef} className={styles.whiteboardContainer}>
            {isLoading && (
                <div className={styles.loadingOverlay}>
                    <div className={styles.loadingSpinner}></div>
                    <p className={styles.loadingText}>Preparing your canvas...</p>
                </div>
            )}

            {/* Connection Status */}
            <div className={styles.connectionStatus}>
                <div
                    className={cx(styles.statusIndicator, {
                        [styles.connected]: isConnected && roomJoined,
                        [styles.connecting]: isConnected && !roomJoined,
                        [styles.disconnected]: !isConnected,
                    })}
                >
                    <span className={styles.statusDot}></span>
                    <span className={styles.statusText}>
                        {isConnected && roomJoined
                            ? "Connected"
                            : isConnected
                                ? "Connecting..."
                                : "Disconnected"}
                    </span>
                </div>
            </div>

            <div
                className={cx(styles.canvasWrapper, {
                    [styles.drawing]: isDrawing.current,
                    [styles.erasing]: activeMenuItem === MENU_ITEMS.ERASER,
                    [styles.panning]: activeMenuItem === MENU_ITEMS.HAND,
                })}
            >
                <div
                    className={styles.canvasContent}
                    style={{
                        transform: `translate(${panX + canvasOffset.x}px, ${panY + canvasOffset.y}px) scale(${zoom / 100})`,
                    }}
                >
                    <canvas ref={canvasRef} className={styles.whiteboardCanvas} />
                    <div
                        className={styles.gridOverlay}
                        style={{
                            width: `${CANVAS_SIZE}px`,
                            height: `${CANVAS_SIZE}px`,
                        }}
                    ></div>
                </div>
            </div>

            {/* Welcome Message */}
            <div className={cx(styles.welcomeMessage, { [styles.hidden]: hasDrawn })}>
                <div className={styles.welcomeIcon}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                    </svg>
                </div>
                <h3 className={styles.welcomeTitle}>Start Creating</h3>
                <p className={styles.welcomeText}>
                    Select a tool from the menu and begin drawing on your canvas
                </p>
                <div className={styles.welcomeStats}>
                    <div className={styles.stat}>
                        <div className={styles.statValue}>1500x1500</div>
                        <div className={styles.statLabel}>Canvas Size</div>
                    </div>
                    <div className={styles.stat}>
                        <div className={styles.statValue}>HD</div>
                        <div className={styles.statLabel}>Quality</div>
                    </div>
                    <div className={styles.stat}>
                        <div className={styles.statValue}>⚡</div>
                        <div className={styles.statLabel}>Real-time</div>
                    </div>
                </div>
            </div>

            {/* Canvas Info */}
            <div className={styles.canvasInfo}>
                <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Tool:</span>
                    <span className={styles.infoValue}>{activeMenuItem}</span>
                </div>
                {activeMenuItem === MENU_ITEMS.PENCIL && (
                    <>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Color:</span>
                            <div
                                className={styles.colorIndicator}
                                style={{ backgroundColor: color }}
                            ></div>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Size:</span>
                            <span className={styles.infoValue}>{size}px</span>
                        </div>
                    </>
                )}
                <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Elements:</span>
                    <span className={styles.infoValue}>{elementCount}</span>
                </div>
            </div>

            {/* Zoom Controls */}
            <div className={styles.zoomControls}>
                <button
                    className={styles.zoomButton}
                    onClick={handleZoomOut}
                    disabled={zoom <= MIN_ZOOM}
                    title="Zoom out"
                >
                    <FontAwesomeIcon icon={faMinus} />
                </button>
                <div
                    className={styles.zoomDisplay}
                    onClick={handleZoomReset}
                    title="Reset zoom"
                >
                    <FontAwesomeIcon icon={faExpand} className={styles.zoomIcon} />
                    <span>{zoom}%</span>
                </div>
                <button
                    className={styles.zoomButton}
                    onClick={handleZoomIn}
                    disabled={zoom >= MAX_ZOOM}
                    title="Zoom in"
                >
                    <FontAwesomeIcon icon={faPlus} />
                </button>
            </div>
        </div>
    );
};

export default memo(Whiteboard);

