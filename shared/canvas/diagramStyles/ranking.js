import { STRUCTURES, LOOKS } from "./catalog.js";
import { normalizeDiagramModel, deriveTree } from "./model.js";

// Words people use for a structure or look, beyond its own name.
const STRUCTURE_ALIASES = {
    "radial-map": ["mind map", "mindmap", "brainstorm"],
    "two-sided-map": ["balanced mind map"],
    "logic-tree": ["issue tree", "why tree", "how tree", "mece"],
    "org-chart": ["org chart", "organisation chart", "organization chart", "reporting line"],
    "bubble-cluster": ["bubble"],
    "brace-map": ["brace", "parts of"],
    outline: ["agenda", "indented"],
    sunburst: ["sunburst"],
    flowchart: ["flowchart", "flow chart", "flow diagram"],
    pipeline: ["pipeline", "approval flow"],
    swimlanes: ["swimlane", "swim lane", "cross-functional"],
    "decision-tree": ["decision tree"],
    "numbered-steps": ["steps", "how to", "how-to", "step by step"],
    cycle: ["cycle", "loop", "lifecycle loop", "flywheel"],
    "layered-tiers": ["architecture", "tiers", "layered"],
    containers: ["c4", "container diagram"],
    "cloud-zones": ["vpc", "subnet", "aws", "azure", "gcp", "infrastructure"],
    "hub-and-spoke": ["hub and spoke", "event bus", "message bus"],
    "data-pipeline": ["etl", "elt", "data pipeline", "analytics"],
    "request-journey": ["request flow", "request lifecycle"],
    timeline: ["timeline", "history", "milestones"],
    fishbone: ["fishbone", "ishikawa", "root cause"],
    quadrant: ["quadrant", "2x2", "eisenhower", "impact effort", "matrix of"],
    funnel: ["funnel", "conversion"],
    "bar-chart": ["bar chart", "bar graph", "column chart", "histogram", "bars"],
    venn: ["venn", "overlap"],
    pyramid: ["pyramid", "hierarchy of needs"],
    "sequence-frames": ["sequence diagram", "sequence"],
    "entity-relationship": ["er diagram", "erd", "entity relationship", "schema", "data model", "database tables"],
    "class-diagram": ["class diagram", "uml class"],
    "state-machine": ["state machine", "state diagram", "states"],
    "activity-forks": ["activity diagram", "parallel steps", "fork"],
    "git-graph": ["git graph", "branching strategy", "gitflow", "git flow"],
    "use-cases": ["use case"],
    "components-ports": ["component diagram", "interfaces"],
    "system-context": ["system context", "context diagram"],
    "ports-adapters": ["hexagonal", "ports and adapters", "clean architecture"],
    "onion-layers": ["onion"],
    "service-mesh": ["service mesh", "microservices", "istio"],
    "cluster-nesting": ["kubernetes", "k8s", "cluster", "namespace"],
    "network-topology": ["network diagram", "network topology", "firewall"],
    "dependency-graph": ["dependency graph", "dependencies", "imports"],
    "isometric-stack": ["isometric", "3d stack"],
    "bpmn-process": ["bpmn"],
    "data-flow": ["data flow diagram", "dfd", "threat model"],
    "value-stream": ["value stream"],
    "service-blueprint": ["service blueprint"],
    "journey-map": ["journey map", "customer journey", "user journey"],
    "event-storming": ["event storming"],
    sipoc: ["sipoc"],
    "incident-timeline": ["incident", "post-mortem", "postmortem", "outage"],
    "story-map": ["story map", "user story map"],
    kanban: ["kanban", "board of tasks", "to do doing done"],
    gantt: ["gantt", "schedule", "project plan"],
    sitemap: ["sitemap", "site map", "information architecture"],
    "now-next-later": ["now next later", "roadmap"],
    "affinity-clusters": ["affinity", "research synthesis", "clusters of notes"],
    "opportunity-tree": ["opportunity solution tree", "opportunity tree"],
    "feature-matrix": ["feature matrix", "comparison table", "compare"],
    "wardley-map": ["wardley"],
    sankey: ["sankey", "flow of money", "where the budget goes"],
    "concept-map": ["concept map"],
    swot: ["swot"],
    treemap: ["treemap", "bundle size"],
    "raci-matrix": ["raci", "responsibility matrix"],
    "business-canvas": ["business model canvas", "lean canvas", "business canvas"],
    "circle-packing": ["circle packing"],
    "stakeholder-rings": ["stakeholder"],
    "argument-map": ["argument map", "pros and cons", "for and against"],
    "fault-tree": ["fault tree"],
    "causal-loop": ["causal loop", "feedback loop", "systems thinking"],
};

const LOOK_ALIASES = {
    sketchbook: ["sketch", "hand-drawn", "hand drawn", "handdrawn", "excalidraw"],
    blueprint: ["blueprint", "engineering"],
    "gold-leaf": ["premium", "luxury", "mosaic brand"],
    "soft-cards": ["friendly", "soft", "explainer"],
    console: ["console", "developer", "cli"],
    editorial: ["black and white", "print", "monochrome", "book"],
    "night-neon": ["neon", "glow"],
    workshop: ["sticky notes", "post-it", "workshop"],
    hairline: ["minimal", "minimalist", "clean"],
    clay: ["warm", "earthy"],
    chalkboard: ["chalk", "classroom", "teaching"],
    cutout: ["playful", "kids", "children", "fun"],
    swiss: ["swiss", "modernist"],
    "clear-signal": ["colour blind", "color blind", "accessible", "colorblind"],
    isometric: ["isometric", "3d"],
    watercolour: ["watercolor", "watercolour", "artistic"],
    "mosaic-tiles": ["tiles", "mosaic"],
    "marker-board": ["marker", "whiteboard"],
    "pastel-shadow": ["pastel"],
    "bold-block": ["bold", "punchy"],
    phosphor: ["terminal", "retro terminal", "green screen"],
    frosted: ["glass", "frosted", "glassmorphism"],
    brutalist: ["brutalist", "raw"],
    "riso-print": ["riso", "risograph", "zine"],
    "cloud-console": ["cloud console", "aws style", "azure style"],
    kraft: ["kraft", "cardboard"],
    pixel: ["pixel", "8-bit", "8 bit", "retro game"],
    bauhaus: ["bauhaus", "geometric"],
    "sumi-ink": ["ink brush", "zen", "japanese"],
    halftone: ["halftone", "comic", "newspaper"],
    duotone: ["duotone", "two colour", "two color"],
    "high-contrast": ["high contrast", "low vision"],
    "pattern-coded": ["no colour", "no color", "black only", "pattern"],
    "graph-paper": ["graph paper", "notebook", "pencil"],
    bevel: ["windows 95", "retro desktop"],
    atlas: ["map style", "atlas"],
    metro: ["metro", "subway", "transit"],
    spotlight: ["spotlight", "highlight the path"],
    letterpress: ["letterpress", "invitation"],
    stitched: ["stitched", "felt", "sewn"],
    heatmap: ["heatmap", "heat map", "by load"],
};

const APPEARANCE_CUE = / (style|styled|look|looks|looking|theme|themed|aesthetic|feel|like a|like an|as a|in a|in an|make it|colou?rs?) /;

const words = (text) =>
    ` ${String(text ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9+\s-]/g, " ")
        .replace(/\s+/g, " ")} `;
const mentions = (haystack, phrase) => haystack.includes(` ${phrase.toLowerCase()} `) || haystack.includes(` ${phrase.toLowerCase()}s `);

// The candidate whose longest phrase the text mentions; the most specific name wins, so
// "data pipeline" is not read as "pipeline" and "incident timeline" not as "timeline".
const mostSpecific = (text, candidates, phrasesOf) =>
    candidates
        .map((candidate) => ({
            candidate,
            length: Math.max(
                0,
                ...phrasesOf(candidate)
                    .filter((phrase) => mentions(text, phrase))
                    .map((phrase) => phrase.length),
            ),
        }))
        .filter(({ length }) => length > 0)
        .sort((a, b) => b.length - a.length)[0]?.candidate;

// A structure or look the message names outright, which skips the assistant's choosing.
export const explicitStyleIn = (message) => {
    const text = words(message);
    const aliases = (candidate) => STRUCTURE_ALIASES[candidate.id] ?? [];
    const structure =
        mostSpecific(text, STRUCTURES, (candidate) => [candidate.name.toLowerCase(), candidate.id.replace(/-/g, " ")]) ??
        mostSpecific(text, STRUCTURES, (candidate) => aliases(candidate).filter((alias) => alias.split(" ").length > 1)) ??
        mostSpecific(text, STRUCTURES, aliases);
    // A one-word alias such as "clean", "engineering" or "book" describes content as often as
    // appearance, so it only counts in a message that is talking about how the diagram looks.
    const lookAliases = (candidate) => LOOK_ALIASES[candidate.id] ?? [];
    const distinctive = (alias) => alias.split(/[\s-]+/).length > 1;
    const look =
        mostSpecific(text, LOOKS, (candidate) => [candidate.name.toLowerCase(), ...lookAliases(candidate).filter(distinctive)]) ??
        (APPEARANCE_CUE.test(text) ? mostSpecific(text, LOOKS, lookAliases) : null);
    return { structure: structure?.id ?? null, look: look?.id ?? null };
};

// Lanes, tiers, stages and groups all band the nodes, whichever field the content used.
const BAND_FIELDS = ["lane", "tier", "stage", "group"];
const SYSTEM_KINDS = new Set(["system", "service", "client", "phone", "database", "queue", "store", "cloud", "external", "gateway"]);
const ARCHITECTURE_GROUPS = new Set(["Architecture", "Architecture and operations"]);
const PROCESS_GROUPS = new Set(["Flowcharts", "Process and service"]);
const SYSTEM_SHARE = 0.6;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// Content made of services, stores and apps is a system: architecture structures suit it, process notations and
// a single request's journey through a branching system read worse.
const systemBias = (structure, model) => {
    const systemNodes = model.nodes.filter((node) => SYSTEM_KINDS.has(node.kind)).length;
    if (systemNodes / model.nodes.length < SYSTEM_SHARE) return 0;
    const outDegree = new Map();
    model.edges.forEach((edge) => outDegree.set(edge.from, (outDegree.get(edge.from) ?? 0) + 1));
    const branching = [...outDegree.values()].some((count) => count >= 2);
    if (structure.family === "sequence" && branching) return -0.3;
    if (ARCHITECTURE_GROUPS.has(structure.group)) return 0.2;
    if (PROCESS_GROUPS.has(structure.group) || structure.options?.mode === "git") return -0.25;
    return 0;
};

// How well a structure can show this content, 0 to 1: a Gantt with no dates
// or a Sankey with no amounts still draws, but says less.
export const structureFit = (structureId, rawModel) => {
    const model = rawModel.nodes?.[0]?.sets ? rawModel : normalizeDiagramModel(rawModel);
    const structure = STRUCTURES.find((candidate) => candidate.id === structureId);
    if (!structure || model.nodes.length === 0) return 0;
    const has = (field) => model.nodes.some((node) => node[field] !== null && node[field] !== undefined);
    const tree = deriveTree(model);
    const isTree = model.edges.length <= model.nodes.length - 1 || has("parent");
    // A tree only reads as one when something branches; a single chain is a flow.
    const branches = [...tree.childrenOf.values()].some((children) => children.length >= 2);
    const connected = model.edges.length >= model.nodes.length - 1;
    const kinds = new Set(model.nodes.map((node) => node.kind));
    const edgeKinds = new Set(model.edges.map((edge) => edge.kind).filter(Boolean));
    const notation = structure.options?.notation;
    let fit = 0.6;
    switch (structure.family) {
        case "tree":
        case "radial":
        case "fishbone":
            fit = isTree && branches ? 0.9 : 0.4;
            break;
        case "layered":
            if (notation === "flowchart") fit = connected ? 0.85 : 0.6;
            else if (notation === "er") fit = [...edgeKinds].some((kind) => kind.includes("many") || kind.includes("one")) ? 0.9 : 0.4;
            else if (notation === "class") fit = [...edgeKinds].some((kind) => ["inherits", "implements", "composes", "aggregates"].includes(kind)) ? 0.9 : 0.4;
            else if (notation === "state") fit = model.edges.some((edge) => edge.label) && !isTree ? 0.8 : 0.5;
            else if (notation === "activity") fit = kinds.has("fork") ? 0.9 : 0.45;
            else if (notation === "dataflow") fit = kinds.has("store") || kinds.has("external") ? 0.85 : 0.45;
            else fit = 0.5;
            break;
        case "sankey":
            fit = model.edges.some((edge) => Number.isFinite(edge.value)) ? 0.95 : 0.35;
            break;
        case "sequence":
            fit = model.edges.length >= 2 ? 0.8 : 0.3;
            break;
        case "timeline":
            fit =
                structure.options.mode === "gantt"
                    ? has("start") && has("end")
                        ? 0.95
                        : 0.35
                    : structure.options.mode === "git"
                      ? has("lane")
                          ? 0.85
                          : 0.35
                      : has("start")
                        ? 0.9
                        : 0.6;
            break;
        case "lanes":
            fit = structure.options.fixed ? 0.65 : has(structure.options.field ?? "lane") || BAND_FIELDS.some(has) ? 0.9 : 0.35;
            break;
        case "matrix":
            fit =
                structure.options.mode === "axes" || structure.options.mode === "quadrant"
                    ? has("x") && has("y")
                        ? 0.95
                        : 0.45
                    : structure.options.mode === "table"
                      ? kinds.has("column") || kinds.has("person")
                          ? 0.9
                          : 0.25
                      : 0.65;
            break;
        case "nested":
            fit =
                structure.options.mode === "treemap" || structure.options.mode === "packing"
                    ? has("value")
                        ? 0.9
                        : 0.45
                    : structure.options.mode === "usecases"
                      ? kinds.has("person")
                          ? 0.9
                          : 0.3
                      : model.groups.length > 0
                        ? 0.85
                        : 0.45;
            break;
        case "stack":
            fit = structure.options.mode === "bars" ? (has("value") && model.nodes.length <= 12 ? 0.9 : 0.3) : model.nodes.length <= 7 ? 0.8 : 0.35;
            break;
        case "circular":
            fit =
                structure.options.mode === "causal"
                    ? model.edges.some((edge) => /^[+-]$/.test(edge.label ?? edge.kind ?? ""))
                        ? 0.95
                        : 0.5
                    : model.nodes.length <= 12
                      ? 0.75
                      : 0.4;
            break;
        case "cards":
            fit = model.nodes.length <= 8 && !branches ? 0.8 : 0.4;
            break;
        default:
            fit = 0.75;
    }
    return clamp(fit + systemBias(structure, model), 0, 1);
};

// Ranked candidates for a message and model when no model call is available:
// what the words point at first, then how well each structure fits the content.
export const rankStructures = (message, model, limit = 5) => {
    const text = words(message);
    return STRUCTURES.map((structure) => {
        const named = (STRUCTURE_ALIASES[structure.id] ?? []).some((alias) => mentions(text, alias)) || mentions(text, structure.name.toLowerCase());
        return { id: structure.id, score: (named ? 1 : 0) + structureFit(structure.id, model) };
    })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((entry) => entry.id);
};
