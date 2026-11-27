import { useRef } from "react";

// True from a panel's first open onwards, so a panel never opened is never fetched or mounted.
const useEverOpened = (isOpen) => {
    const everOpenedRef = useRef(isOpen);
    if (isOpen) everOpenedRef.current = true;
    return everOpenedRef.current;
};

export default useEverOpened;
