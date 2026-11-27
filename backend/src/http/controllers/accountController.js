import crypto from "node:crypto";
import User from "../../models/userSchema.js";
import { nullIfMissing } from "../../db/errors.js";
import logger from "../../observability/logger.js";
import { removeAccount } from "../../services/accountRemoval.js";
import { endOtherSessions } from "../../auth/sessionTokens.js";
import { revokeAllPersonalTokens } from "../../auth/personalTokens.js";

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_REFUSED = "That username and recovery code don't match.";
// 80 random bits, read in groups of four, no look-alike letters.
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const normaliseCode = (code) =>
    String(code)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
// Keyed with a server secret, so the stored hashes alone can't be guessed back into codes.
const hashCode = (code) => crypto.createHmac("sha256", `recovery-codes:${process.env.JWT_SECRET}`).update(normaliseCode(code)).digest("hex");
const newRecoveryCode = () => {
    const chars = Array.from({ length: 16 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join("");
    return chars.match(/.{4}/g).join("-");
};

const findUser = (userId) => nullIfMissing(() => User.findById(userId));

// A password account proves it is really its owner before anything irreversible.
const confirmsPassword = async (user, password) => !user.password || (typeof password === "string" && (await user.comparePassword(password)));

// Ten single-use codes, shown once: the way back in for an account with no email to reset through.
const createRecoveryCodes = async (req, res) => {
    try {
        const user = await findUser(req.user.userId);
        if (!user) return res.status(404).json({ message: "user does not exist" });
        if (!user.password)
            return res.status(400).json({ message: "This account signs in with Google or GitHub, which is how you get back into it.", code: "no_password" });
        if (!(await confirmsPassword(user, req.body.password))) return res.status(400).json({ message: "That password isn't right.", code: "wrong_password" });
        const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);
        user.recoveryCodes = codes.map(hashCode);
        await user.save();
        return res.status(200).json({ codes });
    } catch (error) {
        logger.error({ err: error, userId: req.user.userId }, "error creating recovery codes");
        return res.status(500).json({ message: "Internal server error." });
    }
};

// A forgotten password, replaced with one recovery code. Every sign-in and token ends,
// since whoever knew the old password may still hold one.
const recoverAccount = async (req, res) => {
    try {
        const { username, code, password } = req.body;
        const user = await nullIfMissing(() => User.findOne({ username }));
        const used = hashCode(code);
        if (!user?.password || !(user.recoveryCodes ?? []).includes(used)) return res.status(400).json({ message: RECOVERY_REFUSED, code: "recovery_refused" });
        user.recoveryCodes = user.recoveryCodes.filter((stored) => stored !== used);
        user.password = await User.hashPassword(password);
        await user.save();
        await endOtherSessions(user._id);
        await revokeAllPersonalTokens(user._id);
        return res.status(200).json({ message: "Password changed. Sign in with it now.", recoveryCodesLeft: user.recoveryCodes.length });
    } catch (error) {
        logger.error({ err: error }, "error recovering an account");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const deleteAccount = async (req, res) => {
    const { userId } = req.user;
    try {
        const user = await findUser(userId);
        if (!user) return res.status(404).json({ message: "user does not exist" });
        if (req.body.username !== user.username) return res.status(400).json({ message: "Type your username exactly to confirm.", code: "confirm_mismatch" });
        if (!(await confirmsPassword(user, req.body.password))) return res.status(400).json({ message: "That password isn't right.", code: "wrong_password" });

        const boards = await removeAccount(user);
        logger.info({ boards }, "account deleted");
        return res.status(204).end();
    } catch (error) {
        logger.error({ err: error, userId }, "error deleting an account");
        return res.status(500).json({ message: "Couldn't finish deleting your account. Try again; nothing already removed comes back." });
    }
};

export { createRecoveryCodes, recoverAccount, deleteAccount };
