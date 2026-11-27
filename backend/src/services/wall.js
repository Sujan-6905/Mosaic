import crypto from "node:crypto";
import { getCollection } from "ottoman";
import { isCasMismatch, isDocumentExists, nullIfMissing } from "../db/errors.js";
import { WALL_COLS, WALL_ROWS, WALL_SIZE } from "../../../shared/rules/landingWall.js";

const LEDGER = "ledger";
const stoneKey = (index) => `stone::${index}`;
const visitorKey = (hash) => `visitor::${hash}`;
const VISITOR_ID = /^[A-Za-z0-9_-]{16,64}$/;
const HERE_WINDOW_MS = 30_000;
const LEDGER_FRESH_MS = 2_000;
// A spot can be taken between reading the wall and setting a stone; this many nearby tries covers that race.
const NEARBY_TRIES = 12;

export const isVisitorId = (value) => typeof value === "string" && VISITOR_ID.test(value);
const hashVisitor = (visitor) => crypto.createHash("sha256").update(visitor).digest("hex").slice(0, 32);

const openSpotsNear = (wanted, laid) => {
    const origin = Number.isInteger(wanted) && wanted >= 0 && wanted < WALL_SIZE ? wanted : Math.floor(WALL_ROWS / 2) * WALL_COLS + Math.floor(WALL_COLS / 2);
    const ox = origin % WALL_COLS;
    const oy = Math.floor(origin / WALL_COLS);
    const open = [];
    for (let index = 0; index < WALL_SIZE; index += 1) {
        if (laid.has(index)) continue;
        open.push([Math.hypot((index % WALL_COLS) - ox, Math.floor(index / WALL_COLS) - oy), index]);
    }
    return open
        .sort((a, b) => a[0] - b[0])
        .slice(0, NEARBY_TRIES)
        .map(([, index]) => index);
};

// Stones and claims are raw keys written by atomic insert, so a spot can't be taken twice;
// the CAS-kept ledger is only the fast read.
export const createWall = ({ collection = () => getCollection("wallStones", "app"), now = Date.now } = {}) => {
    const lastSeen = new Map();
    let cached = null;

    const readLedger = async () => {
        if (cached && now() - cached.at < LEDGER_FRESH_MS) return cached.stones;
        const found = await nullIfMissing(() => collection().get(LEDGER));
        cached = { at: now(), stones: found?.content.stones ?? [] };
        return cached.stones;
    };

    const appendToLedger = async (index) => {
        for (let attempt = 0; attempt < 8; attempt += 1) {
            const found = await nullIfMissing(() => collection().get(LEDGER));
            const stones = found?.content.stones ?? [];
            if (stones.includes(index)) return;
            try {
                if (found) await collection().replace(LEDGER, { stones: [...stones, index] }, { cas: found.cas });
                else await collection().insert(LEDGER, { stones: [index] });
                cached = { at: now(), stones: [...stones, index] };
                return;
            } catch (error) {
                if (!isCasMismatch(error) && !isDocumentExists(error)) throw error;
            }
        }
        throw new Error("wall ledger stayed contended");
    };

    const countHere = (visitorHash) => {
        const at = now();
        if (visitorHash) lastSeen.set(visitorHash, at);
        for (const [hash, seen] of lastSeen) if (at - seen > HERE_WINDOW_MS) lastSeen.delete(hash);
        return lastSeen.size;
    };

    const view = async (visitor) => {
        const hash = isVisitorId(visitor) ? hashVisitor(visitor) : null;
        const [stones, claim] = await Promise.all([readLedger(), hash ? nullIfMissing(() => collection().get(visitorKey(hash))) : null]);
        const mine = claim?.content.index;
        return { cols: WALL_COLS, rows: WALL_ROWS, stones, mine: Number.isInteger(mine) && mine >= 0 ? mine : null, here: countHere(hash) };
    };

    const setStone = async (visitor, wanted) => {
        const hash = hashVisitor(visitor);
        try {
            await collection().insert(visitorKey(hash), { index: -1, at: now() });
        } catch (error) {
            if (!isDocumentExists(error)) throw error;
            const claim = await nullIfMissing(() => collection().get(visitorKey(hash)));
            return { status: "already", index: claim?.content.index ?? null };
        }
        const laid = new Set(await readLedger());
        for (const index of openSpotsNear(wanted, laid)) {
            try {
                await collection().insert(stoneKey(index), { at: now() });
            } catch (error) {
                if (isDocumentExists(error)) continue;
                await collection().remove(visitorKey(hash));
                throw error;
            }
            await collection().replace(visitorKey(hash), { index, at: now() });
            await appendToLedger(index);
            return { status: "set", index };
        }
        await collection().remove(visitorKey(hash));
        return { status: laid.size >= WALL_SIZE ? "full" : "busy" };
    };

    return { setStone, view };
};
