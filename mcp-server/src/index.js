#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "./config.js";
import { createBackendClient } from "./connection/backendClient.js";
import { createBoardSessions } from "./connection/boardSession.js";
import { createMcpServer } from "./server.js";

const backend = createBackendClient({
    apiUrl: config.apiUrl,
    credentials: config.token ? { token: config.token } : { username: config.username, password: config.password },
});
const boards = createBoardSessions({ apiUrl: config.apiUrl, getAuthToken: backend.getAuthToken });
const server = createMcpServer({ backend, boards, appUrl: config.appUrl });

const shutdown = () => {
    boards.closeAll();
    process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await server.connect(new StdioServerTransport());
