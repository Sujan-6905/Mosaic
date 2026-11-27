import { describe, it, expect } from "vitest";
import { capacityRefusal, guestNameFor, nextPresenceColor, MAX_CONNECTIONS_PER_PERSON } from "../roomCapacity.js";

const person = (userId, socketId, extra = {}) => ({ userId, socketId, role: "viewer", color: "#000", ...extra });
const fullOfViewers = (count) => Array.from({ length: count }, (_, i) => person(`viewer-${i}`, `s-${i}`));

describe("who may join a busy board", () => {
    it("counts people rather than connections, so one account's tabs don't fill it", () => {
        const present = Array.from({ length: 5 }, (_, i) => person("viewer", `tab-${i}`));
        expect(capacityRefusal({ present, socketId: "new", userId: "editor", role: "editor", maxPeople: 2 })).toBeNull();
    });

    it("refuses a new person once the board holds as many people as it allows", () => {
        expect(capacityRefusal({ present: fullOfViewers(2), socketId: "new", userId: "late", role: "editor", maxPeople: 2 })).toEqual({
            reason: "full",
            people: 2,
        });
    });

    it("always lets the owner in, and anyone already there open another tab", () => {
        expect(capacityRefusal({ present: fullOfViewers(2), socketId: "new", userId: "owner", role: "owner", maxPeople: 2 })).toBeNull();
        expect(capacityRefusal({ present: fullOfViewers(2), socketId: "new", userId: "viewer-0", role: "viewer", maxPeople: 2 })).toBeNull();
    });

    it("lets a connection re-join after its role changed even when the board is full", () => {
        expect(capacityRefusal({ present: fullOfViewers(2), socketId: "s-1", userId: "viewer-1", role: "viewer", maxPeople: 2 })).toBeNull();
    });

    it("caps how many connections one account holds", () => {
        const present = Array.from({ length: MAX_CONNECTIONS_PER_PERSON }, (_, i) => person("greedy", `tab-${i}`));
        expect(capacityRefusal({ present, socketId: "one-more", userId: "greedy", role: "owner", maxPeople: 50 })?.reason).toBe("tooManyConnections");
    });
});

describe("presence colours", () => {
    it("reuses a colour freed by someone leaving instead of doubling one up", () => {
        const present = [person("a", "1", { color: "#ef4444" }), person("c", "3", { color: "#eab308" })];
        expect(nextPresenceColor(present)).toBe("#f97316");
    });

    it("names a guest after the stone their cursor colour comes from, so two guests in a room never share a name", () => {
        const first = nextPresenceColor([]);
        const second = nextPresenceColor([person("a", "1", { color: first })]);
        expect(guestNameFor(first)).toBe("Guest Jasper");
        expect(guestNameFor(second)).toBe("Guest Carnelian");
    });
});
