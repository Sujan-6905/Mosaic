import { describe, it, expect } from "vitest";
import validateDiagram from "../validateDiagram.js";

// Wide fan-outs, long chains and cycles must still validate as graphs; layout is the client's job.
const REGRESSION_GRAPHS = [
    {
        name: "wide fan-out (one node with many children)",
        prompt: "a user login flow with OAuth, email, and SSO options all branching from one entry point",
        graph: {
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
    },
    {
        name: "long linear chain (a multi-step pipeline)",
        prompt: "3-tier web architecture with a CDN, load balancer, app servers, cache, and database",
        graph: {
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
    },
    {
        name: "cycle (a feedback loop)",
        prompt: "a build-test-deploy loop that feeds back into build on failure",
        graph: {
            nodes: [
                { id: "build", label: "Build" },
                { id: "test", label: "Test" },
                { id: "deploy", label: "Deploy" },
            ],
            edges: [
                { from: "build", to: "test" },
                { from: "test", to: "deploy" },
                { from: "test", to: "build", label: "on failure" },
            ],
        },
    },
    {
        name: "disconnected components (two unrelated subsystems)",
        prompt: "a diagram of both the auth service and, separately, the billing service",
        graph: {
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
    },
];

describe("AI generation regression graphs", () => {
    REGRESSION_GRAPHS.forEach(({ name, graph }) => {
        it(`validates the graph shape for: ${name}`, () => {
            const result = validateDiagram(JSON.stringify(graph));
            expect(result.valid).toBe(true);
            expect(result.nodes.length).toBe(graph.nodes.length);
            expect(result.edges.length).toBe(graph.edges.length);
        });
    });
});

export { REGRESSION_GRAPHS };
