// The board as its list thumbnail draws it: topmost elements, thinned strokes and cut text,
// a few kilobytes per board.
const MAX_PREVIEW_ELEMENTS = 300;
const MAX_STROKE_POINTS = 48;
const MAX_TEXT_LENGTH = 120;
// Fields a thumbnail never draws: where a font loads from, links, diagram bookkeeping.
const OMITTED_FIELDS = new Set(["fontSource", "link", "diagram", "version", "updatedBy", "publicId"]);

const round = (value) => (typeof value === "number" ? Math.round(value * 10) / 10 : value);

const thinPoints = (points) => {
    if (!Array.isArray(points) || points.length <= MAX_STROKE_POINTS) return points?.map((point) => ({ x: round(point.x), y: round(point.y) }));
    const stride = (points.length - 1) / (MAX_STROKE_POINTS - 1);
    return Array.from({ length: MAX_STROKE_POINTS }, (_, index) => {
        const point = points[Math.round(index * stride)];
        return { x: round(point.x), y: round(point.y) };
    });
};

const previewOf = (element) =>
    Object.fromEntries(
        Object.entries(element)
            .filter(([key]) => !OMITTED_FIELDS.has(key))
            .map(([key, value]) => {
                if (key === "points") return [key, thinPoints(value)];
                if (key === "text" && typeof value === "string") return [key, value.slice(0, MAX_TEXT_LENGTH)];
                return [key, round(value)];
            }),
    );

export const buildBoardPreview = (elements = {}) => {
    const entries = Object.entries(elements ?? {});
    const topmost = entries.sort(([, a], [, b]) => (a.zIndex ?? 0) - (b.zIndex ?? 0)).slice(-MAX_PREVIEW_ELEMENTS);
    return { count: entries.length, elements: Object.fromEntries(topmost.map(([id, element]) => [id, previewOf(element)])) };
};
