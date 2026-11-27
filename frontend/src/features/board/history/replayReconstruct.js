import { applyOperation, DEFAULT_BACKGROUND } from "../../../../../shared/canvas/history/operationReplay.js";

// Frames from one loaded window; checkpoints mean a frame replays at most CHECKPOINT_INTERVAL changes.
const EMPTY_BASE = { seq: 0, elements: {}, background: DEFAULT_BACKGROUND };
export const CHECKPOINT_INTERVAL = 50;

const copyOf = ({ elements, background }) => ({ elements: { ...elements }, background });

// `ops` must be sorted ascending by `seq` and all come after `base.seq`.
export const buildReplayCheckpoints = (ops, base = EMPTY_BASE) => {
    const checkpoints = [base];
    const state = copyOf(base);
    ops.forEach((op, i) => {
        applyOperation(state, op);
        if ((i + 1) % CHECKPOINT_INTERVAL === 0) {
            checkpoints.push({ seq: op.seq, ...copyOf(state) });
        }
    });
    return checkpoints;
};

const nearestCheckpointAtOrBefore = (checkpoints, targetSeq) => {
    let nearest = checkpoints[0];
    for (const checkpoint of checkpoints) {
        if (checkpoint.seq > targetSeq) break;
        nearest = checkpoint;
    }
    return nearest;
};

export const reconstructAtSeq = (ops, checkpoints, targetSeq) => {
    const base = nearestCheckpointAtOrBefore(checkpoints, targetSeq);
    const state = copyOf(base);
    for (const op of ops) {
        if (op.seq <= base.seq) continue;
        if (op.seq > targetSeq) break;
        applyOperation(state, op);
    }
    return state;
};
