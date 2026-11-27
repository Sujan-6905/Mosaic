import { z } from "zod";
import { isVisitorId } from "../services/wall.js";
import { WALL_SIZE } from "../../../shared/rules/landingWall.js";

export const wallStoneSchema = z.object({
    visitor: z.string().refine(isVisitorId, "Not a visitor id"),
    index: z
        .number()
        .int()
        .min(0)
        .max(WALL_SIZE - 1)
        .optional(),
});
