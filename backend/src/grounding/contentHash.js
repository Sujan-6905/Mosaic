// FNV-1a as six base-36 characters: a stable handle derived from content.
const HASH_LENGTH = 6;

export const hashToBase36 = (input) => {
    let hash = 2166136261; // FNV-1a offset basis
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash).toString(36).padStart(HASH_LENGTH, "0").slice(-HASH_LENGTH);
};
