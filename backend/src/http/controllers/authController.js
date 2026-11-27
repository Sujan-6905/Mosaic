import bcrypt from "bcrypt";
import { nullIfMissing } from "../../db/errors.js";
import User from "../../models/userSchema.js";
import "../../models/usernameSchema.js"; // registers the `usernames` collection with Ottoman: see that file
import { getCollection, getDefaultInstance } from "ottoman";
import logger from "../../observability/logger.js";
import { startSession, endOtherSessions } from "../../auth/sessionTokens.js";
import { revokeAllPersonalTokens } from "../../auth/personalTokens.js";
import { usernameSchema } from "../../validation/restSchemas.js";

const USERNAME_COLLECTION = "usernames";
const USERNAME_SCOPE = "app";

const usernames = () => getCollection(USERNAME_COLLECTION, USERNAME_SCOPE);

// Names are unique regardless of case: "Ada" and "ada" are one name.
const reservationKey = (username) => username.toLowerCase();

// Names reserved before reservations were case-blind sit under their exact
// spelling, so the accounts themselves are checked case-blind as well.
const usernameTaken = async (username) => {
    if (await nullIfMissing(() => usernames().get(reservationKey(username)))) return true;
    const { rows } = await getDefaultInstance().query(
        `SELECT RAW 1 FROM \`${process.env.CB_BUCKET_NAME}\`.\`app\`.\`users\` AS users WHERE LOWER(users.username) = $name LIMIT 1`,
        { parameters: { name: reservationKey(username) } },
    );
    return rows.length > 0;
};

const findUserById = (id) => nullIfMissing(() => User.findById(id));

const findUserByUsername = (username) => nullIfMissing(() => User.findOne({ username }));

const findUserByEmail = (email) => nullIfMissing(() => User.findOne({ email }));

const findUserByOAuthIdentity = async (provider, providerAccountId) => {
    const user = await nullIfMissing(() => User.findOne({ oauthId: providerAccountId }));
    return user?.oauthProvider === provider ? user : null;
};

// Compared against when no such user exists, so a wrong username takes as long as a wrong password.
const UNKNOWN_USER_HASH = bcrypt.hashSync("no account has this password", 10);
const WRONG_CREDENTIALS = { message: "Wrong username or password.", code: "wrong_credentials" };
const EMAIL_IN_USE = {
    message: "Another Mosaic account already uses this email. Sign in the way you did before.",
    code: "email_in_use",
};

// An atomic reserved-key insert, so two sign-ups racing for one username can't both win.
// Returns whether this one won.
const reserveUsername = async (username, userId) => {
    try {
        await usernames().insert(reservationKey(username), { userId });
        return true;
    } catch (error) {
        if (error?.constructor?.name === "DocumentExistsError" || error?.code === 12) {
            return false;
        }
        throw error;
    }
};

// Deterministic variants, checked one by one until three are free.
const suggestUsernames = async (base) => {
    const candidates = [
        `${base}${Math.floor(10 + Math.random() * 90)}`,
        `${base}_`,
        `${base}${new Date().getFullYear()}`,
        `${base}${Math.floor(100 + Math.random() * 900)}`,
    ];
    const available = [];
    for (const candidate of candidates) {
        if (!(await usernameTaken(candidate).catch(() => true))) available.push(candidate);
        if (available.length === 3) break;
    }
    return available;
};

// The reservation is what makes a name unique, so a user whose reservation can't be
// confirmed is removed: a failed or timed-out write never leaves a second account by that name.
const confirmReservation = async (username, user) => {
    try {
        if (await reserveUsername(username, user._id)) return "won";
    } catch (error) {
        const holder = await nullIfMissing(() => usernames().get(reservationKey(username))).catch(() => null);
        if (holder?.content?.userId === user._id) return "won";
        await User.removeById(user._id).catch((removeError) => logger.error({ err: removeError, userId: user._id }, "failed to remove an unreserved user"));
        throw error;
    }
    await User.removeById(user._id);
    return "taken";
};

const register = async (req, res) => {
    const { username, password } = req.body;

    try {
        if (await usernameTaken(username)) {
            return res.status(409).json({ message: "Username is taken", suggestions: await suggestUsernames(username) });
        }
        const savedUser = await User.register(username, password);
        if ((await confirmReservation(username, savedUser)) === "taken") {
            return res.status(409).json({ message: "Username is taken", suggestions: await suggestUsernames(username) });
        }
        return res.status(200).json({ user: savedUser, ...(await startSession(savedUser._id)) });
    } catch (error) {
        logger.error({ err: error }, "error registering user");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await findUserByUsername(username);
        if (!user?.password) {
            await bcrypt.compare(password, UNKNOWN_USER_HASH);
            return res.status(400).json(WRONG_CREDENTIALS);
        }

        if (!(await user.comparePassword(password))) {
            return res.status(400).json(WRONG_CREDENTIALS);
        }

        return res.status(200).json({
            message: "logged in successfully",
            user,
            ...(await startSession(user._id)),
        });
    } catch (error) {
        logger.error({ err: error }, "error logging in user");
        return res.status(500).json({ message: "Internal server error." });
    }
};

// Matched by the provider's id. Email links only an older account from the same provider, and
// only when verified, since anyone can put another person's address on a new account.
const resolveOAuthAccount = async ({ provider, providerAccountId, email, emailVerified }) => {
    const known = await findUserByOAuthIdentity(provider, providerAccountId);
    if (known) return { user: known };
    if (!email || !emailVerified) return { user: null };
    const owner = await findUserByEmail(email);
    if (!owner) return { user: null };
    if (owner.oauthProvider === provider && !owner.oauthId) {
        owner.oauthId = providerAccountId;
        await owner.save();
        return { user: owner };
    }
    return { conflict: true };
};

// A first-time provider account is never written here: it comes back as a
// draft for the client to finish with a username through oauthComplete.
const oauthLogin = async (req, res) => {
    try {
        const { provider, providerAccountId, email, emailVerified, name } = req.body;
        const { user, conflict } = await resolveOAuthAccount(req.body);
        if (conflict) return res.status(409).json(EMAIL_IN_USE);

        if (!user) {
            return res.status(200).json({
                needsUsername: true,
                draft: { provider, providerAccountId, email: emailVerified ? email : null, emailVerified, name },
            });
        }

        return res.status(200).json({
            message: `${provider} login successful`,
            user,
            ...(await startSession(user._id)),
        });
    } catch (error) {
        logger.error({ err: error, provider: req.body?.provider }, "oauth login failed");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const oauthComplete = async (req, res) => {
    const { provider, providerAccountId, email, emailVerified, username } = req.body;

    try {
        const { user: existing, conflict } = await resolveOAuthAccount(req.body);
        if (conflict) return res.status(409).json(EMAIL_IN_USE);
        // This provider account was already finished (a double submit): sign it in.
        if (existing) return res.status(200).json({ user: existing, ...(await startSession(existing._id)) });
        if (await usernameTaken(username)) {
            return res.status(409).json({ message: "Username is taken", suggestions: await suggestUsernames(username) });
        }

        const savedUser = await User.create({
            username,
            ...(email && emailVerified ? { email } : {}),
            oauthProvider: provider,
            oauthId: providerAccountId,
        });

        if ((await confirmReservation(username, savedUser)) === "taken") {
            return res.status(409).json({ message: "Username is taken", suggestions: await suggestUsernames(username) });
        }
        return res.status(200).json({ user: savedUser, ...(await startSession(savedUser._id)) });
    } catch (error) {
        logger.error({ err: error, provider }, "oauth signup completion failed");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const checkUsername = async (req, res) => {
    const parsed = usernameSchema.safeParse(req.params.username);
    if (!parsed.success) return res.status(200).json({ available: false, reason: parsed.error.issues[0].message });
    const username = parsed.data;
    try {
        if (!(await usernameTaken(username))) return res.status(200).json({ available: true });
        return res.status(200).json({ available: false, suggestions: await suggestUsernames(username) });
    } catch (error) {
        logger.error({ err: error }, "error checking a username");
        return res.status(500).json({ message: "Internal server error." });
    }
};

// Always the token's own user, never one named by the client.
const changePassword = async (req, res) => {
    try {
        const { oldpassword, password } = req.body;
        const { userId } = req.user;

        const user = await findUserById(userId);
        if (!user) {
            return res.status(404).json({ message: "user does not exist" });
        }

        if (!user.password) {
            return res.status(400).json({ message: "This account signs in with Google or GitHub and has no password.", code: "no_password" });
        }

        if (!(await user.comparePassword(oldpassword))) {
            return res.status(400).json({ message: "wrong old password" });
        }

        user.password = await User.hashPassword(password);
        await user.save();
        // Whoever knew the old password may be signed in elsewhere or have made a token; only this device stays signed in.
        const ended = await endOtherSessions(userId, { except: req.user.sid });
        const revokedTokens = await revokeAllPersonalTokens(userId);

        return res.status(200).json({ message: "User password updated successfully", endedSessions: ended.length, revokedTokens });
    } catch (error) {
        logger.error({ err: error, userId: req.user?.userId }, "error changing password");
        return res.status(500).json({ message: "Internal server error." });
    }
};

// Persisted server-side (not just localStorage) so the choice follows the
// user across devices, not just across sessions on one browser.
const updateTheme = async (req, res) => {
    try {
        const { theme } = req.body;
        const { userId } = req.user;

        const user = await findUserById(userId);
        if (!user) {
            return res.status(404).json({ message: "user does not exist" });
        }

        user.themePreference = theme;
        await user.save();

        return res.status(200).json({ message: "Theme preference updated" });
    } catch (error) {
        logger.error({ err: error, userId: req.user?.userId }, "error updating theme preference");
        return res.status(500).json({ message: "Internal server error." });
    }
};

// The profile page's own facts about the signed-in account; hasPassword is
// false for accounts that only ever signed in through Google or GitHub.
const getMe = async (req, res) => {
    try {
        const user = await findUserById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "user does not exist" });
        }
        return res.status(200).json({
            data: {
                username: user.username,
                createdAt: user.createdAt,
                hasPassword: !!user.password,
                recoveryCodesLeft: user.recoveryCodes?.length ?? 0,
                themePreference: user.themePreference ?? null,
            },
        });
    } catch (error) {
        logger.error({ err: error, userId: req.user?.userId }, "error getting the current user");
        return res.status(500).json({ message: "Internal server error." });
    }
};

export { getMe, register, login, oauthLogin, oauthComplete, checkUsername, changePassword, updateTheme, findUserByUsername };
