// Hand-labelled freehand boards: elements, the partition a person would draw, and where needed
// an op log of who drew what and when.
const path = (id, points, overrides = {}) => [
    id,
    {
        type: "path",
        points,
        color: "#000000",
        size: 2,
        opacity: 100,
        zIndex: 1,
        rotation: 0,
        ...overrides,
    },
];

// A box drawn as four touching strokes: one object made of several strokes.
const handDrawnBoxBoard = {
    name: "hand-drawn-box",
    elements: Object.fromEntries([
        path(
            "top",
            [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
            ],
            { zIndex: 1 },
        ),
        path(
            "right",
            [
                { x: 100, y: 0 },
                { x: 100, y: 60 },
            ],
            { zIndex: 2 },
        ),
        path(
            "bottom",
            [
                { x: 100, y: 60 },
                { x: 0, y: 60 },
            ],
            { zIndex: 3 },
        ),
        path(
            "left",
            [
                { x: 0, y: 60 },
                { x: 0, y: 0 },
            ],
            { zIndex: 4 },
        ),
    ]),
    groundTruth: [["top", "right", "bottom", "left"]],
    opLog: [
        { elementId: "top", authorId: "u1", ts: 1000 },
        { elementId: "right", authorId: "u1", ts: 1400 },
        { elementId: "bottom", authorId: "u1", ts: 1800 },
        { elementId: "left", authorId: "u1", ts: 2200 },
    ],
};

// A box and a separate arrow by one author, back to back: two objects despite shared author and order.
const boxAndArrowBoard = {
    name: "box-and-arrow",
    elements: Object.fromEntries([
        path(
            "box-top",
            [
                { x: 0, y: 0 },
                { x: 80, y: 0 },
            ],
            { zIndex: 1 },
        ),
        path(
            "box-right",
            [
                { x: 80, y: 0 },
                { x: 80, y: 50 },
            ],
            { zIndex: 2 },
        ),
        path(
            "box-bottom-left",
            [
                { x: 80, y: 50 },
                { x: 0, y: 50 },
                { x: 0, y: 0 },
            ],
            { zIndex: 3 },
        ),
        path(
            "arrow-shaft",
            [
                { x: 600, y: 600 },
                { x: 680, y: 600 },
            ],
            { zIndex: 4 },
        ),
        path(
            "arrow-head",
            [
                { x: 660, y: 588 },
                { x: 680, y: 600 },
                { x: 660, y: 612 },
            ],
            { zIndex: 5 },
        ),
    ]),
    groundTruth: [
        ["box-top", "box-right", "box-bottom-left"],
        ["arrow-shaft", "arrow-head"],
    ],
    opLog: [
        { elementId: "box-top", authorId: "u1", ts: 1000 },
        { elementId: "box-right", authorId: "u1", ts: 1300 },
        { elementId: "box-bottom-left", authorId: "u1", ts: 1600 },
        { elementId: "arrow-shaft", authorId: "u1", ts: 2000 },
        { elementId: "arrow-head", authorId: "u1", ts: 2300 },
    ],
};

// Two people drawing in one spot at once: author separation holds however close the strokes are.
const simultaneousAuthorsBoard = {
    name: "simultaneous-authors",
    elements: Object.fromEntries([
        path(
            "mark-a",
            [
                { x: 0, y: 0 },
                { x: 20, y: 20 },
            ],
            { zIndex: 1 },
        ),
        path(
            "mark-b",
            [
                { x: 5, y: 5 },
                { x: 25, y: 25 },
            ],
            { zIndex: 2 },
        ),
    ]),
    groundTruth: [["mark-a"], ["mark-b"]],
    opLog: [
        { elementId: "mark-a", authorId: "u1", ts: 1000 },
        { elementId: "mark-b", authorId: "u2", ts: 1010 },
    ],
};

export const GROUPING_FIXTURE_BOARDS = [handDrawnBoxBoard, boxAndArrowBoard, simultaneousAuthorsBoard];
