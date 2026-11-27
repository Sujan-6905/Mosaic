import { z } from "zod";
import { CONNECTOR_ROUTINGS } from "../../../shared/canvas/elements/connectors.js";
import { MAX_STROKE_POINTS } from "../../../shared/canvas/strokes/strokePoints.js";
import { isSafeEmbedUrl } from "../../../shared/canvas/elements/links.js";
import { isHostedUpload } from "../../../shared/canvas/elements/hostedUploads.js";
import { tableElementSchema } from "./tableSchema.js";
import { stampElementSchema } from "./stampSchema.js";
import {
    boardNumber,
    pointSchema,
    colorTokenSchema,
    zIndexSchema,
    rotationSchema,
    groupIdSchema,
    frameIdSchema,
    lockedSchema,
    linkSchema,
    strokeStyleSchema,
    fontSourceSchema,
    fillStyleSchema,
    diagramMetaSchema,
    shadowSchema,
    iconSchema,
    carriedTextFields,
    autoHeightBaseSchema,
    anchorSchema,
    arrowheadSchema,
    moduleIdSchema,
} from "./elementFieldSchemas.js";
import { ownOrigins } from "../http/origins.js";

// nanoid(10) with its default alphabet (A-Za-z0-9_-); bounded generously
// above 10 in case that length ever changes.
const shareIdSchema = z
    .string()
    .min(1)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/);

// `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` client-side -
// just bounded as an opaque string, not parsed.
const elementIdSchema = z.string().min(1).max(100);

const displayNameSchema = z.string().max(100).optional();

// Server-stamped fields (version, updatedBy) are added after validation, never accepted.
const pathElementSchema = z.object({
    type: z.literal("path"),
    points: z.array(pointSchema).min(1).max(MAX_STROKE_POINTS),
    color: z.string().max(50),
    colorToken: colorTokenSchema,
    fillColor: z.string().max(50).nullable().optional(),
    label: z.string().max(60).optional(),
    sketchId: z.string().max(100).optional(),
    sketchTitle: z.string().max(120).optional(),
    size: boardNumber,
    opacity: boardNumber,
    style: z.string().max(50).optional(),
    pressure: boardNumber.min(0).max(1).optional(),
    steadying: boardNumber.min(0).max(1).optional(),
    timestamp: z.number().optional(),
    link: linkSchema,
    zIndex: zIndexSchema,
    rotation: rotationSchema,
    groupId: groupIdSchema,
    frameId: frameIdSchema,
    diagram: diagramMetaSchema,
    locked: lockedSchema,
});

const shapeElementSchema = z.object({
    type: z.literal("shape"),
    moduleId: moduleIdSchema,
    shapeType: z.string().max(50),
    startX: boardNumber,
    startY: boardNumber,
    endX: boardNumber,
    endY: boardNumber,
    color: z.string().max(50),
    colorToken: colorTokenSchema,
    fillColor: z.string().max(50).nullable().optional(),
    fillColorToken: colorTokenSchema,
    fillStyle: fillStyleSchema,
    strokeStyle: strokeStyleSchema,
    cornerRadius: boardNumber.min(0).max(1000).optional(),
    roughness: boardNumber.min(0).max(3).optional(),
    autoHeightBase: autoHeightBaseSchema,
    rings: z
        .array(z.array(z.object({ x: boardNumber, y: boardNumber }).strict()).max(4000))
        .max(64)
        .optional(),
    shadow: shadowSchema,
    shadowColor: z.string().max(50).nullable().optional(),
    textInsetLeft: boardNumber.min(0).max(400).optional(),
    textInsetTop: boardNumber.min(0).max(400).optional(),
    icon: iconSchema,
    diagram: diagramMetaSchema,
    link: linkSchema,
    ...carriedTextFields,
    size: boardNumber,
    opacity: boardNumber,
    zIndex: zIndexSchema,
    rotation: rotationSchema,
    groupId: groupIdSchema,
    frameId: frameIdSchema,
    locked: lockedSchema,
});

// x/y is the top-left corner; width drives wrapping and height is derived when drawn.
const textElementSchema = z.object({
    type: z.literal("text"),
    moduleId: moduleIdSchema,
    x: boardNumber,
    y: boardNumber,
    width: boardNumber,
    text: z.string().max(5000),
    autoWidth: z.boolean().optional(),
    opacity: boardNumber.optional(),
    link: linkSchema,
    color: z.string().max(50),
    colorToken: colorTokenSchema,
    size: boardNumber,
    fontFamily: z.string().max(100).optional(),
    fontSource: fontSourceSchema,
    fontWeight: z.enum(["normal", "bold"]).optional(),
    fontStyle: z.enum(["normal", "italic"]).optional(),
    underline: z.boolean().optional(),
    strikethrough: z.boolean().optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    zIndex: zIndexSchema,
    rotation: rotationSchema,
    groupId: groupIdSchema,
    frameId: frameIdSchema,
    diagram: diagramMetaSchema,
    locked: lockedSchema,
});

// Same box-plus-block-formatting model as text, with a filled paper colour
// behind it: the note itself is the box, not a separate shape underneath.
const stickyElementSchema = z.object({
    type: z.literal("sticky"),
    x: boardNumber,
    y: boardNumber,
    width: boardNumber,
    height: boardNumber,
    autoHeightBase: autoHeightBaseSchema,
    text: z.string().max(5000),
    opacity: boardNumber.optional(),
    link: linkSchema,
    color: z.string().max(50),
    colorToken: colorTokenSchema,
    fillColor: z.string().max(50),
    fillColorToken: colorTokenSchema,
    size: boardNumber,
    fontFamily: z.string().max(100).optional(),
    fontSource: fontSourceSchema,
    fontWeight: z.enum(["normal", "bold"]).optional(),
    fontStyle: z.enum(["normal", "italic"]).optional(),
    underline: z.boolean().optional(),
    strikethrough: z.boolean().optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    zIndex: zIndexSchema,
    rotation: rotationSchema,
    groupId: groupIdSchema,
    frameId: frameIdSchema,
    diagram: diagramMetaSchema,
    locked: lockedSchema,
});

// A frame uses a shape's box, so shape geometry applies unchanged. Children carry its id in frameId.
const frameElementSchema = z.object({
    type: z.literal("frame"),
    startX: boardNumber,
    startY: boardNumber,
    endX: boardNumber,
    endY: boardNumber,
    name: z.string().max(100),
    moduleId: moduleIdSchema,
    fillColor: z.string().max(50).nullable().optional(),
    fillColorToken: colorTokenSchema,
    strokeStyle: strokeStyleSchema,
    link: linkSchema,
    color: z.string().max(50),
    colorToken: colorTokenSchema,
    zIndex: zIndexSchema,
    rotation: rotationSchema,
    groupId: groupIdSchema,
    frameId: frameIdSchema,
    diagram: diagramMetaSchema,
    locked: lockedSchema,
});

// A null binding is a free end. Bound ends still store real coordinates, kept current by the client.
const connectorElementSchema = z.object({
    type: z.literal("connector"),
    moduleId: moduleIdSchema,
    startX: boardNumber,
    startY: boardNumber,
    endX: boardNumber,
    endY: boardNumber,
    startElementId: elementIdSchema.nullable(),
    endElementId: elementIdSchema.nullable(),
    waypoints: z
        .array(z.object({ x: boardNumber, y: boardNumber }).strict())
        .max(64)
        .nullable()
        .optional(),
    color: z.string().max(50),
    colorToken: colorTokenSchema,
    size: boardNumber,
    opacity: boardNumber,
    arrowStart: z.boolean(),
    arrowEnd: z.boolean(),
    startHead: arrowheadSchema,
    endHead: arrowheadSchema,
    routing: z.enum(CONNECTOR_ROUTINGS).optional(),
    elbowBias: boardNumber.min(0).max(1).optional(),
    startAnchor: anchorSchema,
    endAnchor: anchorSchema,
    strokeStyle: strokeStyleSchema,
    roughness: boardNumber.min(0).max(3).optional(),
    link: linkSchema,
    text: z.string().max(200).optional(),
    labelStyle: z.enum(["pill", "tag"]).optional(),
    labelFill: z.string().max(50).nullable().optional(),
    cornerRadius: boardNumber.min(0).max(200).optional(),
    diagram: diagramMetaSchema,
    labelT: boardNumber.min(0).max(1).optional(),
    labelOffset: boardNumber.optional(),
    fontSize: boardNumber.min(4).max(400).optional(),
    fontFamily: z.string().max(100).optional(),
    fontSource: fontSourceSchema,
    zIndex: zIndexSchema,
    rotation: rotationSchema,
    groupId: groupIdSchema,
    frameId: frameIdSchema,
    locked: lockedSchema,
});

// Same bounding box as a shape; src is the image's own upload (Cloudinary's
// secure_url), so the backend never receives or stores image bytes itself.
const imageElementSchema = z.object({
    type: z.literal("image"),
    startX: boardNumber,
    startY: boardNumber,
    endX: boardNumber,
    endY: boardNumber,
    src: z
        .string()
        .max(2000)
        .refine((src) => isHostedUpload(src, "image", { cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim() }), {
            message: "images load from the app's own uploads only",
        }),
    publicId: z.string().max(300).optional(),
    link: linkSchema,
    opacity: boardNumber,
    zIndex: zIndexSchema,
    rotation: rotationSchema,
    groupId: groupIdSchema,
    frameId: frameIdSchema,
    locked: lockedSchema,
});

// A live web page on the board. `url` is what the frame loads, so it must be
// plain https; the board itself can never be framed inside itself this way.
const embedElementSchema = z.object({
    type: z.literal("embed"),
    startX: boardNumber,
    startY: boardNumber,
    endX: boardNumber,
    endY: boardNumber,
    url: z
        .string()
        .max(2000)
        .refine((value) => isSafeEmbedUrl(value, ownOrigins()), "Unsupported embed address"),
    title: z.string().max(200).optional(),
    opacity: boardNumber.optional(),
    zIndex: zIndexSchema,
    rotation: rotationSchema,
    groupId: groupIdSchema,
    frameId: frameIdSchema,
    locked: lockedSchema,
});

// Picked by `type`, so a bad element is reported against its own fields.
const elementSchema = z.discriminatedUnion("type", [
    pathElementSchema,
    shapeElementSchema,
    textElementSchema,
    stickyElementSchema,
    frameElementSchema,
    connectorElementSchema,
    imageElementSchema,
    embedElementSchema,
    tableElementSchema,
    stampElementSchema,
]);

// Grids draw with the `canvas-grid` token, `solid` takes any palette token, `blank` ignores it.
const backgroundSchema = z.object({
    type: z.enum(["blank", "dot", "square", "lined", "isometric", "solid"]),
    colorToken: z.string().max(50).nullable().optional(),
});

const updateBackgroundSchema = z.object({
    shareId: shareIdSchema,
    background: backgroundSchema,
});

// An element anchor follows that element's live bounds, so the comment never needs rewriting.
const commentAnchorSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("point"), x: boardNumber, y: boardNumber }),
    z.object({ type: z.literal("element"), elementId: elementIdSchema }),
]);

// The server re-checks every mentioned id against the board's collaborators before saving,
// so a tampered payload can't reach or reveal a non-collaborator.
const mentionsSchema = z.array(z.string().min(1).max(100)).max(20).default([]);

const commentIdSchema = z.string().min(1).max(100);

const addCommentSchema = z.object({
    shareId: shareIdSchema,
    anchor: commentAnchorSchema,
    text: z.string().trim().min(1).max(2000),
    mentions: mentionsSchema,
});

const addCommentReplySchema = z.object({
    shareId: shareIdSchema,
    commentId: commentIdSchema,
    text: z.string().trim().min(1).max(2000),
    mentions: mentionsSchema,
});

const resolveCommentSchema = z.object({
    shareId: shareIdSchema,
    commentId: commentIdSchema,
    resolved: z.boolean(),
});

const markCommentReadSchema = z.object({
    shareId: shareIdSchema,
    commentId: commentIdSchema,
});

const moveCommentSchema = z.object({
    shareId: shareIdSchema,
    commentId: commentIdSchema,
    anchor: commentAnchorSchema,
});

const deleteCommentSchema = z.object({
    shareId: shareIdSchema,
    commentId: commentIdSchema,
});

// A participant's camera, for followers and off-screen indicators. Never persisted.
const cameraMoveSchema = z.object({
    shareId: shareIdSchema,
    x: boardNumber,
    y: boardNumber,
    zoom: boardNumber.min(0.01).max(100),
});

const presentationUpdateSchema = z.object({
    shareId: shareIdSchema,
    presenting: z.boolean(),
});

const followUpdateSchema = z.object({
    shareId: shareIdSchema,
    targetSocketId: z.string().max(100).nullable(),
});

// A full-length stroke of rounded points (about 40 bytes each) fits with room to spare.
const MAX_ELEMENT_BYTES = 512 * 1024;

const joinRoomSchema = z.object({
    shareId: shareIdSchema,
    name: displayNameSchema,
});

const cursorMoveSchema = z.object({
    shareId: shareIdSchema,
    x: boardNumber,
    y: boardNumber,
});

// Relayed to the room for the length of the gesture, never persisted.
const laserPointSchema = z.object({
    shareId: shareIdSchema,
    x: boardNumber,
    y: boardNumber,
});

// Base64 Yjs updates relayed only to others editing the same element, never persisted; the
// text itself lands through updateCanvas when the editor closes. An editor that has just opened
// asks for the text as others have it (wantsState), and they answer with their whole state (isState).
const textSyncSchema = z.object({
    shareId: shareIdSchema,
    elementId: elementIdSchema,
    update: z.string().min(1).max(200000),
    wantsState: z.boolean().optional(),
    isState: z.boolean().optional(),
});

// Positive integer: the op-log sequence a version-history restore targets.
const opSeqSchema = z.number().int().nonnegative();

const restoreVersionSchema = z.object({
    shareId: shareIdSchema,
    seq: opSeqSchema,
});

const clearBoardSchema = z.object({
    shareId: shareIdSchema,
});

const updateCanvasSchema = z
    .object({
        shareId: shareIdSchema,
        operation: z.enum(["insert", "update", "delete", "undo", "redo"]),
        elementId: elementIdSchema,
        element: elementSchema.optional(),
        // An agent's tool call, so its changes can be listed and undone together.
        turnId: z.string().uuid().optional(),
        // On an update, the fields the sender changed; the rest stay as the room has them.
        // "cells.4" names one entry of a table's cells.
        changed: z
            .array(z.string().regex(/^[A-Za-z][A-Za-z0-9]{0,39}(\.\d{1,4})?$/))
            .max(80)
            .optional(),
    })
    .refine((data) => (["insert", "update", "redo"].includes(data.operation) ? data.element !== undefined : true), {
        message: "element is required for insert/update/redo operations",
        path: ["element"],
    })
    .refine((data) => data.element === undefined || Buffer.byteLength(JSON.stringify(data.element)) <= MAX_ELEMENT_BYTES, {
        message: `element exceeds ${MAX_ELEMENT_BYTES} bytes`,
        path: ["element"],
    });

export {
    joinRoomSchema,
    cursorMoveSchema,
    laserPointSchema,
    textSyncSchema,
    updateCanvasSchema,
    backgroundSchema,
    updateBackgroundSchema,
    addCommentSchema,
    addCommentReplySchema,
    resolveCommentSchema,
    markCommentReadSchema,
    moveCommentSchema,
    deleteCommentSchema,
    cameraMoveSchema,
    presentationUpdateSchema,
    followUpdateSchema,
    restoreVersionSchema,
    clearBoardSchema,
    elementSchema,
    elementIdSchema,
    MAX_ELEMENT_BYTES,
};
