import { AsyncLocalStorage } from "node:async_hooks";

// Which tool call a write belongs to, so the board can list and undo an agent's work one call at a time.
export const turnContext = new AsyncLocalStorage();
export const currentTurnId = () => turnContext.getStore()?.turnId ?? null;
