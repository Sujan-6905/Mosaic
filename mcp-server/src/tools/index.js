import { registerBoardTools } from "./board.js";
import { registerCollaborationTools } from "./collaboration.js";
import { registerContentTools } from "./content.js";
import { registerHistoryTools } from "./history.js";
import { registerStyleTools } from "./styles.js";

// `context` is one agent's backend client and board sessions.
export const registerTools = (server, context) => {
    registerBoardTools(server, context);
    registerContentTools(server, context);
    registerCollaborationTools(server, context);
    registerHistoryTools(server, context);
    registerStyleTools(server, context);
};
