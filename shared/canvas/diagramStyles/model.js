// A diagram's content apart from how it is drawn. Every structure accepts any model
// and derives what it needs (a tree, lanes, values, an order) from what is there.

const MAX_DIAGRAM_NODES = 60;

const text = (value, max = 160) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const finiteOr = (value, fallback) => (Number.isFinite(Number(value)) && value !== null && value !== "" ? Number(value) : fallback);

// Kinds a structure or look gives meaning to. Anything else is a plain node.
export const NODE_KINDS = [
    "start",
    "end",
    "decision",
    "process",
    "task",
    "event",
    "person",
    "system",
    "service",
    "client",
    "phone",
    "database",
    "queue",
    "store",
    "document",
    "folder",
    "cloud",
    "external",
    "gateway",
    "fork",
    "join",
    "column",
    "pro",
    "con",
    "rebuttal",
    "gate-and",
    "gate-or",
    "hotspot",
    "command",
    "policy",
    "milestone",
    "note",
];

const NODE_KIND_SET = new Set(NODE_KINDS);

// A group may list several sets for a Venn overlap, written "A & B".
const splitSets = (group) =>
    text(group)
        .split(/\s*&\s*|\s*\+\s*/)
        .filter(Boolean);

export const normalizeDiagramModel = (raw = {}) => {
    const groups = (raw.groups ?? [])
        .map((group) => ({
            id: text(group.id, 60),
            label: text(group.label) || text(group.id, 60),
            parent: text(group.parent, 60) || null,
            kind: text(group.kind, 30) || null,
        }))
        .filter((group) => group.id);
    const groupIds = new Set(groups.map((group) => group.id));

    const seen = new Set();
    const nodes = [];
    (raw.nodes ?? []).slice(0, MAX_DIAGRAM_NODES).forEach((node, index) => {
        const id = text(node.id, 60) || `n${index + 1}`;
        if (seen.has(id)) return;
        seen.add(id);
        const sets = splitSets(node.group);
        sets.forEach((set) => {
            if (!groupIds.has(set)) {
                groupIds.add(set);
                groups.push({ id: set, label: set, parent: null, kind: null });
            }
        });
        const kind = text(node.kind, 30).toLowerCase();
        nodes.push({
            id,
            label: text(node.label) || id,
            detail: text(node.detail, 400) || null,
            kind: NODE_KIND_SET.has(kind) ? kind : kindFromShape(node.shape),
            group: sets[0] ?? null,
            sets,
            parent: text(node.parent, 60) || null,
            value: finiteOr(node.value, null),
            start: finiteOr(node.start, null),
            end: finiteOr(node.end, null),
            x: finiteOr(node.x, null),
            y: finiteOr(node.y, null),
            status: text(node.status, 40) || null,
            owner: text(node.owner, 60) || null,
            tier: text(node.tier, 40) || null,
            lane: text(node.lane, 60) || null,
            icon: text(node.icon, 40) || null,
            fillColor: typeof node.fillColor === "string" && /^#[0-9a-f]{6}$/i.test(node.fillColor) ? node.fillColor : null,
            root: Boolean(node.root),
        });
    });
    const nodeIds = new Set(nodes.map((node) => node.id));
    nodes.forEach((node) => {
        if (node.parent && !nodeIds.has(node.parent)) node.parent = null;
    });

    const edges = (raw.edges ?? [])
        .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
        .map((edge) => ({
            from: edge.from,
            to: edge.to,
            label: text(edge.label, 120) || null,
            kind: text(edge.kind, 30) || null,
            value: finiteOr(edge.value, null),
        }));

    return { nodes, edges, groups, title: text(raw.title, 120) || null };
};

const kindFromShape = (shape) => (shape === "diamond" ? "decision" : shape === "ellipse" ? "start" : null);

// Parent links from `parent` fields when present, otherwise from edges walked
// breadth first out of the root, so any connected graph reads as a tree.
export const deriveTree = (model) => {
    const { nodes, edges } = model;
    if (nodes.length === 0) return { rootId: null, childrenOf: new Map(), parentOf: new Map(), depthOf: new Map() };
    const childrenOf = new Map(nodes.map((node) => [node.id, []]));
    const parentOf = new Map();
    const hasParents = nodes.some((node) => node.parent);

    if (hasParents) {
        nodes.forEach((node) => {
            if (node.parent) {
                parentOf.set(node.id, node.parent);
                childrenOf.get(node.parent).push(node.id);
            }
        });
    } else {
        const outgoing = new Map(nodes.map((node) => [node.id, []]));
        const incoming = new Map(nodes.map((node) => [node.id, 0]));
        edges.forEach(({ from, to }) => {
            if (from === to) return;
            outgoing.get(from).push(to);
            outgoing.get(to).push(from);
            incoming.set(to, incoming.get(to) + 1);
        });
        const marked = nodes.find((node) => node.root);
        const source = nodes.find((node) => incoming.get(node.id) === 0 && outgoing.get(node.id).length > 0);
        const byDegree = [...nodes].sort((a, b) => outgoing.get(b.id).length - outgoing.get(a.id).length);
        const rootId = (marked ?? source ?? byDegree[0]).id;
        const visited = new Set([rootId]);
        const queue = [rootId];
        while (queue.length > 0) {
            const current = queue.shift();
            outgoing.get(current).forEach((next) => {
                if (visited.has(next)) return;
                visited.add(next);
                parentOf.set(next, current);
                childrenOf.get(current).push(next);
                queue.push(next);
            });
        }
    }

    const roots = nodes.filter((node) => !parentOf.has(node.id)).map((node) => node.id);
    const rootId = roots[0];
    // Several roots, or nodes nothing reached, hang off the first root.
    roots.slice(1).forEach((id) => {
        parentOf.set(id, rootId);
        childrenOf.get(rootId).push(id);
    });

    const depthOf = new Map([[rootId, 0]]);
    const walk = (id) =>
        childrenOf.get(id).forEach((child) => {
            depthOf.set(child, depthOf.get(id) + 1);
            walk(child);
        });
    walk(rootId);
    return { rootId, childrenOf, parentOf, depthOf };
};

// Nodes in reading order: a topological order of the edges where there is
// one, falling back to the order they were given.
export const flowOrder = (model) => {
    const { nodes, edges } = model;
    const indexOf = new Map(nodes.map((node, i) => [node.id, i]));
    const incoming = new Map(nodes.map((node) => [node.id, 0]));
    const outgoing = new Map(nodes.map((node) => [node.id, []]));
    edges.forEach(({ from, to }) => {
        if (from === to) return;
        incoming.set(to, incoming.get(to) + 1);
        outgoing.get(from).push(to);
    });
    const ready = nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
    const order = [];
    const placed = new Set();
    while (order.length < nodes.length) {
        if (ready.length === 0) {
            const next = nodes.find((node) => !placed.has(node.id));
            ready.push(next.id);
        }
        ready.sort((a, b) => indexOf.get(a) - indexOf.get(b));
        const id = ready.shift();
        if (placed.has(id)) continue;
        placed.add(id);
        order.push(id);
        outgoing.get(id).forEach((to) => {
            incoming.set(to, incoming.get(to) - 1);
            if (incoming.get(to) === 0 && !placed.has(to)) ready.push(to);
        });
    }
    return order;
};

// The bucket a node belongs to for lanes, columns and bands: the named field
// when the structure asks for one, else lane, then group, then kind.
export const bucketOf = (node, field) => node[field] ?? node.lane ?? node.group ?? node.tier ?? node.kind ?? "Other";

export const bucketsOf = (model, field, fixed = null) => {
    if (fixed) return fixed.map((label) => ({ key: label, label }));
    const labels = new Map();
    model.groups.forEach((group) => labels.set(group.id, group.label));
    const keys = [];
    model.nodes.forEach((node) => {
        const key = bucketOf(node, field);
        if (!keys.includes(key)) keys.push(key);
    });
    return keys.map((key) => ({ key, label: labels.get(key) ?? key }));
};

// Fits a node into one of a fixed set of buckets by its field, then by
// matching words, so "Strength: fast" lands in Strengths without a group.
export const matchFixedBucket = (node, buckets, field) => {
    const candidates = [node[field], node.lane, node.group, node.tier, node.status, node.kind].filter(Boolean).map((value) => value.toLowerCase());
    const found = buckets.find((bucket) =>
        candidates.some(
            (value) => value === bucket.toLowerCase() || bucket.toLowerCase().startsWith(value) || value.startsWith(bucket.toLowerCase().slice(0, 5)),
        ),
    );
    return found ?? null;
};

export const valueOf = (node, fallback = 1) => (Number.isFinite(node.value) && node.value > 0 ? node.value : fallback);
