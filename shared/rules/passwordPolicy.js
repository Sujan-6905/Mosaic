// Shared so the sign-up form and the server agree. Checked only when a password is set,
// so an older account still signs in with its existing password.
export const MIN_PASSWORD_LENGTH = 8;
// bcrypt silently ignores everything past 72 bytes, so anything longer would
// feel stronger than it is.
const MAX_PASSWORD_BYTES = 72;
// Length beats composition: a long passphrase is strong without a digit in it.
const PASSPHRASE_LENGTH = 16;

// The passwords attackers try first, compared with trailing digits and symbols
// removed so "password123!" counts as "password".
const COMMON_PASSWORDS = new Set([
    "password",
    "passw0rd",
    "p@ssword",
    "p@ssw0rd",
    "pass",
    "passcode",
    "secret",
    "letmein",
    "welcome",
    "admin",
    "administrator",
    "root",
    "login",
    "user",
    "guest",
    "test",
    "testing",
    "qwerty",
    "qwertyuiop",
    "qwert",
    "asdfgh",
    "asdfghjkl",
    "zxcvbn",
    "zxcvbnm",
    "qazwsx",
    "qazwsxedc",
    "1q2w3e4r",
    "1qaz2wsx",
    "iloveyou",
    "loveyou",
    "lovely",
    "sunshine",
    "princess",
    "princesa",
    "dragon",
    "monkey",
    "football",
    "baseball",
    "basketball",
    "superman",
    "batman",
    "shadow",
    "master",
    "michael",
    "jennifer",
    "jordan",
    "hunter",
    "ashley",
    "charlie",
    "abc",
    "abcd",
    "abcde",
    "abcdef",
    "abcdefg",
    "abcdefgh",
    "abc123",
    "a1b2c3",
    "aa",
    "aaa",
    "aaaa",
    "changeme",
    "default",
    "freedom",
    "whatever",
    "trustno",
    "starwars",
    "pokemon",
    "minecraft",
    "google",
    "facebook",
    "instagram",
    "mosaic",
    "whiteboard",
    "india",
    "computer",
    "internet",
    "samsung",
    "nokia",
    "liverpool",
    "arsenal",
    "chelsea",
    "summer",
    "winter",
]);

const byteLength = (text) => new TextEncoder().encode(text).length;

const isRepetitive = (password) => new Set(password.toLowerCase()).size < 4;

const SEQUENCES = ["abcdefghijklmnopqrstuvwxyz", "01234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm"];
const isSequential = (password) => {
    const lower = password.toLowerCase();
    return SEQUENCES.some((sequence) => sequence.includes(lower) || [...sequence].reverse().join("").includes(lower));
};

const isCommon = (password) => {
    const lower = password.toLowerCase();
    return COMMON_PASSWORDS.has(lower) || COMMON_PASSWORDS.has(lower.replace(/[^a-z]+$/, "")) || COMMON_PASSWORDS.has(lower.replace(/^[^a-z]+/, ""));
};

// The first reason this can't be used, in words for the person typing it, or
// null when it's acceptable.
export const passwordProblem = (password, { username = "" } = {}) => {
    if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (byteLength(password) > MAX_PASSWORD_BYTES) return `Use at most ${MAX_PASSWORD_BYTES} characters.`;
    if (password.length < PASSPHRASE_LENGTH && (!/\p{L}/u.test(password) || !/[\p{N}\p{P}\p{S}]/u.test(password)))
        return "Mix letters with a number or symbol.";
    if (isRepetitive(password) || isSequential(password)) return "Avoid repeated characters and simple sequences.";
    if (isCommon(password)) return "That's one of the first passwords attackers try. Pick something less common.";
    if (username && username.length >= 3 && password.toLowerCase().includes(username.toLowerCase())) return "Don't use your username in your password.";
    return null;
};
