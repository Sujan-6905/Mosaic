import { line, INK, SOFT, icon, piece, set, shape, text } from "./builders.js";

// Wireframe parts for web and mobile screens, and simple charts drawn from
// shapes so they stay editable.

const MUTED = "#64748b";
const ACCENT = "#ffb43c";

const webUi = set("web-ui", "Web and mobile UI", "Navigation, inputs, overlays and data views for wireframes.", [
    piece("Navigation bar", [
        shape("Rectangle", 0, 0, 640, 56, { size: 1.5 }),
        text(20, 18, "Brand", 16, { fontWeight: "bold" }),
        text(360, 20, "Product", 14),
        text(440, 20, "Pricing", 14),
        shape("Rectangle", 530, 12, 92, 32, { cornerRadius: 999, text: "Sign in", fillColor: ACCENT, fontSize: 13 }),
    ]),
    piece("Tabs", [
        text(0, 0, "Overview", 14, { fontWeight: "bold" }),
        text(100, 0, "Activity", 14, { color: MUTED, colorToken: null }),
        text(190, 0, "Settings", 14, { color: MUTED, colorToken: null }),
        shape("Rectangle", 0, 24, 72, 3, { fillColor: INK, size: 0 }),
    ]),
    piece("Dropdown", [
        shape("Rectangle", 0, 0, 220, 40, { cornerRadius: 8, text: "Choose a plan", align: "left", fontSize: 14 }),
        shape("Triangle", 194, 16, 12, 8, { fillColor: INK, size: 0, rotation: 180 }),
    ]),
    piece("Search field", [
        shape("Rectangle", 0, 0, 300, 42, { cornerRadius: 999, text: "Search", align: "left", textColor: MUTED, textInsetLeft: 26 }),
        icon("search", 12, 11, 20),
    ]),
    piece("Toggle", [
        shape("Rectangle", 0, 0, 48, 26, { cornerRadius: 999, fillColor: ACCENT, size: 0 }),
        shape("Circle", 24, 3, 20, 20, { fillColor: "#ffffff", size: 0 }),
        text(60, 2, "Notifications", 14),
    ]),
    piece("Radio group", [
        shape("Circle", 0, 0, 18, 18, { size: 1.5 }),
        shape("Circle", 5, 5, 8, 8, { fillColor: INK, size: 0 }),
        text(28, -2, "Monthly", 14),
        shape("Circle", 0, 32, 18, 18, { size: 1.5 }),
        text(28, 30, "Yearly", 14),
    ]),
    piece("Slider", [
        shape("Rectangle", 0, 8, 260, 4, { cornerRadius: 999, fillColor: "#cbd5e1", size: 0 }),
        shape("Rectangle", 0, 8, 150, 4, { cornerRadius: 999, fillColor: ACCENT, size: 0 }),
        shape("Circle", 140, 0, 20, 20, { fillColor: "#ffffff", size: 2 }),
    ]),
    piece("Modal", [
        shape("Rectangle", 0, 0, 360, 220, {
            cornerRadius: 16,
            size: 1.5,
            shadow: "soft",
            text: "Delete this board?",
            subtext: "This can't be undone.",
            verticalAlign: "top",
            align: "left",
            fontWeight: "bold",
        }),
        shape("Rectangle", 160, 160, 84, 36, { cornerRadius: 8, text: "Cancel", fontSize: 13 }),
        shape("Rectangle", 256, 160, 84, 36, { cornerRadius: 8, text: "Delete", fontSize: 13, fillColor: "#fecaca" }),
    ]),
    piece("Toast", [
        shape("Rectangle", 0, 0, 300, 52, {
            cornerRadius: 12,
            fillColor: "#1f2937",
            size: 0,
            text: "Saved to your boards",
            textColor: "#ffffff",
            align: "left",
            textInsetLeft: 30,
        }),
        icon("check", 14, 16, 20, { color: "#4ade80", colorToken: null }),
    ]),
    piece("Table", [
        shape("Rectangle", 0, 0, 420, 40, {
            fillColor: SOFT.slate,
            size: 1,
            text: "Name                Status          Owner",
            align: "left",
            fontSize: 13,
            fontWeight: "bold",
        }),
        shape("Rectangle", 0, 40, 420, 40, { size: 1, text: "Checkout redesign   In review     Ana", align: "left", fontSize: 13 }),
        shape("Rectangle", 0, 80, 420, 40, { size: 1, text: "Search speed-up     Shipped        Raj", align: "left", fontSize: 13 }),
    ]),
    piece("Sidebar", [
        shape("Rectangle", 0, 0, 200, 420, { size: 1.5, fillColor: SOFT.slate }),
        ...["Home", "Boards", "Shared", "Settings"].flatMap((label, row) => [
            icon(["house", "layout-dashboard", "users", "settings"][row], 16, 24 + row * 44, 20),
            text(46, 24 + row * 44, label, 14),
        ]),
    ]),
    piece("Breadcrumb", [text(0, 0, "Boards  /  Team  /  Roadmap", 14, { color: MUTED, colorToken: null })]),
    piece("Empty state", [
        shape("Rectangle", 0, 0, 320, 200, {
            cornerRadius: 14,
            strokeStyle: "dashed",
            size: 1.5,
            text: "No boards yet",
            subtext: "Start one from a template or a blank canvas.",
            verticalAlign: "bottom",
        }),
        icon("inbox", 140, 40, 40),
    ]),
    piece("Mobile screen", [
        shape("Phone", 0, 0, 220, 440, { size: 2.5 }),
        shape("Rectangle", 20, 48, 180, 44, { cornerRadius: 10, text: "Good morning", fontWeight: "bold", align: "left" }),
        shape("Rectangle", 20, 104, 180, 120, { cornerRadius: 12, fillColor: SOFT.blue, text: "Today", verticalAlign: "top" }),
        shape("Rectangle", 20, 380, 180, 40, { cornerRadius: 999, fillColor: ACCENT, text: "Start" }),
    ]),
]);

const BAR_COLOURS = ["#93c5fd", "#86efac", "#fcd34d", "#f9a8d4", "#c4b5fd"];

const charts = set("charts", "Charts", "Bar, line and share charts and number tiles, drawn from shapes you can edit.", [
    piece("Bar chart", [
        line(0, 200, 300, 200, { size: 1.5 }),
        line(0, 0, 0, 200, { size: 1.5 }),
        ...[120, 170, 90, 150, 60].map((height, i) =>
            shape("Rectangle", 20 + i * 56, 200 - height, 40, height, { fillColor: BAR_COLOURS[i], size: 0, cornerRadius: 4 }),
        ),
    ]),
    piece("Line chart", [
        line(0, 200, 320, 200, { size: 1.5 }),
        line(0, 0, 0, 200, { size: 1.5 }),
        {
            type: "path",
            points: [
                { x: 10, y: 170 },
                { x: 70, y: 130 },
                { x: 130, y: 145 },
                { x: 190, y: 80 },
                { x: 250, y: 95 },
                { x: 310, y: 30 },
            ],
            color: "#2563eb",
            colorToken: null,
            size: 3,
            opacity: 100,
            zIndex: 1,
            rotation: 0,
            groupId: null,
            frameId: null,
            locked: false,
        },
    ]),
    piece("Share bar", [
        shape("Rectangle", 0, 0, 180, 28, { fillColor: BAR_COLOURS[0], size: 0, text: "Web 45%", fontSize: 12 }),
        shape("Rectangle", 180, 0, 120, 28, { fillColor: BAR_COLOURS[1], size: 0, text: "iOS 30%", fontSize: 12 }),
        shape("Rectangle", 300, 0, 100, 28, { fillColor: BAR_COLOURS[2], size: 0, text: "Android", fontSize: 12 }),
    ]),
    piece("Number tile", [
        shape("Rectangle", 0, 0, 200, 110, { cornerRadius: 14, size: 1.5, text: "12,480", subtext: "Weekly active users", fontSize: 28, fontWeight: "bold" }),
    ]),
    piece("Progress", [
        shape("Rectangle", 0, 0, 280, 14, { cornerRadius: 999, fillColor: "#e2e8f0", size: 0 }),
        shape("Rectangle", 0, 0, 190, 14, { cornerRadius: 999, fillColor: "#22c55e", size: 0 }),
        text(0, 22, "68% complete", 13),
    ]),
    piece("Scale", [
        ...BAR_COLOURS.map((colour, i) => shape("Rectangle", i * 36, 0, 36, 18, { fillColor: colour, size: 0 })),
        text(0, 24, "Low", 12),
        text(150, 24, "High", 12),
    ]),
]);

export const INTERFACE_KITS = [webUi, charts];
