import { z } from "zod";
import { elementIdSchema, elementSchema } from "./socketSchemas.js";

const MAX_ELEMENTS_PER_PIECE = 500;
export const MAX_PIECES_PER_SET = 200;

const titleSchema = z.string().trim().min(1).max(60);

// Every element is checked exactly as a live board edit would be, so a piece
// can't carry anything onto a board that the board itself would refuse.
const pieceElementsSchema = z
    .record(elementIdSchema, elementSchema)
    .refine((elements) => Object.keys(elements).length > 0, "A piece needs at least one element")
    .refine((elements) => Object.keys(elements).length <= MAX_ELEMENTS_PER_PIECE, `A piece holds at most ${MAX_ELEMENTS_PER_PIECE} elements`);

export const newPieceSchema = z.object({ name: titleSchema, elements: pieceElementsSchema });

export const createPieceSetSchema = z.object({
    title: titleSchema,
    description: z.string().trim().max(300).optional(),
    pieces: z.array(newPieceSchema).max(MAX_PIECES_PER_SET).optional(),
});

// Licences a gallery set can be offered under: what someone installing it may do with it.
const PIECE_LICENSES = ["CC0-1.0", "CC-BY-4.0", "MIT"];
const tagSchema = z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(24)
    .regex(/^[a-z0-9][a-z0-9 -]*$/, "Tags use letters, numbers, spaces and dashes");

export const updatePieceSetSchema = z
    .object({
        title: titleSchema.optional(),
        description: z.string().trim().max(300).optional(),
        published: z.boolean().optional(),
        listed: z.boolean().optional(),
        tags: z.array(tagSchema).max(5).optional(),
        license: z.enum(PIECE_LICENSES).optional(),
    })
    .refine((patch) => !patch.listed || patch.license, "Choose a licence to list a set in the gallery")
    .refine((patch) => Object.keys(patch).length > 0, "Nothing to change");
