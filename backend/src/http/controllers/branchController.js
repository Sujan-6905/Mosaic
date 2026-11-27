import { nanoid } from "nanoid";
import { getDefaultInstance } from "ottoman";
import Snapshot from "../../models/snapshotSchema.js";
import Drawing from "../../models/drawingSchema.js";
import canvasStore from "../../liveRooms/canvasStore.js";
import { loadDataFromDB } from "../../services/boards.js";
import { DEFAULT_BACKGROUND } from "../../../../shared/canvas/history/operationReplay.js";
import { reconstructStateAtSeq } from "../../services/operationLog.js";
import logger from "../../observability/logger.js";
import { getRole } from "../../models/accessControl.js";
import { indexBoardForSearchSafely } from "../../search/indexBoard.js";
import { saveMergeBase } from "../../models/mergeBaseSchema.js";
import { SCENE_FORMAT_VERSION } from "../../../../shared/canvas/elements/sceneFile.js";

const bucketName = () => process.env.CB_BUCKET_NAME;

// A board that starts with content (a fork, an import) records that content as
// its first version, so history, compare and replay don't treat it as new.
const writeStartingSnapshot = (shareId, elements, background) =>
    Snapshot.create({ shareId, seq: 0, elements, background, name: null, automatic: true, authorId: null, authorName: null, contributors: [] });

// A fork starts from the live room, the saved board, or a past version when `seq` is given.
// It gets a new owner and history; collaborators are never copied, so a fork can't leak them.
const forkBoard = async ({ shareId, seq = null, forkerUserId }) => {
    let elements;
    let background;

    if (seq !== null) {
        const state = await reconstructStateAtSeq(shareId, seq);
        elements = state.elements;
        background = state.background;
    } else if (await canvasStore.roomExists(shareId)) {
        elements = await canvasStore.getElements(shareId);
        background = await canvasStore.getBackground(shareId);
    } else {
        const saved = await loadDataFromDB(shareId);
        elements = saved?.elements || {};
        background = saved?.background || DEFAULT_BACKGROUND;
    }

    const parentDrawing = await Drawing.findOne({ shareId }).catch(() => null);
    const newShareId = nanoid(10);

    const fork = await Drawing.create({
        title: parentDrawing ? `${parentDrawing.title} (fork)` : "Forked board",
        owner: forkerUserId,
        shareId: newShareId,
        elements,
        background,
        parentShareId: shareId,
        parentSeq: seq,
    });
    // Indexed now, since the fork already has content to search.
    indexBoardForSearchSafely(newShareId, elements);
    await Promise.all([saveMergeBase(newShareId, elements), writeStartingSnapshot(newShareId, elements, background)]);
    return fork;
};

// Only the branches the caller could open: a fork is private to its owner until shared.
const getBranches = async (shareId, caller) => {
    const ottoman = getDefaultInstance();
    const result = await ottoman.query(
        `SELECT drawings.title, drawings.shareId, drawings.owner, drawings.parentSeq, drawings.createdAt,
                drawings.collaborators, drawings.linkAccess, drawings.agentAccess
         FROM \`${bucketName()}\`.\`app\`.\`drawings\` AS drawings
         WHERE parentShareId = $shareId
         ORDER BY drawings.createdAt DESC`,
        { parameters: { shareId } },
    );
    return result.rows
        .filter((branch) => getRole(branch, caller))
        .map(({ title, shareId: branchShareId, owner, parentSeq, createdAt }) => ({ title, shareId: branchShareId, owner, parentSeq, createdAt }));
};

const forkBoardHandler = async (req, res) => {
    try {
        const { userId } = req.user;
        const seq = req.body?.seq ?? null;
        const fork = await forkBoard({ shareId: req.params.shareId, seq, forkerUserId: userId });
        return res.status(201).json({ message: "Board forked successfully", data: fork });
    } catch (error) {
        logger.error({ err: error }, "error forking board");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const getBranchesHandler = async (req, res) => {
    try {
        const branches = await getBranches(req.params.shareId, req.user);
        return res.status(200).json({ branches });
    } catch (error) {
        logger.error({ err: error }, "error fetching branches");
        return res.status(500).json({ message: "Internal server error." });
    }
};

// New boards only; importing into an open board inserts through the live per-element path.
const importDrawingHandler = async (req, res) => {
    try {
        const { title, scene } = req.body;
        const { userId } = req.user;

        if (scene.mosaicSceneVersion !== SCENE_FORMAT_VERSION) {
            return res.status(400).json({
                message: `Unsupported scene file version ${scene.mosaicSceneVersion}. This build reads version ${SCENE_FORMAT_VERSION} only.`,
            });
        }

        const shareId = nanoid(10);
        const drawing = await Drawing.create({
            title,
            owner: userId,
            shareId,
            elements: scene.elements,
            background: scene.background,
        });
        indexBoardForSearchSafely(shareId, scene.elements);
        await writeStartingSnapshot(shareId, scene.elements, scene.background);

        return res.status(201).json({ message: "Drawing imported successfully", data: drawing });
    } catch (error) {
        logger.error({ err: error }, "error importing drawing");
        return res.status(500).json({ message: "Internal server error." });
    }
};

export { forkBoard, getBranches, forkBoardHandler, getBranchesHandler, importDrawingHandler };
