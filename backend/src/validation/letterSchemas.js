import { z } from "zod";

export const LETTER_LIMITS = { company: 60, note: 160, perBoard: 20 };

export const createLetterSchema = z.object({
    company: z.string().trim().min(1).max(LETTER_LIMITS.company),
    note: z.string().trim().max(LETTER_LIMITS.note).optional(),
});
