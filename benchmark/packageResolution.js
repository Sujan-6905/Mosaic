import { createRequire } from "node:module";

// Benchmarks run on the packages the backend, MCP server and frontend already install, rather than keeping copies.
export const requireFromBackend = createRequire(new URL("../backend/package.json", import.meta.url));
export const requireFromMcpServer = createRequire(new URL("../mcp-server/package.json", import.meta.url));
export const requireFromFrontend = createRequire(new URL("../frontend/package.json", import.meta.url));
