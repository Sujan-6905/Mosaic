import { z } from "zod";
import { ARROWHEADS } from "../../../shared/canvas/elements/connectors.js";
import { isSafeLink } from "../../../shared/canvas/elements/links.js";
import { FONT_SOURCE_KINDS, isValidFontSource } from "../../../shared/canvas/elements/fontSources.js";
import { isValidIcon } from "../../../shared/canvas/elements/iconPaths.js";

// Every number stays finite and within a range no real board reaches, so a crafted value
// can't break bounds, rendering or the spatial index for everyone else.
const MAX_BOARD_NUMBER = 1e8;
export const boardNumber = z.number().finite().min(-MAX_BOARD_NUMBER).max(MAX_BOARD_NUMBER);

export const pointSchema = z.object({ x: boardNumber, y: boardNumber, pressure: boardNumber.min(0).max(1).optional() });

// A colour token resolves per theme at render time; a literal hex is used as given.
// zIndex is fractional so inserting between two elements needs no reindex.
export const colorTokenSchema = z.string().max(50).nullable().optional();
export const zIndexSchema = boardNumber;
export const rotationSchema = boardNumber;
export const groupIdSchema = z.string().max(100).nullable().optional();
export const frameIdSchema = z.string().max(100).nullable().optional();
export const lockedSchema = z.boolean().optional();

// A link on any element. Only web and mail addresses, so a javascript: URL can
// never reach a collaborator's click.
export const linkSchema = z
    .string()
    .max(2000)
    .refine((value) => isSafeLink(value), "Unsupported link")
    .nullable()
    .optional();
export const strokeStyleSchema = z.enum(["solid", "dashed", "dotted"]).optional();
// Where a non-web-safe fontFamily loads from; only Google Fonts stylesheets and https font files.
export const fontSourceSchema = z
    .object({ kind: z.enum(FONT_SOURCE_KINDS), url: z.string() })
    .refine((source) => isValidFontSource(source, { cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim() }), "Unsupported font source")
    .nullable()
    .optional();
export const fillStyleSchema = z.enum(["solid", "hachure", "crosshatch", "dots", "wash", "grid", "lines", "tiles"]).optional();
// Which styled diagram an element belongs to and what it stands for, so a
// Restyle can read the content back without asking the model again.
const diagramValueSchema = z.union([z.string().max(400), boardNumber, z.boolean(), z.null()]);
export const diagramMetaSchema = z
    .object({
        id: z.string().max(100),
        role: z.enum(["node", "edge", "group", "decor", "ground", "label", "title"]),
        key: z.string().max(200),
        order: boardNumber.optional(),
        recipe: z
            .object({
                structure: z.string().max(60),
                look: z.string().max(60),
                levers: z.record(z.string().max(30), z.union([z.string().max(30), z.boolean()])).optional(),
            })
            .strict()
            .optional(),
        data: z.record(z.string().max(30), diagramValueSchema).optional(),
        tone: z.string().max(20).optional(),
        category: boardNumber.optional(),
    })
    .strict()
    .nullable()
    .optional();
export const shadowSchema = z.enum(["soft", "hard", "long", "glow"]).nullable().optional();
export const iconSchema = z
    .unknown()
    .refine((icon) => isValidIcon(icon), "Unsupported icon")
    .optional();
// Text a shape or arrow carries itself, separate from its stroke `size`.
export const carriedTextFields = {
    text: z.string().max(5000).optional(),
    subtext: z.string().max(1000).optional(),
    fontSize: boardNumber.min(4).max(400).optional(),
    subtextSize: boardNumber.min(4).max(400).optional(),
    fontFamily: z.string().max(100).optional(),
    fontSource: fontSourceSchema,
    fontWeight: z.enum(["normal", "bold"]).optional(),
    fontStyle: z.enum(["normal", "italic"]).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    verticalAlign: z.enum(["top", "middle", "bottom"]).optional(),
    textColor: z.string().max(50).nullable().optional(),
    textColorToken: colorTokenSchema,
    subtextColor: z.string().max(50).nullable().optional(),
};
// The height a note or shape had before its text pushed it taller, so it can
// shrink back as the text does. Null once a person has sized it themselves.
export const autoHeightBaseSchema = boardNumber.nullable().optional();
// Where a connector end meets its target: a fraction of a box, or of an arrow's length.
export const anchorSchema = z
    .union([z.object({ x: boardNumber.min(0).max(1), y: boardNumber.min(0).max(1) }).strict(), z.object({ t: boardNumber.min(0).max(1) }).strict()])
    .nullable()
    .optional();
export const arrowheadSchema = z.enum(ARROWHEADS).optional();

// Which part of a linked repository a diagram element stands for, so a later
// sync can update it in place. Null on anything drawn by hand.
export const moduleIdSchema = z.string().max(300).nullable().optional();
