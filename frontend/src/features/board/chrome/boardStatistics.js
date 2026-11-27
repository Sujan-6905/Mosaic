import { getElementBounds } from "../../../../../shared/canvas/geometry/bounds.js";

const WORD = /\S+/g;
const countWords = (text) => (text ? (text.match(WORD)?.length ?? 0) : 0);

const KIND_LABELS = {
    shape: "Shapes",
    path: "Drawings",
    text: "Text boxes",
    sticky: "Sticky notes",
    connector: "Arrows",
    frame: "Frames",
    image: "Images",
    embed: "Web embeds",
};

const tally = (map, key) => map.set(key, (map.get(key) || 0) + 1);

const byCountDescending = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));

// Everything the properties dialog reports about a board, worked out from its elements.
export const boardStatistics = (elements) => {
    const kinds = new Map();
    const shapeKinds = new Map();
    const colours = new Map();
    const groups = new Set();
    let words = 0;
    let inkPoints = 0;
    let locked = 0;
    let linked = 0;
    let attachedArrows = 0;
    let looseArrows = 0;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const list = Object.values(elements);

    list.forEach((element) => {
        tally(kinds, KIND_LABELS[element.type] || element.type);
        if (element.type === "shape") tally(shapeKinds, element.shapeType);
        if (element.color) tally(colours, element.color.toLowerCase());
        if (element.fillColor) tally(colours, element.fillColor.toLowerCase());
        if (element.groupId) groups.add(element.groupId);
        if (element.locked) locked += 1;
        if (element.link) linked += 1;
        words += countWords(element.text) + countWords(element.subtext);
        if (element.type === "path") inkPoints += element.points?.length ?? 0;
        if (element.type === "connector") {
            if (element.startElementId || element.endElementId) attachedArrows += 1;
            else looseArrows += 1;
        }
        const bounds = getElementBounds(element);
        if (bounds) {
            minX = Math.min(minX, bounds.minX);
            minY = Math.min(minY, bounds.minY);
            maxX = Math.max(maxX, bounds.maxX);
            maxY = Math.max(maxY, bounds.maxY);
        }
    });

    return {
        total: list.length,
        kinds: byCountDescending(kinds),
        shapeKinds: byCountDescending(shapeKinds),
        topColours: byCountDescending(colours).slice(0, 8),
        groups: groups.size,
        words,
        inkPoints,
        locked,
        linked,
        attachedArrows,
        looseArrows,
        extent: list.length && minX !== Infinity ? { width: Math.round(maxX - minX), height: Math.round(maxY - minY) } : null,
        sizeBytes: new Blob([JSON.stringify(elements)]).size,
    };
};

export const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
