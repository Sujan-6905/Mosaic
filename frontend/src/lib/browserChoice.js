import { useEffect, useState } from "react";

// An on/off preference kept in this browser only, announced with `event` whenever it changes.
export const readChoice = (key) => {
    try {
        return window.localStorage.getItem(key) === "1";
    } catch {
        return false;
    }
};

export const writeChoice = (key, on, event) => {
    try {
        if (on) window.localStorage.setItem(key, "1");
        else window.localStorage.removeItem(key);
    } catch {
        // Storage can be blocked; the choice then lasts for this page only.
    }
    window.dispatchEvent(new Event(event));
};

// Re-reads on every change event, so each switch and listener on the page agrees.
export function useChoiceSync(event, read) {
    const [value, setValue] = useState(null);
    useEffect(() => {
        const sync = () => setValue(read());
        sync();
        window.addEventListener(event, sync);
        return () => window.removeEventListener(event, sync);
    }, [event, read]);
    return value;
}
