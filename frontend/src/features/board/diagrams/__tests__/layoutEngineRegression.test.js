import { describe, it, expect } from "vitest";
import { computeLayout, LAYOUT_DIRECTIONS } from "../layoutEngine.js";

// Graph shapes that once overlapped, which must now lay out cleanly in every direction.
const REGRESSION_GRAPHS = [
    {
        name: "wide fan-out",
        nodes: [
            { id: "entry", label: "Login" },
            { id: "oauth", label: "OAuth" },
            { id: "email", label: "Email/Password" },
            { id: "sso", label: "SSO" },
            { id: "session", label: "Session created" },
        ],
        edges: [
            { from: "entry", to: "oauth" },
            { from: "entry", to: "email" },
            { from: "entry", to: "sso" },
            { from: "oauth", to: "session" },
            { from: "email", to: "session" },
            { from: "sso", to: "session" },
        ],
    },
    {
        name: "long linear chain",
        nodes: [
            { id: "cdn", label: "CDN" },
            { id: "lb", label: "Load Balancer" },
            { id: "app", label: "App Servers" },
            { id: "cache", label: "Cache" },
            { id: "db", label: "Database" },
        ],
        edges: [
            { from: "cdn", to: "lb" },
            { from: "lb", to: "app" },
            { from: "app", to: "cache" },
            { from: "app", to: "db" },
        ],
    },
    {
        name: "cycle",
        nodes: [
            { id: "build", label: "Build" },
            { id: "test", label: "Test" },
            { id: "deploy", label: "Deploy" },
        ],
        edges: [
            { from: "build", to: "test" },
            { from: "test", to: "deploy" },
            { from: "test", to: "build" },
        ],
    },
    {
        name: "disconnected components",
        nodes: [
            { id: "authApi", label: "Auth API" },
            { id: "authDb", label: "Auth DB" },
            { id: "billingApi", label: "Billing API" },
            { id: "billingDb", label: "Billing DB" },
        ],
        edges: [
            { from: "authApi", to: "authDb" },
            { from: "billingApi", to: "billingDb" },
        ],
    },
];

// Two node boxes count as overlapping only if both their x-range and
// y-range intersect: matching AABB overlap, not just center distance.
const boxesOverlap = (a, b) => {
    const halfAW = a.w / 2,
        halfAH = a.h / 2,
        halfBW = b.w / 2,
        halfBH = b.h / 2;
    return Math.abs(a.cx - b.cx) < halfAW + halfBW && Math.abs(a.cy - b.cy) < halfAH + halfBH;
};

describe.each(REGRESSION_GRAPHS)("layout regression: $name", ({ nodes, edges }) => {
    [LAYOUT_DIRECTIONS.TOP_DOWN, LAYOUT_DIRECTIONS.LEFT_RIGHT, LAYOUT_DIRECTIONS.RADIAL].forEach((direction) => {
        it(`produces a non-overlapping ${direction} layout`, () => {
            const positions = computeLayout(nodes, edges, direction);
            const placed = Object.values(positions);
            expect(placed).toHaveLength(nodes.length);

            for (let i = 0; i < placed.length; i++) {
                for (let j = i + 1; j < placed.length; j++) {
                    expect(boxesOverlap(placed[i], placed[j])).toBe(false);
                }
            }
        });
    });
});
