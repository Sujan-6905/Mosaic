import { nullIfMissing } from "../../db/errors.js";
import Drawing from "../../models/drawingSchema.js";
import User from "../../models/userSchema.js";
import BoardVisit from "../../models/boardVisitSchema.js";
import { findUserByUsername } from "./authController.js";
import { getDefaultInstance } from "ottoman";
import { ROLES } from "../../models/accessControl.js";
import logger from "../../observability/logger.js";
import { enforceLiveAccess } from "../../services/liveAccess.js";
import { notify } from "../../services/notifications.js";
import { getUsername } from "../../services/boards.js";
import { markFirst } from "../../services/userActivity.js";

const findDrawingByShareId = (shareId) => nullIfMissing(() => Drawing.findOne({ shareId }));

const findUserById = (userId) => nullIfMissing(() => User.findById(userId));

// checkDeleteAccess has already loaded req.drawing and confirmed the caller owns it.
const addCollaborator = async (req, res) => {
    try {
        const { username, role } = req.body;
        const { drawing } = req;

        logger.info({ shareId: req.params.shareId, role }, "add collaborator requested");

        const userToAdd = await findUserByUsername(username);
        if (!userToAdd) {
            return res.status(404).json({ message: "User with this username not found." });
        }

        if (drawing.owner === userToAdd._id) {
            return res.status(409).json({ message: "User is already the owner." });
        }

        const existingIndex = drawing.collaborators.findIndex((c) => c.userId === userToAdd._id);
        const isRoleChange = existingIndex >= 0;
        if (isRoleChange) {
            drawing.collaborators[existingIndex] = { ...drawing.collaborators[existingIndex], role };
        } else {
            drawing.collaborators.push({ userId: userToAdd._id, role, addedAt: new Date().toISOString() });
        }
        await Drawing.writeFields(drawing._id, { collaborators: drawing.collaborators });

        if (isRoleChange) await enforceLiveAccess(drawing);
        else {
            markFirst(req.user.userId, "firstShare");
            await notify(userToAdd._id, {
                kind: "shared",
                shareId: drawing.shareId,
                boardTitle: drawing.title,
                actorId: req.user.userId,
                actorName: await getUsername(req.user.userId),
                preview: role,
            });
        }

        return res.status(200).json({ message: "Collaborator added successfully." });
    } catch (error) {
        logger.error({ err: error }, "error adding collaborator");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const lastSeenByUserFor = async (shareId) => {
    try {
        const { rows } = await BoardVisit.find({ shareId });
        return new Map(rows.map((visit) => [visit.userId, visit.lastSeenAt]));
    } catch (error) {
        logger.warn({ err: error, shareId }, "failed to read last seen");
        return new Map();
    }
};

// checkDeleteAccess has already fetched the drawing and confirmed ownership -
// req.drawing is that same document, not re-fetched here.
const removeCollaborator = async (req, res) => {
    try {
        const { username } = req.body;
        const { drawing } = req;

        const userToRemove = await findUserByUsername(username);
        if (!userToRemove) {
            return res.status(404).json({ message: "User with this username not found." });
        }

        const updatedCollaborators = drawing.collaborators.filter((c) => c.userId !== userToRemove._id);
        await Drawing.writeFields(drawing._id, { collaborators: updatedCollaborators });

        await enforceLiveAccess({ ...drawing, collaborators: updatedCollaborators });

        return res.status(200).json({ message: "Collaborator removed successfully." });
    } catch (error) {
        logger.error({ err: error }, "error removing collaborator");
        return res.status(500).json({ message: "Internal server error." });
    }
};

// The owner changes an existing collaborator's role; unlike addCollaborator, this never invites.
const updateCollaboratorRole = async (req, res) => {
    try {
        const { username, role } = req.body;
        const { drawing } = req;

        const userToUpdate = await findUserByUsername(username);
        if (!userToUpdate) {
            return res.status(404).json({ message: "User with this username not found." });
        }

        const existingIndex = drawing.collaborators.findIndex((c) => c.userId === userToUpdate._id);
        if (existingIndex < 0) {
            return res.status(404).json({ message: "User is not a collaborator on this drawing." });
        }

        drawing.collaborators[existingIndex] = { ...drawing.collaborators[existingIndex], role };
        await Drawing.writeFields(drawing._id, { collaborators: drawing.collaborators });

        await enforceLiveAccess(drawing);

        return res.status(200).json({ message: "Collaborator role updated successfully." });
    } catch (error) {
        logger.error({ err: error }, "error updating collaborator role");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const getCollaborator = async (req, res) => {
    try {
        const { shareId } = req.params;

        const drawing = await findDrawingByShareId(shareId);
        if (!drawing) {
            return res.status(404).json({ message: "Drawing not found." });
        }

        if (!drawing.hasViewAccess(req.user)) {
            return res.status(403).json({ message: "Access forbidden. Only with access can view this list." });
        }

        // When people were last here is for the people on the board, not anyone holding its public link.
        const invited = drawing.owner === req.user.userId || drawing.collaborators.some((c) => c.userId === req.user.userId);
        const lastSeenByUser = invited ? await lastSeenByUserFor(shareId) : new Map();
        const collaborators = (
            await Promise.all(
                drawing.collaborators.map(async (c) => {
                    const user = await findUserById(c.userId);
                    return user ? { _id: user._id, username: user.username, role: c.role, lastSeenAt: lastSeenByUser.get(c.userId) ?? null } : null;
                }),
            )
        ).filter(Boolean);

        return res.status(200).json({
            message: "Collaborators fetched successfully.",
            collaborators,
            owner: { _id: drawing.owner, username: (await findUserById(drawing.owner))?.username ?? null },
            roles: ROLES,
        });
    } catch (error) {
        logger.error({ err: error }, "error fetching collaborators");
        return res.status(500).json({ message: "Internal server error." });
    }
};

// The owner's invite search: registered usernames only, each with its current role on the
// board so the dialog can say "will change role".
const searchInvitableUsers = async (req, res) => {
    try {
        const { q } = req.query;
        const { drawing } = req;
        const { userId } = req.user;

        if (!q || !/^[a-zA-Z0-9_]{1,30}$/.test(q)) {
            return res.status(200).json({ users: [] });
        }

        const ottoman = getDefaultInstance();
        const bucket = process.env.CB_BUCKET_NAME;
        const result = await ottoman.query(
            `SELECT users.username, META(users).id AS _id
             FROM \`${bucket}\`.\`app\`.\`users\` AS users
             WHERE LOWER(users.username) LIKE $prefix
             ORDER BY users.username ASC
             LIMIT 8`,
            { parameters: { prefix: `${q.toLowerCase()}%` } },
        );

        const roleByUserId = new Map(drawing.collaborators.map((c) => [c.userId, c.role]));
        const users = result.rows
            .map((row) => ({ ...row, _id: row._id.replace(/^User::/, "") }))
            .filter((row) => row._id !== userId) // the requester (board owner) can't invite themself
            .map((row) => ({
                username: row.username,
                alreadyCollaborator: roleByUserId.has(row._id),
                role: roleByUserId.get(row._id) || null,
            }));

        return res.status(200).json({ users });
    } catch (error) {
        logger.error({ err: error }, "error searching invitable users");
        return res.status(500).json({ message: "Internal server error." });
    }
};

export { addCollaborator, removeCollaborator, updateCollaboratorRole, getCollaborator, searchInvitableUsers };
