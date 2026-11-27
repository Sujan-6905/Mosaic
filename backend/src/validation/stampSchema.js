import { z } from "zod";
import { STAMP_KIND_IDS } from "../../../shared/canvas/elements/stamps.js";
import { boardNumber, frameIdSchema, groupIdSchema, lockedSchema, rotationSchema, zIndexSchema } from "./elementFieldSchemas.js";

// A reaction dropped on the board, sitting in its own square box.
export const stampElementSchema = z.object({
    type: z.literal("stamp"),
    startX: boardNumber,
    startY: boardNumber,
    endX: boardNumber,
    endY: boardNumber,
    kind: z.enum(STAMP_KIND_IDS),
    opacity: boardNumber.optional(),
    zIndex: zIndexSchema,
    rotation: rotationSchema,
    groupId: groupIdSchema,
    frameId: frameIdSchema,
    locked: lockedSchema,
});
