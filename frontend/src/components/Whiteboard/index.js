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
import { MENU_ITEMS, LINE_STYLES, SHAPE_TYPES } from "@/constants";
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
    const isDrawingShape = useRef(false);
    const isPanning = useRef(false);
    const isErasing = useRef(false);
    const lastPanPoint = useRef({ x: 0, y: 0 });
    const currentPath = useRef([]);
    const currentElementId = useRef(null);
    const initialShapePoint = useRef(null);

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

    const [eraserPosition, setEraserPosition] = useState(null);

    // New state for temporary shape rendering
    const [tempShape, setTempShape] = useState(null);

    const { activeMenuItem, actionMenuItem } = useSelector((state) => state.menu);
    const { actionHeaderItem } = useSelector((state) => state.header);
    const toolboxState = useSelector((state) => state.toolbox[activeMenuItem]);
    const { color, fillColor, size, opacity, style } = toolboxState || {};

    const { data: session, status } = useSession();
    const dispatch = useDispatch();

    const MIN_ZOOM = 80;
    const MAX_ZOOM = 400;
    const CANVAS_SIZE = 1500;

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

    useEffect(() => {
        const handleConnect = () => {
            setIsConnected(true);
            if (shareId) {
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
        context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        Object.entries(elements).forEach(([elementId, element]) => {
            if (element?.type === "path") {
                renderPath(context, element);
            } else if (element?.type === "shape") {
                renderShape(context, element);
            }
        });

        // Draw the temporary shape on top of everything
        if (tempShape) {
            renderShape(context, tempShape);
        }

        setElementCount(Object.keys(elements).length);
        if (Object.keys(elements).length > 0) {
            setHasDrawn(true);
        }
    };
    useEffect(() => {
        renderElements();
    }, [renderElements, elements, tempShape]); // Add tempShape to dependencies

    const renderPath = useCallback((context, element) => {
        if (!element.points || element.points.length < 2) return;
        context.save();
        context.strokeStyle = element.color;
        context.lineWidth = element.size;
        context.lineCap = element.style;
        context.lineJoin = "round";
        context.globalAlpha = element.opacity / 100;
        context.beginPath();
        context.moveTo(element.points[0].x, element.points[0].y);
        for (let i = 1; i < element.points.length; i++) {
            context.lineTo(element.points[i].x, element.points[i].y);
        }
        context.stroke();
        context.restore();
    }, []);

    const renderShape = useCallback((context, element) => {
        const { startX, startY, endX, endY, color, fillColor, size, opacity, shapeType } = element;
        
        context.save();
        context.lineWidth = size;
        context.globalAlpha = opacity / 100;
        context.lineCap = "round";
        context.lineJoin = "round";
        
        context.beginPath();

        switch (shapeType) {
            case MENU_ITEMS.RECTANGLE:
                context.rect(startX, startY, endX - startX, endY - startY);
                break;
            case MENU_ITEMS.CIRCLE:
                const circleRadius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)) / 2;
                const circleCenterX = startX + (endX - startX) / 2;
                const circleCenterY = startY + (endY - startY) / 2;
                context.arc(circleCenterX, circleCenterY, circleRadius, 0, 2 * Math.PI);
                break;
            case MENU_ITEMS.ELLIPSE:
                const ellipseCenterX = startX + (endX - startX) / 2;
                const ellipseCenterY = startY + (endY - startY) / 2;
                const radiusX = Math.abs(endX - startX) / 2;
                const radiusY = Math.abs(endY - startY) / 2;
                context.ellipse(ellipseCenterX, ellipseCenterY, radiusX, radiusY, 0, 0, 2 * Math.PI);
                break;
            case MENU_ITEMS.TRIANGLE:
                context.moveTo(startX + (endX - startX) / 2, startY);
                context.lineTo(startX, endY);
                context.lineTo(endX, endY);
                context.closePath();
                break;
            case MENU_ITEMS.STAR:
                 const starPoints = 5;
                 const outerRadius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)) / 2;
                 const innerRadius = outerRadius / 2;
                 const starCenterX = startX + (endX - startX) / 2;
                 const starCenterY = startY + (endY - startY) / 2;
                 
                 context.moveTo(starCenterX, starCenterY - outerRadius);
                 for (let i = 0; i < starPoints; i++) {
                     let angle = (i * Math.PI * 2) / starPoints - Math.PI / 2;
                     let x = starCenterX + outerRadius * Math.cos(angle);
                     let y = starCenterY + outerRadius * Math.sin(angle);
                     context.lineTo(x, y);
                     angle = ((i + 0.5) * Math.PI * 2) / starPoints - Math.PI / 2;
                     x = starCenterX + innerRadius * Math.cos(angle);
                     y = starCenterY + innerRadius * Math.sin(angle);
                     context.lineTo(x, y);
                 }
                 context.closePath();
                 break;
            case MENU_ITEMS.ARROW:
            case MENU_ITEMS.LINE:
                context.moveTo(startX, startY);
                context.lineTo(endX, endY);
                if (shapeType === MENU_ITEMS.ARROW) {
                    const angle = Math.atan2(endY - startY, endX - startX);
                    const headLength = 15;
                    context.lineTo(
                        endX - headLength * Math.cos(angle - Math.PI / 6),
                        endY - headLength * Math.sin(angle - Math.PI / 6),
                    );
                    context.moveTo(endX, endY);
                    context.lineTo(
                        endX - headLength * Math.cos(angle + Math.PI / 6),
                        endY - headLength * Math.sin(angle + Math.PI / 6),
                    );
                }
                break;
            default:
                break;
        }

        // Only draw the fill if a fillColor is selected
        if (fillColor) {
            context.fillStyle = fillColor;
            context.fill();
        }
        
        // Only draw the stroke if a border color is selected
        if (color) {
            context.strokeStyle = color;
            context.stroke();
        }
        
        context.restore();
    }, []);

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

    const getElementAtPoint = useCallback(
        (x, y) => {
            const context = contextRef.current;
            if (!context) return null;

            const eraserSize = (toolboxState && toolboxState[MENU_ITEMS.ERASER] && toolboxState[MENU_ITEMS.ERASER].size) || 1;
            
            for (const [elementId, element] of Object.entries(elements)) {
                context.save();
                context.beginPath();

                if (element?.type === "path") {
                    if (!element.points || element.points.length < 2) {
                        context.restore();
                        continue;
                    }
                    // Temporarily set line width for accurate hit testing
                    context.lineWidth = eraserSize;
                    context.moveTo(element.points[0].x, element.points[0].y);
                    for (let i = 1; i < element.points.length; i++) {
                        context.lineTo(element.points[i].x, element.points[i].y);
                    }
                    if (context.isPointInStroke(x, y)) {
                        context.restore();
                        return elementId;
                    }
                } else if (element?.type === "shape") {
                    // Create a temporary path for hit detection
                    context.lineWidth = eraserSize;
                    
                    switch (element.shapeType) {
                        case MENU_ITEMS.RECTANGLE:
                            context.rect(element.startX, element.startY, element.endX - element.startX, element.endY - element.startY);
                            break;
                        case MENU_ITEMS.CIRCLE:
                            const radius = Math.sqrt(Math.pow(element.endX - element.startX, 2) + Math.pow(element.endY - element.startY, 2)) / 2;
                            const centerX = element.startX + (element.endX - element.startX) / 2;
                            const centerY = element.startY + (element.endY - element.startY) / 2;
                            context.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                            break;
                        case MENU_ITEMS.ELLIPSE:
                            const ellCenterX = element.startX + (element.endX - element.startX) / 2;
                            const ellCenterY = element.startY + (element.endY - element.startY) / 2;
                            const radX = Math.abs(element.endX - element.startX) / 2;
                            const radY = Math.abs(element.endY - element.startY) / 2;
                            context.ellipse(ellCenterX, ellCenterY, radX, radY, 0, 0, 2 * Math.PI);
                            break;
                        case MENU_ITEMS.TRIANGLE:
                            context.moveTo(element.startX + (element.endX - element.startX) / 2, element.startY);
                            context.lineTo(element.startX, element.endY);
                            context.lineTo(element.endX, element.endY);
                            context.closePath();
                            break;
                        case MENU_ITEMS.STAR:
                            const starPoints = 5;
                            const outerRadius = Math.sqrt(Math.pow(element.endX - element.startX, 2) + Math.pow(element.endY - element.startY, 2)) / 2;
                            const innerRadius = outerRadius / 2;
                            const starCenterX = element.startX + (element.endX - element.startX) / 2;
                            const starCenterY = element.startY + (element.endY - element.startY) / 2;
                            context.moveTo(starCenterX, starCenterY - outerRadius);
                            for (let i = 0; i < starPoints; i++) {
                                let angle = (i * Math.PI * 2) / starPoints - Math.PI / 2;
                                let starX = starCenterX + outerRadius * Math.cos(angle);
                                let starY = starCenterY + outerRadius * Math.sin(angle);
                                context.lineTo(starX, starY);
                                angle = ((i + 0.5) * Math.PI * 2) / starPoints - Math.PI / 2;
                                starX = starCenterX + innerRadius * Math.cos(angle);
                                starY = starCenterY + innerRadius * Math.sin(angle);
                                context.lineTo(starX, starY);
                            }
                            context.closePath();
                            break;
                        case MENU_ITEMS.ARROW:
                        case MENU_ITEMS.LINE:
                            context.moveTo(element.startX, element.startY);
                            context.lineTo(element.endX, element.endY);
                            if (element.shapeType === MENU_ITEMS.ARROW) {
                                const angle = Math.atan2(element.endY - element.startY, element.endX - element.startX);
                                const headLength = 15;
                                context.lineTo(
                                    element.endX - headLength * Math.cos(angle - Math.PI / 6),
                                    element.endY - headLength * Math.sin(angle - Math.PI / 6),
                                );
                                context.moveTo(element.endX, element.endY);
                                context.lineTo(
                                    element.endX - headLength * Math.cos(angle + Math.PI / 6),
                                    element.endY - headLength * Math.sin(angle + Math.PI / 6),
                                );
                            }
                            break;
                        default:
                            break;
                    }
                    if (context.isPointInPath(x, y) || context.isPointInStroke(x, y)) {
                        context.restore();
                        return elementId;
                    }
                }
                context.restore();
            }
            return null;
        },
        [elements, toolboxState],
    );

    const addElement = useCallback(
        (elementId, element) => {
            setElements((prev) => ({
                ...prev,
                [elementId]: element,
            }));
            setUndoStack((prev) => [...prev, elementId]);
            setRedoStack([]);
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
    const removeElement = useCallback(
        (elementId) => {
            const elementToRemove = elements[elementId];
            if (!elementToRemove) return;
            setElements((prev) => {
                const newElements = { ...prev };
                delete newElements[elementId];
                return newElements;
            });
            setUndoStack((prev) => [
                ...prev,
                { id: elementId, element: elementToRemove, operation: "delete" },
            ]);
            setRedoStack([]);
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
    useEffect(() => {
        if (!actionMenuItem) return;
        switch (actionMenuItem) {
            case MENU_ITEMS.UNDO:
                if (undoStack.length > 0) {
                    const lastAction = undoStack[undoStack.length - 1];
                    setUndoStack((prev) => prev.slice(0, -1));
                    if (lastAction.operation === "delete") {
                        setElements((prev) => ({
                            ...prev,
                            [lastAction.id]: lastAction.element,
                        }));
                        setRedoStack((prev) => [
                            ...prev,
                            { id: lastAction.id, operation: "insert" },
                        ]);
                        if (roomJoined && shareId) {
                            socket.emit("client:updateCanvas", {
                                shareId,
                                operation: "redo",
                                elementId: lastAction.id,
                                element: lastAction.element,
                            });
                        }
                    } else {
                        const elementId = lastAction;
                        const elementToRedo = elements[elementId];
                        setElements((prev) => {
                            const newElements = { ...prev };
                            delete newElements[elementId];
                            return newElements;
                        });
                        setRedoStack((prev) => [
                            ...prev,
                            { id: elementId, element: elementToRedo, operation: "delete" },
                        ]);
                        if (roomJoined && shareId) {
                            socket.emit("client:updateCanvas", {
                                shareId,
                                operation: "undo",
                                elementId: elementId,
                                element: elementToRedo,
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
                        setElements((prev) => ({
                            ...prev,
                            [lastRedoAction.id]: lastRedoAction.element,
                        }));
                        setUndoStack((prev) => [...prev, lastRedoAction.id]);
                        if (roomJoined && shareId) {
                            socket.emit("client:updateCanvas", {
                                shareId,
                                operation: "insert",
                                elementId: lastRedoAction.id,
                                element: lastRedoAction.element,
                            });
                        }
                    } else {
                        const elementId = lastRedoAction.id;
                        const elementToUndo = lastRedoAction.element;
                        setElements((prev) => ({ ...prev, [elementId]: elementToUndo }));
                        setUndoStack((prev) => [...prev, elementId]);
                        if (roomJoined && shareId) {
                            socket.emit("client:updateCanvas", {
                                shareId,
                                operation: "redo",
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

    useEffect(() => {
        if (!canvasRef.current || !actionHeaderItem) return;
        const canvas = canvasRef.current;
        switch (actionHeaderItem) {
            case "Export":
                const exportCanvas = document.createElement("canvas");
                const exportContext = exportCanvas.getContext("2d");
                exportCanvas.width = CANVAS_SIZE;
                exportCanvas.height = CANVAS_SIZE;
                exportContext.fillStyle = "#ffffff";
                exportContext.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
                exportContext.drawImage(
                    canvas,
                    0, 0, CANVAS_SIZE, CANVAS_SIZE,
                    0, 0, CANVAS_SIZE, CANVAS_SIZE,
                );
                const URL = exportCanvas.toDataURL("image/png", 1.0);
                const anchor = document.createElement("a");
                anchor.href = URL;
                anchor.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.png`;
                anchor.click();
                showToast?.success("Downloaded", "Whiteboard exported successfully");
                break;
            case "Share":
                break;
            case "Collaborators":
                break;
            default:
                break;
        }
        dispatch(headerItemClick(null));
    }, [actionHeaderItem, shareId, showToast, dispatch]);

    useLayoutEffect(() => {
        if (!canvasRef.current || !containerRef.current) return;
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        contextRef.current = context;
        const container = containerRef.current;
        canvas.width = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;
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
                isErasing.current = true;
                setEraserPosition({ x: e.clientX, y: e.clientY });
                const elementId = getElementAtPoint(x, y);
                if (elementId) {
                    removeElement(elementId);
                }
                return;
            }

            if (
                [
                    MENU_ITEMS.RECTANGLE,
                    MENU_ITEMS.CIRCLE,
                    MENU_ITEMS.ELLIPSE,
                    MENU_ITEMS.TRIANGLE,
                    MENU_ITEMS.STAR,
                    MENU_ITEMS.ARROW,
                    MENU_ITEMS.LINE,
                ].includes(activeMenuItem)
            ) {
                isDrawingShape.current = true;
                initialShapePoint.current = { x, y };
                currentElementId.current = generateElementId();
                return;
            }

            if (
                activeMenuItem === MENU_ITEMS.PENCIL_PENCIL ||
                activeMenuItem === MENU_ITEMS.PENCIL_PEN ||
                activeMenuItem === MENU_ITEMS.PENCIL_HIGHLIGHTER
            ) {
                shouldDraw.current = true;
                isDrawing.current = true;
                currentElementId.current = generateElementId();
                currentPath.current = [{ x, y }];
                return;
            }

            showToast?.info("Coming Soon", `${activeMenuItem} tool is yet to be implemented`);
        },
        [
            activeMenuItem,
            getCanvasCoordinates,
            getElementAtPoint,
            removeElement,
            showToast,
            size,
            color,
            opacity,
            style,
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

            if (isErasing.current) {
                const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
                setEraserPosition({ x: e.clientX, y: e.clientY });
                // Check multiple points along the mouse path for better performance
                const lastX = lastPanPoint.current.x;
                const lastY = lastPanPoint.current.y;
                
                const dx = x - lastX;
                const dy = y - lastY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const steps = Math.ceil(distance / (size / 2)); // Check at intervals of half the eraser size
                
                for (let i = 0; i <= steps; i++) {
                    const stepX = lastX + (dx / steps) * i;
                    const stepY = lastY + (dy / steps) * i;
                    const elementId = getElementAtPoint(stepX, stepY);
                    if (elementId) {
                        removeElement(elementId);
                        break; // Exit loop after finding and erasing one element
                    }
                }
                lastPanPoint.current = { x, y };
                return;
            }

            if (isDrawingShape.current && initialShapePoint.current) {
                const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
                const tempElement = {
                    type: "shape",
                    shapeType: activeMenuItem,
                    startX: initialShapePoint.current.x,
                    startY: initialShapePoint.current.y,
                    endX: x,
                    endY: y,
                    color: color,
                    fillColor: fillColor,
                    size: size,
                    opacity: opacity,
                };
                setTempShape(tempElement);
                return;
            }

            if (!shouldDraw.current ||
                ![
                    MENU_ITEMS.PENCIL_PENCIL,
                    MENU_ITEMS.PENCIL_PEN,
                    MENU_ITEMS.PENCIL_HIGHLIGHTER,
                ].includes(activeMenuItem)
            ) {
                return;
            }

            const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
            currentPath.current.push({ x, y });
            if (currentElementId.current) {
                setElements((prev) => ({
                    ...prev,
                    [currentElementId.current]: {
                        type: "path",
                        points: [...currentPath.current],
                        color: color,
                        size: size,
                        opacity: opacity,
                        style: style,
                    },
                }));
            }
        },
        [getCanvasCoordinates, activeMenuItem, color, fillColor, size, opacity, style, getElementAtPoint, removeElement, panX, panY, canvasOffset],
    );

    const handleMouseUp = useCallback(
        (e) => {
            if (isPanning.current) {
                isPanning.current = false;
                return;
            }
            if (isErasing.current) {
                isErasing.current = false;
                setEraserPosition(null);
                lastPanPoint.current = {x: 0, y: 0}; // Reset last pan point
                return;
            }
            if (isDrawingShape.current && initialShapePoint.current) {
                isDrawingShape.current = false;
                const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
                setTempShape(null); // Clear the temporary shape state

                const finalElement = {
                    type: "shape",
                    shapeType: activeMenuItem,
                    startX: initialShapePoint.current.x,
                    startY: initialShapePoint.current.y,
                    endX: x,
                    endY: y,
                    color: color,
                    fillColor: fillColor,
                    size: size,
                    opacity: opacity,
                };
                addElement(currentElementId.current, finalElement);
                initialShapePoint.current = null;
                currentElementId.current = null;
                return;
            }
            if (!shouldDraw.current || ![
                MENU_ITEMS.PENCIL_PENCIL,
                MENU_ITEMS.PENCIL_PEN,
                MENU_ITEMS.PENCIL_HIGHLIGHTER,
            ].includes(activeMenuItem)) {
                return;
            }
            shouldDraw.current = false;
            isDrawing.current = false;
            if (currentElementId.current && currentPath.current.length > 1) {
                const element = {
                    type: "path",
                    points: [...currentPath.current],
                    color: color,
                    size: size,
                    opacity: opacity,
                    style: style,
                    timestamp: Date.now(),
                };
                addElement(currentElementId.current, element);
            }
            currentElementId.current = null;
            currentPath.current = [];
        },
        [activeMenuItem, color, fillColor, size, opacity, style, addElement, getCanvasCoordinates],
    );

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
            handleMouseUp(e);
        },
        [handleMouseUp],
    );
    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const isPinch = e.ctrlKey || e.metaKey;
        const zoomStep = isPinch ? 5 : 25;
        const delta = Math.sign(e.deltaY) * -1;
        const newZoom = Math.max(
            MIN_ZOOM,
            Math.min(MAX_ZOOM, zoom + delta * zoomStep),
        );
        if (newZoom === zoom) {
            return;
        }
        const containerRect = containerRef.current.getBoundingClientRect();
        const cursorX = e.clientX - containerRect.left;
        const cursorY = e.clientY - containerRect.top;
        const oldScale = zoom / 100;
        const newScale = newZoom / 100;
        const worldXBefore = (cursorX - panX - canvasOffset.x) / oldScale;
        const worldYBefore = (cursorY - panY - canvasOffset.y) / oldScale;
        const newPanX = cursorX - (worldXBefore * newScale + canvasOffset.x);
        const newPanY = cursorY - (worldYBefore * newScale + canvasOffset.y);
        setZoom(newZoom);
        setPanX(newPanX);
        setPanY(newPanY);
    }, [zoom, panX, panY, canvasOffset]);

    const handleContextMenu = useCallback((e) => {
        e.preventDefault();
    }, []);

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
            {activeMenuItem === MENU_ITEMS.ERASER && eraserPosition && (
                <div
                    className={styles.eraserHighlight}
                    style={{
                        left: eraserPosition.x,
                        top: eraserPosition.y,
                        width: `${size * 2}px`,
                        height: `${size * 2}px`,
                        transform: `translate(-50%, -50%)`,
                    }}
                />
            )}
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
            <div className={styles.canvasInfo}>
                <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Tool:</span>
                    <span className={styles.infoValue}>{activeMenuItem}</span>
                </div>
                {(isDrawing.current || isDrawingShape.current) && (
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