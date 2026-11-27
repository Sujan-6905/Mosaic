import { getLiveOrPersistedElements } from "../../liveRooms/liveScene.js";
import { getGroundedScene } from "../../grounding/relationCache.js";
import { serializeSceneContext } from "../../grounding/contextSerializer.js";
import { resolveReference } from "../../grounding/referenceResolver.js";
import { applyResolutionPolicy } from "../../grounding/resolutionPolicy.js";
import { isLayerEnabled, LAYER_KEYS } from "../../grounding/flags.js";
import { recordAgentStageTiming, recordResolutionOutcome } from "../../observability/metrics.js";
import { sendAlert } from "../../observability/alerts.js";
import logger from "../../observability/logger.js";

// The one grounding read shared by the assistant and the MCP describe_board and resolve tools.
const getContext = async (req, res) => {
    const { shareId } = req.params;
    const startedAt = Date.now();
    try {
        const { viewport, selection } = req.body;
        const elements = await getLiveOrPersistedElements(shareId, req.drawing.elements);
        const groundedScene = await getGroundedScene(shareId, elements, viewport);
        const context = serializeSceneContext(groundedScene, { viewport: viewport ?? null, selection });
        recordAgentStageTiming("grounding:context", Date.now() - startedAt);
        return res.status(200).json(context);
    } catch (error) {
        // A crash here breaks the assistant for everyone on the board, so it alerts.
        logger.error({ err: error, shareId, correlationId: req.correlationId }, "error building grounding context");
        sendAlert("grounding-failure", { shareId, correlationId: req.correlationId, error: error.message });
        return res.status(500).json({ message: "Internal server error." });
    }
};

const resolve = async (req, res) => {
    const { shareId } = req.params;
    const startedAt = Date.now();
    try {
        const { description, viewport, selection } = req.body;

        if (!isLayerEnabled(LAYER_KEYS.RESOLVER)) {
            return res.status(200).json({ status: "none", candidates: [] });
        }

        const elements = await getLiveOrPersistedElements(shareId, req.drawing.elements);
        const groundedScene = await getGroundedScene(shareId, elements, viewport);
        const ranked = resolveReference(groundedScene, description, { viewport: viewport ?? null, selection });
        const decision = applyResolutionPolicy(ranked);
        recordAgentStageTiming("grounding:resolve", Date.now() - startedAt);
        recordResolutionOutcome(decision.status);
        return res.status(200).json(decision);
    } catch (error) {
        logger.error({ err: error, shareId, correlationId: req.correlationId }, "error resolving board reference");
        sendAlert("grounding-failure", { shareId, correlationId: req.correlationId, error: error.message });
        return res.status(500).json({ message: "Internal server error." });
    }
};

export { getContext, resolve };
