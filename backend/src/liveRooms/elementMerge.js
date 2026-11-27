const STAMPS = ["version", "updatedBy"];
const TABLE_SHAPE_FIELDS = ["rows", "cols", "cells"];

const sameTableShape = (a, b) => a.rows === b.rows && a.cols === b.cols && a.cells?.length === b.cells?.length;
const isWholeTable = (table) => Array.isArray(table.cells) && table.cells.length === table.rows * table.cols;

// Takes only `fieldNames` from the incoming element; a named but absent field was cleared.
// Table cells merge one by one only while both copies share the same grid.
export const mergeElementFields = (stored, element, fieldNames) => {
    if (!stored || stored.type !== element.type) return element;
    const merged = Object.fromEntries(Object.entries(stored).filter(([key]) => !STAMPS.includes(key)));
    const isTable = element.type === "table";
    for (const name of fieldNames) {
        const [key, entry] = name.split(".");
        if (isTable && TABLE_SHAPE_FIELDS.includes(key) && !sameTableShape(stored, element)) {
            TABLE_SHAPE_FIELDS.forEach((field) => {
                merged[field] = element[field];
            });
        } else if (isTable && entry !== undefined && key === "cells") {
            const index = Number(entry);
            merged.cells = merged.cells.map((value, i) => (i === index ? element.cells[i] : value));
        } else if (entry !== undefined) {
            continue;
        } else if (Object.hasOwn(element, key)) merged[key] = element[key];
        else delete merged[key];
    }
    if (isTable && !isWholeTable(merged)) return element;
    return merged;
};
