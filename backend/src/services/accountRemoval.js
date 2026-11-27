import { getCollection, getDefaultInstance } from "ottoman";
import User from "../models/userSchema.js";
import Drawing from "../models/drawingSchema.js";
import { nullIfMissing } from "../db/errors.js";
import { endOtherSessions } from "../auth/sessionTokens.js";
import { revokeAllPersonalTokens } from "../auth/personalTokens.js";
import { findDrawingsSharedWithUser, removeBoard } from "./boards.js";
import { enforceLiveAccess } from "./liveAccess.js";

// Rows that belong to one person and mean nothing once they are gone.
const PERSONAL_COLLECTIONS = [
    ["notifications", "userId"],
    ["boardOrganizations", "userId"],
    ["categories", "userId"],
    ["aiConversations", "userId"],
    ["boardVisits", "userId"],
    ["pieceSets", "ownerId"],
    ["pushSubscriptions", "userId"],
];

const releaseUsername = async (username, userId) => {
    const usernames = getCollection("usernames", "app");
    for (const key of new Set([username.toLowerCase(), username])) {
        const reservation = await nullIfMissing(() => usernames.get(key));
        if (reservation?.content.userId === userId) await nullIfMissing(() => usernames.remove(key));
    }
};

// Removes the account, its boards, its place on others' boards and every sign-in and token.
// Its comments on other boards stay under its old name. Returns the number of boards removed.
export const removeAccount = async (user) => {
    const userId = user._id;
    const { rows: owned } = await Drawing.find({ owner: userId }, { select: ["_id", "shareId"] });
    for (const board of owned) await removeBoard(board);

    for (const board of await findDrawingsSharedWithUser(userId)) {
        const collaborators = board.collaborators.filter((collaborator) => collaborator.userId !== userId);
        await Drawing.writeFields(board._id, { collaborators });
        await enforceLiveAccess({ ...board, collaborators });
    }

    const ottoman = getDefaultInstance();
    await Promise.all(
        PERSONAL_COLLECTIONS.map(([collection, field]) =>
            ottoman.query(`DELETE FROM \`${process.env.CB_BUCKET_NAME}\`.\`app\`.\`${collection}\` WHERE ${field} = $userId`, { parameters: { userId } }),
        ),
    );
    await revokeAllPersonalTokens(userId);
    await endOtherSessions(userId);
    await releaseUsername(user.username, userId);
    await User.removeById(userId);
    return owned.length;
};
