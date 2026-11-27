// The vocabulary a model may edit with: every operand is a ref or a named relation, edge or axis,
// never a coordinate. Never throws; complaints go back to the model.
import { z } from "zod";
import { MAX_CELL_LENGTH, MAX_TABLE_COLS, MAX_TABLE_ROWS } from "../../../../shared/canvas/elements/table.js";

const refSchema = z.string().min(1).max(80);
const refsSchema = z.array(refSchema).min(1).max(100);

const EDGE_VALUES = ["left", "h-center", "right", "top", "v-center", "bottom"];
const AXIS_VALUES = ["horizontal", "vertical"];
const RELATION_VALUES = ["above", "below", "left-of", "right-of", "inside"];
const REORDER_DIRECTION_VALUES = ["front", "back", "forward", "backward"];
const TIDY_DIRECTION_VALUES = ["top-down", "left-right", "radial"];
export const MOVE_DIRECTION_VALUES = ["left", "right", "up", "down"];
export const MOVE_DISTANCE_VALUES = ["small", "medium", "large"];
export const ADD_KIND_VALUES = ["sticky", "text", "rectangle", "ellipse", "diamond", "table", "icon"];
export const TEXT_SIZE_VALUES = ["small", "medium", "large", "huge"];
export const FONT_VALUES = ["hand", "sans", "serif", "mono"];

// Restyle changes only appearance: opacity and size are style magnitudes, not positions.
const restylePropsSchema = z
    .object({
        color: z.string().max(50).optional(),
        fillColor: z.string().max(50).nullable().optional(),
        opacity: z.number().min(0).max(100).optional(),
        size: z.number().min(0).max(500).optional(),
        font: z.enum(FONT_VALUES).optional(),
    })
    .strict()
    .refine((props) => Object.keys(props).length > 0, { message: "restyle requires at least one property to change" });

const OPERATIONS = {
    align: z.object({ op: z.literal("align"), refs: refsSchema, edge: z.enum(EDGE_VALUES) }).strict(),
    distribute: z.object({ op: z.literal("distribute"), refs: refsSchema, axis: z.enum(AXIS_VALUES) }).strict(),
    place: z
        .object({
            op: z.literal("place"),
            ref: refSchema,
            relation: z.enum(RELATION_VALUES),
            anchorRef: refSchema,
            gap: z.number().min(0).max(2000).optional(),
        })
        .strict(),
    resizeToFit: z.object({ op: z.literal("resizeToFit"), ref: refSchema }).strict(),
    connect: z.object({ op: z.literal("connect"), refA: refSchema, refB: refSchema, label: z.string().max(200).optional() }).strict(),
    disconnect: z.object({ op: z.literal("disconnect"), refA: refSchema, refB: refSchema }).strict(),
    restyle: z.object({ op: z.literal("restyle"), ref: refSchema, props: restylePropsSchema }).strict(),
    setText: z.object({ op: z.literal("setText"), ref: refSchema, text: z.string().max(5000) }).strict(),
    group: z.object({ op: z.literal("group"), refs: refsSchema }).strict(),
    ungroup: z.object({ op: z.literal("ungroup"), ref: refSchema }).strict(),
    duplicate: z.object({ op: z.literal("duplicate"), ref: refSchema, relation: z.enum(RELATION_VALUES), anchorRef: refSchema.optional() }).strict(),
    delete: z.object({ op: z.literal("delete"), refs: refsSchema }).strict(),
    reorder: z.object({ op: z.literal("reorder"), ref: refSchema, direction: z.enum(REORDER_DIRECTION_VALUES) }).strict(),
    moveToFrame: z.object({ op: z.literal("moveToFrame"), ref: refSchema, frameRef: refSchema.nullable() }).strict(),
    tidy: z.object({ op: z.literal("tidy"), refs: refsSchema, direction: z.enum(TIDY_DIRECTION_VALUES) }).strict(),
    add: z
        .object({
            op: z.literal("add"),
            kind: z.enum(ADD_KIND_VALUES),
            text: z.string().max(500),
            relation: z.enum(["above", "below", "left-of", "right-of"]).optional(),
            anchorRef: refSchema.optional(),
            fillColor: z.string().max(50).optional(),
            color: z.string().max(50).optional(),
            textSize: z.enum(TEXT_SIZE_VALUES).optional(),
            rows: z
                .array(z.array(z.string().max(MAX_CELL_LENGTH)).min(1).max(MAX_TABLE_COLS))
                .min(1)
                .max(MAX_TABLE_ROWS)
                .optional(),
        })
        .strict(),
    frame: z.object({ op: z.literal("frame"), refs: refsSchema, name: z.string().max(100) }).strict(),
    lock: z.object({ op: z.literal("lock"), refs: refsSchema }).strict(),
    cleanUp: z.object({ op: z.literal("cleanUp"), refs: refsSchema }).strict(),
    resize: z.object({ op: z.literal("resize"), refs: refsSchema, factor: z.number().min(0.1).max(10) }).strict(),
    move: z.object({ op: z.literal("move"), refs: refsSchema, direction: z.enum(MOVE_DIRECTION_VALUES), distance: z.enum(MOVE_DISTANCE_VALUES) }).strict(),
    rotate: z.object({ op: z.literal("rotate"), refs: refsSchema, degrees: z.number().min(-360).max(360) }).strict(),
    // Built by the server from a sketch model's output, in board coordinates. It is
    // deliberately absent from the schema an edit model answers against.
    drawParts: z
        .object({
            op: z.literal("drawParts"),
            title: z.string().max(120),
            color: z.string().max(50),
            colorToken: z.string().max(50).nullable(),
            parts: z
                .array(
                    z.object({
                        name: z.string().max(60),
                        fill: z.string().max(50).nullable(),
                        strokes: z
                            .array(
                                z.object({
                                    points: z
                                        .array(z.object({ x: z.number(), y: z.number() }))
                                        .min(2)
                                        .max(200),
                                    closed: z.boolean(),
                                    smooth: z.boolean(),
                                }),
                            )
                            .min(1),
                    }),
                )
                .min(1)
                .max(40),
        })
        .strict(),
};

// Operations that create elements. Each claims the next batch ref whether it applies or not, so the
// numbers always match the order the model wrote them in.
export const CREATING_OPERATIONS = new Set(["add", "duplicate", "frame", "drawParts"]);

// What an op creates can be named by later ops in the same batch: new1 for the first creation, new2 next.
const BATCH_REF_PATTERN = /^new([1-9][0-9]?)$/;
export const batchRefIndex = (ref) => {
    const match = BATCH_REF_PATTERN.exec(ref ?? "");
    return match ? Number(match[1]) - 1 : null;
};

export const OPERATION_NAMES = Object.keys(OPERATIONS);
export const SERVER_ONLY_OPERATIONS = ["drawParts"];

const operationSchema = z.discriminatedUnion("op", Object.values(OPERATIONS));
const editBatchSchema = z.object({ ops: z.array(operationSchema).min(1).max(50) });

// { valid: true, ops } or { valid: false, error }, never throwing.
export const validateEditBatch = (rawBatch) => {
    const result = editBatchSchema.safeParse(rawBatch);
    if (!result.success) {
        return {
            valid: false,
            error: result.error.issues.map((issue) => `${issue.path.join(".") || "batch"}: ${issue.message}`).join("; "),
        };
    }
    return { valid: true, ops: result.data.ops };
};
