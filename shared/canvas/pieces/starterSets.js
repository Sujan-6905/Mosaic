import { line, INK, SOFT, frame, linked, piece, shape, sticky, text } from "./kits/builders.js";
import { PIECE_KITS } from "./kits/index.js";

// The sets every board starts with.
export const STARTER_SETS = [
    {
        _id: "starter-flowchart",
        title: "Flowchart",
        description: "The shapes a process diagram is made of.",
        starter: true,
        pieces: [
            piece("Start or end", [shape("Rectangle", 0, 0, 160, 56, { cornerRadius: 999, text: "Start", fillColor: SOFT.green })]),
            piece("Step", [shape("Rectangle", 0, 0, 170, 70, { cornerRadius: 8, text: "Do the thing" })]),
            piece("Decision", [shape("Diamond", 0, 0, 170, 110, { text: "Ready?", fillColor: SOFT.amber })]),
            piece("Input or output", [shape("Parallelogram", 0, 0, 180, 70, { text: "Read input" })]),
            piece("Stored data", [shape("Cylinder", 0, 0, 130, 100, { text: "Data" })]),
            piece("Report", [shape("Document", 0, 0, 160, 100, { text: "Report" })]),
            piece(
                "Yes or no",
                linked(
                    [
                        shape("Diamond", 120, 0, 160, 100, { text: "Approved?", fillColor: SOFT.amber }),
                        shape("Rectangle", 0, 190, 150, 64, { cornerRadius: 8, text: "Ship it" }),
                        shape("Rectangle", 250, 190, 150, 64, { cornerRadius: 8, text: "Revise" }),
                    ],
                    [
                        [0, 1, "Yes"],
                        [0, 2, "No"],
                    ],
                ),
            ),
            piece(
                "Three steps",
                linked(
                    [
                        shape("Rectangle", 0, 0, 150, 64, { cornerRadius: 8, text: "Plan" }),
                        shape("Rectangle", 230, 0, 150, 64, { cornerRadius: 8, text: "Build" }),
                        shape("Rectangle", 460, 0, 150, 64, { cornerRadius: 8, text: "Ship" }),
                    ],
                    [
                        [0, 1],
                        [1, 2],
                    ],
                ),
            ),
        ],
    },
    {
        _id: "starter-systems",
        title: "System parts",
        description: "Services, stores and the lines between them.",
        starter: true,
        pieces: [
            piece("Service", [
                shape("Rectangle", 0, 0, 170, 76, { cornerRadius: 12, text: "API service", subtext: "Node", fontWeight: "bold", fillColor: SOFT.blue }),
            ]),
            piece("Database", [shape("Cylinder", 0, 0, 140, 110, { text: "Postgres", fillColor: SOFT.slate })]),
            piece("Cache", [shape("Hexagon", 0, 0, 150, 84, { text: "Cache", fillColor: SOFT.rose })]),
            piece("Queue", [shape("Rectangle", 0, 0, 190, 56, { text: "Jobs queue", strokeStyle: "dashed", fillColor: SOFT.violet })]),
            piece("Cloud provider", [shape("Cloud", 0, 0, 190, 120, { text: "Cloud" })]),
            piece("Person", [shape("Circle", 0, 0, 90, 90, { text: "User", fillColor: SOFT.amber })]),
            piece(
                "Request path",
                linked(
                    [
                        shape("Rectangle", 0, 20, 140, 64, { cornerRadius: 12, text: "Web app" }),
                        shape("Rectangle", 230, 20, 140, 64, { cornerRadius: 12, text: "API", fillColor: SOFT.blue }),
                        shape("Cylinder", 460, 0, 120, 104, { text: "Database" }),
                    ],
                    [
                        [0, 1, "HTTPS"],
                        [1, 2, "SQL"],
                    ],
                ),
            ),
            piece("Boundary", [frame(0, 0, 420, 260, "Private network")]),
        ],
    },
    {
        _id: "starter-planning",
        title: "Planning",
        description: "Notes, columns and a timeline for working sessions.",
        starter: true,
        pieces: [
            piece("Three notes", [sticky(0, 0, "Idea", "#fef08a"), sticky(160, 0, "Question", "#bfdbfe"), sticky(320, 0, "Risk", "#fbcfe8")]),
            piece("Board columns", [
                frame(0, 0, 220, 360, "To do"),
                frame(250, 0, 220, 360, "Doing"),
                frame(500, 0, 220, 360, "Done"),
                sticky(30, 30, "First task", "#fef08a", 160),
            ]),
            piece("Pros and cons", [
                frame(0, 0, 280, 300, "For"),
                frame(310, 0, 280, 300, "Against"),
                sticky(30, 30, "Faster", "#bbf7d0", 120),
                sticky(340, 30, "Costs more", "#fecaca", 120),
            ]),
            piece("Timeline", [
                line(0, 40, 600, 40, { size: 3 }),
                shape("Circle", 40, 30, 20, 20, { fillColor: INK }),
                text(20, 60, "Kickoff", 14),
                shape("Circle", 290, 30, 20, 20, { fillColor: INK }),
                text(272, 60, "Beta", 14),
                shape("Circle", 540, 30, 20, 20, { fillColor: INK }),
                text(518, 60, "Launch", 14),
            ]),
            piece("Decision record", [
                shape("Rectangle", 0, 0, 300, 170, {
                    cornerRadius: 10,
                    text: "Decision",
                    subtext: "Context\nWhat we chose\nWhat it costs",
                    align: "left",
                    verticalAlign: "top",
                    fontWeight: "bold",
                    fillColor: SOFT.slate,
                }),
            ]),
        ],
    },
    {
        _id: "starter-wireframes",
        title: "Wireframes",
        description: "Rough screens to sketch an interface with.",
        starter: true,
        pieces: [
            piece("Button", [shape("Rectangle", 0, 0, 140, 44, { cornerRadius: 999, text: "Continue", fillColor: "#ffb43c", fontWeight: "bold" })]),
            piece("Text field", [shape("Rectangle", 0, 0, 260, 44, { cornerRadius: 8, text: "Email address", align: "left", textColor: "#64748b" })]),
            piece("Card", [
                shape("Rectangle", 0, 0, 240, 150, {
                    cornerRadius: 14,
                    text: "Card title",
                    subtext: "A line or two of supporting text.",
                    align: "left",
                    verticalAlign: "top",
                    fontWeight: "bold",
                }),
            ]),
            piece("Avatar", [shape("Circle", 0, 0, 56, 56, { text: "AB", fillColor: SOFT.blue, fontWeight: "bold" })]),
            piece("Checklist", [
                shape("Rectangle", 0, 0, 18, 18, { cornerRadius: 4 }),
                text(30, -2, "First item", 15),
                shape("Rectangle", 0, 32, 18, 18, { cornerRadius: 4, fillColor: INK }),
                text(30, 30, "Done item", 15),
            ]),
            piece("Browser window", [
                shape("Rectangle", 0, 0, 480, 320, { cornerRadius: 12 }),
                line(0, 36, 480, 36),
                shape("Circle", 14, 12, 12, 12, { fillColor: "#f87171", size: 0 }),
                shape("Circle", 32, 12, 12, 12, { fillColor: "#fbbf24", size: 0 }),
                shape("Circle", 50, 12, 12, 12, { fillColor: "#34d399", size: 0 }),
            ]),
            piece("Phone", [
                shape("Rectangle", 0, 0, 200, 400, { cornerRadius: 32, size: 3 }),
                shape("Rectangle", 70, 14, 60, 12, { cornerRadius: 999, fillColor: INK, size: 0 }),
            ]),
        ],
    },
    ...PIECE_KITS,
];
