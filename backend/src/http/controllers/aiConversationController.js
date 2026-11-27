import AiConversation from "../../models/aiConversationSchema.js";
import logger from "../../observability/logger.js";
import { PROVIDER_FAILURE_MESSAGE } from "../../ai/turn/turnResponses.js";

// A person's own assistant threads on a board: listing, opening, renaming and deleting them.
const summarizeConversation = (conversation) => ({
    id: conversation._id,
    title: conversation.title,
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messages?.length ?? 0,
});

const listConversations = async (req, res) => {
    try {
        const conversations = await AiConversation.listForUser(req.params.shareId, req.user.userId);
        return res.status(200).json({ conversations: conversations.map(summarizeConversation) });
    } catch (error) {
        logger.error({ err: error }, "error listing AI conversations");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const createConversation = async (req, res) => {
    try {
        const conversation = await AiConversation.start(req.params.shareId, req.user.userId, req.body.title);
        return res.status(201).json({ conversation: summarizeConversation(conversation) });
    } catch (error) {
        logger.error({ err: error }, "error creating AI conversation");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const ownedConversation = (req) =>
    AiConversation.findOwned({ shareId: req.params.shareId, userId: req.user.userId, conversationId: req.params.conversationId });

// Threads written before provider errors were classified stored the raw error
// body, with its rejected generation and billing details, as the message.
const RAW_PROVIDER_ERROR = /Groq request failed|failed_generation|AI (edit|generation) failed:/;
const withoutRawProviderErrors = (messages) =>
    messages.map((message) =>
        message.role === "assistant" && RAW_PROVIDER_ERROR.test(message.content ?? "") ? { ...message, content: PROVIDER_FAILURE_MESSAGE } : message,
    );

const getConversation = async (req, res) => {
    try {
        const conversation = await ownedConversation(req);
        if (!conversation) return res.status(404).json({ message: "Conversation not found." });
        return res
            .status(200)
            .json({ conversation: { ...summarizeConversation(conversation), messages: withoutRawProviderErrors(conversation.messages || []) } });
    } catch (error) {
        logger.error({ err: error }, "error fetching AI conversation");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const renameConversation = async (req, res) => {
    try {
        const conversation = await ownedConversation(req);
        if (!conversation) return res.status(404).json({ message: "Conversation not found." });
        conversation.title = req.body.title;
        await conversation.save();
        return res.status(200).json({ conversation: summarizeConversation(conversation) });
    } catch (error) {
        logger.error({ err: error }, "error renaming AI conversation");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const deleteConversation = async (req, res) => {
    try {
        const conversation = await ownedConversation(req);
        if (!conversation) return res.status(404).json({ message: "Conversation not found." });
        await AiConversation.removeById(conversation._id);
        return res.status(204).send();
    } catch (error) {
        logger.error({ err: error }, "error deleting AI conversation");
        return res.status(500).json({ message: "Internal server error." });
    }
};

export { listConversations, createConversation, getConversation, renameConversation, deleteConversation };
