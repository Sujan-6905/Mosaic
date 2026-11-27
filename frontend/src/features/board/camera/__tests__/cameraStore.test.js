import { describe, it, expect, vi } from "vitest";
import { createCameraStore } from "../cameraStore.js";

describe("createCameraStore", () => {
    it("notifies subscribers only when the camera actually changes", () => {
        const initial = { x: 0, y: 0, zoom: 1 };
        const store = createCameraStore(initial);
        const listener = vi.fn();
        store.subscribe(listener);

        store.publish(initial);
        expect(listener).not.toHaveBeenCalled();

        const moved = { x: 5, y: 0, zoom: 1 };
        store.publish(moved);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(store.get()).toBe(moved);
    });

    it("stops notifying after unsubscribing", () => {
        const store = createCameraStore({ x: 0, y: 0, zoom: 1 });
        const listener = vi.fn();
        store.subscribe(listener)();
        store.publish({ x: 1, y: 0, zoom: 1 });
        expect(listener).not.toHaveBeenCalled();
    });
});
