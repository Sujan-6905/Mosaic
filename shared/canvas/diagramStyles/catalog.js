import thinkingAndFlow from "./structures/thinkingAndFlow.js";
import systemsAndExplainers from "./structures/systemsAndExplainers.js";
import softwareAndOperations from "./structures/softwareAndOperations.js";
import processAndPlanning from "./structures/processAndPlanning.js";
import analysisAndStrategy from "./structures/analysisAndStrategy.js";
import decisionPaths from "./structures/decisionPaths.js";
import boardLooks from "./looks/boardLooks.js";
import printAndScreenLooks from "./looks/printAndScreenLooks.js";
import signalLooks from "./looks/signalLooks.js";
import { DEFAULT_LEVERS, sanitizeLevers } from "./levers.js";

export const STRUCTURES = [
    ...thinkingAndFlow,
    ...systemsAndExplainers,
    ...softwareAndOperations,
    ...processAndPlanning,
    ...analysisAndStrategy,
    ...decisionPaths,
].sort((a, b) => a.number - b.number);
export const LOOKS = [...boardLooks, ...printAndScreenLooks, ...signalLooks].sort((a, b) => a.number - b.number);

export const STRUCTURE_GROUPS = [...new Set(STRUCTURES.map((structure) => structure.group))];
const DEFAULT_STRUCTURE_ID = "flowchart";
export const DEFAULT_LOOK_ID = "ink";

const structureById = new Map(STRUCTURES.map((structure) => [structure.id, structure]));
const lookById = new Map(LOOKS.map((look) => [look.id, look]));

export const structureFor = (id) => structureById.get(id) ?? structureById.get(DEFAULT_STRUCTURE_ID);
export const lookFor = (id) => lookById.get(id) ?? lookById.get(DEFAULT_LOOK_ID);
export const isStructureId = (id) => structureById.has(id);
export const isLookId = (id) => lookById.has(id);

// What a style recipe resolves to: the look's palette and type, and every
// lever with the structure's needs, then the look's preset, then any override.
export const resolveStyle = ({ structure: structureId, look: lookId, levers: overrides } = {}) => {
    const structure = structureFor(structureId);
    const look = lookFor(lookId);
    const levers = { ...DEFAULT_LEVERS, ...look.levers, ...sanitizeLevers(overrides) };
    return { structure, look, levers, palette: look.palette, dark: isDarkGround(look.palette.ground, levers.ground) };
};

const isDarkGround = (ground, groundLever) => groundLever === "dark" || (ground ? luminance(ground) < 0.35 : false);

const luminance = (hex) => {
    const match = /^#([0-9a-f]{6})$/i.exec(hex ?? "");
    if (!match) return 1;
    const value = parseInt(match[1], 16);
    return (0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) / 255;
};

// The short form the assistant shortlists from: an id, a name and one or two lines.
export const structureSummaries = () => STRUCTURES.map(({ id, name, group, summary }) => `${id} (${name}, ${group}): ${summary}`).join("\n");
export const lookSummaries = () => LOOKS.map(({ id, name, summary }) => `${id} (${name}): ${summary}`).join("\n");

// The long form it reads only for its shortlist, before deciding.
export const structureDetails = (ids) =>
    ids
        .filter(isStructureId)
        .map((id) => {
            const { name, summary, details, bestFor } = structureFor(id);
            return `${id} (${name}). ${summary} Best for: ${bestFor}. ${details}`;
        })
        .join("\n\n");
export const lookDetails = (ids) =>
    ids
        .filter(isLookId)
        .map((id) => {
            const { name, summary, details } = lookFor(id);
            return `${id} (${name}). ${summary} ${details}`;
        })
        .join("\n\n");
