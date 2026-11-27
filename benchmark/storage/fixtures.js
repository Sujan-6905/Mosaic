// Seeded boards and operations shaped like the app's own documents, so both stores carry identical bytes.
const SHAPES = ["Rectangle", "Ellipse", "Diamond"];
const WORDS = ["login", "cache", "queue", "review", "deploy", "billing", "search", "upload", "notify", "audit"];

const seededRandom = (seed) => {
    let state = seed >>> 0 || 1;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 2 ** 32;
    };
};

const elementFor = (random, index) => {
    const x = Math.round(random() * 4000);
    const y = Math.round(random() * 3000);
    const kind = index % 4;
    if (kind === 3)
        return {
            type: "path",
            points: Array.from({ length: 24 }, (_, step) => ({ x: x + step * 6, y: y + Math.round(Math.sin(step / 3) * 20) })),
            color: "#1f2937",
            size: 3,
            zIndex: index,
        };
    if (kind === 2) return { type: "sticky", x, y, width: 200, height: 160, text: `${WORDS[index % WORDS.length]} notes`, fillColor: "#fde68a", zIndex: index };
    return {
        type: "shape",
        shapeType: SHAPES[index % SHAPES.length],
        startX: x,
        startY: y,
        endX: x + 160,
        endY: y + 80,
        text: WORDS[index % WORDS.length],
        color: "#1f2937",
        fillColor: null,
        size: 2,
        zIndex: index,
    };
};

export const ownerOf = (index, owners) => `bench-owner-${index % owners}`;

export const buildBoard = (index, { elementsPerBoard, owners }) => {
    const random = seededRandom(index + 1);
    const elements = Object.fromEntries(Array.from({ length: elementsPerBoard }, (_, n) => [`el-${index}-${n}`, elementFor(random, n)]));
    return {
        shareId: `bench-board-${index}`,
        title: `Benchmark board ${index}`,
        owner: ownerOf(index, owners),
        collaborators: [],
        elements,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    };
};

export const buildOps = (shareId, fromSeq, count, elementIds) =>
    Array.from({ length: count }, (_, n) => {
        const seq = fromSeq + n;
        const elementId = elementIds[seq % elementIds.length];
        return {
            shareId,
            seq,
            opType: "update",
            elementId,
            after: { type: "shape", shapeType: "Rectangle", startX: seq, startY: seq, endX: seq + 160, endY: seq + 80, text: `edit ${seq}` },
            authorId: "bench-author",
            ts: 1_790_000_000_000 + seq,
        };
    });

export const buildSnapshot = (board, seq) => ({ shareId: board.shareId, seq, elements: board.elements, automatic: true, createdAt: new Date().toISOString() });
