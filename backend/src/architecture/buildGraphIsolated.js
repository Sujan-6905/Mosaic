import { fork } from "child_process";
import { fileURLToPath } from "url";
import { RepositoryError } from "./githubRepo.js";

const GRAPH_TIMEOUT_MS = 30_000;
const WORKER_HEAP_MB = 384;
const WORKER_PATH = fileURLToPath(new URL("./graphWorker.js", import.meta.url));

const runWorker = (files, options, { timeoutMs, workerPath, useGrammars }) =>
    new Promise((resolve, reject) => {
        const worker = fork(workerPath, [], {
            execArgv: [`--max-old-space-size=${WORKER_HEAP_MB}`],
            serialization: "advanced",
            stdio: ["ignore", "ignore", "ignore", "ipc"],
        });
        let settled = false;
        const settle = (finish, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            worker.kill("SIGKILL");
            finish(value);
        };
        const timer = setTimeout(() => settle(reject, new Error("timed out")), timeoutMs);
        worker.once("message", (graph) => settle(resolve, graph));
        worker.once("error", (error) => settle(reject, error));
        worker.once("exit", () => settle(reject, new Error("the graph process ended early")));
        worker.send({ files, options, useGrammars });
    });

// Scanning untrusted text runs in its own process with a timeout and heap limit. If the grammars
// crash it, the patterns alone get another go.
export const buildModuleGraphIsolated = async (files, options = {}, { timeoutMs = GRAPH_TIMEOUT_MS, workerPath = WORKER_PATH } = {}) => {
    try {
        return await runWorker(files, options, { timeoutMs, workerPath, useGrammars: true });
    } catch {
        try {
            return await runWorker(files, options, { timeoutMs, workerPath, useGrammars: false });
        } catch {
            throw new RepositoryError("That repository is too complex to map.", 422);
        }
    }
};
