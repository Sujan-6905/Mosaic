import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";
import { registerPrompts } from "./prompts.js";
import { registerBoardResources } from "./resources.js";
import { registerBoardView } from "./boardView/boardView.js";
import { turnContext } from "./toolTurns.js";

// One MCP server per agent, acting through that agent's backend client and board sessions.
// `beforeToolCall` may refuse a call (a rate limit) by throwing.
export const createMcpServer = ({ backend, boards, appUrl, beforeToolCall = async () => {} }) => {
    const server = new McpServer(
        { name: "mosaic-whiteboard", title: "Mosaic", version: "2.0.0", websiteUrl: appUrl },
        { capabilities: { resources: { subscribe: true, listChanged: false } } },
    );
    const register = server.registerTool.bind(server);
    server.registerTool = (name, config, handler) =>
        register(name, config, async (...args) => {
            try {
                await beforeToolCall(name);
            } catch (error) {
                return { isError: true, content: [{ type: "text", text: error.message }] };
            }
            return turnContext.run({ turnId: randomUUID(), tool: name }, () => handler(...args));
        });
    const context = { backend, boards, appUrl };
    registerTools(server, context);
    registerBoardView(server, context);
    registerPrompts(server);
    registerBoardResources(server, context);
    return server;
};
