import { z } from "zod";
import { MAX_CELL_LENGTH, MAX_TABLE_COLS, MAX_TABLE_ROWS, TABLE_STYLES } from "../../../shared/canvas/elements/table.js";
import {
    boardNumber,
    colorTokenSchema,
    fontSourceSchema,
    frameIdSchema,
    groupIdSchema,
    linkSchema,
    lockedSchema,
    rotationSchema,
    zIndexSchema,
} from "./elementFieldSchemas.js";

// Rows and columns of words in one box; `cells` lists them row by row and
// always holds exactly rows x cols entries.
export const tableElementSchema = z
    .object({
        type: z.literal("table"),
        startX: boardNumber,
        startY: boardNumber,
        endX: boardNumber,
        endY: boardNumber,
        rows: z.number().int().min(1).max(MAX_TABLE_ROWS),
        cols: z.number().int().min(1).max(MAX_TABLE_COLS),
        cells: z.array(z.string().max(MAX_CELL_LENGTH)).max(MAX_TABLE_ROWS * MAX_TABLE_COLS),
        headerRow: z.boolean().optional(),
        tableStyle: z.enum(TABLE_STYLES).optional(),
        color: z.string().max(50),
        colorToken: colorTokenSchema,
        fillColor: z.string().max(50).nullable().optional(),
        fillColorToken: colorTokenSchema,
        size: boardNumber,
        fontFamily: z.string().max(100).optional(),
        fontSource: fontSourceSchema,
        fontWeight: z.enum(["normal", "bold"]).optional(),
        fontStyle: z.enum(["normal", "italic"]).optional(),
        align: z.enum(["left", "center", "right"]).optional(),
        opacity: boardNumber.optional(),
        link: linkSchema,
        zIndex: zIndexSchema,
        rotation: rotationSchema,
        groupId: groupIdSchema,
        frameId: frameIdSchema,
        locked: lockedSchema,
    })
    .refine((table) => table.cells.length === table.rows * table.cols, { message: "a table needs one cell per row and column", path: ["cells"] });
