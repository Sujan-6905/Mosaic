import { LETTER_LIMITS } from "../../validation/letterSchemas.js";
import { nanoid } from "nanoid";
import { nullIfMissing } from "../../db/errors.js";
import Letter from "../../models/letterSchema.js";
import Drawing from "../../models/drawingSchema.js";
import { isSwept } from "../../models/accessControl.js";
import { getUsername } from "../../services/boards.js";
import { loadReel } from "../../services/boardReel.js";
import logger from "../../observability/logger.js";

const LETTER_FRAMES = 60;
const TOKEN = /^[A-Za-z0-9_-]{16}$/;

const listed = ({ token, company, note, createdAt }) => ({ token, company, note: note ?? null, createdAt });

const failed = (res, error, context) => {
    logger.error({ err: error, ...context }, "letter request failed");
    return res.status(500).json({ message: "Internal server error." });
};

// The board's owner writes and revokes letters; each is one company's own link.
export const listBoardLetters = async (req, res) => {
    try {
        const { rows } = await Letter.find({ shareId: req.params.shareId }, { sort: { createdAt: "DESC" } });
        return res.status(200).json({ letters: rows.map(listed) });
    } catch (error) {
        return failed(res, error, { shareId: req.params.shareId });
    }
};

export const createLetter = async (req, res) => {
    try {
        const { rows } = await Letter.find({ shareId: req.params.shareId }, { select: ["token"] });
        if (rows.length >= LETTER_LIMITS.perBoard)
            return res.status(409).json({ message: `A board holds up to ${LETTER_LIMITS.perBoard} letters. Revoke one to write another.` });
        const letter = await Letter.create({
            token: nanoid(16),
            shareId: req.params.shareId,
            ownerId: req.user.userId,
            company: req.body.company,
            note: req.body.note || undefined,
        });
        return res.status(201).json({ letter: listed(letter) });
    } catch (error) {
        return failed(res, error, { shareId: req.params.shareId });
    }
};

export const revokeLetter = async (req, res) => {
    try {
        const letter = TOKEN.test(req.params.token) ? await nullIfMissing(() => Letter.findOne({ token: req.params.token })) : null;
        if (!letter || letter.ownerId !== req.user.userId) return res.status(404).json({ message: "No such letter." });
        await Letter.removeById(letter._id);
        return res.status(200).json({ message: "Letter revoked." });
    } catch (error) {
        return failed(res, error, {});
    }
};

// Anyone holding the link may read the letter, and only the letter: the board's replay, its title and who sent it.
export const readLetter = async (req, res) => {
    try {
        const letter = TOKEN.test(req.params.token) ? await nullIfMissing(() => Letter.findOne({ token: req.params.token })) : null;
        const drawing = letter ? await nullIfMissing(() => Drawing.findOne({ shareId: letter.shareId })) : null;
        if (!letter || !drawing || isSwept(drawing)) return res.status(404).json({ message: "This letter isn't here any more." });
        const [from, reel] = await Promise.all([getUsername(letter.ownerId), loadReel(letter.shareId, LETTER_FRAMES)]);
        return res
            .status(200)
            .json({ company: letter.company, note: letter.note ?? null, title: drawing.title || "Untitled board", from: from ?? "Someone", reel });
    } catch (error) {
        return failed(res, error, {});
    }
};
