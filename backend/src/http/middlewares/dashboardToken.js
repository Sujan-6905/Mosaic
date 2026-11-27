import { secretsMatch } from "../../auth/secretsMatch.js";

// A self-hosted operations page that names busy boards, behind a shared-secret token.
// A 404 when DASHBOARD_TOKEN is unset, so no deployment exposes it by accident.
export const requireDashboardToken = (req, res, next) => {
    if (typeof req.query.token !== "string" || !secretsMatch(req.query.token, process.env.DASHBOARD_TOKEN)) return res.status(404).end();
    return next();
};
