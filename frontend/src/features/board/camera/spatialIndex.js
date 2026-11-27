// An R-tree keyed by element id, with a map from id to item so update and remove find it without scanning.
import RBush from "rbush";
import { getPaintBounds } from "../rendering/boundsCache";

const toBBoxItem = (elementId, element) => {
    const bounds = getPaintBounds(element);
    if (!bounds) return null;
    return { minX: bounds.minX, minY: bounds.minY, maxX: bounds.maxX, maxY: bounds.maxY, elementId };
};

export const createSpatialIndex = () => {
    const tree = new RBush();
    const itemsById = new Map();

    const insert = (elementId, element) => {
        const item = toBBoxItem(elementId, element);
        // Geometry without real bounds yet, such as a one-point path, waits until it has some.
        if (!item) return;
        tree.insert(item);
        itemsById.set(elementId, item);
    };

    const remove = (elementId) => {
        const item = itemsById.get(elementId);
        if (!item) return;
        tree.remove(item, (a, b) => a.elementId === b.elementId);
        itemsById.delete(elementId);
    };

    // rbush has no in-place update: remove then reinsert.
    const update = (elementId, element) => {
        remove(elementId);
        insert(elementId, element);
    };

    const queryRect = (rect) => tree.search({ minX: rect.minX, minY: rect.minY, maxX: rect.maxX, maxY: rect.maxY }).map((item) => item.elementId);

    const queryPoint = (x, y, tolerance = 0) => queryRect({ minX: x - tolerance, minY: y - tolerance, maxX: x + tolerance, maxY: y + tolerance });

    // Bulk-loads a full elements snapshot (e.g. server:joinedRoom): rbush's
    // own bulk loader is meaningfully faster than N individual inserts.
    const load = (elementsMap) => {
        tree.clear();
        itemsById.clear();
        const items = [];
        for (const [elementId, element] of Object.entries(elementsMap)) {
            const item = toBBoxItem(elementId, element);
            if (!item) continue;
            items.push(item);
            itemsById.set(elementId, item);
        }
        tree.load(items);
    };

    const clear = () => {
        tree.clear();
        itemsById.clear();
    };

    // The bounds of everything indexed, read from the tree's root, or null when empty.
    const getFullExtent = () => {
        const data = tree.toJSON();
        // An empty tree reports null or infinite bounds.
        if (!data || data.minX == null || !Number.isFinite(data.minX)) return null;
        return { minX: data.minX, minY: data.minY, maxX: data.maxX, maxY: data.maxY };
    };

    return { insert, update, remove, queryRect, queryPoint, load, clear, getFullExtent, size: () => itemsById.size };
};
