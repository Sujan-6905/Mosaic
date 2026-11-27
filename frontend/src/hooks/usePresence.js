import { useEffect, useState } from "react";

// Keeps something mounted for the length of its exit animation after `isOpen`
// goes false. `closing` is what the markup keys that animation on.
export default function usePresence(isOpen, exitMs) {
    const [mounted, setMounted] = useState(isOpen);

    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            return undefined;
        }
        const timer = setTimeout(() => setMounted(false), exitMs);
        return () => clearTimeout(timer);
    }, [isOpen, exitMs]);

    return { mounted: isOpen || mounted, closing: !isOpen && mounted };
}
