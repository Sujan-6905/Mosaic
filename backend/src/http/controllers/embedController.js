import logger from "../../observability/logger.js";
import Drawing from "../../models/drawingSchema.js";
import { nullIfMissing } from "../../db/errors.js";
import { isLinkShared, linkRole, hasAtLeastRank, ROLES } from "../../models/accessControl.js";
import { startSession } from "../../auth/sessionTokens.js";
import { reconstructStateAtSeq, flushOperationLog } from "../../services/operationLog.js";
import { appUrl } from "../origins.js";
import { getUsername } from "../../services/boards.js";
import { getLiveOrPersistedScene } from "../../liveRooms/liveScene.js";

// A board's embed answers for a few seconds from memory, so a page with
// thousands of viewers costs one read per board per instance, not one each.
const LIVE_SCENE_CACHE_MS = 2000;
const PINNED_SCENE_CACHE_MS = 10 * 60 * 1000;
const SCENE_CACHE_LIMIT = 500;
const DEFAULT_EMBED_SIZE = { width: 800, height: 500 };
const SHARE_ID = /^[A-Za-z0-9_-]{1,40}$/;

const findBoard = (shareId) => (SHARE_ID.test(shareId ?? "") ? nullIfMissing(() => Drawing.findOne({ shareId })) : Promise.resolve(null));

const embedOf = (drawing) => drawing.embed ?? { enabled: false, sites: [] };

// Read by the embed page's server before it answers, to set which sites may frame it.
const policy = async (req, res) => {
    try {
        const drawing = await findBoard(req.params.shareId);
        if (!drawing) return res.status(404).json({ exists: false });
        const embed = embedOf(drawing);
        const open = embed.enabled && isLinkShared(drawing);
        return res
            .status(200)
            .json({ exists: true, enabled: embed.enabled, sites: embed.enabled ? embed.sites : [], public: open, title: open ? drawing.title : null });
    } catch (error) {
        logger.error({ err: error }, "error reading an embed policy");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const sceneCache = new Map();

const elementsWithin = (elements, frameId) => {
    if (!frameId) return elements;
    if (!elements[frameId] || elements[frameId].type !== "frame") return null;
    return Object.fromEntries(Object.entries(elements).filter(([id, element]) => id === frameId || element.frameId === frameId));
};

const frameList = (elements) =>
    Object.entries(elements)
        .filter(([, element]) => element.type === "frame")
        .map(([id, element]) => ({ id, name: element.name || element.text || "Frame" }));

// The board as it stands now: the open room's state when anyone is on it, else what was last saved.
const loadScene = async (drawing, seq) => {
    if (seq === null) return getLiveOrPersistedScene(drawing);
    await flushOperationLog(drawing.shareId);
    return reconstructStateAtSeq(drawing.shareId, seq);
};

// The board (or one frame of it, or a saved version of it) as an embed or a signed-out visitor draws it.
// Framing is the embed page's own policy; the scene itself is anyone's who holds the link to a link-shared board.
const scene = async (req, res) => {
    try {
        const drawing = await findBoard(req.params.shareId);
        if (!drawing) return res.status(404).json({ message: "This board doesn't exist." });
        const role = linkRole(drawing, req.user);
        if (!role) return res.status(req.user ? 403 : 401).json({ message: "Sign in to view this board.", code: "sign_in" });
        const frameId = typeof req.query.frame === "string" ? req.query.frame.slice(0, 80) : null;
        const seq = /^\d{1,9}$/.test(req.query.version ?? "") ? Number(req.query.version) : null;
        // History is for the people on the board; a signed-out visitor sees a past version only through an embed its owner published.
        if (seq !== null && !req.user && !drawing.embed?.enabled)
            return res.status(401).json({ message: "Sign in to see this board's history.", code: "sign_in" });
        const key = `${drawing.shareId}:${frameId}:${seq}`;
        const cached = sceneCache.get(key);
        let payload = cached && Date.now() - cached.at < (seq === null ? LIVE_SCENE_CACHE_MS : PINNED_SCENE_CACHE_MS) ? cached.payload : null;
        if (!payload) {
            const { elements, background } = await loadScene(drawing, seq);
            const within = elementsWithin(elements ?? {}, frameId);
            if (!within) return res.status(404).json({ message: "That frame isn't on this board any more." });
            payload = { title: drawing.title, elements: within, background, frames: frameList(elements ?? {}), version: seq };
            if (sceneCache.size >= SCENE_CACHE_LIMIT) sceneCache.clear();
            sceneCache.set(key, { at: Date.now(), payload });
        }
        return res.status(200).json({ ...payload, role, canComment: hasAtLeastRank(role, ROLES.COMMENTER), canEdit: hasAtLeastRank(role, ROLES.EDITOR) });
    } catch (error) {
        logger.error({ err: error }, "error reading an embed scene");
        return res.status(500).json({ message: "Internal server error." });
    }
};

// A signed-in person viewing from inside someone else's page, where their
// Mosaic cookies may not reach: a sign-in good for this one board only.
const embedSession = async (req, res) => {
    try {
        const drawing = await findBoard(req.params.shareId);
        const role = drawing ? drawing.getRole(req.user) : null;
        if (!role) return res.status(403).json({ message: "You don't have access to this board." });
        const pair = await startSession(req.user.userId, { grant: { kind: "embed", boards: [drawing.shareId] } });
        return res.status(200).json({ ...pair, role, username: await getUsername(req.user.userId) });
    } catch (error) {
        logger.error({ err: error }, "error starting an embed sign-in");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const shareIdFromLink = (link) => {
    try {
        const url = new URL(link);
        if (url.origin !== appUrl()) return null;
        const embedded = /^\/embed\/([A-Za-z0-9_-]{1,40})$/.exec(url.pathname);
        return embedded?.[1] ?? url.searchParams.get("shareId");
    } catch {
        return null;
    }
};

const clampSize = (value, fallback) => (Number.isFinite(Number(value)) ? Math.max(200, Math.min(Number(value), 2000)) : fallback);

// oEmbed (https://oembed.com), so a pasted board link becomes an embed in
// editors that read it. Only boards whose owner turned embedding on.
const oembed = async (req, res) => {
    if (req.query.format && req.query.format !== "json") return res.status(501).json({ message: "Only JSON is offered." });
    try {
        const shareId = shareIdFromLink(String(req.query.url ?? ""));
        const drawing = shareId ? await findBoard(shareId) : null;
        if (!drawing || !embedOf(drawing).enabled) return res.status(404).json({ message: "No embeddable board at that link." });
        const width = clampSize(req.query.maxwidth, DEFAULT_EMBED_SIZE.width);
        const height = clampSize(req.query.maxheight, DEFAULT_EMBED_SIZE.height);
        const title = isLinkShared(drawing) ? drawing.title : "Mosaic board";
        const src = `${appUrl()}/embed/${encodeURIComponent(drawing.shareId)}`;
        return res.status(200).json({
            version: "1.0",
            type: "rich",
            provider_name: "Mosaic",
            provider_url: appUrl(),
            title,
            width,
            height,
            html: `<iframe src="${src}" width="${width}" height="${height}" style="border:0" allow="storage-access" allowfullscreen title="${title.replace(/[<>&"]/g, "")}"></iframe>`,
            ...(isLinkShared(drawing)
                ? {
                      thumbnail_url: `${appUrl()}/api/embed/${encodeURIComponent(drawing.shareId)}/snapshot.png`,
                      thumbnail_width: width,
                      thumbnail_height: height,
                  }
                : {}),
        });
    } catch (error) {
        logger.error({ err: error }, "error answering an oembed request");
        return res.status(500).json({ message: "Internal server error." });
    }
};

export { policy, scene, embedSession, oembed };
