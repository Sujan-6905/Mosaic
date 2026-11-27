import { MutateInSpec, StoreSemantics } from "couchbase";
import { getDefaultInstance } from "ottoman";
import logger from "../observability/logger.js";
import { nullIfMissing } from "../db/errors.js";

// Firsts a person can earn, in the order the wall sets them.
const FIRSTS = ["firstBoard", "roomOfFive", "firstMerge", "thousandPieces", "firstShare", "agentInTheRoom", "tenBoards"];

const collection = () => getDefaultInstance().getCollection("userActivity", "app");
const keyFor = (userId, year) => `UserActivity::${userId}:${year}`;
const dayOf = (ts) => new Date(ts).toISOString().slice(0, 10);
const isPathExists = (error) => error?.name === "PathExistsError" || error?.cause?.name === "PathExistsError";

const upsertDoc = (userId, year, specs) =>
    Promise.resolve().then(() =>
        collection().mutateIn(keyFor(userId, year), [MutateInSpec.upsert("userId", userId), MutateInSpec.upsert("year", year), ...specs], {
            storeSemantics: StoreSemantics.Upsert,
        }),
    );

// Tallies flushed changes by person and day: a person's own pieces, not those an agent set for them.
export const tallyOps = (ops) => {
    const tallies = new Map();
    const agentHelped = new Set();
    for (const op of ops) {
        if (!op.authorId || !Number.isFinite(op.ts)) continue;
        if (op.agentId) {
            agentHelped.add(op.authorId);
            continue;
        }
        const day = dayOf(op.ts);
        const key = `${op.authorId}|${day}`;
        const tally = tallies.get(key) ?? { userId: op.authorId, day, pieces: 0, boards: new Set() };
        tally.pieces += 1;
        tally.boards.add(op.shareId);
        tallies.set(key, tally);
    }
    return { tallies: [...tallies.values()], agentHelped: [...agentHelped] };
};

// A board already listed for the day rejects arrayAddUnique, so each goes alone and never takes the count down with it.
const addDayBoard = (userId, year, day, shareId) =>
    upsertDoc(userId, year, [MutateInSpec.arrayAddUnique(`days.\`${day}\`.boards`, shareId, { createPath: true })]).catch((error) => {
        if (!isPathExists(error)) throw error;
    });

const recordDay = async ({ userId, day, pieces, boards }) => {
    const year = Number(day.slice(0, 4));
    await upsertDoc(userId, year, [MutateInSpec.increment(`days.\`${day}\`.pieces`, pieces, { createPath: true })]);
    await Promise.all([...boards].map((shareId) => addDayBoard(userId, year, day, shareId)));
};

// A wall that misses a flush only undercounts a day; it must never fail the save that called it.
export const recordActivity = async (ops, now = new Date()) => {
    const { tallies, agentHelped } = tallyOps(ops ?? []);
    await Promise.all([
        ...tallies.map((tally) => recordDay(tally).catch((error) => logger.warn({ err: error, userId: tally.userId }, "recording activity failed"))),
        ...agentHelped.map((userId) => markFirst(userId, "agentInTheRoom", now)),
    ]);
};

const marked = new Set();

// Set once, the first time; later calls are no-ops, remembered in-process so a busy room doesn't keep asking.
export const markFirst = async (userId, first, now = new Date()) => {
    const memo = `${userId}|${first}`;
    if (!userId || marked.has(memo)) return;
    try {
        await upsertDoc(userId, now.getUTCFullYear(), [MutateInSpec.insert(`firsts.${first}`, now.toISOString(), { createPath: true })]);
        marked.add(memo);
    } catch (error) {
        if (isPathExists(error)) marked.add(memo);
        else logger.warn({ err: error, userId, first }, "recording a first failed");
    }
};

const ROOM_OF = 5;
export const markRoomOfFive = (userIds, now) => {
    const people = [...new Set(userIds.filter(Boolean))];
    if (people.length < ROOM_OF) return Promise.resolve();
    return Promise.all(people.map((userId) => markFirst(userId, "roomOfFive", now)));
};

// Read by key like they are written, since these documents carry no Ottoman type field.
export const readActivityYears = (userId, years) =>
    Promise.all(years.map((year) => nullIfMissing(async () => (await collection().get(keyFor(userId, year))).content)));

const DAY_MS = 24 * 60 * 60 * 1000;
export const WALL_DAYS = 53 * 7;

// The last 53 weeks, oldest first and ending today, with each first the person has earned.
export const buildWall = (docs, { now = new Date(), ownedBoards = [] } = {}) => {
    const days = Object.assign({}, ...docs.map((doc) => doc?.days ?? {}));
    const firsts = Object.assign({}, ...docs.map((doc) => doc?.firsts ?? {}));
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const wall = Array.from({ length: WALL_DAYS }, (_unused, n) => {
        const day = dayOf(today - (WALL_DAYS - 1 - n) * DAY_MS);
        return { day, pieces: days[day]?.pieces ?? 0, boards: days[day]?.boards?.length ?? 0 };
    });
    let pieces = 0;
    let thousandth = null;
    for (const entry of wall) {
        pieces += entry.pieces;
        if (!thousandth && pieces >= 1000) thousandth = entry.day;
    }
    const byAge = [...ownedBoards].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    const earned = {
        thousandPieces: thousandth,
        ...firsts,
        ...(byAge[0] ? { firstBoard: byAge[0].createdAt } : {}),
        ...(byAge[9] ? { tenBoards: byAge[9].createdAt } : {}),
    };
    return {
        days: wall,
        pieces,
        boards: ownedBoards.length,
        firsts: FIRSTS.map((name) => ({ name, at: earned[name] ?? null })),
    };
};

// A thousandth piece seen in the window is kept as a first, so it outlasts the window.
export const keepThousandth = (wall, docs, userId, now = new Date()) => {
    const thousand = wall.firsts.find((first) => first.name === "thousandPieces");
    if (thousand.at && !docs.some((doc) => doc?.firsts?.thousandPieces)) return markFirst(userId, "thousandPieces", now);
    return Promise.resolve();
};
