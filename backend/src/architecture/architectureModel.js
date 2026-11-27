// Reads a module graph as an engineer would draw it: which side each part is on, how parts stack
// from entry points to data, their names, and how sides talk when no import joins them.
import { deployTargetsIn, frameworkForImport, PROTOCOLS } from "./serviceSignatures.js";

const FRONTEND_WORDS = new Set([
    "frontend",
    "front-end",
    "client",
    "web",
    "webapp",
    "ui",
    "app-ui",
    "pages",
    "components",
    "views",
    "screens",
    "layouts",
    "hooks",
    "store",
    "stores",
    "slice",
    "slices",
    "redux",
    "theme",
    "styles",
    "widgets",
]);
const BACKEND_WORDS = new Set([
    "backend",
    "back-end",
    "server",
    "api",
    "apis",
    "routes",
    "router",
    "routers",
    "controllers",
    "controller",
    "handlers",
    "handler",
    "middleware",
    "middlewares",
    "models",
    "model",
    "schemas",
    "services",
    "service",
    "repositories",
    "repository",
    "db",
    "database",
    "dao",
    "entities",
    "workers",
    "jobs",
    "cmd",
    "internal",
    "domain",
    "usecases",
    "resolvers",
]);
const FRONTEND_EXTENSIONS = /\.(jsx|tsx|vue|svelte|astro|dart|swift)$/;
const CONTAINER_FOLDERS = new Set(["apps", "packages", "services", "libs", "crates", "modules", "plugins", "projects"]);
const GENERIC_ROOTS = new Set(["src", "lib", "source", "sources", "main", "app", "core", "pkg", "internal"]);

// Lower draws higher: where a request comes in down to where data sits.
const ROLE_RANKS = [
    [0, /^(pages|app|cmd|bin|main|index|server|entry|entrypoints?|gateway|web)$/],
    [1, /^(routes?|routers?|urls|controllers?|handlers?|api|apis|views|screens|components|features|widgets|layouts|resolvers|socket)$/],
    [2, /^(middlewares?|services?|usecases?|domain|core|engine|logic|hooks|context|providers?|agents?)$/],
    [3, /^(store|stores|slices?|state|redux|lib|libs|utils?|helpers?|common|shared|client|clients|config|theme|styles|types|constants)$/],
    [4, /^(models?|schemas?|entities|repositor(y|ies)|db|database|dao|data|persistence|storage)$/],
];
const DEFAULT_RANK = 2;
const SIDE_PASSES = 4;
const MAX_LAYER_PASSES = 12;
const MAX_LAYER = 4;
// Routes, views, and what they share reads clearly in three; a server's request
// path usually needs one more.
const MAX_ROWS = { frontend: 3, default: 4 };
const MAX_GROUPS = 6;
const MAX_PRIMARY_OUT = 4;
// Past this many arrows into one part, more add clutter rather than meaning.
const MAX_PRIMARY_IN = 3;
const ARROWS_PER_PART = 1.25;
const MIN_ARROWS = 10;
const MAX_SERVICE_LINKS = 2;
const SAMPLE_NAMES = 3;

const FILE_ROLES = [
    [/^socket\.io-client$/, "Realtime client"],
    [/^socket\.io$/, "Rooms, event handlers"],
    [/^(axios|ky)$/, "REST client"],
    [/^next-auth/, "Auth session"],
    [/^(@reduxjs\/toolkit|redux|zustand|pinia)$/, "State store"],
    [/^express$/, "HTTP server"],
    [/^(fastapi|flask)($|\.)/, "HTTP server"],
];

const PART_NAMES = {
    components: "Component",
    services: "Service",
    features: "Feature",
    modules: "Module",
    packages: "Package",
    plugins: "Plugin",
    pages: "Page",
    views: "View",
    screens: "Screen",
};

const segmentsOf = (moduleId) => (moduleId === "." ? [] : moduleId.split("/"));
const isFileModule = (node) => /\.\w+$/.test(node.id) && node.fileCount === 1;
const stem = (name) => name.replace(/\.[^.]+$/, "");

const sideFromPath = (node, externals) => {
    const words = segmentsOf(node.id).map((segment) => stem(segment).toLowerCase());
    let frontend = words.filter((word) => FRONTEND_WORDS.has(word)).length;
    let backend = words.filter((word) => BACKEND_WORDS.has(word)).length;
    if (words[0] === "frontend" || words[0] === "client" || words[0] === "web") frontend += 3;
    if (words[0] === "backend" || words[0] === "server" || words[0] === "api") backend += 3;
    if ((node.sampleFiles ?? []).some((file) => FRONTEND_EXTENSIONS.test(file))) frontend += 1;
    for (const specifier of externals) {
        const side = frameworkForImport(specifier)?.side;
        if (side === "frontend") frontend += 2;
        if (side === "backend") backend += 2;
    }
    if (frontend === backend) return null;
    return frontend > backend ? "frontend" : "backend";
};

const roleRankOf = (node) => {
    const words = segmentsOf(node.id)
        .map((segment) => stem(segment).toLowerCase())
        .reverse();
    for (const word of words) {
        const match = ROLE_RANKS.find(([, pattern]) => pattern.test(word));
        if (match) return match[0];
    }
    return DEFAULT_RANK;
};

// The folder a module belongs to at the top of the repository: the part a person
// would name first when describing it.
const areaOf = (node) => {
    const segments = segmentsOf(node.id);
    const folders = isFileModule(node) ? segments.slice(0, -1) : segments;
    if (folders.length === 0) return ".";
    if (CONTAINER_FOLDERS.has(folders[0]) && folders[1]) return `${folders[0]}/${folders[1]}`;
    return folders[0];
};

const titleCase = (text) => text.replace(/[-_]+/g, " ").replace(/^\w/, (first) => first.toUpperCase());

const GROUP_NAMES = { frontend: "Frontend", backend: "Backend", client: "Frontend", server: "Backend", web: "Frontend", api: "Backend" };

// A part with no tell of its own sits on the side of whatever it's wired to; a
// shared helper used only by the server is server code, wherever its folder is.
const propagateSides = (sides, edges) => {
    for (let pass = 0; pass < SIDE_PASSES; pass += 1) {
        const votes = new Map();
        const vote = (id, side) => {
            if (sides.get(id) !== null || !side) return;
            if (!votes.has(id)) votes.set(id, { frontend: 0, backend: 0 });
            votes.get(id)[side] += 1;
        };
        for (const { from, to } of edges) {
            if (!sides.has(from) || !sides.has(to)) continue;
            vote(to, sides.get(from));
            vote(from, sides.get(to));
        }
        if (votes.size === 0) break;
        for (const [id, { frontend, backend }] of votes) sides.set(id, frontend > backend ? "frontend" : backend > frontend ? "backend" : sides.get(id));
    }
    return sides;
};

const assignGroups = (modules, edges, externalsByModule, filePaths) => {
    const sides = propagateSides(new Map(modules.map((node) => [node.id, sideFromPath(node, externalsByModule.get(node.id) ?? [])])), edges);
    const areas = new Map();
    for (const node of modules) {
        const area = areaOf(node);
        if (!areas.has(area)) areas.set(area, []);
        areas.get(area).push(node);
    }

    // A repository with one app under one folder has no meaningful areas, so its
    // parts group by which side they're on instead.
    const meaningfulAreas = [...areas.keys()].filter((area) => area !== "." && !GENERIC_ROOTS.has(area));
    const byArea = meaningfulAreas.length >= 2;

    // An area of one part isn't a structure worth drawing a border around, unless
    // its name says it's a whole side of the system.
    const isWorthAGroup = (area) => (areas.get(area).length >= 2 || GROUP_NAMES[area.split("/").pop()]) && area !== "." && !GENERIC_ROOTS.has(area);
    const groupKey = (node) => (byArea && isWorthAGroup(areaOf(node)) ? areaOf(node) : (sides.get(node.id) ?? "app"));

    const members = new Map();
    for (const node of modules) {
        const key = groupKey(node);
        if (!members.has(key)) members.set(key, []);
        members.get(key).push(node);
    }

    // Too many groups stop being a structure; the smallest fold into one together.
    const ordered = [...members.entries()].sort((a, b) => b[1].length - a[1].length);
    const kept = ordered.slice(0, MAX_GROUPS - 1);
    const folded = ordered.slice(MAX_GROUPS - 1).flatMap(([, nodes]) => nodes);
    if (folded.length > 0) kept.push(["other", folded]);

    const deploys = deployTargetsIn(filePaths);
    return kept.map(([key, nodes]) => {
        const sideVotes = nodes.map((node) => sides.get(node.id)).filter(Boolean);
        const frontendVotes = sideVotes.filter((side) => side === "frontend").length;
        const kind = sideVotes.length === 0 ? "library" : frontendVotes * 2 >= sideVotes.length ? "frontend" : "backend";
        const frameworks = new Set();
        for (const node of nodes) {
            for (const specifier of externalsByModule.get(node.id) ?? []) {
                const framework = frameworkForImport(specifier);
                if (framework && framework.side === kind) frameworks.add(framework.name);
            }
        }
        const name = GROUP_NAMES[key.split("/").pop()] ?? (key === "app" ? "Application" : key === "other" ? "Other" : titleCase(key.split("/").pop()));
        const deploy = deploys.find(
            ({ directory }) => (directory && (key === directory || key.startsWith(`${directory}/`))) || (!directory && byArea === false),
        );
        const detail = [...frameworks]
            .filter((framework) => framework !== "React" || !frameworks.has("Next.js"))
            .slice(0, 1)
            .concat(deploy ? [deploy.name] : []);
        return { id: `group:${key}`, key, label: detail.length ? `${name} (${detail.join(", ")})` : name, kind, nodeIds: nodes.map((node) => node.id) };
    });
};

// A part's role sets its row and imports push dependencies lower so arrows run downhill,
// capped at a few levels.
const assignLayers = (group, nodesById, edges) => {
    const members = new Set(group.nodeIds);
    const layers = new Map(group.nodeIds.map((id) => [id, roleRankOf(nodesById.get(id))]));
    const internal = edges.filter((edge) => members.has(edge.from) && members.has(edge.to));
    const links = new Set(internal.map((edge) => `${edge.from}->${edge.to}`));
    const oneWay = internal.filter((edge) => !links.has(`${edge.to}->${edge.from}`));
    for (let pass = 0; pass < MAX_LAYER_PASSES; pass += 1) {
        let changed = false;
        for (const { from, to } of oneWay) {
            if (layers.get(to) <= layers.get(from) && layers.get(from) < MAX_LAYER) {
                layers.set(to, layers.get(from) + 1);
                changed = true;
            }
        }
        if (!changed) break;
    }
    const used = [...new Set(layers.values())].sort((a, b) => a - b);
    const rank = new Map(used.map((layer, index) => [layer, index]));
    const lastRow = (MAX_ROWS[group.kind] ?? MAX_ROWS.default) - 1;
    return new Map([...layers].map(([id, layer]) => [id, Math.min(rank.get(layer), lastRow)]));
};

const titleOf = (node, framework) => {
    if (isFileModule(node)) return node.id.split("/").pop();
    const segments = segmentsOf(node.id);
    if (segments.length === 0) return "root";
    const last = segments[segments.length - 1];
    const name = GENERIC_ROOTS.has(last) && segments.length > 1 ? `${segments[segments.length - 2]}/${last}/` : `${last}/`;
    if (framework === "Next.js" && /^(pages|app)$/.test(last)) return `${name} (Next.js routes)`;
    return name;
};

const subtitleOf = (node, externals) => {
    if (isFileModule(node)) {
        for (const specifier of externals) {
            const role = FILE_ROLES.find(([pattern]) => pattern.test(specifier));
            if (role) return role[1];
        }
        return "";
    }
    const names = node.parts ?? (node.sampleFiles ?? []).map(stem).filter((name) => !/^(index|__init__|mod|main)$/.test(name));
    const shown = names.slice(0, SAMPLE_NAMES).join(", ");
    const more = node.fileCount - Math.min(names.length, SAMPLE_NAMES);
    if (shown) return more > 0 ? `${shown} +${more}` : shown;
    const parent = segmentsOf(node.id).at(-2)?.toLowerCase() ?? "";
    return PART_NAMES[parent] ?? `${node.fileCount} file${node.fileCount === 1 ? "" : "s"}`;
};

// Drops arrows implied by a path through others, heaviest kept first so cycles can't cancel.
// Everything stays in the graph for comparisons; `primary` is what's drawn.
const markPrimaryEdges = (nodes, edges) => {
    const isService = new Set(nodes.filter((node) => node.kind === "service").map((node) => node.id));
    const kept = new Map();
    const reaches = (from, to) => {
        const seen = new Set([from]);
        const stack = [from];
        while (stack.length) {
            for (const next of kept.get(stack.pop()) ?? []) {
                if (next === to) return true;
                if (!seen.has(next)) {
                    seen.add(next);
                    stack.push(next);
                }
            }
        }
        return false;
    };
    const primary = new Set();
    const heaviestFirst = [...edges].filter((edge) => !isService.has(edge.to)).sort((a, b) => b.weight - a.weight);
    const connected = new Set();
    const incoming = new Map();
    const keep = (edge) => {
        incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
        if (!kept.has(edge.from)) kept.set(edge.from, []);
        kept.get(edge.from).push(edge.to);
        primary.add(edge);
        connected.add(edge.from);
        connected.add(edge.to);
    };
    // Nothing floats alone: each part keeps its heaviest link before anything else.
    for (const edge of heaviestFirst) {
        if (!connected.has(edge.from) || !connected.has(edge.to)) keep(edge);
    }
    // Then the rest in order of weight, up to what a person can actually follow.
    const budget = Math.max(MIN_ARROWS, Math.ceil(nodes.filter((node) => node.kind === "module").length * ARROWS_PER_PART));
    for (const edge of heaviestFirst) {
        if (primary.size >= budget) break;
        if (
            primary.has(edge) ||
            reaches(edge.from, edge.to) ||
            (kept.get(edge.from)?.length ?? 0) >= MAX_PRIMARY_OUT ||
            (incoming.get(edge.to) ?? 0) >= MAX_PRIMARY_IN
        )
            continue;
        keep(edge);
    }
    // Each data store shows its heaviest users, not everything that touches it.
    for (const service of isService) {
        edges
            .filter((edge) => edge.to === service)
            .sort((a, b) => b.weight - a.weight)
            .slice(0, MAX_SERVICE_LINKS)
            .forEach((edge) => primary.add(edge));
    }
    return edges.map((edge) => ({ ...edge, primary: primary.has(edge) }));
};

// Two parts on one row are peers; an arrow between them is detail, kept only when
// it's what stops one of them floating unconnected.
const withoutSameRowDetail = (edges, nodes) => {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const degree = new Map();
    const note = (id) => degree.set(id, (degree.get(id) ?? 0) + 1);
    edges
        .filter((edge) => edge.primary)
        .forEach((edge) => {
            note(edge.from);
            note(edge.to);
        });
    return edges.map((edge) => {
        const from = byId.get(edge.from);
        const to = byId.get(edge.to);
        const peers = edge.primary && from?.kind === "module" && to?.kind === "module" && from.group === to.group && from.layer === to.layer;
        return peers && degree.get(edge.from) > 1 && degree.get(edge.to) > 1 ? { ...edge, primary: false } : edge;
    });
};

// How the sides talk: a socket client here and a socket server there are joined
// by a wire no import shows.
const protocolEdges = (groups, externalsByModule, layers) => {
    const groupOf = new Map(groups.flatMap((group) => group.nodeIds.map((id) => [id, group])));
    const usesAny = (moduleId, pattern) => [...(externalsByModule.get(moduleId) ?? [])].some((specifier) => pattern.test(specifier));
    const usesJwt = [...externalsByModule.values()].some((externals) => [...externals].some((specifier) => /^(jsonwebtoken|jose|pyjwt|jwt)/i.test(specifier)));
    const edges = [];
    for (const { label, client, server } of PROTOCOLS) {
        const clients = [...externalsByModule.keys()].filter((id) => groupOf.get(id)?.kind === "frontend" && usesAny(id, client));
        const servers = [...externalsByModule.keys()].filter((id) => groupOf.get(id)?.kind === "backend" && usesAny(id, server));
        if (clients.length === 0 || servers.length === 0) continue;
        const pick = (ids) => [...ids].sort((a, b) => a.split("/").length - b.split("/").length || a.length - b.length)[0];
        // A request arrives at the server's front door, whichever part handles it after that.
        const serverGroup = groupOf.get(pick(servers));
        const frontDoor = serverGroup.nodeIds.filter((id) => layers.get(id) === 0);
        edges.push({
            from: pick(clients),
            to: pick(frontDoor.length ? frontDoor : servers),
            weight: 1,
            label: label === "REST" && usesJwt ? "REST + JWT" : label,
            protocol: true,
            primary: true,
            bidirectional: label === "WebSocket",
        });
    }
    return edges;
};

// A database that only a compose file mentions still belongs to the server, even
// though no import names it: an ORM can sit between them.
const inferredDataEdges = (nodes, edges, groups, layers) => {
    const server = groups.find((group) => group.kind === "backend") ?? groups[0];
    if (!server) return [];
    const lowest = [...server.nodeIds].sort((a, b) => layers.get(b) - layers.get(a));
    const dataLayer = lowest.find((id) => /(^|\/)(models?|db|database|schemas?|core|data)(\/|\.|$)/i.test(id)) ?? lowest[0];
    return nodes
        .filter((node) => node.kind === "service" && node.serviceKind === "data" && !edges.some((edge) => edge.to === node.id))
        .map((node) => ({ from: dataLayer, to: node.id, weight: 1, primary: true }));
};

// Adds the drawing to a graph: each node's group, layer, title and subtitle, the
// groups themselves, and which edges to draw.
export const describeArchitecture = (graph, { externalsByModule, filePaths }) => {
    const modules = graph.nodes.filter((node) => node.kind === "module");
    const groups = assignGroups(modules, graph.edges, externalsByModule, filePaths);
    const groupById = new Map(groups.flatMap((group) => group.nodeIds.map((id) => [id, group.id])));
    const modulesById = new Map(modules.map((node) => [node.id, node]));
    const layers = new Map(groups.flatMap((group) => [...assignLayers(group, modulesById, graph.edges)]));

    const frameworkByModule = (id) => {
        for (const specifier of externalsByModule.get(id) ?? []) {
            const framework = frameworkForImport(specifier);
            if (framework) return framework.name;
        }
        return null;
    };
    const appFramework = [...externalsByModule.keys()].map(frameworkByModule).find((name) => name === "Next.js");

    const nodes = graph.nodes.map((node) => {
        if (node.kind !== "module")
            return {
                ...node,
                title: node.label,
                subtitle: node.serviceKind === "data" ? "Data store" : "External service",
                group: node.serviceKind === "data" ? "group:data" : "group:external",
                layer: 0,
            };
        const externals = [...(externalsByModule.get(node.id) ?? [])];
        return {
            ...node,
            title: titleOf(node, appFramework),
            subtitle: subtitleOf(node, externals),
            group: groupById.get(node.id),
            layer: layers.get(node.id),
        };
    });

    const edges = [
        ...withoutSameRowDetail(markPrimaryEdges(nodes, graph.edges), nodes),
        ...protocolEdges(groups, externalsByModule, layers),
        ...inferredDataEdges(nodes, graph.edges, groups, layers),
    ];
    return { ...graph, nodes, edges, groups: groups.map(({ id, label, kind }) => ({ id, label, kind })) };
};
