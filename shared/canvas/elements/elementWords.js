import { plainText } from "./richText.js";

// The words written on an element (text, names, labels, table cells) without
// formatting marks, for search and Find.
export const wordsOf = (element) => {
    if (!element) return "";
    if (element.type === "table") return plainText((element.cells ?? []).filter((cell) => cell.trim()).join("\n"));
    return [element.type === "frame" ? element.name : plainText(element.text), element.subtext, element.type === "path" ? element.label : null]
        .filter((text) => typeof text === "string" && text.trim())
        .join("\n");
};
