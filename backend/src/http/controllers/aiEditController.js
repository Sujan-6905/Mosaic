// Acting on a reviewed proposal after its turn: accept all or some of it, redo it against the current board,
// undo an applied batch, discard it, or stop a turn still running.
import { commitPlannedEdit, discardPlannedEdit, rebasePlannedEdit, revertAppliedEdit } from "../../ai/edits/agentEdit.js";
import { cancelTurn } from "../../ai/model/cancellation.js";
import { changedElementCount, describeEditOutcome, plural, reviewFieldsOf } from "../../ai/turn/turnResponses.js";
import AiConversation from "../../models/aiConversationSchema.js";
import { recordAiGeneration } from "../../observability/metrics.js";
import logger from "../../observability/logger.js";

// The user's turn was logged with the preview, so a commit logs only the assistant's follow-up.
const appendCommitOutcome = (thread, content, fields = {}) =>
    AiConversation.appendTurn(thread, [{ role: "assistant", createdAt: Date.now(), content, ...fields }]).catch((error) => {
        logger.error({ err: error, shareId: thread.shareId }, "failed to persist AI conversation turn");
    });

const commitEditPreview = async (req, res) => {
    const { token, acceptedIndexes, conversationId } = req.body;
    const { shareId } = req.params;
    const { userId } = req.user;
    const thread = { shareId, userId, conversationId };

    const result = await commitPlannedEdit({
        token,
        shareId,
        drawing: req.drawing,
        userId,
        correlationId: req.correlationId,
        acceptedIndexes: acceptedIndexes ?? null,
    });

    if (result.status !== "applied" && result.status !== "no-op") {
        const message = describeEditOutcome(result);
        const statusCode = result.status === "unauthorized" ? 403 : result.status === "conflict" ? 409 : 422;
        // A conflict or an unmet dependency leaves the proposal open, so the
        // card stays up rather than this becoming a turn in the thread.
        const stillOpen = result.status === "conflict" || result.status === "needs-dependency";
        if (!stillOpen) await appendCommitOutcome(thread, message);
        return res.status(statusCode).json({ message, conflicts: result.conflicts, stillOpen });
    }

    recordAiGeneration();
    const changeCount = result.status === "applied" ? changedElementCount(result) : 0;
    const message = result.status === "no-op" ? "That didn't change anything on the board." : `Applied the edit (${plural(changeCount, "element")} changed).`;
    await appendCommitOutcome(thread, message, result.status === "applied" ? { diff: result.diff, batchId: result.batchId } : {});
    return res.status(200).json({ ...result, message });
};

const rebaseEditPreview = async (req, res) => {
    const { token } = req.body;
    const { shareId } = req.params;
    const plan = await rebasePlannedEdit({ token, shareId, drawing: req.drawing, userId: req.user.userId });
    if (plan.status === "planned") return res.status(200).json({ status: "planned", ...reviewFieldsOf(plan) });
    const message = plan.status === "no-op" ? "The board already matches this proposal, so there's nothing left to apply." : describeEditOutcome(plan);
    return res.status(plan.status === "no-op" ? 200 : 422).json({ status: plan.status, message });
};

const revertAppliedEditBatch = async (req, res) => {
    const { batchId, conversationId } = req.body;
    const { shareId } = req.params;
    const { userId } = req.user;
    const thread = { shareId, userId, conversationId };

    const applied = await AiConversation.findAppliedEdit(thread, batchId);
    if (!applied) return res.status(404).json({ message: "That edit can't be undone from here any more." });
    if (applied.revertedAt) return res.status(409).json({ message: "That edit has already been undone." });

    const result = await revertAppliedEdit({ shareId, drawing: req.drawing, userId, diff: applied.diff, batchId, correlationId: req.correlationId });
    if (result.status === "unauthorized") return res.status(403).json({ message: describeEditOutcome(result) });

    await AiConversation.markEditReverted(thread, batchId);
    const { restoredCount, skipped } = result;
    const undone = restoredCount === 0 ? "Nothing could be undone" : `Undid the edit (${plural(restoredCount, "element")} restored)`;
    const message = skipped.length > 0 ? `${undone}. Left alone because they've changed since: ${skipped.join(", ")}.` : `${undone}.`;
    await appendCommitOutcome(thread, message);
    return res.status(200).json({ ...result, message });
};

const discardEditPreview = async (req, res) => {
    const { token } = req.params;
    const { userId } = req.user;
    discardPlannedEdit(token, userId);
    return res.status(204).send();
};

const cancelEditTurn = async (req, res) => {
    const { turnId } = req.params;
    cancelTurn(turnId);
    return res.status(204).send();
};

export { commitEditPreview, rebaseEditPreview, revertAppliedEditBatch, discardEditPreview, cancelEditTurn };
