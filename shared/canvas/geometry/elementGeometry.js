import { boundsCenter, getElementBounds } from "./bounds.js";

const CONNECTOR_TYPE = "connector";

export const translateElement = (element, dx, dy) => {
    if (element.type === "path") {
        // Keeps each point's `pressure`, or the stroke's taper would flatten.
        return { ...element, points: element.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) };
    }
    if (element.type === "text" || element.type === "sticky") {
        return { ...element, x: element.x + dx, y: element.y + dy };
    }
    return {
        ...element,
        startX: element.startX + dx,
        startY: element.startY + dy,
        endX: element.endX + dx,
        endY: element.endY + dy,
        ...(element.waypoints ? { waypoints: element.waypoints.map((p) => ({ x: p.x + dx, y: p.y + dy })) } : {}),
    };
};

// Scales about the anchor opposite the dragged handle; a factor of 1 leaves that axis alone.
export const scaleElementAboutAnchor = (element, anchorX, anchorY, sx, sy, { scaleFont = false } = {}) => {
    const scaleX = (x) => anchorX + (x - anchorX) * sx;
    const scaleY = (y) => anchorY + (y - anchorY) * sy;
    if (element.type === "path") {
        return {
            ...element,
            points: element.points.map((p) => ({ ...p, x: scaleX(p.x), y: scaleY(p.y) })),
        };
    }
    if (element.type === "text") {
        // An edge reflows the text inside a new width at the same point size;
        // only a uniform scale, from a corner, changes the point size itself.
        const x0 = scaleX(element.x);
        const x1 = scaleX(element.x + element.width);
        const size = scaleFont ? Math.max(4, (element.size || 16) * Math.abs(sx)) : element.size;
        return { ...element, x: Math.min(x0, x1), y: scaleY(element.y), width: Math.abs(x1 - x0), size };
    }
    if (element.type === "sticky") {
        const x0 = scaleX(element.x);
        const x1 = scaleX(element.x + element.width);
        const y0 = scaleY(element.y);
        const y1 = scaleY(element.y + element.height);
        return {
            ...element,
            x: Math.min(x0, x1),
            y: Math.min(y0, y1),
            width: Math.abs(x1 - x0),
            height: Math.abs(y1 - y0),
        };
    }
    return {
        ...element,
        startX: scaleX(element.startX),
        startY: scaleY(element.startY),
        endX: scaleX(element.endX),
        endY: scaleY(element.endY),
        ...(element.waypoints ? { waypoints: element.waypoints.map((p) => ({ x: scaleX(p.x), y: scaleY(p.y) })) } : {}),
    };
};

const rotatePointAround = (x, y, pivotX, pivotY, angleDegrees) => {
    const angle = (angleDegrees * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = x - pivotX;
    const dy = y - pivotY;
    return { x: pivotX + dx * cos - dy * sin, y: pivotY + dx * sin + dy * cos };
};

// Revolves the element's centre about the pivot and turns its own rotation by the same
// amount, so a group rotate carries every member around while spinning each in place.
export const rotateElementAroundPivot = (element, pivotX, pivotY, deltaDegrees) => {
    // A connector has no box of its own to turn: its points move instead.
    if (element.type === CONNECTOR_TYPE) {
        const turned = (x, y) => rotatePointAround(x, y, pivotX, pivotY, deltaDegrees);
        const start = turned(element.startX, element.startY);
        const end = turned(element.endX, element.endY);
        return {
            ...element,
            startX: start.x,
            startY: start.y,
            endX: end.x,
            endY: end.y,
            ...(element.waypoints ? { waypoints: element.waypoints.map((point) => turned(point.x, point.y)) } : {}),
        };
    }
    const bounds = getElementBounds(element);
    if (!bounds) return element;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const revolvedCenter = rotatePointAround(centerX, centerY, pivotX, pivotY, deltaDegrees);
    const translated = translateElement(element, revolvedCenter.x - centerX, revolvedCenter.y - centerY);
    return { ...translated, rotation: ((((element.rotation || 0) + deltaDegrees) % 360) + 360) % 360 };
};

const MIN_ELEMENT_SIZE = 4;

// Where a point written in an element's unrotated coordinates actually lands.
export const elementPointToWorld = (element, point) => {
    if (!element.rotation) return point;
    const center = boundsCenter(getElementBounds(element));
    return rotatePointAround(point.x, point.y, center.x, center.y, element.rotation);
};

// A world point in an element's unrotated coordinates, so anything testing
// against its stored geometry works however the element is turned.
export const worldPointToElement = (element, point) => {
    if (!element.rotation) return point;
    const center = boundsCenter(getElementBounds(element));
    return rotatePointAround(point.x, point.y, center.x, center.y, -element.rotation);
};

const HANDLE_DIRECTIONS = {
    nw: [-1, -1],
    n: [0, -1],
    ne: [1, -1],
    e: [1, 0],
    se: [1, 1],
    s: [0, 1],
    sw: [-1, 1],
    w: [-1, 0],
};

// Resizes in the element's rotated frame so the opposite handle stays put on screen;
// `fromCenter` pins the middle instead.
export const resizeElementFromHandle = (element, handle, pointer, { keepAspect = false, fromCenter = false } = {}) => {
    const bounds = getElementBounds(element);
    const [directionX, directionY] = HANDLE_DIRECTIONS[handle];
    const center = boundsCenter(bounds);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const local = worldPointToElement(element, pointer);

    const anchor = {
        x: fromCenter ? center.x : center.x - (directionX * width) / 2,
        y: fromCenter ? center.y : center.y - (directionY * height) / 2,
    };
    const reach = fromCenter ? 2 : 1;
    let newWidth = directionX ? Math.max(MIN_ELEMENT_SIZE, directionX * (local.x - anchor.x) * reach) : width;
    let newHeight = directionY ? Math.max(MIN_ELEMENT_SIZE, directionY * (local.y - anchor.y) * reach) : height;
    if (keepAspect && width > 0 && height > 0) {
        const scale = directionX && directionY ? Math.max(newWidth / width, newHeight / height) : directionX ? newWidth / width : newHeight / height;
        newWidth = width * scale;
        newHeight = height * scale;
    }

    const sx = width > 0 ? newWidth / width : 1;
    const sy = height > 0 ? newHeight / height : 1;
    const scaleFont = element.type === "text" && directionX !== 0 && directionY !== 0;
    const scaled = scaleElementAboutAnchor(element, anchor.x, anchor.y, sx, scaleFont ? sx : sy, { scaleFont });

    // Scaling moved the centre the element rotates about; shifting by the difference
    // keeps the anchor fixed on screen.
    const scaledCenter = boundsCenter(getElementBounds(scaled));
    const anchorOnScreen = elementPointToWorld(element, anchor);
    const radians = ((element.rotation || 0) * Math.PI) / 180;
    const offsetX = scaledCenter.x - anchor.x;
    const offsetY = scaledCenter.y - anchor.y;
    const wantedCenter = {
        x: anchorOnScreen.x + offsetX * Math.cos(radians) - offsetY * Math.sin(radians),
        y: anchorOnScreen.y + offsetX * Math.sin(radians) + offsetY * Math.cos(radians),
    };
    const placed = translateElement(scaled, wantedCenter.x - scaledCenter.x, wantedCenter.y - scaledCenter.y);
    return element.type === "text" && !scaleFont ? { ...placed, autoWidth: false } : placed;
};

// Scales a whole selection together by dragging a corner or edge of its union
// box. Always uniform, because stretching one axis would shear anything rotated.
export const resizeSelectionFromHandle = (elementsById, unionBounds, handle, pointer, { fromCenter = false } = {}) => {
    const [directionX, directionY] = HANDLE_DIRECTIONS[handle];
    const center = boundsCenter(unionBounds);
    const width = unionBounds.maxX - unionBounds.minX;
    const height = unionBounds.maxY - unionBounds.minY;
    const anchor = {
        x: fromCenter ? center.x : center.x - (directionX * width) / 2,
        y: fromCenter ? center.y : center.y - (directionY * height) / 2,
    };
    const reach = fromCenter ? 2 : 1;
    const scaleX = directionX && width > 0 ? (directionX * (pointer.x - anchor.x) * reach) / width : 0;
    const scaleY = directionY && height > 0 ? (directionY * (pointer.y - anchor.y) * reach) / height : 0;
    const smallestScale = MIN_ELEMENT_SIZE / Math.max(width, height, 1);
    const scale = Math.max(smallestScale, directionX && directionY ? Math.max(scaleX, scaleY) : scaleX || scaleY);
    return Object.fromEntries(
        Object.entries(elementsById).map(([id, element]) => {
            if (!element.rotation) return [id, scaleElementAboutAnchor(element, anchor.x, anchor.y, scale, scale, { scaleFont: true })];
            // The centre scales about the anchor; the stored size scales about that centre.
            const elementCenter = boundsCenter(getElementBounds(element));
            const movedCenter = { x: anchor.x + (elementCenter.x - anchor.x) * scale, y: anchor.y + (elementCenter.y - anchor.y) * scale };
            const scaled = scaleElementAboutAnchor(element, elementCenter.x, elementCenter.y, scale, scale, { scaleFont: true });
            return [id, translateElement(scaled, movedCenter.x - elementCenter.x, movedCenter.y - elementCenter.y)];
        }),
    );
};
