import { saveCanvasToDB, getAccessForShareId, getUsername, closeLiveRoom, recordLastSeen, SAVE_RESULT } from "../services/boards.js";
import { getCommentsForShareId } from "../services/comments.js";
import { resolveCredential } from "../http/middlewares/authMiddleware.js";
import { signInEvents } from "../auth/sessionTokens.js";
import { registerWatchHandlers } from "./watchHandlers.js";
import { userRoom } from "../services/notifications.js";
import { isFullSignIn } from "../models/accessControl.js";
import {
    joinRoomSchema,
    cursorMoveSchema,
    laserPointSchema,
    textSyncSchema,
    updateCanvasSchema,
    updateBackgroundSchema,
    cameraMoveSchema,
    presentationUpdateSchema,
    followUpdateSchema,
} from "../validation/socketSchemas.js";
import { appendOp, flushOperationLog } from "../services/operationLog.js";
import { applyElementUpsert, applyElementDelete } from "../services/canvasMutations.js";
import { boardAndWatchers } from "./roomNames.js";
import { indexBoardForSearchSafely } from "../search/indexBoard.js";
import logger, { childLoggerForSocket } from "../observability/logger.js";
import safeHandler from "../http/middlewares/safeHandler.js";
import { canEdit, parsePayload, rejectElementChange } from "./payloads.js";
import { createCommentHandlers } from "./commentHandlers.js";
import { createBoardWideHandlers } from "./boardWideHandlers.js";
import { createWorkshopHandlers } from "./workshopHandlers.js";
import {
    recordOp,
    recordCapRejection,
    recordRoomOccupancy,
    recordRoomOp,
    recordPresenceEvent,
    recordSaveLatency,
    startOpsPerSecTicker,
} from "../observability/metrics.js";
import { flushDirtyBoards } from "../services/autosaveFlush.js";
import { ensureRoomLoaded } from "../services/roomLoading.js";
import { broadcastPresence as broadcastPresenceTo } from "../services/liveAccess.js";
import { resolveMaxBoardCollaborators } from "../config.js";
import { capacityRefusal, guestNameFor, nextPresenceColor } from "./roomCapacity.js";
import defaultCanvasStore from "../liveRooms/canvasStore.js";
import { markRoomOfFive } from "../services/userActivity.js";

const signInRoom = (sid) => `signin:${sid}`;

// Room state lives in canvasStore so instances can share rooms; socket -> shareId stays
// local because a socket lives on one instance.
const canvasAccessed = {};

const AUTOSAVE_INTERVAL_MS = 15000;

// The store is injectable so tests can run two servers against one Redis.
const socketLogic = (io, canvasStore = defaultCanvasStore) => {
    const registerCommentHandlers = createCommentHandlers({ io, canvasStore });
    const registerBoardWideHandlers = createBoardWideHandlers({ io, canvasStore });
    const workshop = createWorkshopHandlers({ io, canvasStore });
    const maxBoardCollaborators = resolveMaxBoardCollaborators();

    const broadcastPresence = (shareId) => broadcastPresenceTo(io, canvasStore, shareId);

    // Followers live on each socket's own data rather than the store: they die
    // with the socket, and fetchSockets sees across instances when Redis is on.
    const notifyFollowers = async (shareId, presenterSocketId) => {
        if (!presenterSocketId) return;
        const sockets = await io.in(shareId).fetchSockets();
        const followers = sockets.filter((candidate) => candidate.data.followingSocketId === presenterSocketId).map((candidate) => candidate.id);
        io.to(presenterSocketId).emit("server:followersUpdate", { shareId, followers });
    };

    const flushRoom = async (shareId) => {
        const startedAt = Date.now();
        // A store reads a missing room as empty, and saving that would wipe the real
        // board. Checked after the reads too, since the room can close during them.
        if (!(await canvasStore.roomExists(shareId))) return SAVE_RESULT.NOTHING_TO_SAVE;
        const elements = await canvasStore.getElements(shareId);
        const background = await canvasStore.getBackground(shareId);
        if (!(await canvasStore.roomExists(shareId))) return SAVE_RESULT.NOTHING_TO_SAVE;
        const result = await saveCanvasToDB({ canvasShareId: shareId, canvasElements: elements, canvasBackground: background });
        recordSaveLatency(Date.now() - startedAt);
        if (result === SAVE_RESULT.BOARD_GONE) return result;
        // The history is written on the same sweep as the elements, with its own failure mode.
        try {
            await flushOperationLog(shareId);
        } catch (error) {
            // The unwritten history is still queued in the room; keep the room open so a later sweep writes it.
            logger.error({ err: error, shareId }, "operation log flush failed for room");
            return SAVE_RESULT.FAILED;
        }
        // Same reasoning: the search index rebuilds off this same sweep rather
        // than reindexing on every keystroke.
        await indexBoardForSearchSafely(shareId, elements);
        return result;
    };

    // Joins still on their way into a room, per shareId, so a room someone is
    // joining is never closed under them (a reload while the last save lands).
    const pendingJoins = new Map();
    const trackJoin = (shareId, delta) => {
        const next = (pendingJoins.get(shareId) ?? 0) + delta;
        if (next > 0) pendingJoins.set(shareId, next);
        else pendingJoins.delete(shareId);
    };

    // A room everyone has left only stays open while its last save hasn't landed.
    const closeRoomIfEmpty = async (shareId) => {
        const empty = (await canvasStore.getParticipants(shareId)).length === 0;
        if (empty && !pendingJoins.has(shareId)) await canvasStore.deleteRoom(shareId);
    };

    const sweepDirtyBoards = ({ emitSaved }) =>
        flushDirtyBoards({
            canvasStore,
            flushRoom,
            onSaved: async (shareId) => {
                if (emitSaved) io.to(shareId).emit("server:saved", { savedAt: Date.now() });
                await closeRoomIfEmpty(shareId);
            },
            onBoardGone: (shareId) => closeLiveRoom(shareId, { io, store: canvasStore }),
        });

    const leaveCurrentRoom = async (socket) => {
        const shareId = canvasAccessed[socket.id];
        delete canvasAccessed[socket.id];
        if (!shareId) return;
        socket.leave(shareId);
        if (!(await canvasStore.roomExists(shareId))) return;

        const remaining = await canvasStore.removeParticipant(shareId, socket.id);
        await recordLastSeen(shareId, socket.userId);
        await notifyFollowers(shareId, socket.data.followingSocketId);

        if (remaining <= 0) {
            const result = await flushRoom(shareId).catch((error) => {
                logger.error({ err: error, shareId }, "final flush failed for room");
                return SAVE_RESULT.FAILED;
            });
            // Closing now would drop strokes that exist nowhere else, so the room stays
            // open for the autosave sweep to retry, and closes once a save lands.
            if (result === SAVE_RESULT.FAILED) await canvasStore.markDirty(shareId);
            else await closeRoomIfEmpty(shareId);
        } else {
            await broadcastPresence(shareId);
        }
    };

    io.use(async (socket, next) => {
        try {
            const principal = await resolveCredential(socket.handshake.auth?.token);
            // A signed-out or embedded view may watch without signing in; it can do nothing else.
            if (!principal && socket.handshake.auth?.watchOnly === true) {
                socket.principal = null;
                socket.data.principal = null;
                socket.watchOnly = true;
                socket.correlationId = socket.id;
                return next();
            }
            if (!principal) return next(new Error("unauthorized"));
            socket.userId = principal.userId;
            socket.principal = principal;
            // Copied to data so access checks can read it from any instance.
            socket.data.principal = principal;
            // The client's correlation id ties its socket activity to its REST calls; else the socket id.
            socket.correlationId = socket.handshake.auth?.correlationId || socket.id;
            if (principal.sid) socket.join(signInRoom(principal.sid));
            if (isFullSignIn(principal)) socket.join(userRoom(principal.userId));
            return next();
        } catch (error) {
            // A database hiccup is not a lapsed sign-in; the client retries instead of signing out.
            logger.warn({ err: error }, "could not check a socket's credential");
            return next(new Error("unavailable"));
        }
    });

    // A connection outlives the token it opened with, so ending a sign-in closes its sockets too.
    signInEvents.on("ended", (sid) => io.in(signInRoom(sid)).disconnectSockets(true));

    io.on("connection", (socket) => {
        socket.log = childLoggerForSocket(socket);
        registerWatchHandlers(socket, io);
        if (socket.watchOnly) return;
        socket.log.info("client connected");

        socket.on(
            "client:joinRoom",
            safeHandler(
                socket,
                "client:joinRoom",
                async (payload) => {
                    const parsed = parsePayload(joinRoomSchema, socket, "client:joinRoom", payload);
                    if (!parsed) return;
                    const { shareId } = parsed;

                    socket.log.info({ shareId }, "joined room");

                    // One board per connection: opening another one leaves the last.
                    if (canvasAccessed[socket.id] && canvasAccessed[socket.id] !== shareId) await leaveCurrentRoom(socket);

                    trackJoin(shareId, 1);
                    try {
                        const roomOpen = await canvasStore.roomExists(shareId);
                        const access = await getAccessForShareId(shareId, socket.principal);

                        if (!access.exists) {
                            socket.emit("server:canvasNotFound");
                            return;
                        }

                        if (!access.role) {
                            if (canvasAccessed[socket.id] === shareId) await leaveCurrentRoom(socket);
                            socket.emit("server:canvasAccessDenied");
                            return;
                        }

                        const { role } = access;

                        // Two joins racing for a new board both get here; only createRoom's winner seeds it.
                        if (!roomOpen) await ensureRoomLoaded(shareId);

                        const present = await canvasStore.getParticipants(shareId);
                        const refusal = capacityRefusal({ present, socketId: socket.id, userId: socket.userId, role, maxPeople: maxBoardCollaborators });
                        if (refusal) {
                            recordCapRejection();
                            socket.log.warn(
                                { shareId, people: refusal.people, max: maxBoardCollaborators, reason: refusal.reason },
                                "join rejected at capacity",
                            );
                            socket.emit("server:canvasFull", { max: maxBoardCollaborators, reason: refusal.reason });
                            return;
                        }

                        const color = present.find((other) => other.socketId === socket.id)?.color ?? nextPresenceColor(present);
                        // Names come from the account, never the client, so nobody can join as someone else.
                        const username = await getUsername(socket.userId);
                        const agent = socket.principal.agent;
                        const participant = agent
                            ? { userId: socket.userId, role, name: `${agent} for ${username ?? "someone"}`, color, via: "mcp" }
                            : { userId: socket.userId, role, name: username ?? guestNameFor(color), color };
                        try {
                            await canvasStore.addParticipant(shareId, socket.id, participant);
                        } catch {
                            // A close already under way when this join began can still remove the
                            // room; it closes only once saved, so reopen it from that save.
                            await ensureRoomLoaded(shareId);
                            await canvasStore.addParticipant(shareId, socket.id, participant);
                        }
                        canvasAccessed[socket.id] = shareId;
                        recordRoomOccupancy(await canvasStore.getParticipantCount(shareId));
                        markRoomOfFive([...present.map((other) => other.userId), socket.userId]);

                        socket.join(shareId);
                        socket.emit("server:joinedRoom", {
                            elements: await canvasStore.getElements(shareId),
                            comments: await getCommentsForShareId(shareId),
                            background: await canvasStore.getBackground(shareId),
                            role,
                        });
                        await workshop.sendWorkshopState(socket, shareId);
                        await broadcastPresence(shareId);
                    } finally {
                        trackJoin(shareId, -1);
                    }
                },
                {
                    // Nothing tells a joining client otherwise, so it would wait forever.
                    onError: () => socket.emit("server:boardLoadFailed"),
                },
            ),
        );

        // Ephemeral, and socket.rooms is authoritative locally; socket.to skips the sender.
        socket.on(
            "client:cursorMove",
            safeHandler(socket, "client:cursorMove", (payload) => {
                const parsed = parsePayload(cursorMoveSchema, socket, "client:cursorMove", payload);
                if (!parsed) return;
                const { shareId, x, y } = parsed;

                if (!socket.rooms.has(shareId)) return;

                recordPresenceEvent(shareId);
                socket.to(shareId).emit("server:cursorMove", { socketId: socket.id, x, y });
            }),
        );

        // Relayed for the length of the gesture, never persisted.
        socket.on(
            "client:laserPoint",
            safeHandler(socket, "client:laserPoint", (payload) => {
                const parsed = parsePayload(laserPointSchema, socket, "client:laserPoint", payload);
                if (!parsed) return;
                const { shareId, x, y } = parsed;

                if (!socket.rooms.has(shareId)) return;

                recordPresenceEvent(shareId);
                socket.to(shareId).emit("server:laserPoint", { socketId: socket.id, x, y });
            }),
        );

        // A participant's camera for followers and off-screen indicators; never persisted.
        socket.on(
            "client:cameraMove",
            safeHandler(socket, "client:cameraMove", (payload) => {
                const parsed = parsePayload(cameraMoveSchema, socket, "client:cameraMove", payload);
                if (!parsed) return;
                const { shareId, x, y, zoom } = parsed;

                if (!socket.rooms.has(shareId)) return;

                recordPresenceEvent(shareId);
                socket.to(shareId).emit("server:cameraMove", { socketId: socket.id, x, y, zoom });
            }),
        );

        // Announces presenting so others can follow; the following itself rides on cameraMove.
        socket.on(
            "client:presentationUpdate",
            safeHandler(socket, "client:presentationUpdate", (payload) => {
                const parsed = parsePayload(presentationUpdateSchema, socket, "client:presentationUpdate", payload);
                if (!parsed) return;
                const { shareId, presenting } = parsed;

                if (!socket.rooms.has(shareId)) return;

                io.to(shareId).emit("server:presentationUpdate", { socketId: socket.id, presenting });
            }),
        );

        socket.on(
            "client:followUpdate",
            safeHandler(socket, "client:followUpdate", async (payload) => {
                const parsed = parsePayload(followUpdateSchema, socket, "client:followUpdate", payload);
                if (!parsed) return;
                const { shareId, targetSocketId } = parsed;

                if (!socket.rooms.has(shareId)) return;

                const previousTarget = socket.data.followingSocketId ?? null;
                socket.data.followingSocketId = targetSocketId;
                await Promise.all([notifyFollowers(shareId, previousTarget), notifyFollowers(shareId, targetSocketId)]);
            }),
        );

        // Clients not editing this element ignore it; the text itself lands through updateCanvas.
        socket.on(
            "client:textSync",
            safeHandler(socket, "client:textSync", async (payload) => {
                const parsed = parsePayload(textSyncSchema, socket, "client:textSync", payload);
                if (!parsed) return;
                const { shareId, elementId, update, wantsState = false, isState = false } = parsed;

                if (!socket.rooms.has(shareId)) return;
                // An editor saves whatever merged into the note, so text from anyone who cannot edit never reaches it.
                const participant = await canvasStore.getParticipant(shareId, socket.id);
                if (!participant || !canEdit(participant.role)) return;

                socket.to(shareId).emit("server:textSync", { elementId, update, wantsState, isState });
            }),
        );

        socket.on(
            "client:updateCanvas",
            safeHandler(socket, "client:updateCanvas", async (payload) => {
                const parsed = parsePayload(updateCanvasSchema, socket, "client:updateCanvas", payload);
                if (!parsed) {
                    await rejectElementChange(socket, canvasStore, payload, "invalid");
                    return;
                }
                const { shareId, operation, elementId, element, turnId, changed } = parsed;
                const agentTurn = socket.principal.agent ? { agentId: socket.principal.agent, correlationId: turnId ?? null } : {};

                if (!socket.rooms.has(shareId)) {
                    socket.emit("server:canvasNotFound");
                    return;
                }

                // Only editors and owners mutate; everyone in the room still receives broadcasts.
                const participant = await canvasStore.getParticipant(shareId, socket.id);
                if (!participant || !canEdit(participant.role)) {
                    socket.emit("server:canvasAccessDenied");
                    await rejectElementChange(socket, canvasStore, parsed, "denied");
                    return;
                }

                // Every write shares one version counter with delete, so a tombstone outranks a late stale write.
                if (operation === "insert" || operation === "redo" || operation === "update") {
                    await applyElementUpsert(
                        {
                            shareId,
                            elementId,
                            element,
                            operation,
                            changedFields: operation === "update" ? changed : undefined,
                            authorId: socket.userId,
                            authorName: participant.name,
                            ...agentTurn,
                        },
                        { io, canvasStore },
                    );
                } else if (operation === "delete" || operation === "undo") {
                    await applyElementDelete({ shareId, elementId, authorId: socket.userId, authorName: participant.name, ...agentTurn }, { io, canvasStore });
                }
            }),
        );

        // Sent to the whole room, sender included: one small value that every client takes as confirmed.
        socket.on(
            "client:updateBackground",
            safeHandler(socket, "client:updateBackground", async (payload) => {
                const parsed = parsePayload(updateBackgroundSchema, socket, "client:updateBackground", payload);
                if (!parsed) return;
                const { shareId, background } = parsed;

                if (!socket.rooms.has(shareId)) {
                    socket.emit("server:canvasNotFound");
                    return;
                }

                const participant = await canvasStore.getParticipant(shareId, socket.id);
                if (!participant || !canEdit(participant.role)) {
                    socket.emit("server:canvasAccessDenied");
                    return;
                }

                await canvasStore.setBackground(shareId, background);
                io.to(boardAndWatchers(shareId)).emit("server:backgroundUpdated", { background });
                await canvasStore.markDirty(shareId);
                await appendOp({
                    shareId,
                    opType: "background",
                    elementId: null,
                    after: background,
                    authorId: socket.userId,
                    authorName: participant.name,
                });
                recordOp();
                recordRoomOp(shareId);
            }),
        );

        registerBoardWideHandlers(socket);
        registerCommentHandlers(socket);
        workshop.register(socket);

        socket.on(
            "disconnect",
            safeHandler(socket, "disconnect", () => leaveCurrentRoom(socket)),
        );
    });

    const opsPerSecTimer = startOpsPerSecTicker();

    const autosaveTimer = setInterval(() => {
        sweepDirtyBoards({ emitSaved: true }).catch((error) => {
            logger.error({ err: error }, "autosave sweep failed");
        });
    }, AUTOSAVE_INTERVAL_MS);

    // Render sends SIGTERM on every deploy; flush everything dirty before
    // the process actually exits so a deploy never loses in-flight strokes.
    process.on("SIGTERM", async () => {
        logger.info("SIGTERM received, flushing dirty canvases before exit");
        clearInterval(autosaveTimer);
        clearInterval(opsPerSecTimer);

        await sweepDirtyBoards({ emitSaved: false });

        process.exit(0);
    });
};

export default socketLogic;
