// Participants along the top with dashed lifelines, messages as arrows in order;
// notes become sticky notes and loops become frames.

const LINE = {
    SOLID: 0,
    DOTTED: 1,
    NOTE: 2,
    SOLID_CROSS: 3,
    DOTTED_CROSS: 4,
    SOLID_OPEN: 5,
    DOTTED_OPEN: 6,
    SOLID_POINT: 24,
    DOTTED_POINT: 25,
    BIDIRECTIONAL_SOLID: 33,
    BIDIRECTIONAL_DOTTED: 34,
};
const BLOCK_STARTS = { 10: "loop", 12: "alt", 15: "opt", 19: "par", 27: "critical", 30: "break" };
const BLOCK_ENDS = new Set([11, 14, 16, 21, 29, 31]);
const NOTE_PLACEMENT = { LEFT: 0, RIGHT: 1, OVER: 2 };

const ACTOR_HEIGHT = 56;
const ACTOR_MIN_WIDTH = 120;
const ACTOR_GAP = 72;
const ROW = 56;
const NOTE_WIDTH = 160;
const SELF_LOOP_WIDTH = 46;

const DASHED = new Set([LINE.DOTTED, LINE.DOTTED_CROSS, LINE.DOTTED_OPEN, LINE.DOTTED_POINT, LINE.BIDIRECTIONAL_DOTTED]);
const headFor = (type) => {
    if (type === LINE.SOLID_OPEN || type === LINE.DOTTED_OPEN) return "none";
    if (type === LINE.SOLID_CROSS || type === LINE.DOTTED_CROSS) return "bar";
    if (type === LINE.SOLID || type === LINE.DOTTED) return "triangle";
    return "arrow";
};

const text = (value) =>
    String(value ?? "")
        .replace(/<br\s*\/?>/gi, "\n")
        .trim();

// Elements in the board's own form, positioned around (0, 0).
export const buildSequenceElements = (db, { metrics, color, fontSize, base, newId }) => {
    const actors = [...db.getActors().values()];
    const messages = db.getMessages();
    const xOf = {};
    const elements = [];
    let x = 0;
    actors.forEach((actor) => {
        const label = text(actor.description || actor.name);
        const longestMessage = Math.max(
            0,
            ...messages
                .filter((message) => message.from === actor.name && typeof message.message === "string")
                .map((message) => metrics.textWidth(text(message.message), fontSize)),
        );
        const width = Math.max(ACTOR_MIN_WIDTH, metrics.textWidth(label, fontSize) + 32);
        xOf[actor.name] = { center: x + width / 2, width, label, isPerson: actor.type === "actor" };
        x += width + Math.max(ACTOR_GAP, longestMessage * 0.6);
    });

    const actorIds = {};
    actors.forEach((actor) => {
        const column = xOf[actor.name];
        actorIds[actor.name] = newId();
        elements.push([
            actorIds[actor.name],
            {
                type: "shape",
                shapeType: column.isPerson ? "Ellipse" : "Rectangle",
                cornerRadius: column.isPerson ? 0 : 8,
                startX: column.center - column.width / 2,
                startY: 0,
                endX: column.center + column.width / 2,
                endY: ACTOR_HEIGHT,
                text: column.label,
                fontSize,
                fontWeight: "bold",
                color,
                fillColor: null,
                size: 2,
                opacity: 100,
                ...base(),
            },
        ]);
    });

    let y = ACTOR_HEIGHT + ROW;
    const openBlocks = [];
    messages.forEach((message) => {
        if (BLOCK_STARTS[message.type]) {
            openBlocks.push({ name: `${BLOCK_STARTS[message.type]} ${text(message.message)}`.trim(), top: y - ROW / 2 });
            y += ROW / 2;
            return;
        }
        if (BLOCK_ENDS.has(message.type)) {
            const block = openBlocks.pop();
            if (block) {
                elements.push([
                    newId(),
                    {
                        type: "frame",
                        startX: -24,
                        startY: block.top,
                        endX: x - ACTOR_GAP + 24,
                        endY: y - ROW / 3,
                        name: block.name,
                        color: "#94a3b8",
                        ...base({ behind: true }),
                    },
                ]);
            }
            return;
        }
        if (message.type === LINE.NOTE) {
            const column = xOf[message.from];
            if (!column) return;
            const noteX =
                message.placement === NOTE_PLACEMENT.LEFT
                    ? column.center - NOTE_WIDTH - 12
                    : message.placement === NOTE_PLACEMENT.RIGHT
                      ? column.center + 12
                      : column.center - NOTE_WIDTH / 2;
            const lines = metrics.lineCount(text(message.message), NOTE_WIDTH - 32, fontSize);
            const height = Math.max(56, lines * fontSize * 1.3 + 32);
            elements.push([
                newId(),
                {
                    type: "sticky",
                    x: noteX,
                    y: y - 16,
                    width: NOTE_WIDTH,
                    height,
                    text: text(message.message),
                    color: "#1f2937",
                    fillColor: "#fef08a",
                    size: fontSize,
                    align: "left",
                    ...base(),
                },
            ]);
            y += height + 16;
            return;
        }
        const from = xOf[message.from];
        const to = xOf[message.to];
        if (!from || !to || typeof message.message !== "string") return;
        const self = message.from === message.to;
        elements.push([
            newId(),
            {
                type: "connector",
                startX: from.center,
                startY: y,
                endX: to.center,
                endY: self ? y + ROW / 2 : y,
                startElementId: null,
                endElementId: null,
                waypoints: self
                    ? [
                          { x: from.center + SELF_LOOP_WIDTH, y },
                          { x: from.center + SELF_LOOP_WIDTH, y: y + ROW / 2 },
                      ]
                    : null,
                text: text(message.message),
                labelOffset: self ? 0 : -14,
                fontSize: Math.max(11, fontSize - 2),
                color,
                size: 2,
                opacity: 100,
                arrowStart: false,
                arrowEnd: true,
                startHead: message.type === LINE.BIDIRECTIONAL_SOLID || message.type === LINE.BIDIRECTIONAL_DOTTED ? "arrow" : "none",
                endHead: headFor(message.type),
                strokeStyle: DASHED.has(message.type) ? "dashed" : "solid",
                ...base(),
            },
        ]);
        y += self ? ROW * 1.4 : ROW;
    });

    actors.forEach((actor) => {
        const column = xOf[actor.name];
        elements.push([
            newId(),
            {
                type: "connector",
                startX: column.center,
                startY: ACTOR_HEIGHT,
                endX: column.center,
                endY: y,
                startElementId: actorIds[actor.name],
                endElementId: null,
                startAnchor: { x: 0.5, y: 1 },
                endAnchor: null,
                color: "#94a3b8",
                size: 1.5,
                opacity: 100,
                arrowStart: false,
                arrowEnd: false,
                startHead: "none",
                endHead: "none",
                strokeStyle: "dashed",
                ...base({ behind: true }),
            },
        ]);
    });
    return elements;
};
