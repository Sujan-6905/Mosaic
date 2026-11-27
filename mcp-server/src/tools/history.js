import { z } from "zod";
import { json, shareIdField } from "./common.js";

const directionField = z
    .enum(["intoParent", "fromParent"])
    .describe("intoParent carries the branch's changes back to the board it came from; fromParent brings the parent's newer changes into the branch");

const conflictSummary = (conflict) => ({
    id: conflict.id,
    kind: conflict.kind,
    label: conflict.label,
    fields: conflict.parts,
});

export const registerHistoryTools = (server, { backend, boards }) => {
    server.registerTool(
        "list_versions",
        {
            title: "List versions",
            description: "List a board's version history, newest first: automatic checkpoints and named versions, each with the seq number that identifies it.",
            inputSchema: { shareId: shareIdField },
        },
        async ({ shareId }) => json(await backend.listVersions(shareId)),
    );

    server.registerTool(
        "preview_version",
        {
            title: "Preview a version",
            description: "Read a board exactly as it was at a version's seq, without changing anything.",
            inputSchema: { shareId: shareIdField, seq: z.number().int().min(0) },
        },
        async ({ shareId, seq }) => {
            const state = await backend.previewVersion(shareId, seq);
            return json({ seq, background: state.background, elementCount: Object.keys(state.elements ?? {}).length, elements: state.elements });
        },
    );

    server.registerTool(
        "save_version",
        {
            title: "Save a named version",
            description: "Name the board's current state as a version, so it can be found and restored later.",
            inputSchema: { shareId: shareIdField, name: z.string().min(1).max(100) },
        },
        async ({ shareId, name }) => json(await backend.saveVersion(shareId, name)),
    );

    server.registerTool(
        "restore_version",
        {
            title: "Restore a version",
            description:
                "Bring the board back to how it was at a version's seq. Restoring is itself a new change: it lands in history and every collaborator sees it live, " +
                "so nothing after that version is lost.",
            inputSchema: { shareId: shareIdField, seq: z.number().int().min(0) },
        },
        async ({ shareId, seq }) => json({ restoredTo: seq, elementsChanged: await boards.get(shareId).restoreVersion(seq) }),
    );

    server.registerTool(
        "branch_board",
        {
            title: "Branch a board",
            description:
                "Make a branch: a new board copied from this one (now, or at a version's seq) that can later be merged back with preview_merge and apply_merge.",
            inputSchema: { shareId: shareIdField, seq: z.number().int().min(0).optional().describe("Branch from this version instead of now") },
        },
        async ({ shareId, seq }) => json(await backend.branchBoard(shareId, seq ?? null)),
    );

    server.registerTool(
        "list_branches",
        {
            title: "List branches",
            description: "List the branches made from a board.",
            inputSchema: { shareId: shareIdField },
        },
        async ({ shareId }) => json(await backend.listBranches(shareId)),
    );

    server.registerTool(
        "preview_merge",
        {
            title: "Preview a merge",
            description:
                "Work out a three-way merge between a branch and the board it came from without changing either. Returns the changes that apply cleanly, " +
                "the conflicts (where both sides changed the same thing) that need a keep or take choice, new overlaps, and the targetSeq apply_merge needs.",
            inputSchema: { shareId: shareIdField.describe("The branch's shareId"), direction: directionField },
        },
        async ({ shareId, direction }) => {
            const preview = await backend.previewMerge(shareId, direction);
            return json({
                direction,
                target: { shareId: preview.target.shareId, title: preview.target.title },
                source: preview.source,
                counts: preview.counts,
                conflicts: preview.conflicts.map(conflictSummary),
                overlaps: preview.overlaps,
                approximateBase: preview.approximateBase,
                targetSeq: preview.targetSeq,
            });
        },
    );

    server.registerTool(
        "apply_merge",
        {
            title: "Apply a merge",
            description:
                "Apply a previewed merge. Pass the targetSeq preview_merge returned; if the receiving board changed since, the merge is refused so nothing unseen is merged. " +
                "For each conflict id, choose keep (the receiving board's version) or take (the incoming version); unchosen conflicts keep.",
            inputSchema: {
                shareId: shareIdField.describe("The branch's shareId"),
                direction: directionField,
                expectedTargetSeq: z.number().int().min(0),
                choices: z.record(z.string(), z.enum(["keep", "take"])).optional(),
            },
        },
        async ({ shareId, direction, expectedTargetSeq, choices = {} }) => json(await backend.applyMerge(shareId, { direction, expectedTargetSeq, choices })),
    );

    server.registerTool(
        "list_agent_activity",
        {
            title: "List agent activity",
            description:
                "What agents have done on a board, newest first, one entry per tool call: which agent, for whom, when, and how many elements it added, changed or removed.",
            inputSchema: { shareId: shareIdField },
        },
        async ({ shareId }) => json((await backend.agentActivity(shareId)).turns),
    );

    server.registerTool(
        "undo_agent_turn",
        {
            title: "Undo an agent turn",
            description:
                "Put back every element one agent tool call changed, as it was before that call. Elements someone changed afterwards are left alone and listed as skipped. " +
                "Get the turnId from list_agent_activity.",
            inputSchema: { shareId: shareIdField, turnId: z.string().uuid() },
        },
        async ({ shareId, turnId }) => json(await backend.undoAgentTurn(shareId, turnId)),
    );
};
