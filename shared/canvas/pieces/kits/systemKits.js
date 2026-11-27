import { SOFT, frame, icon, iconTile, linked, piece, set, shape, text } from "./builders.js";

// Infrastructure drawn with generic line icons, so a diagram reads as a
// network or a cloud without leaning on any vendor's own artwork.

const network = set("network", "Network", "Routers, switches, firewalls and the devices on them.", [
    piece("Internet", iconTile("globe", "Internet")),
    piece("Router", iconTile("router", "Router")),
    piece("Switch", iconTile("network", "Switch")),
    piece("Firewall", iconTile("shield", "Firewall", { fill: SOFT.rose })),
    piece("Server", iconTile("server", "Server")),
    piece("Storage", iconTile("hard-drive", "Storage")),
    piece("Wi-Fi access point", iconTile("wifi", "Access point")),
    piece("Laptop", iconTile("monitor", "Workstation")),
    piece("Phone", iconTile("smartphone", "Phone")),
    piece("Rack", [
        shape("Rectangle", 0, 0, 120, 200, { cornerRadius: 6, size: 2 }),
        ...[0, 1, 2, 3, 4].map((row) => shape("Rectangle", 10, 12 + row * 36, 100, 26, { cornerRadius: 3, size: 1.2 })),
        text(30, 205, "Rack 1", 13),
    ]),
    piece("DMZ", [
        shape("Rectangle", 0, 0, 420, 240, {
            cornerRadius: 10,
            strokeStyle: "dashed",
            size: 1.5,
            text: "DMZ",
            verticalAlign: "top",
            fontWeight: "bold",
            fillColor: SOFT.amber,
        }),
    ]),
    piece(
        "Edge path",
        linked(
            [
                ...iconTile("globe", "Internet"),
                ...iconTile("shield", "Firewall").map((element) => ({ ...shiftX(element, 200) })),
                ...iconTile("server", "Web server").map((element) => shiftX(element, 400)),
            ],
            [
                [0, 3],
                [3, 6],
            ],
        ),
    ),
]);

function shiftX(element, dx) {
    if (element.type === "text") return { ...element, x: element.x + dx };
    return { ...element, startX: element.startX + dx, endX: element.endX + dx };
}

const cloud = set("cloud", "Cloud", "Generic cloud building blocks: compute, storage, data, messaging and networking.", [
    piece("Compute", iconTile("cpu", "Compute", { fill: SOFT.blue })),
    piece("Function", iconTile("zap", "Function", { fill: SOFT.amber })),
    piece("Container", iconTile("container", "Container", { fill: SOFT.blue })),
    piece("Object storage", iconTile("package", "Object storage", { fill: SOFT.green })),
    piece("Database", iconTile("database", "Database", { fill: SOFT.violet })),
    piece("Cache", iconTile("gauge", "Cache", { fill: SOFT.rose })),
    piece("Queue", iconTile("list-ordered", "Queue", { fill: SOFT.amber })),
    piece("Event bus", iconTile("webhook", "Event bus", { fill: SOFT.amber })),
    piece("API gateway", iconTile("plug", "API gateway", { fill: SOFT.slate })),
    piece("Load balancer", iconTile("workflow", "Load balancer", { fill: SOFT.slate })),
    piece("CDN", iconTile("globe", "CDN", { fill: SOFT.slate })),
    piece("Identity", iconTile("key-round", "Identity", { fill: SOFT.rose })),
    piece("Monitoring", iconTile("activity", "Monitoring", { fill: SOFT.green })),
    piece("Region", [
        shape("Rectangle", 0, 0, 520, 320, {
            cornerRadius: 12,
            strokeStyle: "dashed",
            size: 1.5,
            text: "Region",
            verticalAlign: "top",
            align: "left",
            fontWeight: "bold",
        }),
    ]),
    piece("Private network", [frame(0, 0, 440, 260, "Private network"), icon("lock", 404, 8, 24)]),
    piece("Availability zone", [
        shape("Rectangle", 0, 0, 220, 300, { cornerRadius: 8, strokeStyle: "dotted", size: 1.5, text: "Zone A", verticalAlign: "top", fillColor: SOFT.slate }),
    ]),
]);

export const SYSTEM_KITS = [network, cloud];
