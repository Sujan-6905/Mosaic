import { getElementBounds, unionBounds } from "../../../../../shared/canvas/geometry/bounds.js";

const boundsCache = new WeakMap();

// A stroke's bounds walk every point, so anything that asks once per repaint
// goes through this. Elements are replaced on edit, never mutated.
export const getCachedElementBounds = (element) => {
    if (boundsCache.has(element)) return boundsCache.get(element);
    const bounds = getElementBounds(element);
    boundsCache.set(element, bounds);
    return bounds;
};

const rotatedExtent = (bounds, degrees) => {
    const radians = (degrees * Math.PI) / 180;
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    const halfWidth = (bounds.maxX - bounds.minX) / 2;
    const halfHeight = (bounds.maxY - bounds.minY) / 2;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const extentX = halfWidth * cos + halfHeight * sin;
    const extentY = halfWidth * sin + halfHeight * cos;
    return { minX: centerX - extentX, minY: centerY - extentY, maxX: centerX + extentX, maxY: centerY + extentY };
};

const paintBoundsCache = new WeakMap();

// Where an element actually puts ink: unlike its bounds, this covers rotation
// and a connector's bends. Anything deciding what to draw needs this one.
export const getPaintBounds = (element) => {
    if (paintBoundsCache.has(element)) return paintBoundsCache.get(element);
    let bounds = getCachedElementBounds(element);
    if (bounds && element.rotation) bounds = rotatedExtent(bounds, element.rotation);
    if (bounds && element.waypoints?.length) {
        bounds = { ...bounds };
        for (const { x, y } of element.waypoints) {
            bounds.minX = Math.min(bounds.minX, x);
            bounds.minY = Math.min(bounds.minY, y);
            bounds.maxX = Math.max(bounds.maxX, x);
            bounds.maxY = Math.max(bounds.maxY, y);
        }
    }
    if (bounds && element.type === "connector" && element.text) {
        const reach = Math.abs(element.labelOffset || 0) + (element.fontSize || 13) * (element.text.length * 0.35 + 1);
        bounds = { minX: bounds.minX - reach, minY: bounds.minY - reach, maxX: bounds.maxX + reach, maxY: bounds.maxY + reach };
    }
    paintBoundsCache.set(element, bounds);
    return bounds;
};

export const getPaintUnionBounds = (elementsList) => unionBounds(elementsList.map(getPaintBounds));
