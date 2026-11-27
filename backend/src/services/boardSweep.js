import { getDefaultInstance } from "ottoman";
import Drawing from "../models/drawingSchema.js";
import { closeLiveRoom, removeBoard } from "./boards.js";
import { SWEPT_BOARD_DAYS } from "../../../shared/rules/sweptBoards.js";
import logger from "../observability/logger.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const sweepBoard = async ({ _id, shareId }, now = new Date()) => {
    await Drawing.markSwept(_id, now.toISOString());
    await closeLiveRoom(shareId);
};

const restoreBoard = (drawingId) => Drawing.markSwept(drawingId, null);

// One board at a time, so a failure leaves the rest for the next pass.
const purgeSweptBoards = async (now = new Date()) => {
    const cutoff = new Date(now.getTime() - SWEPT_BOARD_DAYS * DAY_MS).toISOString();
    const { rows } = await getDefaultInstance().query(
        `SELECT META(d).id AS _id, d.shareId FROM \`${process.env.CB_BUCKET_NAME}\`.\`app\`.\`drawings\` AS d WHERE d.deletedAt IS VALUED AND d.deletedAt < $cutoff`,
        { parameters: { cutoff } },
    );
    let purged = 0;
    for (const row of rows) {
        try {
            await removeBoard({ _id: row._id.replace(/^Drawing::/, ""), shareId: row.shareId });
            purged += 1;
        } catch (error) {
            logger.error({ err: error, shareId: row.shareId }, "purging a swept board failed");
        }
    }
    return purged;
};

export { sweepBoard, restoreBoard, purgeSweptBoards };
