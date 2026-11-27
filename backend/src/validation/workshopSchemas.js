import { z } from "zod";

const shareIdSchema = z
    .string()
    .min(1)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/);

export const MAX_TIMER_MS = 2 * 60 * 60 * 1000;
const MIN_TIMER_MS = 10 * 1000;
const MAX_VOTES_PER_PERSON = 20;

export const timerSchema = z.discriminatedUnion("action", [
    z.object({ shareId: shareIdSchema, action: z.literal("start"), durationMs: z.number().int().min(MIN_TIMER_MS).max(MAX_TIMER_MS) }),
    z.object({ shareId: shareIdSchema, action: z.enum(["pause", "resume", "extend", "reset"]) }),
]);

export const voteStartSchema = z.object({ shareId: shareIdSchema, votesPerPerson: z.number().int().min(1).max(MAX_VOTES_PER_PERSON) });

export const voteSchema = z.object({ shareId: shareIdSchema, elementId: z.string().min(1).max(100), add: z.boolean() });

export const votingActionSchema = z.object({ shareId: shareIdSchema, action: z.enum(["end", "clear"]) });
