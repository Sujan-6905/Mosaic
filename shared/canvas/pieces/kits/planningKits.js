import { line, INK, SOFT, frame, icon, linked, piece, set, shape, sticky, text } from "./builders.js";

// Working-session and explanation parts: agile planning, mind maps, and the
// marks that explain a diagram (legends, callouts, title blocks).

const agile = set("agile", "Agile planning", "Story cards, sprints, retros and milestones.", [
    piece("User story", [
        shape("Rectangle", 0, 0, 240, 130, {
            cornerRadius: 10,
            fillColor: SOFT.amber,
            text: "As a shopper, I want to save my cart so I can buy later",
            align: "left",
            verticalAlign: "top",
            fontSize: 14,
        }),
        shape("Rectangle", 190, 98, 40, 22, { cornerRadius: 999, text: "3", fontSize: 12, fontWeight: "bold" }),
    ]),
    piece("Task card", [
        shape("Rectangle", 0, 0, 220, 90, { cornerRadius: 10, size: 1.5, text: "Write payment tests", align: "left", verticalAlign: "top" }),
        shape("Circle", 186, 56, 24, 24, { fillColor: SOFT.blue, text: "AL", fontSize: 10, fontWeight: "bold" }),
    ]),
    piece("Bug card", [
        shape("Rectangle", 0, 0, 220, 90, { cornerRadius: 10, fillColor: "#fee2e2", text: "Coupon applies twice", align: "left", verticalAlign: "top" }),
        icon("triangle-alert", 188, 58, 22, { color: "#dc2626", colorToken: null }),
    ]),
    piece("Sprint", [
        frame(0, 0, 720, 360, "Sprint 14"),
        frame(20, 40, 220, 300, "To do"),
        frame(250, 40, 220, 300, "In progress"),
        frame(480, 40, 220, 300, "Done"),
    ]),
    piece("Retro", [
        frame(0, 0, 220, 300, "Start"),
        frame(240, 0, 220, 300, "Stop"),
        frame(480, 0, 220, 300, "Continue"),
        sticky(30, 40, "Pair on reviews", "#bbf7d0", 150),
        sticky(270, 40, "Late standups", "#fecaca", 150),
        sticky(510, 40, "Demo day", "#bfdbfe", 150),
    ]),
    piece("Milestone", [shape("Diamond", 0, 0, 36, 36, { fillColor: "#ffb43c", size: 0 }), text(46, 6, "Beta launch", 15, { fontWeight: "bold" })]),
    piece("Gantt row", [
        text(0, 6, "Design", 14),
        shape("Rectangle", 120, 0, 200, 30, { cornerRadius: 6, fillColor: SOFT.blue, size: 1 }),
        shape("Rectangle", 120, 0, 120, 30, { cornerRadius: 6, fillColor: "#93c5fd", size: 0 }),
    ]),
    piece("Now next later", [frame(0, 0, 220, 320, "Now"), frame(240, 0, 220, 320, "Next"), frame(480, 0, 220, 320, "Later")]),
]);

const mindMap = set("mind-map", "Mind map", "A central idea, branches and notes to grow a map by hand.", [
    piece("Central idea", [shape("Ellipse", 0, 0, 200, 90, { text: "Big idea", fontWeight: "bold", fontSize: 18, fillColor: SOFT.amber })]),
    piece("Branch", [shape("Rectangle", 0, 0, 150, 48, { cornerRadius: 999, text: "Branch", fillColor: SOFT.blue })]),
    piece("Sub-branch", [text(0, 0, "Sub-topic", 15), line(0, 22, 110, 22, { size: 2 })]),
    piece(
        "Starter map",
        linked(
            [
                shape("Ellipse", 180, 120, 180, 80, { text: "Launch", fontWeight: "bold", fillColor: SOFT.amber }),
                shape("Rectangle", 0, 0, 140, 46, { cornerRadius: 999, text: "Marketing", fillColor: SOFT.blue }),
                shape("Rectangle", 400, 0, 140, 46, { cornerRadius: 999, text: "Product", fillColor: SOFT.green }),
                shape("Rectangle", 0, 270, 140, 46, { cornerRadius: 999, text: "Sales", fillColor: SOFT.rose }),
                shape("Rectangle", 400, 270, 140, 46, { cornerRadius: 999, text: "Support", fillColor: SOFT.violet }),
            ],
            [
                [0, 1],
                [0, 2],
                [0, 3],
                [0, 4],
            ],
        ).map((element) => (element.type === "connector" ? { ...element, routing: "curved", endHead: "none", arrowEnd: false } : element)),
    ),
    piece("Cloud note", [shape("Cloud", 0, 0, 200, 120, { text: "What if…?" })]),
]);

const annotations = set("annotations", "Annotations", "Legends, callouts, numbered markers and title blocks that explain a diagram.", [
    piece("Legend", [
        shape("Rectangle", 0, 0, 200, 130, { cornerRadius: 8, size: 1, text: "Key", verticalAlign: "top", align: "left", fontWeight: "bold", fontSize: 13 }),
        ...[
            ["#93c5fd", "Service"],
            ["#86efac", "Data store"],
            ["#fcd34d", "External"],
        ].flatMap(([colour, label], row) => [
            shape("Rectangle", 14, 40 + row * 28, 16, 16, { fillColor: colour, size: 0, cornerRadius: 3 }),
            text(40, 38 + row * 28, label, 13),
        ]),
    ]),
    piece("Callout", [shape("Callout", 0, 0, 220, 110, { text: "This step retries three times", fillColor: SOFT.amber })]),
    piece("Numbered marker", [shape("Circle", 0, 0, 30, 30, { fillColor: "#ffb43c", size: 0, text: "1", fontWeight: "bold" })]),
    piece("Title block", [
        shape("Rectangle", 0, 0, 360, 96, {
            size: 1.5,
            text: "Checkout architecture",
            subtext: "v2 · owned by Payments · reviewed 3 Nov",
            align: "left",
            fontWeight: "bold",
            fontSize: 18,
        }),
    ]),
    piece("Warning", [
        shape("Rectangle", 0, 0, 260, 60, {
            cornerRadius: 10,
            fillColor: "#fee2e2",
            size: 0,
            text: "Single point of failure",
            textInsetLeft: 34,
            align: "left",
        }),
        icon("triangle-alert", 14, 18, 24, { color: "#dc2626", colorToken: null }),
    ]),
    piece("Highlight ring", [shape("Ellipse", 0, 0, 220, 120, { size: 3, strokeStyle: "dashed", color: "#f97316", colorToken: null })]),
    piece("Divider", [line(0, 0, 480, 0, { size: 1.5, strokeStyle: "dashed", color: INK })]),
]);

export const PLANNING_KITS = [agile, mindMap, annotations];
