import crypto from "node:crypto";
import { nullIfMissing } from "../../db/errors.js";
import PieceSet from "../../models/pieceSetSchema.js";
import User from "../../models/userSchema.js";
import logger from "../../observability/logger.js";
import { MAX_PIECES_PER_SET } from "../../validation/pieceSchemas.js";

const MAX_SETS_PER_PERSON = 50;

const findSet = (setId) => nullIfMissing(() => PieceSet.findById(setId));

const withPieceIds = (pieces) => pieces.map((piece) => ({ id: crypto.randomUUID(), name: piece.name, elements: piece.elements }));

// Sets created while these fields had a null default hold the text "null" instead.
const storedText = (value) => (value === "null" ? null : (value ?? null));

const summaryOf = (set) => ({
    _id: set._id,
    title: set.title,
    description: set.description,
    pieces: set.pieces,
    published: set.published,
    listed: set.listed ?? false,
    tags: set.tags ?? [],
    license: storedText(set.license),
    installedFrom: storedText(set.installedFrom),
    installs: set.installs,
    updatedAt: set.updatedAt,
});

// Runs `work` on a set only its owner may change, answering 404 for anyone else
// so a set's existence isn't given away.
const ownedSet = (work) => async (req, res) => {
    try {
        const set = await findSet(req.params.setId);
        if (!set || set.ownerId !== req.user.userId) return res.status(404).json({ message: "Piece set not found." });
        return await work(set, req, res);
    } catch (error) {
        logger.error({ err: error }, "error changing a piece set");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const atSetLimit = async (userId) => (await PieceSet.find({ ownerId: userId })).rows.length >= MAX_SETS_PER_PERSON;

export const listPieceSetsHandler = async (req, res) => {
    try {
        const { rows } = await PieceSet.find({ ownerId: req.user.userId }, { sort: { updatedAt: "DESC" } });
        return res.status(200).json({ sets: rows.map(summaryOf) });
    } catch (error) {
        logger.error({ err: error }, "error listing piece sets");
        return res.status(500).json({ message: "Internal server error." });
    }
};

export const createPieceSetHandler = async (req, res) => {
    try {
        if (await atSetLimit(req.user.userId)) return res.status(409).json({ message: `You can keep up to ${MAX_SETS_PER_PERSON} piece sets.` });
        const { title, description = "", pieces = [] } = req.body;
        const set = await PieceSet.create({ ownerId: req.user.userId, title, description, pieces: withPieceIds(pieces) });
        return res.status(201).json({ set: summaryOf(set) });
    } catch (error) {
        logger.error({ err: error }, "error creating a piece set");
        return res.status(500).json({ message: "Internal server error." });
    }
};

// Listing in the gallery shares the set too; taking sharing away takes it out of the gallery.
export const updatePieceSetHandler = ownedSet(async (set, req, res) => {
    const patch = { ...req.body, ...(req.body.listed ? { published: true } : {}), ...(req.body.published === false ? { listed: false } : {}) };
    if (patch.listed && storedText(set.installedFrom)) return res.status(409).json({ message: "Only sets you made can be listed in the gallery." });
    await PieceSet.writeFields(set._id, patch);
    return res.status(200).json({ set: summaryOf({ ...set, ...patch }) });
});

const GALLERY_SCAN_LIMIT = 400;
const GALLERY_PAGE_SIZE = 60;
const PREVIEW_PIECES = 4;
const MAX_PREVIEW_ELEMENTS = 120;

// The public gallery of listed sets, readable without signing in, with a few
// pieces of each to preview. Installing still needs an account.
export const listGalleryHandler = async (req, res) => {
    try {
        const query = String(req.query.q ?? "")
            .trim()
            .toLowerCase()
            .slice(0, 60);
        const tag = String(req.query.tag ?? "")
            .trim()
            .toLowerCase()
            .slice(0, 24);
        const newest = req.query.sort === "new";
        const { rows } = await PieceSet.find({ listed: true }, { sort: newest ? { createdAt: "DESC" } : { installs: "DESC" }, limit: GALLERY_SCAN_LIMIT });
        const matching = rows
            .filter((set) => !tag || (set.tags ?? []).includes(tag))
            .filter((set) => !query || `${set.title} ${set.description} ${(set.tags ?? []).join(" ")}`.toLowerCase().includes(query))
            .slice(0, GALLERY_PAGE_SIZE);
        const ownerIds = [...new Set(matching.map((set) => set.ownerId))];
        const owners = new Map(await Promise.all(ownerIds.map(async (id) => [id, (await nullIfMissing(() => User.findById(id)))?.username ?? "Someone"])));
        const sets = matching.map((set) => ({
            _id: set._id,
            title: set.title,
            description: set.description,
            tags: set.tags ?? [],
            license: storedText(set.license),
            installs: set.installs,
            updatedAt: set.updatedAt,
            ownerName: owners.get(set.ownerId),
            pieceCount: set.pieces.length,
            preview: set.pieces
                .filter((piece) => Object.keys(piece.elements).length <= MAX_PREVIEW_ELEMENTS)
                .slice(0, PREVIEW_PIECES)
                .map(({ id, name, elements }) => ({ id, name, elements })),
        }));
        const tags = [...new Set(rows.flatMap((set) => set.tags ?? []))].sort();
        return res.status(200).json({ sets, tags });
    } catch (error) {
        logger.error({ err: error }, "error listing the pieces gallery");
        return res.status(500).json({ message: "Internal server error." });
    }
};

export const deletePieceSetHandler = ownedSet(async (set, req, res) => {
    await PieceSet.removeById(set._id);
    return res.status(200).json({ message: "Piece set deleted." });
});

export const addPieceHandler = ownedSet(async (set, req, res) => {
    if (set.pieces.length >= MAX_PIECES_PER_SET) return res.status(409).json({ message: `A set holds up to ${MAX_PIECES_PER_SET} pieces.` });
    const [piece] = withPieceIds([req.body]);
    await PieceSet.appendPiece(set._id, piece);
    return res.status(201).json({ piece });
});

export const removePieceHandler = ownedSet(async (set, req, res) => {
    const pieces = set.pieces.filter((piece) => piece.id !== req.params.pieceId);
    if (pieces.length === set.pieces.length) return res.status(404).json({ message: "Piece not found." });
    await PieceSet.writeFields(set._id, { pieces });
    return res.status(200).json({ message: "Piece removed." });
});

// A published set as anyone signed in sees it before installing it.
export const getSharedPieceSetHandler = async (req, res) => {
    try {
        const set = await findSet(req.params.setId);
        if (!set || (!set.published && set.ownerId !== req.user.userId)) return res.status(404).json({ message: "This piece set isn't shared." });
        const owner = await nullIfMissing(() => User.findById(set.ownerId));
        return res.status(200).json({ set: { ...summaryOf(set), ownerName: owner?.username ?? "Someone" } });
    } catch (error) {
        logger.error({ err: error }, "error opening a shared piece set");
        return res.status(500).json({ message: "Internal server error." });
    }
};

export const installPieceSetHandler = async (req, res) => {
    try {
        const source = await findSet(req.params.setId);
        if (!source || !source.published) return res.status(404).json({ message: "This piece set isn't shared." });
        if (source.ownerId === req.user.userId) return res.status(409).json({ message: "This set is already yours." });
        if (await atSetLimit(req.user.userId)) return res.status(409).json({ message: `You can keep up to ${MAX_SETS_PER_PERSON} piece sets.` });
        const copy = await PieceSet.create({
            ownerId: req.user.userId,
            title: source.title,
            description: source.description,
            pieces: withPieceIds(source.pieces),
            installedFrom: source._id,
        });
        await PieceSet.countInstall(source._id);
        return res.status(201).json({ set: summaryOf(copy) });
    } catch (error) {
        logger.error({ err: error }, "error installing a piece set");
        return res.status(500).json({ message: "Internal server error." });
    }
};
