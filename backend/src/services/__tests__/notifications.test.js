import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
const query = vi.fn();
vi.mock("../../models/notificationSchema.js", () => ({ default: { create: (...args) => create(...args) } }));
vi.mock("ottoman", () => ({ getDefaultInstance: () => ({ query: (...args) => query(...args) }) }));
const pushToUser = vi.fn().mockResolvedValue(1);
vi.mock("../webPush.js", () => ({
    pushToUser: (...args) => pushToUser(...args),
    mentionMessage: (notice) => ({ title: `${notice.actorName} mentioned you` }),
}));
const { notify, listNotifications, markNotificationsRead, userRoom } = await import("../notifications.js");

// `onBoard` lists the people with the board open, as socket.data carries them across instances.
const fakeIo = (onBoard = []) => {
    const emit = vi.fn();
    const fetchSockets = vi.fn().mockResolvedValue(onBoard.map((userId) => ({ data: { principal: { userId } } })));
    return { emit, io: { to: vi.fn(() => ({ emit })), in: vi.fn(() => ({ fetchSockets })) } };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
    vi.clearAllMocks();
});

describe("notify", () => {
    it("stores the notice and pushes it to every connection the person has", async () => {
        create.mockResolvedValue({
            _id: "n1",
            kind: "mention",
            shareId: "b1",
            boardTitle: "Plan",
            actorName: "ava",
            preview: "hi",
            createdAt: "2026-11-11T10:00:00.000Z",
        });
        const { io, emit } = fakeIo();

        await notify("u1", { kind: "mention", shareId: "b1" }, { io });

        expect(create).toHaveBeenCalledWith({ userId: "u1", kind: "mention", shareId: "b1" });
        expect(io.to).toHaveBeenCalledWith(userRoom("u1"));
        expect(emit).toHaveBeenCalledWith("server:notification", expect.objectContaining({ id: "n1", kind: "mention", read: false, boardTitle: "Plan" }));
    });

    it("pushes a mention to the person's devices when they don't have the board open", async () => {
        create.mockResolvedValue({ _id: "n2", kind: "mention", shareId: "b1", createdAt: "2026-11-11T10:00:00.000Z" });
        await notify("u1", { kind: "mention", shareId: "b1", actorName: "ava" }, { io: fakeIo(["someone-else"]).io });
        await settle();
        expect(pushToUser).toHaveBeenCalledWith("u1", { title: "ava mentioned you" });
    });

    it("doesn't push a mention to someone already looking at the board, nor push other notices", async () => {
        create.mockResolvedValue({ _id: "n3", kind: "mention", shareId: "b1", createdAt: "2026-11-11T10:00:00.000Z" });
        await notify("u1", { kind: "mention", shareId: "b1", actorName: "ava" }, { io: fakeIo(["u1"]).io });
        await notify("u1", { kind: "shared", shareId: "b1" }, { io: fakeIo().io });
        await settle();
        expect(pushToUser).not.toHaveBeenCalled();
    });

    it("never fails what caused it when the notice can't be stored", async () => {
        create.mockRejectedValue(new Error("db down"));
        const { io, emit } = fakeIo();
        await expect(notify("u1", { kind: "shared", shareId: "b1" }, { io })).resolves.toBeNull();
        expect(emit).not.toHaveBeenCalled();
    });
});

describe("listNotifications", () => {
    it("returns the latest notices with plain ids and the unread count", async () => {
        query
            .mockResolvedValueOnce({ rows: [{ _id: "Notification::n1", kind: "shared", shareId: "b1", createdAt: "x", readAt: null }] })
            .mockResolvedValueOnce({ rows: [{ unread: 3 }] });
        const result = await listNotifications("u1");
        expect(result).toEqual({ notifications: [expect.objectContaining({ id: "n1", kind: "shared", read: false })], unread: 3 });
        expect(query.mock.calls[0][1]).toEqual({ parameters: { userId: "u1" } });
    });
});

describe("markNotificationsRead", () => {
    it("marks only the named notices of this person", async () => {
        query.mockResolvedValue({ rows: [] });
        await markNotificationsRead("u1", ["n1"]);
        const [sql, { parameters }] = query.mock.calls[0];
        expect(sql).toContain("n.userId = $userId");
        expect(parameters).toMatchObject({ userId: "u1", keys: ["Notification::n1"] });
    });
});
