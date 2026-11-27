import { Router } from "express";
import validateBody from "../middlewares/validateBody.js";
import { wallReadLimiter, wallStoneLimiter } from "../middlewares/rateLimiters.js";
import logger from "../../observability/logger.js";
import { createWall } from "../../services/wall.js";
import "../../models/wallStoneSchema.js";
import { wallStoneSchema } from "../../validation/wallSchemas.js";

export const createWallRouter = (wall = createWall()) => {
    const router = Router();

    router.get("/", wallReadLimiter, async (req, res) => {
        try {
            return res.status(200).json(await wall.view(req.query.visitor));
        } catch (error) {
            logger.error({ err: error }, "error reading the wall");
            return res.status(500).json({ message: "Couldn't load the wall." });
        }
    });

    router.post("/stones", wallStoneLimiter, validateBody(wallStoneSchema), async (req, res) => {
        try {
            const result = await wall.setStone(req.body.visitor, req.body.index);
            if (result.status === "set") return res.status(201).json({ index: result.index });
            if (result.status === "already")
                return res.status(409).json({ code: "already_set", index: result.index, message: "This browser has already set its stone." });
            return res.status(409).json({
                code: result.status === "full" ? "wall_full" : "wall_busy",
                message: result.status === "full" ? "The wall is finished." : "Everyone nearby got there first. Try another spot.",
            });
        } catch (error) {
            logger.error({ err: error }, "error setting a wall stone");
            return res.status(500).json({ message: "Couldn't set the stone. Try again." });
        }
    });

    return router;
};
