import { useSyncExternalStore } from "react";

// Hands camera changes to the few components that draw in screen space, once
// per animation frame, so a pan never re-renders the whole board.
export const createCameraStore = (initialCamera) => {
    let published = initialCamera;
    const listeners = new Set();
    return {
        get: () => published,
        publish: (camera) => {
            if (camera === published) return;
            published = camera;
            listeners.forEach((listener) => listener());
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
};

export const WithCamera = ({ store, children }) => children(useSyncExternalStore(store.subscribe, store.get, store.get));
