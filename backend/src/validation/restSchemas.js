import { z } from "zod";
import { elementSchema, elementIdSchema, backgroundSchema } from "./socketSchemas.js";
import { passwordProblem } from "../../../shared/rules/passwordPolicy.js";
import { AGENT_ACCESS, LINK_ACCESS } from "../models/accessControl.js";
import { MAX_IMPORT_ELEMENTS } from "../../../shared/canvas/elements/sceneFile.js";

// The only check before an account is written: the database enforces nothing.
const usernameSchema = z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "usernames may only contain letters, numbers and underscores");
const addPasswordIssue = (password, ctx, context) => {
    const problem = passwordProblem(password, context);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: problem });
};

const newPasswordSchema = z.string().max(200);
const emailSchema = z.string().trim().email().max(254);

const registerSchema = z
    .object({
        username: usernameSchema,
        password: newPasswordSchema,
    })
    .superRefine(({ username, password }, ctx) => addPasswordIssue(password, ctx, { username }));

const loginSchema = z.object({
    username: z.string().trim().min(1).max(30),
    password: z.string().min(1).max(200),
});

const OAUTH_PROVIDERS = ["google", "github"];

// A provider identity as the Next.js server verified it. The email counts only
// when the provider itself says the person proved they own it.
const oauthIdentitySchema = z.object({
    provider: z.enum(OAUTH_PROVIDERS),
    providerAccountId: z.string().trim().min(1).max(200),
    email: emailSchema.nullish(),
    emailVerified: z.boolean().default(false),
    name: z.string().trim().max(100).nullish(),
});

const oauthLoginSchema = oauthIdentitySchema;

const oauthCompleteSchema = oauthIdentitySchema.extend({ username: usernameSchema });

const refreshTokenSchema = z.object({
    refreshToken: z.string().min(20).max(200),
});

const THEME_VALUES = ["light", "dark"];

const updateThemeSchema = z.object({
    theme: z.enum(THEME_VALUES),
});

const changePasswordSchema = z
    .object({
        oldpassword: z.string().min(1).max(200),
        password: newPasswordSchema,
    })
    .superRefine(({ password }, ctx) => addPasswordIssue(password, ctx, {}));

const recoveryCodesSchema = z.object({
    password: z.string().min(1).max(200),
});

const recoverAccountSchema = z
    .object({
        username: z.string().trim().min(1).max(30),
        code: z.string().trim().min(1).max(40),
        password: newPasswordSchema,
    })
    .superRefine(({ username, password }, ctx) => addPasswordIssue(password, ctx, { username }));

const deleteAccountSchema = z.object({
    username: z.string().trim().min(1).max(30),
    password: z.string().max(200).optional(),
});

const shareIdListSchema = z
    .array(
        z
            .string()
            .trim()
            .min(1)
            .max(40)
            .regex(/^[A-Za-z0-9_-]+$/),
    )
    .max(50);

const createPersonalTokenSchema = z.object({
    name: z.string().trim().min(1).max(60),
    scope: z.enum(["read", "write"]),
    boards: shareIdListSchema.optional(),
    days: z.number().int().min(1).max(365).default(90),
});

// An origin allowed to frame a board: https with an optional leading wildcard
// subdomain, or a local address while building a site.
const EMBED_SITE = /^(https:\/\/(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d{1,5})?|http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?)$/;

const boardSettingsSchema = z
    .object({
        linkAccess: z.enum(LINK_ACCESS).optional(),
        agentAccess: z.enum(AGENT_ACCESS).optional(),
        embed: z
            .object({
                enabled: z.boolean(),
                sites: z
                    .array(
                        z
                            .string()
                            .trim()
                            .toLowerCase()
                            .max(200)
                            .regex(EMBED_SITE, "A site is an origin such as https://docs.example.com or https://*.example.com"),
                    )
                    .max(20),
            })
            .optional(),
    })
    .refine((settings) => Object.values(settings).some((value) => value !== undefined), { message: "Nothing to change." });

const createDrawingSchema = z.object({
    title: z.string().trim().min(1).max(200),
});

const updateDrawingTitleSchema = z.object({
    newTitle: z.string().trim().min(1).max(200),
});

const ROLE_VALUES = ["editor", "commenter", "viewer"];

const notificationReadSchema = z.object({
    ids: z
        .array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/))
        .max(100)
        .optional(),
});

const addCollaboratorSchema = z.object({
    username: usernameSchema,
    role: z.enum(ROLE_VALUES),
});

const removeCollaboratorSchema = z.object({
    username: usernameSchema,
});

const updateCollaboratorRoleSchema = z.object({
    username: usernameSchema,
    role: z.enum(ROLE_VALUES),
});

const viewportSchema = z.object({ minX: z.number(), minY: z.number(), maxX: z.number(), maxY: z.number() });
const selectionSchema = z.array(z.string().max(120)).max(200).default([]);

const conversationIdSchema = z.string().trim().min(1).max(100);
const conversationTitleSchema = z.string().trim().min(1).max(80);

const aiTurnSchema = z.object({
    message: z.string().trim().min(1).max(2000),
    conversationId: conversationIdSchema.optional(),
    // Raw element ids, not grounding refs: the client never learns a ref,
    // only the server does (see buildGroundedScene.js's mapElementIdsToRefs).
    selection: selectionSchema,
    viewport: viewportSchema.nullable().optional(),
    // preview: always review. auto: apply low-risk changes, review the rest. direct: for agents
    // with no review surface; applies without review and refuses anything high-risk.
    review: z.enum(["preview", "auto", "direct"]).default("preview"),
    // The ref picked to settle a previous turn's question, re-checked against the live scene.
    clarifiedRef: z.string().min(1).max(80).optional(),
});

const aiEditCommitSchema = z.object({
    token: z.string().min(1).max(100),
    acceptedIndexes: z.array(z.number().int().nonnegative()).max(50).optional(),
    conversationId: conversationIdSchema.optional(),
});

const aiEditRebaseSchema = z.object({
    token: z.string().min(1).max(100),
});

const architectureImportSchema = z.object({
    url: z.string().min(1).max(300),
});

const architectureCompareSchema = z.object({
    target: z.string().min(1).max(300),
});

const aiCatchUpSummarySchema = z.object({
    since: z.string().datetime(),
});

const aiEditRevertSchema = z.object({
    batchId: z.string().min(1).max(100),
    conversationId: conversationIdSchema,
});

const aiConversationCreateSchema = z.object({
    title: conversationTitleSchema.optional(),
});

const aiConversationRenameSchema = z.object({
    title: conversationTitleSchema,
});

const groundingContextSchema = z.object({
    viewport: viewportSchema.nullable().optional(),
    selection: selectionSchema,
});

const groundingResolveSchema = z.object({
    description: z.string().trim().min(1).max(300),
    viewport: viewportSchema.nullable().optional(),
    selection: selectionSchema,
});

// Room for a long stack trace, but bounded: the endpoint is unauthenticated.
const clientErrorSchema = z.object({
    message: z.string().trim().min(1).max(2000),
    stack: z.string().max(8000).optional(),
    componentStack: z.string().max(8000).optional(),
    url: z.string().max(2000).optional(),
    correlationId: z.string().max(200).optional(),
});

const sceneFileSchema = z.object({
    mosaicSceneVersion: z.number().int(),
    elements: z
        .record(elementIdSchema, elementSchema)
        .refine((elements) => Object.keys(elements).length <= MAX_IMPORT_ELEMENTS, { message: `scene exceeds ${MAX_IMPORT_ELEMENTS} elements` }),
    background: backgroundSchema.optional(),
});

const importDrawingSchema = z.object({
    title: z.string().trim().min(1).max(200),
    scene: sceneFileSchema,
});

const createVersionSchema = z.object({
    name: z.string().trim().min(1).max(100),
});

const forkBoardSchema = z.object({
    seq: z.number().int().nonnegative().nullable().optional(),
});

const CATEGORY_SECTIONS = ["owned", "shared"];

const createCategorySchema = z.object({
    section: z.enum(CATEGORY_SECTIONS),
    name: z.string().trim().min(1).max(60),
});

const updateCategorySchema = z.object({
    name: z.string().trim().min(1).max(60).optional(),
    order: z.number().int().nonnegative().optional(),
});

const setBoardOrganizationSchema = z.object({
    categoryId: z.string().min(1).max(100).nullable().optional(),
    favorite: z.boolean().optional(),
});

export {
    usernameSchema,
    shareIdListSchema,
    createPersonalTokenSchema,
    boardSettingsSchema,
    registerSchema,
    loginSchema,
    oauthLoginSchema,
    oauthCompleteSchema,
    refreshTokenSchema,
    updateThemeSchema,
    changePasswordSchema,
    recoveryCodesSchema,
    recoverAccountSchema,
    deleteAccountSchema,
    createDrawingSchema,
    updateDrawingTitleSchema,
    addCollaboratorSchema,
    removeCollaboratorSchema,
    updateCollaboratorRoleSchema,
    aiTurnSchema,
    aiEditCommitSchema,
    aiEditRebaseSchema,
    aiCatchUpSummarySchema,
    architectureImportSchema,
    architectureCompareSchema,
    aiEditRevertSchema,
    aiConversationCreateSchema,
    aiConversationRenameSchema,
    groundingContextSchema,
    notificationReadSchema,
    groundingResolveSchema,
    clientErrorSchema,
    sceneFileSchema,
    importDrawingSchema,
    createVersionSchema,
    forkBoardSchema,
    createCategorySchema,
    updateCategorySchema,
    setBoardOrganizationSchema,
};

export const applyMergeSchema = z.object({
    direction: z.enum(["intoParent", "fromParent"]),
    choices: z.record(z.string().max(100), z.enum(["keep", "take"])).default({}),
    expectedTargetSeq: z.number().int().min(0),
});
