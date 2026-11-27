import crypto from "node:crypto";

const digest = (value) => crypto.createHash("sha256").update(String(value)).digest();

// Constant-time comparison; hashing first means unequal lengths leak nothing either.
export const secretsMatch = (given, expected) => Boolean(given && expected) && crypto.timingSafeEqual(digest(given), digest(expected));
