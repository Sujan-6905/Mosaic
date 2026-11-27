// Streams a turn's stages to the room so a several-second turn reads as working, and records
// stage timing.
import { recordAgentStageTiming } from "../../observability/metrics.js";

export const STAGES = {
    UNDERSTANDING: "understanding",
    PLANNING: "planning",
    CHECKING: "checking",
};

const STAGE_LABELS = {
    [STAGES.UNDERSTANDING]: "Reading the board",
    [STAGES.PLANNING]: "Working out what to do",
    [STAGES.CHECKING]: "Checking the result",
};

// Announces the next stage and closes the previous one's timing; `stage: null` only closes.
export const emitAgentStage = (io, { shareId, userId, turnId, stage, previousStage, previousStartedAt }) => {
    const now = Date.now();
    if (previousStage && previousStartedAt) {
        recordAgentStageTiming(previousStage, now - previousStartedAt);
    }
    if (io && stage) {
        io.to(shareId).emit("server:agentActivity", {
            shareId,
            userId,
            turnId,
            stage,
            label: STAGE_LABELS[stage] || stage,
        });
    }
    return now;
};

export const emitAgentTurnDone = (io, { shareId, userId, turnId, status }) => {
    if (io) io.to(shareId).emit("server:agentActivityDone", { shareId, userId, turnId, status });
};
