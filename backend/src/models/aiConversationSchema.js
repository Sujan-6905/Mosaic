import "../db/connection.js";
import { Schema, model } from "ottoman";

// One personal document per chat thread. Messages are plain objects because Ottoman's
// array-of-Schema support is limited.
const MAX_MESSAGES = 200;
// A pronoun only reaches back a few turns, so resolved refs are capped separately.
const MAX_RESOLVED_REFS = 20;
const MAX_TITLE_LENGTH = 80;

const aiConversationSchema = new Schema(
    {
        shareId: { type: String, required: true },
        userId: { type: String, required: true },
        title: { type: String, default: null },
        messages: { type: [Schema.Types.Mixed], default: [] },
        // Newest last: what "it" or "the last one" in a later turn refers to.
        resolvedRefs: { type: [Schema.Types.Mixed], default: [] },
    },
    { timestamps: true },
);

aiConversationSchema.index.findByShareId = { by: "shareId", type: "n1ql" };
aiConversationSchema.index.findByShareIdAndUserId = { by: ["shareId", "userId"], type: "n1ql" };

const titleFrom = (text) => {
    const line = String(text).trim().replace(/\s+/g, " ");
    return line.length > MAX_TITLE_LENGTH ? `${line.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…` : line;
};

// Null for a missing thread and for one belonging to another user or board,
// so a guessed id never reads or writes someone else's conversation.
aiConversationSchema.statics.findOwned = async function ({ shareId, userId, conversationId }) {
    if (!conversationId) return null;
    const conversation = await this.findById(conversationId).catch(() => null);
    if (!conversation || conversation.shareId !== shareId || conversation.userId !== userId) return null;
    return conversation;
};

aiConversationSchema.statics.listForUser = async function (shareId, userId) {
    const { rows } = await this.find({ shareId, userId }, { sort: { updatedAt: "DESC" } });
    return rows;
};

aiConversationSchema.statics.start = function (shareId, userId, title = null) {
    return this.create({ shareId, userId, title: title ? titleFrom(title) : null, messages: [], resolvedRefs: [] });
};

// Appends a turn and trims to MAX_MESSAGES. A missing or foreign conversationId starts a new
// thread; the first user message titles it.
aiConversationSchema.statics.appendTurn = async function (thread, turnMessages, resolvedRef = null) {
    const { shareId, userId } = thread;
    const existing = await this.findOwned(thread);
    const messages = [...(existing?.messages || []), ...turnMessages].slice(-MAX_MESSAGES);
    const resolvedRefs = resolvedRef
        ? [...(existing?.resolvedRefs || []), { ...resolvedRef, ts: Date.now() }].slice(-MAX_RESOLVED_REFS)
        : existing?.resolvedRefs || [];
    const firstPrompt = turnMessages.find((message) => message.role === "user")?.content;
    const title = existing?.title || (firstPrompt ? titleFrom(firstPrompt) : null);

    if (existing) {
        existing.messages = messages;
        existing.resolvedRefs = resolvedRefs;
        existing.title = title;
        await existing.save();
        return existing;
    }
    return this.create({ shareId, userId, title, messages, resolvedRefs });
};

aiConversationSchema.statics.findAppliedEdit = async function (thread, batchId) {
    const existing = await this.findOwned(thread);
    return existing?.messages.find((message) => message.batchId === batchId) ?? null;
};

aiConversationSchema.statics.markEditReverted = async function (thread, batchId) {
    const existing = await this.findOwned(thread);
    if (!existing) return;
    existing.messages = existing.messages.map((message) => (message.batchId === batchId ? { ...message, revertedAt: Date.now() } : message));
    await existing.save();
};

// The last object this conversation settled on that is still on the board.
export const mostRecentLiveRef = (conversation, liveRefs) => {
    const history = conversation?.resolvedRefs || [];
    for (let i = history.length - 1; i >= 0; i -= 1) {
        if (liveRefs.has(history[i].ref)) return history[i];
    }
    return null;
};

const AiConversation = model("AiConversation", aiConversationSchema, {
    collectionName: "aiConversations",
    scopeName: "app",
    idKey: "_id",
});

export default AiConversation;
