import { describe, it, expect, vi, beforeEach } from "vitest";

const findOne = vi.fn();
const liveScene = vi.fn();
const embedRole = vi.fn();
const linkRole = vi.fn();

vi.mock("../../services/boards.js", () => ({ findDrawingByShareId: (...args) => findOne(...args) }));
vi.mock("../../liveRooms/liveScene.js", () => ({ getLiveOrPersistedScene: (...args) => liveScene(...args) }));
vi.mock("../../models/accessControl.js", () => ({ WATCH_ROLES: { embed: (...args) => embedRole(...args), link: (...args) => linkRole(...args) } }));
const { registerWatchHandlers } = await import("../watchHandlers.js");

const BOARD = { elements: { a: { type: "shape" } }, background: { type: "blank" } };
let calls;

const connect = ({ viewersAlready = 0, via = "embed" } = {}) => {
    const handlers = {};
    const socket = {
        principal: null,
        rooms: new Set(),
        on: (event, handler) => {
            handlers[event] = handler;
        },
        join: (room) => {
            socket.rooms.add(room);
            calls.push(["join", room]);
        },
        emit: (event, data) => calls.push([event, data]),
    };
    registerWatchHandlers(socket, { sockets: { adapter: { rooms: new Map([[`${via}:b1`, { size: viewersAlready }]]) } } });
    return () => handlers["watch:start"]({ shareId: "b1", via });
};

const watch = (options) => connect(options)();

describe("a view watching a board", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        calls = [];
        findOne.mockResolvedValue({ shareId: "b1" });
        embedRole.mockReturnValue("viewer");
        linkRole.mockReturnValue("viewer");
        liveScene.mockImplementation(async () => {
            calls.push(["read"]);
            return BOARD;
        });
    });

    it("joins the room before reading the board, so no change falls between the two", async () => {
        await watch();
        expect(calls).toEqual([["join", "embed:b1"], ["read"], ["watch:live", BOARD]]);
    });

    it("gives viewers who join together one shared read of the board", async () => {
        await Promise.all([watch(), watch(), watch()]);
        expect(liveScene).toHaveBeenCalledTimes(1);
        expect(calls.filter(([event]) => event === "watch:live")).toHaveLength(3);
    });

    it("ignores a socket asking again to watch a board it already watches", async () => {
        const watchAgain = connect();
        await watchAgain();
        await watchAgain();
        expect(liveScene).toHaveBeenCalledTimes(1);
        expect(findOne).toHaveBeenCalledTimes(1);
    });

    it("refuses a viewer the board doesn't admit, without joining or reading", async () => {
        embedRole.mockReturnValue(null);
        await watch();
        expect(calls).toEqual([["watch:refused", undefined]]);
    });

    it("sends a viewer past the live cap to snapshots instead of the room", async () => {
        await watch({ viewersAlready: 1000 });
        expect(calls).toEqual([["watch:snapshotOnly", undefined]]);
    });

    it("lets a signed-out visitor watch a board shared by link, from the link room, judged by the link's rule", async () => {
        embedRole.mockReturnValue(null);
        await watch({ via: "link" });
        expect(linkRole).toHaveBeenCalled();
        expect(calls).toEqual([["join", "link:b1"], ["read"], ["watch:live", BOARD]]);
    });

    it("ignores a request to watch through anything but an embed or the link", async () => {
        await watch({ via: "board" });
        expect(calls).toEqual([]);
        expect(findOne).not.toHaveBeenCalled();
    });
});
