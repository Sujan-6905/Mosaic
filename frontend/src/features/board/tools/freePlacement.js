const SEARCH_STEP = 60;
const MAX_SEARCH_RADIUS = 6000;
const CLEARANCE = 48;

const overlapsAny = (box, occupied) =>
    occupied.some((o) => box.minX < o.maxX + CLEARANCE && box.maxX > o.minX - CLEARANCE && box.minY < o.maxY + CLEARANCE && box.maxY > o.minY - CLEARANCE);

const boxAround = (cx, cy, width, height) => ({
    minX: cx - width / 2,
    maxX: cx + width / 2,
    minY: cy - height / 2,
    maxY: cy + height / 2,
});

// The clear spot nearest a preferred centre, searched in widening rings, so a new diagram
// lands beside existing content; the preferred centre itself when nothing is clear.
export const findFreeCenter = ({ width, height, preferredX, preferredY, occupied }) => {
    if (occupied.length === 0 || !overlapsAny(boxAround(preferredX, preferredY, width, height), occupied)) {
        return { x: preferredX, y: preferredY };
    }

    for (let ring = 1; ring * SEARCH_STEP <= MAX_SEARCH_RADIUS; ring += 1) {
        const reach = ring * SEARCH_STEP;
        const candidates = [];
        for (let offset = -reach; offset <= reach; offset += SEARCH_STEP) {
            candidates.push([offset, -reach], [offset, reach], [-reach, offset], [reach, offset]);
        }
        candidates.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
        for (const [dx, dy] of candidates) {
            if (!overlapsAny(boxAround(preferredX + dx, preferredY + dy, width, height), occupied)) {
                return { x: preferredX + dx, y: preferredY + dy };
            }
        }
    }
    return { x: preferredX, y: preferredY };
};
