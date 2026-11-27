import { nullIfMissing } from "../../db/errors.js";
import Drawing from "../../models/drawingSchema.js";
import { nanoid } from "nanoid";
import { SearchConsistency, getDefaultInstance } from "ottoman";
import { ROLES, getRole, isFullSignIn, isSwept } from "../../models/accessControl.js";
import logger from "../../observability/logger.js";
import { getUserOrganizationMap } from "./organizationController.js";
import { indexBoardForSearchSafely } from "../../search/indexBoard.js";
import { findDrawingByShareId, findUserById, findDrawingsSharedWithUser } from "../../services/boards.js";

// Enough to decide access and name a board, without its elements.
const SUMMARY_FIELDS = ["shareId", "title", "owner", "collaborators", "linkAccess", "agentAccess", "createdAt"];

// What the boards list shows: the summary, when it last changed, and its thumbnail.
const LIST_FIELDS = [...SUMMARY_FIELDS, "_id", "updatedAt", "background", "preview", "deletedAt"];

// Every board the caller may open, narrowed by any board limit or agent setting on their credential,
// and the boards they swept away that can still be put back. Read at request_plus so a page loaded right
// after a delete, star or share already reflects it.
const listAccessibleDrawings = async (principal, { fields = SUMMARY_FIELDS } = {}) => {
    const select = [...new Set([...fields, "deletedAt"])];
    const [{ rows: owned }, shared] = await Promise.all([
        Drawing.find({ owner: principal.userId }, { sort: { createdAt: "DESC" }, select, consistency: SearchConsistency.GLOBAL }),
        findDrawingsSharedWithUser(principal.userId, select),
    ]);
    const reachable = (drawing) => getRole(drawing, principal) !== null;
    const swept = isFullSignIn(principal) ? owned.filter(isSwept) : [];
    return { owned: owned.filter(reachable), shared: shared.filter(reachable), swept };
};

const createDrawing = async (req, res) => {
    try {
        const { title } = req.body;
        // The owner is always the caller, never a client-supplied id.
        const { userId } = req.user;

        const shareId = nanoid(10);

        const newDrawing = await Drawing.createDrawing({
            title,
            shareId,
            ownerId: userId,
        });
        // Indexed now, or a board with no edits would never be searchable.
        indexBoardForSearchSafely(shareId, {});

        return res.status(200).json({ message: "Drawing created successfully", data: newDrawing });
    } catch (error) {
        logger.error({ err: error }, "error creating drawing");
        return res.status(500).json({ message: "Internal server error." });
    }
};

// Overlays this person's private category and star on each board.
const withOrganization = (drawings, organizationByShareId) =>
    drawings.map((drawing) => ({
        ...drawing,
        categoryId: organizationByShareId[drawing.shareId]?.categoryId ?? null,
        favorite: organizationByShareId[drawing.shareId]?.favorite ?? false,
    }));

// A board saved before previews existed gets one the first time it is listed.
const withPreview = async (drawing) => {
    let { preview, ...listed } = drawing;
    if (!preview) {
        const full = await nullIfMissing(() => Drawing.findById(drawing._id));
        preview = full ? await Drawing.writePreview(drawing._id, full.elements ?? {}) : { count: 0, elements: {} };
    }
    return { ...listed, previewElements: preview.elements, elementCount: preview.count };
};

const getDrawings = async (req, res) => {
    try {
        const [{ owned, shared, swept }, organizationByShareId] = await Promise.all([
            listAccessibleDrawings(req.user, { fields: LIST_FIELDS }),
            getUserOrganizationMap(req.user.userId),
        ]);
        const [ownedListed, sharedListed, sweptListed] = await Promise.all([owned, shared, swept].map((boards) => Promise.all(boards.map(withPreview))));

        const data = {
            ownedDrawings: withOrganization(ownedListed, organizationByShareId),
            sharedWithDrawings: withOrganization(sharedListed, organizationByShareId),
            sweptDrawings: withOrganization(sweptListed, organizationByShareId),
        };

        return res.status(200).json({
            message: "drawings owned or accessible by the user fetched successfully",
            data,
        });
    } catch (error) {
        logger.error({ err: error, userId: req.user?.userId }, "error getting drawings");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const ACTIVITY_LIMIT = 4;

// Others' comments on boards this person can reach, and boards newly shared with them,
// dated by the collaborator entry's addedAt.
const getActivity = async (req, res) => {
    try {
        const { userId } = req.user;
        const since = new Date(req.query.since);
        if (Number.isNaN(since.getTime())) {
            return res.status(400).json({ message: "since must be a date" });
        }
        const sinceIso = since.toISOString();

        const { owned, shared } = await listAccessibleDrawings(req.user);
        const titleByShareId = new Map([...owned, ...shared].map((drawing) => [drawing.shareId, drawing.title]));
        if (titleByShareId.size === 0) return res.status(200).json({ data: [] });

        const { rows: comments } = await getDefaultInstance().query(
            `SELECT c.authorName, c.shareId, c.createdAt
             FROM \`${process.env.CB_BUCKET_NAME}\`.\`app\`.\`comments\` AS c
             WHERE c.shareId IN $shareIds AND c.authorId != $userId AND c.createdAt > $since
             ORDER BY c.createdAt DESC
             LIMIT ${ACTIVITY_LIMIT}`,
            { parameters: { shareIds: [...titleByShareId.keys()], userId, since: sinceIso } },
        );

        const newShares = shared
            .map((drawing) => ({ drawing, addedAt: drawing.collaborators.find((c) => c.userId === userId)?.addedAt }))
            .filter(({ addedAt }) => addedAt && addedAt > sinceIso);
        const owners = await Promise.all([...new Set(newShares.map(({ drawing }) => drawing.owner))].map((ownerId) => findUserById(ownerId)));
        const ownerNameById = new Map(owners.filter(Boolean).map((owner) => [String(owner._id), owner.username]));

        const items = [
            ...comments.map((comment) => ({
                kind: "comment",
                actor: comment.authorName,
                shareId: comment.shareId,
                title: titleByShareId.get(comment.shareId),
                at: comment.createdAt,
            })),
            ...newShares.map(({ drawing, addedAt }) => ({
                kind: "shared",
                actor: ownerNameById.get(drawing.owner) || "Someone",
                shareId: drawing.shareId,
                title: drawing.title,
                at: addedAt,
            })),
        ]
            .sort((left, right) => (left.at < right.at ? 1 : -1))
            .slice(0, ACTIVITY_LIMIT);

        return res.status(200).json({ data: items });
    } catch (error) {
        logger.error({ err: error, userId: req.user?.userId }, "error getting activity");
        return res.status(500).json({ message: "Internal server error." });
    }
};

// Older boards stored a missing parent as the text "null". Embedding rules are the owner's alone.
const boardForCaller = (drawing, role) => {
    const { embed, parentShareId, ...board } = { ...drawing };
    return {
        ...board,
        parentShareId: parentShareId && parentShareId !== "null" ? parentShareId : null,
        ...(role === ROLES.OWNER ? { embed } : {}),
    };
};

const getDrawingById = async (req, res) => {
    try {
        const { shareId } = req.params;

        const drawing = await findDrawingByShareId(shareId);

        if (!drawing) {
            return res.status(404).json({ message: "drawing not found" });
        }

        const role = drawing.getRole(req.user);
        if (!role) {
            return res.status(403).json({ message: "access forbidden" });
        }

        return res.status(200).json({ message: "drawing fetched successfully", data: boardForCaller(drawing, role) });
    } catch (error) {
        logger.error({ err: error, shareId: req.params?.shareId }, "error getting drawing by shareId");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const updateDrawingTitle = async (req, res) => {
    try {
        const { drawingId } = req.params;
        const { newTitle } = req.body;

        await Drawing.writeFields(drawingId, { title: newTitle });

        return res.status(200).json({ message: "drawing title updated successfully" });
    } catch (error) {
        logger.error({ err: error, drawingId: req.params?.drawingId }, "error updating drawing title");
        return res.status(500).json({ message: "Internal server error." });
    }
};

export { createDrawing, getDrawings, getActivity, getDrawingById, listAccessibleDrawings, updateDrawingTitle };
