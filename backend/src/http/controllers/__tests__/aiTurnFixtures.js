// What the assistant turn tests share: a board, a drawing that owns it, and
// model replies and edit plans shaped like the real ones.
export const boardElements = {
    a: {
        type: "shape",
        shapeType: "rectangle",
        startX: 0,
        startY: 0,
        endX: 50,
        endY: 50,
        color: "#000",
        size: 2,
        opacity: 100,
        zIndex: 1,
        rotation: 0,
    },
};

export const fakeDrawing = {
    shareId: "board-1",
    owner: "user-1",
    elements: boardElements,
    hasEditAccess: () => true,
    hasViewAccess: () => true,
};

export const stickyElements = (text) => ({
    ...boardElements,
    note: { type: "sticky", x: 200, y: 200, width: 100, height: 100, text, color: "#000", fillColor: "#fff", size: 14, zIndex: 2, rotation: 0 },
});

export const modelReply = (fields, usage = { inputTokens: 100, outputTokens: 20 }) => ({
    content: JSON.stringify({ intent: "reply", message: "", diagram: null, sketch: null, ops: null, candidates: null, ...fields }),
    finishReason: "stop",
    model: "test-model",
    responseId: "resp-1",
    usage,
});

export const graph = {
    nodes: [
        { id: "a", label: "Start", shape: "ellipse", fillColor: null },
        { id: "b", label: "End", shape: "ellipse", fillColor: null },
    ],
    edges: [{ from: "a", to: "b", label: null }],
    replaceRefs: [],
};

export const plannedResult = (overrides = {}) => ({
    status: "planned",
    token: "plan-token",
    diff: { added: [], removed: [], moved: [], modified: [{ elementId: "a" }] },
    opsPreview: [{ index: 0, op: "restyle", summary: "Restyle" }],
    autoRepairs: [],
    failedOps: [],
    remainingLints: [],
    ...overrides,
});

export const emptyDiff = { added: [], removed: [], moved: [], modified: [] };
