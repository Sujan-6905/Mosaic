import { io as ioClient } from "socket.io-client";
import { currentTurnId } from "../toolTurns.js";
import { hasAtLeastRank, ROLES } from "../../../backend/src/models/accessControl.js";

const JOIN_TIMEOUT_MS = 10000;
const WRITE_TIMEOUT_MS = 10000;

const genElementId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

// One live socket per board, reused across tool calls, so an agent edits through the same
// realtime path and server-side checks as a person in the room.
class BoardSession {
    constructor(shareId, { apiUrl, getAuthToken }) {
        this.shareId = shareId;
        this.apiUrl = apiUrl;
        this.getAuthToken = getAuthToken;
        this.elements = new Map();
        this.comments = new Map();
        this.participants = null;
        this.background = null;
        this.role = null;
        this.socket = null;
        this.readyPromise = null;
        this.changeListeners = new Set();
    }

    async ensureReady() {
        // A failed join is forgotten, so the next call tries again rather than repeating the failure.
        this.readyPromise ??= this._connect().catch((error) => {
            this.readyPromise = null;
            this.socket?.disconnect();
            throw error;
        });
        return this.readyPromise;
    }

    async _connect() {
        const token = await this.getAuthToken();
        const socket = ioClient(this.apiUrl, {
            auth: { token },
            transports: ["websocket"],
            reconnection: false,
        });
        this.socket = socket;
        // A dropped connection (a restart, or the sign-in ending) is rejoined on the next call.
        socket.on("disconnect", () => {
            this.readyPromise = null;
        });

        socket.on("server:addNewElement", ({ elementId, element }) => {
            this.elements.set(elementId, element);
            this._changed();
        });
        socket.on("server:updateElement", ({ elementId, element }) => {
            this.elements.set(elementId, element);
            this._changed();
        });
        socket.on("server:deleteElement", ({ elementId }) => {
            this.elements.delete(elementId);
            this._changed();
        });
        socket.on("server:backgroundUpdated", ({ background }) => {
            this.background = background;
        });
        socket.on("server:commentAdded", (comment) => {
            this.comments.set(comment._id, comment);
            this._changed();
        });
        socket.on("server:commentUpdated", (comment) => {
            this.comments.set(comment._id, comment);
            this._changed();
        });
        socket.on("server:commentDeleted", ({ commentId }) => {
            this.comments.delete(commentId);
            this._changed();
        });
        socket.on("server:presenceUpdate", (participants) => {
            this.participants = participants;
        });

        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Timed out joining board ${this.shareId}`)), JOIN_TIMEOUT_MS);

            socket.once("server:joinedRoom", ({ elements, comments, background, role }) => {
                clearTimeout(timer);
                this.elements = new Map(Object.entries(elements || {}));
                this.comments = new Map((comments || []).map((comment) => [comment._id, comment]));
                this.background = background;
                this.role = role;
                resolve();
            });
            socket.once("server:canvasNotFound", () => {
                clearTimeout(timer);
                reject(new Error(`Board "${this.shareId}" was not found`));
            });
            socket.once("server:canvasAccessDenied", () => {
                clearTimeout(timer);
                reject(new Error(`Access denied to board "${this.shareId}"`));
            });
            socket.once("server:canvasFull", ({ max }) => {
                clearTimeout(timer);
                reject(new Error(`Board "${this.shareId}" is at capacity (max ${max} collaborators)`));
            });
            socket.once("connect_error", (err) => {
                clearTimeout(timer);
                reject(new Error(`Could not connect to ${this.apiUrl}: ${err.message}`));
            });

            socket.emit("client:joinRoom", { shareId: this.shareId });
        });
    }

    assertCanComment() {
        if (!hasAtLeastRank(this.role, ROLES.COMMENTER)) {
            throw new Error(`This session has "${this.role}" access to board "${this.shareId}"; commenting requires commenter or above`);
        }
    }

    assertCanEdit() {
        if (!hasAtLeastRank(this.role, ROLES.EDITOR)) {
            throw new Error(`This session has "${this.role}" access to board "${this.shareId}"; editing requires editor or owner`);
        }
    }

    // Resolves on the room's echo of `elementId`, rejects on a denial or timeout. On an update,
    // `changed` names the fields this write owns; the room keeps everyone else's.
    async writeElement(operation, elementId, element, { changed } = {}) {
        await this.ensureReady();
        this.assertCanEdit();

        const expectedEvent = operation === "update" ? "server:updateElement" : "server:addNewElement";
        const result = await this._raceForElement(elementId, expectedEvent, () =>
            this.socket.emit("client:updateCanvas", { shareId: this.shareId, operation, elementId, element, ...(changed ? { changed } : {}), ...this._turn() }),
        );
        return result;
    }

    async deleteElement(elementId) {
        await this.ensureReady();
        this.assertCanEdit();

        return this._raceForEvent(
            "server:deleteElement",
            (payload) => payload.elementId === elementId,
            () => this.socket.emit("client:updateCanvas", { shareId: this.shareId, operation: "delete", elementId, ...this._turn() }),
        );
    }

    // The protocol has no request id, so a collaborator's background change landing in the
    // same instant can resolve this first.
    async setBackground(background) {
        await this.ensureReady();
        this.assertCanEdit();

        await this._raceForEvent(
            "server:backgroundUpdated",
            () => true,
            () => this.socket.emit("client:updateBackground", { shareId: this.shareId, background }),
        );
        return this.background;
    }

    async clearBoard() {
        await this.ensureReady();
        if (this.role !== ROLES.OWNER) {
            throw new Error(`Clearing a board requires ownership; this session has "${this.role}" access`);
        }

        const { elementOps } = await this._raceForEvent(
            "server:boardCleared",
            () => true,
            () => this.socket.emit("client:clearBoard", { shareId: this.shareId }),
        );
        return elementOps.length;
    }

    // Comment events carry no request id, so a write is matched by what it
    // changed: the new thread's text, or the id of the thread it touched.
    async addComment(anchor, text) {
        await this.ensureReady();
        this.assertCanComment();
        return this._raceForEvent(
            "server:commentAdded",
            (comment) => comment.text === text.trim(),
            () => this.socket.emit("client:addComment", { shareId: this.shareId, anchor, text }),
        );
    }

    async replyToComment(commentId, text) {
        await this.ensureReady();
        this.assertCanComment();
        return this._raceForEvent(
            "server:commentUpdated",
            (comment) => comment._id === commentId,
            () => this.socket.emit("client:addCommentReply", { shareId: this.shareId, commentId, text }),
        );
    }

    async resolveComment(commentId, resolved) {
        await this.ensureReady();
        this.assertCanComment();
        return this._raceForEvent(
            "server:commentUpdated",
            (comment) => comment._id === commentId,
            () => this.socket.emit("client:resolveComment", { shareId: this.shareId, commentId, resolved }),
        );
    }

    async deleteComment(commentId) {
        await this.ensureReady();
        this.assertCanComment();
        await this._raceForEvent(
            "server:commentDeleted",
            (payload) => payload.commentId === commentId,
            () => this.socket.emit("client:deleteComment", { shareId: this.shareId, commentId }),
        );
    }

    async restoreVersion(seq) {
        await this.ensureReady();
        this.assertCanEdit();
        const { elementOps } = await this._raceForEvent(
            "server:versionRestored",
            (payload) => payload.seq === seq,
            () => this.socket.emit("client:restoreVersion", { shareId: this.shareId, seq }),
        );
        return elementOps.length;
    }

    // The room announces who is here right after a join; a call made in that
    // instant waits briefly for it rather than reporting an empty room.
    async listParticipants() {
        await this.ensureReady();
        if (this.participants) return this.participants;
        return this._raceForEvent(
            "server:presenceUpdate",
            () => true,
            () => {},
        ).catch(() => []);
    }

    async moveCursor(x, y) {
        await this.ensureReady();
        this.socket.emit("client:cursorMove", { shareId: this.shareId, x, y });
    }

    async _raceForElement(elementId, eventName, emit) {
        await this._raceForEvent(eventName, (payload) => payload.elementId === elementId, emit);
        return this.elements.get(elementId);
    }

    _raceForEvent(eventName, matches, emit) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                cleanup();
                reject(new Error(`Timed out waiting for "${eventName}" on board "${this.shareId}"`));
            }, WRITE_TIMEOUT_MS);

            const onEvent = (payload) => {
                if (!matches(payload)) return;
                cleanup();
                resolve(payload);
            };
            const onDenied = () => {
                cleanup();
                reject(new Error(`Access denied on board "${this.shareId}"`));
            };
            const cleanup = () => {
                clearTimeout(timer);
                this.socket.off(eventName, onEvent);
                this.socket.off("server:canvasAccessDenied", onDenied);
                this.socket.off("server:canvasNotFound", onDenied);
            };

            this.socket.on(eventName, onEvent);
            this.socket.once("server:canvasAccessDenied", onDenied);
            this.socket.once("server:canvasNotFound", onDenied);
            emit();
        });
    }

    listElements() {
        return this.elements;
    }

    _turn() {
        const turnId = currentTurnId();
        return turnId ? { turnId } : {};
    }

    // Called (debounced by the caller) whenever anything on the board changes.
    onChange(listener) {
        this.changeListeners.add(listener);
        return () => this.changeListeners.delete(listener);
    }

    _changed() {
        this.changeListeners.forEach((listener) => listener());
    }

    close() {
        this.socket?.disconnect();
    }
}

// shareId -> BoardSession for one agent, so repeated calls reuse one connection.
export const createBoardSessions = ({ apiUrl, getAuthToken }) => {
    const sessions = new Map();
    return {
        get(shareId) {
            if (!sessions.has(shareId)) sessions.set(shareId, new BoardSession(shareId, { apiUrl, getAuthToken }));
            return sessions.get(shareId);
        },
        closeAll() {
            for (const session of sessions.values()) session.close();
            sessions.clear();
        },
        // Boards someone has subscribed to stay open; their changes are still wanted.
        closeUnwatched() {
            for (const [shareId, session] of sessions) {
                if (session.changeListeners.size > 0) continue;
                session.close();
                sessions.delete(shareId);
            }
        },
    };
};

export { genElementId };
