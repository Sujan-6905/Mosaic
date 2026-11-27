// What a turn remembers of the conversation: recent exchanges that went through, with the
// diagram or sketch each answer drew, trimmed to fit the prompt.
import { describeSketchParts } from "./sketchContract.js";
import { normalizeUntrustedText } from "../safety/promptSafety.js";

const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_MESSAGE_CHARS = 400;
const MAX_HISTORY_GRAPH_CHARS = 900;

const describeGraphForHistory = ({ nodes, edges }) => {
    const summary = JSON.stringify({
        nodes: nodes.map(({ id, label, shape, fillColor }) => ({ id, label, shape, ...(fillColor ? { fillColor } : {}) })),
        edges: (edges ?? []).map(({ from, to, label }) => ({ from, to, ...(label ? { label } : {}) })),
    });
    return summary.length > MAX_HISTORY_GRAPH_CHARS ? null : summary;
};

const historyTextFor = (message) => {
    const content = String(message.content ?? "").slice(0, MAX_HISTORY_MESSAGE_CHARS);
    if (message.parts?.length) return `${content}\nThe sketch's parts were: ${describeSketchParts(message.parts)}`;
    const graph = message.nodes?.length ? describeGraphForHistory(message) : null;
    return graph ? `${content}\nThe diagram was: ${graph}` : content;
};

// Failed and refused exchanges are left out of history, so a refused attack gets no second go.
export const buildConversationHistory = (storedMessages = []) => {
    const exchanges = [];
    storedMessages.forEach((message) => {
        if (message.role === "user") exchanges.push({ user: message, assistant: null });
        else if (exchanges.length > 0 && !exchanges.at(-1).assistant) exchanges.at(-1).assistant = message;
    });

    return exchanges
        .filter(({ assistant }) => assistant && !assistant.failed && !assistant.refused && !assistant.canceled)
        .flatMap(({ user, assistant }) => [
            { role: "user", content: normalizeUntrustedText(user.content).text.slice(0, MAX_HISTORY_MESSAGE_CHARS) },
            { role: "assistant", content: historyTextFor(assistant) },
        ])
        .slice(-MAX_HISTORY_MESSAGES);
};
