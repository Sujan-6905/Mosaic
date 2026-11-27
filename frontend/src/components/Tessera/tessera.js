const SIZE = 7;
const HALF = Math.ceil(SIZE / 2);
const TONES = ["#ffb43c", "#de5816", "#3d5a9e", "#2f9e6e", "#c2453d", "#8b5cf6", "#0ea5a4", "#c07d1c"];

const fnv = (text) => {
    let hash = 2166136261;
    for (let n = 0; n < text.length; n += 1) {
        hash ^= text.charCodeAt(n);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

// A name cut into a personal tile: one colour, and a seven by seven pattern mirrored like a stamp.
export function tesseraFor(name) {
    const key = name.trim().toLowerCase();
    if (!key) return { color: null, cells: Array(SIZE * SIZE).fill(false) };
    const hash = fnv(key);
    let bits = fnv(`${key}:pattern`);
    const cells = [];
    for (let row = 0; row < SIZE; row += 1) {
        const half = [];
        for (let col = 0; col < HALF; col += 1) {
            half.push((bits & 1) === 1);
            bits = bits >>> 1 || fnv(`${key}:${row}:${col}`);
        }
        cells.push(...half, ...half.slice(0, SIZE - HALF).reverse());
    }
    return { color: TONES[hash % TONES.length], cells };
}
