import { createContext, useContext } from "react";

// Separate from AssetStage so slots can claim stage space without importing three, which loads dynamically.

export const StageContext = createContext({ controller: null, unavailable: false });

export function useStage() {
    return useContext(StageContext);
}
