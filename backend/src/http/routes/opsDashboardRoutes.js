import { Router } from "express";
import { requireDashboardToken } from "../middlewares/dashboardToken.js";
import { listAiTraces, reportMetrics, showDashboard } from "../controllers/opsDashboardController.js";

const createDashboardRouter = ({ collectMetrics }) => {
    const router = Router();
    router.use(requireDashboardToken);
    router.get("/", showDashboard);
    router.get("/metrics", reportMetrics(collectMetrics));
    // Spans, timings and token counts only: a trace never holds prompt or output text.
    router.get("/ai-traces", listAiTraces);
    return router;
};

export default createDashboardRouter;
