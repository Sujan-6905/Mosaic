import { downloadPublic } from "./publicFetch.js";
import { isFontFileBytes } from "../../../shared/canvas/elements/fontSources.js";
import { isRasterImageBytes } from "../../../shared/canvas/elements/hostedUploads.js";
import { currentTurnId } from "../toolTurns.js";

const MAX_FONT_FILE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;
const RENEW_BEFORE_MS = 60 * 1000;

class BackendError extends Error {
    constructor(message, status) {
        super(message);
        this.name = "BackendError";
        this.status = status;
    }
}

const segment = (value) => encodeURIComponent(String(value));

// One person's way into the backend: a fixed token, a function returning the current one,
// or a username and password that sign in and renew the short-lived access token.
export const createBackendClient = ({ apiUrl, credentials }) => {
    const request = async (path, { method = "GET", body, token } = {}) => {
        // The tool call this request belongs to, so the board groups an agent's changes by call.
        const turnId = currentTurnId();
        const res = await fetch(`${apiUrl}${path}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                ...(turnId ? { "X-Correlation-Id": turnId } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new BackendError(data?.message || `${method} ${path} failed with ${res.status}`, res.status);
        return data;
    };

    let session = null;
    let pending = null;
    const hasFixedToken = Boolean(credentials.token);
    const fixedToken = () => (typeof credentials.token === "function" ? credentials.token() : credentials.token);

    const signIn = () => request("/api/auth/login", { method: "POST", body: { username: credentials.username, password: credentials.password } });

    const renew = async () => {
        if (session?.refreshToken) {
            try {
                return await request("/api/auth/session/refresh", { method: "POST", body: { refreshToken: session.refreshToken } });
            } catch (error) {
                if (error.status !== 401) throw error;
            }
        }
        return signIn();
    };

    const resolveToken = async ({ force = false } = {}) => {
        if (hasFixedToken) return fixedToken();
        const fresh = session && Date.now() < session.accessTokenExpiresAt - RENEW_BEFORE_MS;
        if (fresh && !force) return session.token;
        pending ??= renew()
            .then((data) => {
                session = data;
                return data.token;
            })
            .finally(() => {
                pending = null;
            });
        return pending;
    };

    const authed = async (path, options = {}) => {
        try {
            return await request(path, { ...options, token: await resolveToken() });
        } catch (error) {
            if (error.status !== 401 || hasFixedToken) throw error;
            return request(path, { ...options, token: await resolveToken({ force: true }) });
        }
    };

    const uploadToBoardStorage = async (bytes, fileName, resourceType) => {
        const signed = await authed("/api/upload/cloudinary-signature");
        const form = new FormData();
        form.append("file", new Blob([bytes]), fileName);
        form.append("api_key", signed.apiKey);
        form.append("timestamp", String(signed.timestamp));
        form.append("signature", signed.signature);
        if (signed.folder) form.append("folder", signed.folder);
        const upload = await fetch(`https://api.cloudinary.com/v1_1/${segment(signed.cloudName)}/${resourceType}/upload`, { method: "POST", body: form });
        const uploaded = await upload.json().catch(() => null);
        if (!upload.ok || !uploaded?.secure_url) throw new Error(uploaded?.error?.message || "The upload failed");
        return uploaded;
    };

    // Copies an agent-supplied font file into the app's uploads so viewers never fetch it
    // from that site; anything that isn't a font file is refused.
    const copyLinkedFont = async (link, family) => {
        const bytes = await downloadPublic(link, { maxBytes: MAX_FONT_FILE_BYTES, tooBig: "Font files can be up to 5 MB" });
        if (!isFontFileBytes(bytes)) throw new Error("That link didn't return a font file");
        const extension = new URL(link).pathname.split(".").pop().toLowerCase();
        return (await uploadToBoardStorage(bytes, `${family}.${extension}`, "raw")).secure_url;
    };

    // The same for a picture: viewers only ever load it from the app's uploads.
    const copyLinkedImage = async (link) => {
        const bytes = await downloadPublic(link, { maxBytes: MAX_IMAGE_FILE_BYTES, tooBig: "Images can be up to 10 MB", accept: "image/*" });
        if (!isRasterImageBytes(bytes)) throw new Error("That link didn't return a PNG, JPEG, GIF or WebP image");
        const uploaded = await uploadToBoardStorage(bytes, "image", "image");
        return { src: uploaded.secure_url, publicId: uploaded.public_id };
    };

    return {
        getAuthToken: () => resolveToken(),
        copyLinkedFont,
        copyLinkedImage,
        // Titles and sizes only: an agent reads a board's content by opening it.
        listBoards: async () => {
            const { ownedDrawings = [], sharedWithDrawings = [] } = (await authed("/api/drawing/get")).data;
            const summary =
                (access) =>
                ({ shareId, title, updatedAt, elementCount }) => ({ shareId, title, updatedAt, access, elementCount });
            return [...ownedDrawings.map(summary("owner")), ...sharedWithDrawings.map(summary("shared"))];
        },
        createBoard: async (title) => (await authed("/api/drawing/create", { method: "POST", body: { title } })).data,
        getBoardMetadata: async (shareId) => (await authed(`/api/drawing/getById/${segment(shareId)}`)).data,
        // The grounding endpoints return their own payload directly, with no {data} envelope.
        getBoardContext: (shareId, { viewport = null, selection = [] } = {}) =>
            authed(`/api/grounding/${segment(shareId)}/context`, { method: "POST", body: { viewport, selection } }),
        resolveBoardReference: (shareId, description, { viewport = null, selection = [] } = {}) =>
            authed(`/api/grounding/${segment(shareId)}/resolve`, { method: "POST", body: { description, viewport, selection } }),
        // Runs the full resolve, sanitize, shadow, lint, repair and commit pipeline
        // server-side and broadcasts the result live, exactly like a person's edit.
        editBoard: (shareId, instruction) => authed(`/api/ai/${segment(shareId)}/turn`, { method: "POST", body: { message: instruction, review: "direct" } }),
        listVersions: async (shareId) => (await authed(`/api/drawing/${segment(shareId)}/versions`)).versions,
        previewVersion: (shareId, seq) => authed(`/api/drawing/${segment(shareId)}/versions/${segment(Number(seq))}/preview`),
        saveVersion: async (shareId, name) => (await authed(`/api/drawing/${segment(shareId)}/versions`, { method: "POST", body: { name } })).data,
        branchBoard: async (shareId, seq = null) => (await authed(`/api/drawing/${segment(shareId)}/fork`, { method: "POST", body: { seq } })).data,
        listBranches: async (shareId) => (await authed(`/api/drawing/${segment(shareId)}/branches`)).branches,
        previewMerge: (branchShareId, direction) => authed(`/api/drawing/${segment(branchShareId)}/merge?direction=${segment(direction)}`),
        applyMerge: (branchShareId, body) => authed(`/api/drawing/${segment(branchShareId)}/merge`, { method: "POST", body }),
        listPieceSets: async () => (await authed("/api/pieces")).sets,
        getSharedPieceSet: async (setId) => (await authed(`/api/pieces/shared/${segment(setId)}`)).set,
        createPieceSet: async (body) => (await authed("/api/pieces", { method: "POST", body })).set,
        addPiece: async (setId, piece) => (await authed(`/api/pieces/${segment(setId)}/pieces`, { method: "POST", body: piece })).piece,
        searchIcons: (query, sets) => authed(`/api/icons/search?q=${segment(query)}${sets ? `&set=${segment(sets)}` : ""}&limit=40`),
        getIcon: async (set, name) => (await authed(`/api/icons/${segment(set)}/${segment(name)}`)).icon,
        agentActivity: (shareId) => authed(`/api/drawing/${segment(shareId)}/agent-activity`),
        undoAgentTurn: (shareId, turnId) => authed(`/api/drawing/${segment(shareId)}/agent-activity/${segment(turnId)}/undo`, { method: "POST" }),
    };
};
