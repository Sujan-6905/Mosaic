import { describe, it, expect } from "vitest";
import { buildModuleGraph, chooseModuleFolders, diffModuleGraphs, isModuleSource } from "../moduleGraph.js";

const repo = {
    "frontend/src/app/page.tsx": `import { api } from "@/lib/api"; import Button from "../ui/Button";`,
    "frontend/src/lib/api.ts": `import axios from "axios"; export const api = axios;`,
    "frontend/src/ui/Button.tsx": `export default function Button() {}`,
    "frontend/tsconfig.json": `{ // comment\n "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }`,
    "backend/routes/users.js": `const db = require("../db/index"); import("../services/mail.js");`,
    "backend/db/index.js": `import { Pool } from "pg"; import { createClient } from "redis";`,
    "backend/services/mail.js": `import nodemailer from "nodemailer";`,
    "backend/__tests__/users.test.js": `import "../routes/users.js";`,
    "docker-compose.yml": `services:\n  cache:\n    image: redis:7\n  search:\n    image: "elasticsearch:8"\n`,
};

describe("isModuleSource", () => {
    it("takes source files and leaves tests, builds and dependencies out", () => {
        expect(isModuleSource("src/a.ts")).toBe(true);
        expect(isModuleSource("src/a.test.ts")).toBe(false);
        expect(isModuleSource("src/__tests__/a.ts")).toBe(false);
        expect(isModuleSource("node_modules/x/a.js")).toBe(false);
        expect(isModuleSource("src/types.d.ts")).toBe(false);
        expect(isModuleSource("README.md")).toBe(false);
    });
});

describe("chooseModuleFolders", () => {
    it("opens folders until there's something to say about the structure", () => {
        const folders = chooseModuleFolders(["src/a/x.js", "src/b/y.js", "src/c/z.js"]);
        expect(folders.sort()).toEqual(["src/a", "src/b", "src/c"]);
    });

    it("keeps a folder that has files of its own alongside its subfolders", () => {
        expect(chooseModuleFolders(["src/main.js", "src/a/x.js"]).sort()).toEqual(["src", "src/a"]);
    });

    it("stops at a readable number of boxes on a big repository", () => {
        const paths = Array.from({ length: 200 }, (_, i) => `pkg${i % 40}/sub${i % 7}/file${i}.js`);
        expect(chooseModuleFolders(paths).length).toBeLessThanOrEqual(24);
    });
});

describe("buildModuleGraph", () => {
    const graph = buildModuleGraph(repo);
    const hasEdge = (from, to) => graph.edges.some((edge) => edge.from === from && edge.to === to);

    it("makes a box per folder with source in it, and no box for tests", () => {
        const ids = graph.nodes.filter((node) => node.kind === "module").map((node) => node.id);
        expect(ids).toContain("backend/routes");
        expect(ids).not.toContain("backend/__tests__");
    });

    it("links modules by relative imports, require and dynamic import", () => {
        expect(hasEdge("backend/routes", "backend/db")).toBe(true);
        expect(hasEdge("backend/routes", "backend/services")).toBe(true);
    });

    it("follows a tsconfig path alias, despite comments in the config", () => {
        expect(hasEdge("frontend/src/app", "frontend/src/lib")).toBe(true);
    });

    it("finds services from imports and from docker-compose", () => {
        const services = graph.nodes.filter((node) => node.kind === "service").map((node) => node.label);
        expect(services).toEqual(expect.arrayContaining(["PostgreSQL", "Redis", "Elasticsearch", "Email"]));
        expect(hasEdge("backend/db", "service:PostgreSQL")).toBe(true);
    });

    it("leaves ordinary libraries out", () => {
        expect(graph.nodes.some((node) => /axios/i.test(node.label))).toBe(false);
    });

    it("gives the same result for the same files", () => {
        expect(buildModuleGraph(repo)).toEqual(graph);
    });

    it("draws an empty graph for a repository with no source code", () => {
        expect(buildModuleGraph({ "README.md": "# hello" }).nodes).toEqual([]);
    });

    it("never treats the model-free graph as carrying source text", () => {
        expect(JSON.stringify(graph)).not.toContain("createClient");
    });
});

describe("buildModuleGraph in a monorepo", () => {
    const monorepo = {
        "packages/lib/package.json": `{ "name": "@acme/lib" }`,
        "packages/lib/src/date.ts": "export const today = 1;",
        "packages/ui/package.json": `{ "name": "@acme/ui" }`,
        "packages/ui/button.tsx": `import { today } from "@acme/lib/date"; import "@acme/lib";`,
        "apps/web/package.json": `{ "name": "web" }`,
        "apps/web/page.tsx": `import Button from "@acme/ui/button";`,
        "__checks__/smoke.js": "export const check = 1;",
        ".storybook/main.js": "export default {};",
    };
    const graph = buildModuleGraph(monorepo);
    const hasEdge = (from, to) => graph.edges.some((edge) => edge.from === from && edge.to === to);

    it("links packages that import each other by name", () => {
        expect(hasEdge("packages/ui", "packages/lib/src")).toBe(true);
        expect(hasEdge("apps/web", "packages/ui")).toBe(true);
    });

    it("leaves tooling folders out", () => {
        expect(graph.nodes.some((node) => node.id.includes("__checks__") || node.id.includes(".storybook"))).toBe(false);
    });
});

describe("diffModuleGraphs", () => {
    const base = buildModuleGraph(repo);
    const { folders } = base;

    it("finds nothing between identical commits", () => {
        const diff = diffModuleGraphs(base, buildModuleGraph(repo, { folders }));
        expect(Object.values(diff).every((list) => list.length === 0)).toBe(true);
    });

    it("reports a changed module when a file in it changes", () => {
        const head = buildModuleGraph({ ...repo, "backend/db/index.js": `import { Pool } from "pg";` }, { folders });
        const diff = diffModuleGraphs(base, head);
        expect(diff.changedNodes.map((node) => node.id)).toContain("backend/db");
    });

    it("reports a removed service and link", () => {
        const withoutCompose = { ...repo };
        delete withoutCompose["docker-compose.yml"];
        const baseOnly = buildModuleGraph(withoutCompose, { folders });
        const head = buildModuleGraph({ ...withoutCompose, "backend/db/index.js": `import { Pool } from "pg";` }, { folders });
        const diff = diffModuleGraphs(baseOnly, head);
        expect(diff.removedNodes.map((node) => node.label)).toContain("Redis");
        expect(diff.removedEdges.some((edge) => edge.to === "service:Redis")).toBe(true);
    });

    it("reports a new link between existing modules", () => {
        const head = buildModuleGraph(
            { ...repo, "backend/services/mail.js": `import nodemailer from "nodemailer"; import db from "../db/index.js";` },
            { folders },
        );
        const diff = diffModuleGraphs(base, head);
        expect(diff.addedEdges).toEqual([expect.objectContaining({ from: "backend/services", to: "backend/db" })]);
    });

    it("keeps a new top-level folder visible by comparing on the head's folders", () => {
        const head = buildModuleGraph({ ...repo, "backend/queue/worker.js": "export const run = 1;" });
        const diff = diffModuleGraphs(buildModuleGraph(repo, { folders: head.folders }), head);
        expect(diff.addedNodes.map((node) => node.id)).toContain("backend/queue");
    });
});

describe("hostile repository text", () => {
    it("scans a file built to make open-ended patterns go quadratic in reasonable time", () => {
        const hostile = "import ".repeat(70_000);
        const started = performance.now();
        buildModuleGraph({ "src/a.js": hostile, "src/b.js": `${"require( ".repeat(50_000)}`, "src/c.js": `import${" ".repeat(500_000)}` });
        expect(performance.now() - started).toBeLessThan(3000);
    });

    it("still reads an import spread over several lines", () => {
        const graph = buildModuleGraph({
            "src/a/x.js": `import {\n  one,\n  two,\n} from "../b/y.js";`,
            "src/b/y.js": "export const one = 1;",
        });
        expect(graph.edges).toEqual([expect.objectContaining({ from: "src/a", to: "src/b" })]);
    });
});

describe("buildModuleGraph across languages", () => {
    const linked = (files, from, to) => {
        const { edges } = buildModuleGraph(files);
        return edges.some((edge) => edge.from === from && edge.to === to);
    };

    it("follows Python relative and absolute imports", () => {
        const files = {
            "app/api/users.py": "from ..core.db import engine\nimport app.models.user\n",
            "app/core/db.py": "x = 1\n",
            "app/models/user.py": "y = 1\n",
        };
        expect(linked(files, "app/api", "app/core")).toBe(true);
        expect(linked(files, "app/api", "app/models")).toBe(true);
    });

    it("follows Go imports through go.mod", () => {
        const files = {
            "go.mod": "module github.com/acme/shop\n\ngo 1.22\n",
            "cmd/server/main.go": 'package main\nimport (\n  "fmt"\n  "github.com/acme/shop/internal/store"\n)\n',
            "internal/store/db.go": "package store\n",
        };
        expect(linked(files, "cmd/server", "internal/store")).toBe(true);
    });

    it("follows Java package imports from any source root", () => {
        const files = {
            "src/main/java/com/acme/web/Api.java": "package com.acme.web;\nimport com.acme.data.Repo;\nclass Api {}\n",
            "src/main/java/com/acme/data/Repo.java": "package com.acme.data;\nclass Repo {}\n",
        };
        expect(linked(files, "src/main/java/com/acme/web", "src/main/java/com/acme/data")).toBe(true);
    });

    it("follows Rust crate paths and mod declarations", () => {
        const files = {
            "Cargo.toml": '[package]\nname = "shop"\n',
            "src/api/mod.rs": "use crate::store::db;\n",
            "src/store/db.rs": "pub fn open() {}\n",
        };
        expect(linked(files, "src/api", "src/store")).toBe(true);
    });

    it("follows C includes, Ruby requires and C# namespaces", () => {
        expect(linked({ "src/a/x.c": '#include "../b/y.h"\n', "src/b/y.h": "int y;\n" }, "src/a", "src/b")).toBe(true);
        expect(linked({ "lib/a/x.rb": "require_relative '../b/y'\n", "lib/b/y.rb": "Y = 1\n" }, "lib/a", "lib/b")).toBe(true);
        expect(
            linked(
                { "Shop/Web/Api.cs": "using Shop.Data;\nclass Api {}\n", "Shop/Data/Repo.cs": "namespace Shop.Data;\nclass Repo {}\n" },
                "Shop/Web",
                "Shop/Data",
            ),
        ).toBe(true);
    });

    it("maps a language with no resolver by its folders alone", () => {
        const { nodes } = buildModuleGraph({ "core/a.sol": "contract A {}", "token/b.sol": "contract B {}" });
        expect(nodes.map((node) => node.id).sort()).toEqual(["core", "token"]);
    });

    it("finds a database from any language's import", () => {
        const { nodes } = buildModuleGraph({ "db/conn.py": "import psycopg2\n" });
        expect(nodes.find((node) => node.kind === "service")?.label).toBe("PostgreSQL");
    });

    it("doesn't take a package path deep in Java for a samples folder", () => {
        expect(isModuleSource("src/main/java/org/acme/samples/Shop.java")).toBe(true);
        expect(isModuleSource("samples/shop/Shop.java")).toBe(false);
    });

    it("leaves other languages' tests out", () => {
        ["store_test.go", "test_store.py", "StoreTest.java", "store_spec.rb"].forEach((file) => expect(isModuleSource(`src/${file}`)).toBe(false));
    });
});

describe("describeArchitecture", () => {
    const app = {
        "frontend/src/pages/index.js": `import s from "../socket.js"; import a from "../api.js"; import "next/link";`,
        "frontend/src/socket.js": `import { io } from "socket.io-client";`,
        "frontend/src/api.js": `import axios from "axios";`,
        "backend/index.js": `import express from "express"; import { Server } from "socket.io"; import "./routes/users.js";`,
        "backend/routes/users.js": `import "../models/user.js"; import jwt from "jsonwebtoken";`,
        "backend/models/user.js": `import mongoose from "mongoose";`,
    };
    const graph = buildModuleGraph(app);
    const nodeOf = (id) => graph.nodes.find((node) => node.id === id);

    it("separates the two sides of the system and names their framework", () => {
        const labels = graph.groups.map((group) => group.label);
        expect(labels).toContain("Frontend (Next.js)");
        expect(labels).toContain("Backend (Express)");
    });

    it("gives parts their real file and folder names", () => {
        expect(nodeOf("frontend/src/socket.js").title).toBe("socket.js");
        expect(nodeOf("backend/routes").title).toBe("routes/");
    });

    it("stacks parts from entry points down to data", () => {
        expect(nodeOf("backend/index.js").layer).toBeLessThan(nodeOf("backend/routes").layer);
        expect(nodeOf("backend/routes").layer).toBeLessThan(nodeOf("backend/models").layer);
    });

    it("joins the sides with the wires no import shows, labelled", () => {
        const wires = graph.edges.filter((edge) => edge.protocol);
        expect(wires.map((edge) => edge.label).sort()).toEqual(["REST + JWT", "WebSocket"]);
        expect(wires.find((edge) => edge.label === "WebSocket")).toMatchObject({ from: "frontend/src/socket.js", to: "backend/index.js", bidirectional: true });
    });

    it("draws a heavy cycle of imports without cancelling all of it out", () => {
        const { edges } = buildModuleGraph({ "a/x.js": `import "../b/y.js";`, "b/y.js": `import "../c/z.js";`, "c/z.js": `import "../a/x.js";` });
        expect(edges.filter((edge) => edge.primary).length).toBeGreaterThanOrEqual(2);
    });
});

describe("the arrows drawn", () => {
    it("keeps the arrows into one widely used part to a few", () => {
        const files = { "core/index.js": "export const core = 1;", "lib/index.js": "export const lib = 1;", "lib/format.js": "export const format = 1;" };
        for (let n = 0; n < 4; n++) {
            files[`part${n}/a.js`] = `import "../core/index.js";`;
            files[`part${n}/b.js`] = `import "../core/index.js";`;
            files[`part${n}/c.js`] = `import "../lib/index.js";`;
        }
        const graph = buildModuleGraph(files);
        expect(graph.edges.filter((edge) => edge.to === "lib")).toHaveLength(4);
        expect(graph.edges.filter((edge) => edge.primary && edge.to === "lib").length).toBeLessThanOrEqual(3);
    });
});
