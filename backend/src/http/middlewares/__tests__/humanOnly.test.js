import { describe, it, expect, vi } from "vitest";
import humanOnly from "../humanOnly.js";

const run = (user) => {
    const res = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    humanOnly({ user }, res, next);
    return { res, next };
};

describe("account settings only answer a person's full sign-in", () => {
    it("lets a person through", () => {
        expect(run({ userId: "u1", boards: null, agent: null }).next).toHaveBeenCalled();
    });

    it("refuses an agent", () => {
        expect(run({ userId: "u1", agent: "Claude" }).res.status).toHaveBeenCalledWith(403);
    });

    it("refuses a sign-in limited to some boards, such as an embed's", () => {
        const { res, next } = run({ userId: "u1", boards: ["b1"], agent: null });
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
});
