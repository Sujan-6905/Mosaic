import { expect } from "@playwright/test";
import { io } from "socket.io-client";

export const FRONTEND_URL = process.env.E2E_BASE_URL || "http://localhost:3100";
export const BACKEND_URL = process.env.E2E_BACKEND_URL || "http://localhost:5100";
const PASSWORD = "TestPass123!";

export const randomUsername = (prefix) => `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

const sessionFields = ({ token, refreshToken, accessTokenExpiresAt }) => ({ token, refreshToken, tokenExpiresAt: accessTokenExpiresAt });

export const registerAccount = async (request, prefix = "e2e") => {
    const username = randomUsername(prefix);
    const response = await request.post(`${BACKEND_URL}/api/auth/register`, { data: { username, password: PASSWORD } });
    expect(response.ok(), await response.text()).toBe(true);
    const session = await response.json();
    return { username, userId: session.user._id, ...sessionFields(session) };
};

// Access tokens last 15 minutes, so an account kept for a whole run renews its own.
export const keepTokenFresh = async (request, account) => {
    if (account.tokenExpiresAt - Date.now() > 5 * 60 * 1000) return;
    const response = await request.post(`${BACKEND_URL}/api/auth/session/refresh`, { data: { refreshToken: account.refreshToken } });
    expect(response.ok()).toBe(true);
    Object.assign(account, sessionFields(await response.json()));
};

export const deleteAccount = (request, account) =>
    request.delete(`${BACKEND_URL}/api/auth/account`, { headers: bearer(account.token), data: { username: account.username, password: PASSWORD } });

export const createBoard = async (request, account, title = "E2E board") => {
    const response = await request.post(`${BACKEND_URL}/api/drawing/create`, { headers: bearer(account.token), data: { title, userId: account.userId } });
    expect(response.ok()).toBe(true);
    const { data } = await response.json();
    return { title, drawingId: data._id, shareId: data.shareId };
};

// Purged straight away, since a delete alone keeps the board under Recently deleted for 30 days.
export const deleteBoard = async (request, account, board) => {
    await request.delete(`${BACKEND_URL}/api/drawing/delete/${board.drawingId}`, { headers: bearer(account.token) });
    await request.delete(`${BACKEND_URL}/api/drawing/purge/${board.drawingId}`, { headers: bearer(account.token) });
};

export const findBoard = async (request, account, shareId) => {
    const response = await request.get(`${BACKEND_URL}/api/drawing/getById/${shareId}`, { headers: bearer(account.token) });
    return response.ok() ? (await response.json()).data : null;
};

export const addCollaborator = async (request, owner, board, collaborator, role) => {
    const response = await request.put(`${BACKEND_URL}/api/drawing/collaborators/${board.shareId}`, {
        headers: bearer(owner.token),
        data: { username: collaborator.username, role },
    });
    expect(response.ok()).toBe(true);
};

export const updateBoardSettings = async (request, owner, board, settings) => {
    const response = await request.patch(`${BACKEND_URL}/api/drawing/${board.shareId}/settings`, { headers: bearer(owner.token), data: settings });
    expect(response.ok()).toBe(true);
};

export const authorizedRequest = (request, account, method, path, data) => request[method](`${BACKEND_URL}${path}`, { headers: bearer(account.token), data });

// Signs a browser context in through next-auth's own credentials endpoint, the
// same one the sign-in form posts to, so the session cookie lands in the context.
export const signIn = async (context, account) => {
    const { csrfToken } = await (await context.request.get(`${FRONTEND_URL}/api/auth/csrf`)).json();
    const response = await context.request.post(`${FRONTEND_URL}/api/auth/callback/credentials`, {
        form: { csrfToken, username: account.username, password: PASSWORD, json: "true" },
    });
    expect(response.ok()).toBe(true);
    expect((await response.json()).url).not.toContain("error");
};

const connectRoomSocket = (account, board, name = "seed") =>
    new Promise((resolve, reject) => {
        const socket = io(BACKEND_URL, { auth: { token: account.token }, transports: ["websocket"], forceNew: true });
        socket.once("connect_error", reject);
        socket.once("server:joinedRoom", (state) => resolve(Object.assign(socket, { joinedState: state })));
        socket.once("connect", () => socket.emit("client:joinRoom", { shareId: board.shareId, name }));
    });

// Writes elements as a collaborator would, waiting for the server to apply each one.
export const writeElements = async (account, board, changes) => {
    const socket = await connectRoomSocket(account, board);
    for (const { elementId, element, operation = "insert" } of changes) {
        const applied = new Promise((resolve) => socket.once(operation === "insert" ? "server:addNewElement" : "server:updateElement", resolve));
        socket.emit("client:updateCanvas", { shareId: board.shareId, operation, elementId, element });
        await applied;
    }
    socket.disconnect();
};

// What the server holds, read by joining the room the way a second person would.
export const readElements = async (account, board) => {
    const socket = await connectRoomSocket(account, board, "check");
    socket.disconnect();
    return socket.joinedState.elements;
};

export const rectangle = ({ x = 100, y = 100, width = 160, height = 80, ...rest } = {}) => ({
    type: "shape",
    shapeType: "Rectangle",
    startX: x,
    startY: y,
    endX: x + width,
    endY: y + height,
    color: "#000000",
    size: 2,
    opacity: 100,
    zIndex: 1,
    rotation: 0,
    ...rest,
});
