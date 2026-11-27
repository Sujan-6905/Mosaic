// Icon and logo sets from their Iconify packages, served as path data, never SVG markup.
import { createRequire } from "node:module";
import { iconFromSvgBody } from "../../../shared/canvas/elements/iconPaths.js";

const require = createRequire(import.meta.url);

// Logos are trademarks of their owners, offered so a diagram can name the
// product it shows; the licence covers the drawing, not the brand.
export const ICON_SETS = [
    { id: "lucide", name: "Lucide", kind: "icons", license: "ISC", url: "https://lucide.dev" },
    { id: "tabler", name: "Tabler Icons", kind: "icons", license: "MIT", url: "https://tabler.io/icons" },
    { id: "carbon", name: "Carbon", kind: "icons", license: "Apache-2.0", url: "https://carbondesignsystem.com" },
    { id: "devicon", name: "Devicon", kind: "logos", license: "MIT", url: "https://devicon.dev", trademarks: true },
    { id: "logos", name: "SVG Logos", kind: "logos", license: "CC0-1.0", url: "https://svgporn.com", trademarks: true },
    { id: "simple-icons", name: "Simple Icons", kind: "logos", license: "CC0-1.0", url: "https://simpleicons.org", trademarks: true },
];

const SET_IDS = new Set(ICON_SETS.map((set) => set.id));
const loaded = new Map();
const MAX_RESULTS = 120;

const loadSet = (setId) => {
    if (!loaded.has(setId)) {
        const data = require(`@iconify-json/${setId}/icons.json`);
        const aliases = Object.entries(data.aliases ?? {}).map(([name, alias]) => [name, alias.parent]);
        loaded.set(setId, { data, names: Object.keys(data.icons), aliases });
    }
    return loaded.get(setId);
};

export const isIconSet = (setId) => SET_IDS.has(setId);

export const iconFor = (setId, name) => {
    if (!isIconSet(setId)) return null;
    const { data, aliases } = loadSet(setId);
    const resolved = data.icons[name] ? name : aliases.find(([alias]) => alias === name)?.[1];
    const source = resolved ? data.icons[resolved] : null;
    if (!source) return null;
    const icon = iconFromSvgBody(source.body, {
        width: source.width ?? data.width ?? 24,
        height: source.height ?? data.height ?? 24,
        left: source.left ?? 0,
        top: source.top ?? 0,
    });
    return icon ? { ...icon, set: setId, name } : null;
};

const titleOf = (name) => name.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

// Names matching every word of the query, best first: exact, then prefix, then contains.
export const searchIcons = ({ query = "", sets = ICON_SETS.map((set) => set.id), limit = 60 }) => {
    const words = query
        .toLowerCase()
        .trim()
        .split(/[\s-]+/)
        .filter(Boolean);
    const results = [];
    for (const setId of sets.filter(isIconSet)) {
        const { names } = loadSet(setId);
        for (const name of names) {
            if (words.length && !words.every((word) => name.includes(word))) continue;
            const score = words.length === 0 ? 3 : name === words.join("-") ? 0 : name.startsWith(words[0]) ? 1 : 2;
            results.push({ setId, name, score });
        }
    }
    results.sort((a, b) => a.score - b.score || a.name.length - b.name.length || a.name.localeCompare(b.name));
    const icons = [];
    for (const { setId, name } of results) {
        if (icons.length >= Math.min(limit, MAX_RESULTS)) break;
        const icon = iconFor(setId, name);
        if (icon) icons.push({ ...icon, title: titleOf(name) });
    }
    return { icons, total: results.length };
};
