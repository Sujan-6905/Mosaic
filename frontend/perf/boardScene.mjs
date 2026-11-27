// Mostly freehand strokes, then shapes, text, stickies and connectors, like a real board.
// Runs inside the page through toString(), so it must stay self-contained.
export const buildBoardScene = (count, elementsPerThousandSquare = 150) => {
    let state = 1234567;
    const random = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
    const span = Math.sqrt(count / elementsPerThousandSquare) * 1000;
    const palette = ["#e8b94a", "#3b82f6", "#ef4444", "#22c55e", "#111827", "#a855f7"];
    const base = (index) => ({ opacity: 100, zIndex: index, rotation: 0, groupId: null, frameId: null, locked: false, version: 1 });
    const elements = {};

    for (let index = 0; index < count; index++) {
        const id = `perf-${index}`;
        const x = random() * span;
        const y = random() * span;
        const color = palette[index % palette.length];
        const kind = random();

        if (kind < 0.6) {
            const pointCount = 20 + Math.floor(random() * 60);
            const points = [];
            let px = x;
            let py = y;
            for (let p = 0; p < pointCount; p++) {
                px += (random() - 0.5) * 16;
                py += (random() - 0.5) * 16;
                points.push({ x: px, y: py, pressure: 0.5 });
            }
            elements[id] = { ...base(index), type: "path", points, color, size: 3, style: "round", fillColor: null };
        } else if (kind < 0.85) {
            elements[id] = {
                ...base(index),
                type: "shape",
                shapeType: index % 2 ? "Rectangle" : "Circle",
                startX: x,
                startY: y,
                endX: x + 40 + random() * 120,
                endY: y + 30 + random() * 80,
                color,
                fillColor: index % 3 === 0 ? color : null,
                size: 2,
            };
            if (index % 5 === 0) {
                elements[`${id}-link`] = {
                    ...base(index),
                    type: "connector",
                    startX: x,
                    startY: y,
                    endX: x + (random() - 0.5) * 400,
                    endY: y + (random() - 0.5) * 400,
                    startBinding: null,
                    endBinding: null,
                    color,
                    size: 2,
                };
            }
        } else if (kind < 0.95) {
            elements[id] = {
                ...base(index),
                type: "text",
                x,
                y,
                width: 220,
                text: "A short note on the board that wraps once or twice",
                size: 16,
                fontFamily: "sans",
                color,
            };
        } else {
            elements[id] = {
                ...base(index),
                type: "sticky",
                x,
                y,
                width: 180,
                height: 140,
                text: "Sticky note with a few words",
                size: 14,
                fontFamily: "sans",
                color: "#111827",
                fillColor: "#fef08a",
            };
        }
    }
    return { elements, span };
};
