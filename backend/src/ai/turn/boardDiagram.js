// A diagram already on the board, offered to the model when the conversation drew none itself, so "add a CDN
// between the apps and the gateway" grows that diagram in its own structure and look instead of sketching a CDN.
import { readDiagram } from "../../../../shared/canvas/diagramStyles/restyle.js";

export const BOARD_DIAGRAM_NOTE =
    'A diagram on the board is what this message is about, and its nodes and edges are in the data block after this, with each node\'s ref as its id. Renaming or recolouring a node is an edit on its ref. Adding, removing or reconnecting its parts (a step, a service, a store, a link) is intent "diagram" with the whole updated diagram: every node and edge as they are now, keeping their ids, labels, kinds and lanes, plus or minus only what this message asks for. Never draw a part of this diagram as a sketch or an add, and never clarify these.';

const MIN_NAME_LENGTH = 3;
const SPEAKS_OF_A_DIAGRAM = /\b(diagram|architecture|flow ?chart|flow|chart|map|graph)\b/i;
const BAND_FIELDS = ["lane", "tier", "stage"];
const NODE_FIELDS = ["kind", "detail", ...BAND_FIELDS, "group", "parent"];

const diagramMembers = (elements) => {
    const byDiagram = new Map();
    for (const [id, element] of Object.entries(elements)) {
        const diagramId = element?.diagram?.id;
        if (!diagramId) continue;
        if (!byDiagram.has(diagramId)) byDiagram.set(diagramId, []);
        byDiagram.get(diagramId).push(id);
    }
    return [...byDiagram.values()].filter((ids) => ids.some((id) => elements[id].diagram.role === "node"));
};

// The diagram whose node names the message uses most, or the only one when the message just says "the diagram".
const pickDiagram = (message, diagrams, elements) => {
    const lowered = message.toLowerCase();
    const mentions = (ids) =>
        ids.filter((id) => {
            const { role, data } = elements[id].diagram;
            const label = (data?.label ?? elements[id].text ?? "").toLowerCase();
            return role === "node" && label.length >= MIN_NAME_LENGTH && lowered.includes(label);
        }).length;
    const ranked = diagrams.map((ids) => ({ ids, score: mentions(ids) })).sort((a, b) => b.score - a.score);
    if (ranked[0]?.score > 0) return ranked[0].ids;
    return diagrams.length === 1 && SPEAKS_OF_A_DIAGRAM.test(message) ? diagrams[0] : null;
};

const membersOf = (diagramId, elements) => Object.keys(elements).filter((id) => elements[id]?.diagram?.id === diagramId);

// The diagram as the model edits it, by the refs of the grounded objects that own its nodes, in its own style.
const offerDiagram = (ids, objects, elements, suspectRefs) => {
    const members = new Set(ids);
    const ownerOf = (elementId) => objects.find((object) => object.memberElementIds.includes(elementId));
    const covering = objects.filter((object) => object.memberElementIds.some((id) => members.has(id)));
    // Labels go to the model as data and come back as the new diagram's text, so text that reads like instructions isn't offered.
    if (covering.some((object) => suspectRefs.includes(object.ref))) return null;

    const { model, recipe } = readDiagram(elements, ids);
    const nodeElementOf = new Map(ids.filter((id) => elements[id].diagram.role === "node").map((id) => [elements[id].diagram.key, id]));
    const refOf = (key) => ownerOf(nodeElementOf.get(key))?.ref ?? key;
    const nodes = model.nodes.map((node) => ({
        id: refOf(node.id),
        label: node.label,
        ...Object.fromEntries(NODE_FIELDS.filter((field) => node[field] != null).map((field) => [field, node[field]])),
    }));
    const edges = model.edges.map((edge) => ({ from: refOf(edge.from), to: refOf(edge.to), ...(edge.label ? { label: edge.label } : {}) }));
    return {
        fromBoard: true,
        note: BOARD_DIAGRAM_NOTE,
        diagram: { nodes, edges, style: recipe },
        placedDiagram: { nodes, edges, refs: covering.map((object) => object.ref) },
    };
};

export const readBoardDiagram = (message, objects, elements, suspectRefs = []) => {
    const ids = pickDiagram(message, diagramMembers(elements), elements);
    return ids ? offerDiagram(ids, objects, elements, suspectRefs) : null;
};

// The board's own diagram behind objects a conversation placed, so a follow-up replaces all of it, lanes and title
// included, and keeps its look; null when those objects carry no diagram, such as a diagram redrawn by hand.
export const readDiagramBehind = (refs, objects, elements, suspectRefs = []) => {
    const wanted = new Set(refs);
    const counts = new Map();
    for (const object of objects.filter((candidate) => wanted.has(candidate.ref)))
        for (const id of object.memberElementIds) {
            const diagramId = elements[id]?.diagram?.id;
            if (diagramId) counts.set(diagramId, (counts.get(diagramId) ?? 0) + 1);
        }
    if (counts.size === 0) return null;
    const diagramId = [...counts].sort((a, b) => b[1] - a[1])[0][0];
    return offerDiagram(membersOf(diagramId, elements), objects, elements, suspectRefs);
};

const bandWords = (band) =>
    band
        .toLowerCase()
        .replace(/\b(tiers?|layers?|lanes?|stages?)\b/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/s\b/g, "");

const ASKS_ABOUT_LANES = /\b(lanes?|tiers?|layers?|columns?|rows?|swimlanes?)\b/i;

// The model re-sends every node and tends to invent bands from kinds, under whichever of lane, tier or stage it likes,
// which redraws the diagram's tiers under new names. Unless the message is about them, nodes it already had keep their
// band, a new node's band moves to the field the board uses, and a diagram without bands gains none.
export const keepBoardLanes = (updated, previous, message) => {
    if (ASKS_ABOUT_LANES.test(message)) return updated;
    const before = new Map(
        previous.nodes.flatMap((node) => [
            [node.id, node],
            [node.label.toLowerCase(), node],
        ]),
    );
    const field = BAND_FIELDS.find((candidate) => previous.nodes.some((node) => node[candidate]));
    const bands = [...new Set(previous.nodes.map((node) => node[field]).filter(Boolean))];
    // "Edge Tier" for a new node is the board's "Edge"; only a band the board lacks is new.
    const onBoard = (band) => bands.find((existing) => bandWords(existing) === bandWords(band)) ?? band;
    const nodes = updated.nodes.map((node) => {
        const known = before.get(node.id) ?? before.get(node.label.toLowerCase());
        const rest = { ...node };
        BAND_FIELDS.forEach((band) => delete rest[band]);
        if (!field) return rest;
        const offered = BAND_FIELDS.map((candidate) => node[candidate]).find(Boolean);
        const band = known ? known[field] : offered && onBoard(offered);
        return band ? { ...rest, [field]: band } : rest;
    });
    return { ...updated, nodes };
};
