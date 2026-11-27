import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createBackendClient } from "./connection/backendClient.js";
import { createBoardSessions } from "./connection/boardSession.js";
import { createMcpServer } from "./server.js";

const IDLE_MS = 30 * 60 * 1000;
// An agent that has gone quiet leaves the boards it was on, so presence shows
// who is actually working; its next call rejoins.
const BOARD_IDLE_MS = 5 * 60 * 1000;
const SWEEP_MS = 60 * 1000;
const MAX_SESSIONS_PER_PERSON = 10;
const CALLS_PER_MINUTE = 60;

const jsonRpcError = (res, status, message) => res.status(status).json({ jsonrpc: "2.0", error: { code: -32000, message }, id: null });

// Tool calls per credential in a sliding minute, shared by every session that credential opened.
const createCallLimiter = () => {
    const calls = new Map();
    return (key) => {
        const now = Date.now();
        const recent = (calls.get(key) ?? []).filter((at) => now - at < 60_000);
        if (recent.length >= CALLS_PER_MINUTE) {
            const wait = Math.ceil((60_000 - (now - recent[0])) / 1000);
            throw new Error(`This token has made ${CALLS_PER_MINUTE} tool calls in the last minute. Try again in ${wait}s.`);
        }
        recent.push(now);
        calls.set(key, recent);
    };
};

// The Streamable HTTP server. Each session belongs to the person whose token opened it,
// and each request's own token replaces the previous one.
export const createHostedMcp = ({ apiUrl, appUrl }) => {
    const sessions = new Map();
    const limitCalls = createCallLimiter();

    const close = (sessionId) => {
        const entry = sessions.get(sessionId);
        if (!entry) return;
        sessions.delete(sessionId);
        entry.boards.closeAll();
        entry.transport.close().catch(() => {});
    };

    const sweep = setInterval(() => {
        const now = Date.now();
        sessions.forEach((entry, sessionId) => {
            if (now - entry.lastSeen > IDLE_MS) close(sessionId);
            else if (now - entry.lastSeen > BOARD_IDLE_MS) entry.boards.closeUnwatched();
        });
    }, SWEEP_MS);
    sweep.unref();

    const open = (principal, token) => {
        const owned = [...sessions.entries()].filter(([, entry]) => entry.userId === principal.userId).sort((a, b) => a[1].lastSeen - b[1].lastSeen);
        if (owned.length >= MAX_SESSIONS_PER_PERSON) close(owned[0][0]);
        const entry = { userId: principal.userId, principal, token, lastSeen: Date.now() };
        const backend = createBackendClient({ apiUrl, credentials: { token: () => entry.token } });
        entry.boards = createBoardSessions({ apiUrl, getAuthToken: async () => entry.token });
        entry.server = createMcpServer({ backend, boards: entry.boards, appUrl, beforeToolCall: async () => limitCalls(entry.principal.sid ?? entry.userId) });
        entry.transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: randomUUID,
            enableJsonResponse: true,
            onsessioninitialized: (sessionId) => sessions.set(sessionId, entry),
        });
        entry.transport.onclose = () => {
            const sessionId = entry.transport.sessionId;
            if (sessionId && sessions.get(sessionId) === entry) {
                sessions.delete(sessionId);
                entry.boards.closeAll();
            }
        };
        return entry;
    };

    // `principal` is the caller the web server already authenticated; `token` the bearer token it sent.
    const handle = async (req, res, { principal, token }) => {
        const sessionId = req.get("mcp-session-id");
        if (sessionId) {
            const entry = sessions.get(sessionId);
            // A session someone else opened looks the same as one that never existed.
            if (!entry || entry.userId !== principal.userId) return jsonRpcError(res, 404, "Session not found. Start a new one.");
            Object.assign(entry, { principal, token, lastSeen: Date.now() });
            return entry.transport.handleRequest(req, res, req.body);
        }
        if (req.method !== "POST" || !isInitializeRequest(req.body)) return jsonRpcError(res, 400, "Start a session with an initialize request first.");
        const entry = open(principal, token);
        await entry.server.connect(entry.transport);
        return entry.transport.handleRequest(req, res, req.body);
    };

    const shutdown = () => {
        clearInterval(sweep);
        [...sessions.keys()].forEach(close);
    };

    return { handle, shutdown, sessionCount: () => sessions.size };
};
