import { readChoice, useChoiceSync, writeChoice } from "./browserChoice";

const STORAGE_KEY = "mosaic:calm";
const CHANGE_EVENT = "mosaic:calm-change";

const systemPrefersCalm = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Calm when this browser asked for it in Profile, or the system asks for reduced motion.
export const isCalm = () => typeof window !== "undefined" && (readChoice(STORAGE_KEY) || systemPrefersCalm());

export const syncCalmAttribute = () => document.documentElement.toggleAttribute("data-calm", isCalm());

const setCalmChoice = (calm) => {
    writeChoice(STORAGE_KEY, calm, CHANGE_EVENT);
    syncCalmAttribute();
};

const readCalmState = () => ({ chosen: readChoice(STORAGE_KEY), system: systemPrefersCalm() });

// What this browser chose, the setter, and whether the system already asks for calm regardless.
export function useCalmChoice() {
    const state = useChoiceSync(CHANGE_EVENT, readCalmState);
    return [state?.chosen ?? false, setCalmChoice, state?.system ?? false];
}
