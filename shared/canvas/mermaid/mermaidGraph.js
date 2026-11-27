// Mermaid's parsed diagrams as one plain graph with the board's own shape kinds and edge styles.

// Mermaid's shape names, old and `@{ shape: ... }` alike, as board shapes.
const SHAPES = {
    rect: { shapeType: "Rectangle" },
    squareRect: { shapeType: "Rectangle" },
    square: { shapeType: "Rectangle" },
    proc: { shapeType: "Rectangle" },
    process: { shapeType: "Rectangle" },
    roundedRect: { shapeType: "Rectangle", cornerRadius: 12 },
    round: { shapeType: "Rectangle", cornerRadius: 12 },
    rounded: { shapeType: "Rectangle", cornerRadius: 12 },
    event: { shapeType: "Rectangle", cornerRadius: 12 },
    stadium: { shapeType: "Rectangle", cornerRadius: 999 },
    pill: { shapeType: "Rectangle", cornerRadius: 999 },
    terminal: { shapeType: "Rectangle", cornerRadius: 999 },
    subroutine: { shapeType: "Rectangle" },
    subproc: { shapeType: "Rectangle" },
    cylinder: { shapeType: "Cylinder" },
    cyl: { shapeType: "Cylinder" },
    db: { shapeType: "Cylinder" },
    database: { shapeType: "Cylinder" },
    circle: { shapeType: "Circle", round: true },
    circ: { shapeType: "Circle", round: true },
    doublecircle: { shapeType: "Circle", round: true },
    "dbl-circ": { shapeType: "Circle", round: true },
    ellipse: { shapeType: "Ellipse", round: true },
    mindmapCircle: { shapeType: "Circle", round: true },
    diamond: { shapeType: "Diamond", diamond: true },
    question: { shapeType: "Diamond", diamond: true },
    decision: { shapeType: "Diamond", diamond: true },
    hexagon: { shapeType: "Hexagon" },
    hex: { shapeType: "Hexagon" },
    prepare: { shapeType: "Hexagon" },
    lean_r: { shapeType: "Parallelogram" },
    lean_right: { shapeType: "Parallelogram" },
    "lean-r": { shapeType: "Parallelogram" },
    lean_l: { shapeType: "Parallelogram" },
    lean_left: { shapeType: "Parallelogram" },
    "lean-l": { shapeType: "Parallelogram" },
    "in-out": { shapeType: "Parallelogram" },
    trap_t: { shapeType: "Trapezoid" },
    trap_b: { shapeType: "Trapezoid" },
    trapezoid: { shapeType: "Trapezoid" },
    inv_trapezoid: { shapeType: "Trapezoid" },
    "trap-t": { shapeType: "Trapezoid" },
    "trap-b": { shapeType: "Trapezoid" },
    doc: { shapeType: "Document" },
    document: { shapeType: "Document" },
    docs: { shapeType: "Document" },
    cloud: { shapeType: "Cloud" },
    odd: { shapeType: "BlockArrow" },
    flag: { shapeType: "BlockArrow" },
    stateStart: { shapeType: "Circle", round: true, marker: "start" },
    stateEnd: { shapeType: "Circle", round: true, marker: "end" },
    classBox: { shapeType: "Rectangle", listed: true },
    erBox: { shapeType: "Rectangle", listed: true },
    defaultMindmapNode: { shapeType: "Rectangle", cornerRadius: 12 },
};

const HEADS = {
    none: "none",
    arrow_open: "none",
    arrow_point: "triangle",
    arrow_barb: "arrow",
    arrow_circle: "dot",
    arrow_cross: "bar",
    extension: "triangle_outline",
    composition: "diamond",
    aggregation: "diamond_outline",
    dependency: "arrow",
    lollipop: "circle_outline",
    only_one: "crowfoot_one",
    zero_or_one: "crowfoot_one",
    one_or_more: "crowfoot_one_many",
    zero_or_more: "crowfoot_many",
    md_parent: "crowfoot_one",
};

// "fill:#f96", "stroke:#333", "color:#fff" from Mermaid's styles, as board colours.
const coloursFrom = (styles = []) => {
    const colours = {};
    styles.forEach((style) => {
        const [key, value] = style.split(":").map((part) => part?.trim());
        if (!value || !/^#[0-9a-f]{3,8}$|^[a-z]+$/i.test(value)) return;
        if (key === "fill") colours.fillColor = value;
        if (key === "stroke") colours.color = value;
        if (key === "color") colours.textColor = value;
    });
    return colours;
};

const plainText = (text) =>
    String(text ?? "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/\\([+\-#~])/g, "$1")
        .trim();

const memberLines = (node) => {
    const members = [...(node.members ?? []), ...(node.methods ?? [])].map((member) => plainText(member.text));
    const attributes = (node.attributes ?? []).map((attribute) => [attribute.type, attribute.name, ...(attribute.keys ?? [])].filter(Boolean).join(" "));
    return [...members, ...attributes];
};

const flowOf = (raw) => ({ direction: raw === "LR" || raw === "RL" ? "left-right" : "top-down", reversed: raw === "RL" || raw === "BT" });

// The shared layout data most diagram kinds expose: flowchart, state, class, ER, mindmap.
const fromLayoutData = (data, raw = {}) => {
    const groups = data.nodes.filter((node) => node.isGroup).map((node) => ({ id: node.id, label: plainText(node.label), parent: node.parentId ?? null }));
    const groupIds = new Set(groups.map((group) => group.id));
    const nodes = data.nodes
        .filter((node) => !node.isGroup)
        .map((node) => {
            const look = SHAPES[node.shape] ?? SHAPES.rect;
            const label = look.marker ? "" : plainText(node.label ?? node.id);
            return {
                id: node.id,
                label,
                details: look.listed ? memberLines(raw.entities?.get?.(node.id) ?? node) : [],
                group: node.parentId && groupIds.has(node.parentId) ? node.parentId : null,
                root: raw.kind === "mindmap" && node.level === 0,
                ...look,
                ...coloursFrom([...(node.cssStyles ?? []), ...(node.cssCompiledStyles ?? [])]),
            };
        });
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = data.edges
        .filter((edge) => nodeIds.has(edge.start) && nodeIds.has(edge.end) && edge.thickness !== "invisible" && edge.stroke !== "invisible")
        .map((edge) => ({
            from: edge.start,
            to: edge.end,
            label: plainText(edge.label),
            startHead: HEADS[edge.arrowTypeStart] ?? "none",
            endHead: HEADS[edge.arrowTypeEnd] ?? (raw.kind === "mindmap" ? "none" : "triangle"),
            strokeStyle:
                edge.pattern === "dotted" || edge.pattern === "dashed" || edge.thickness === "dotted" || edge.arrowTypeEnd === "dependency"
                    ? "dashed"
                    : "solid",
            size: edge.thickness === "thick" || edge.pattern === "thick" ? 4 : 2,
        }));
    return { nodes, edges, groups };
};

const SERVICE_SHAPES = { database: "Cylinder", disk: "Cylinder", cloud: "Cloud", internet: "Cloud", server: "Rectangle" };

const fromArchitecture = (db) => {
    const groups = db.getGroups().map((group) => ({ id: group.id, label: plainText(group.title ?? group.id), parent: group.in ?? null }));
    const nodes = [...db.getServices(), ...db.getJunctions()].map((service) => ({
        id: service.id,
        label: plainText(service.title ?? (service.type === "junction" ? "" : service.id)),
        details: [],
        group: service.in ?? null,
        shapeType: service.type === "junction" ? "Circle" : (SERVICE_SHAPES[service.icon] ?? "Rectangle"),
        round: service.type === "junction",
        cornerRadius: SERVICE_SHAPES[service.icon] ? 0 : 10,
    }));
    const edges = db.getEdges().map((edge) => ({
        from: edge.lhsId,
        to: edge.rhsId,
        label: plainText(edge.title),
        startHead: edge.lhsInto ? "triangle" : "none",
        endHead: edge.rhsInto ? "triangle" : "none",
        strokeStyle: "solid",
        size: 2,
    }));
    return { nodes, edges, groups };
};

// What kind of board drawing a parsed diagram becomes.
export const graphFromDiagram = (type, db) => {
    if (type === "architecture") return { kind: "architecture", direction: "left-right", ...fromArchitecture(db) };
    if (type === "mindmap") return { kind: "mindmap", direction: "radial", ...fromLayoutData(db.getData(), { kind: "mindmap" }) };
    if (type === "er") {
        return { kind: "er", ...flowOf(db.getDirection?.()), ...fromLayoutData(db.getData(), { entities: db.getEntities() }) };
    }
    if (db.getData) {
        const kind = type.startsWith("flowchart") ? "flowchart" : type.startsWith("class") ? "class" : type.startsWith("state") ? "state" : type;
        return { kind, ...flowOf(db.getDirection?.()), ...fromLayoutData(db.getData(), { kind }) };
    }
    return null;
};
