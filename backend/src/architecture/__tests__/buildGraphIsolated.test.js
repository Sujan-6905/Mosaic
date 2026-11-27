import { describe, it, expect } from "vitest";
import { writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { buildModuleGraphIsolated } from "../buildGraphIsolated.js";
import { RepositoryError } from "../githubRepo.js";

const workerFile = (source) => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "graph-worker-")), "worker.mjs");
    writeFileSync(file, source);
    return file;
};

describe("buildModuleGraphIsolated", () => {
    it("builds the same graph in its own process, from a Map of files", async () => {
        const files = new Map([
            ["src/a/x.js", `import "../b/y.js";`],
            ["src/b/y.js", "export {};"],
        ]);
        const graph = await buildModuleGraphIsolated(files);
        expect(graph.edges).toEqual([expect.objectContaining({ from: "src/a", to: "src/b" })]);
    });

    it("gives up on a worker that never finishes", async () => {
        const workerPath = workerFile("for (;;) {}");
        await expect(buildModuleGraphIsolated(new Map(), {}, { timeoutMs: 200, workerPath })).rejects.toBeInstanceOf(RepositoryError);
    });

    it("refuses when the worker fails, without crashing the caller", async () => {
        const workerPath = workerFile(`throw new Error("boom");`);
        await expect(buildModuleGraphIsolated(new Map(), {}, { workerPath })).rejects.toBeInstanceOf(RepositoryError);
    });

    it("still maps the repository from patterns when the grammars take the process down", async () => {
        const workerPath = workerFile(
            `process.once("message", ({ useGrammars }) => { if (useGrammars) process.exit(134); process.send({ nodes: [], edges: [], usedPatterns: true }, () => process.exit(0)); });`,
        );
        await expect(buildModuleGraphIsolated(new Map(), {}, { workerPath })).resolves.toMatchObject({ usedPatterns: true });
    });
});
