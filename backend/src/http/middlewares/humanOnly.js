// An agent or a board-limited sign-in may never mint credentials or widen who can reach a board.
import { isFullSignIn } from "../../models/accessControl.js";

const humanOnly = (req, res, next) => {
    if (req.user?.agent) return res.status(403).json({ message: "Agents can't change this. Sign in to Mosaic to do it yourself.", code: "agent_refused" });
    if (!isFullSignIn(req.user))
        return res.status(403).json({ message: "This sign-in only reaches some boards. Sign in to Mosaic to change this.", code: "limited_refused" });
    return next();
};

export default humanOnly;
