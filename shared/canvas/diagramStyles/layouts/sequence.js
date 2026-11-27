import { emptyScene, place } from "./common.js";

const PARTICIPANT_GAP = 80;
const MESSAGE_ROW = 58;
const HEADER_GAP = 40;
const SELF_LOOP = 44;
const ACTIVATION_WIDTH = 12;
const FRAME_PAD = 18;
const FRAME_KINDS = /^(alt|opt|loop|par|critical|break)\b/i;

// Participants left to right in order of first appearance; each message an
// arrow at its own height, in the order the edges are given.
export const layoutSequence = (ctx) => {
    const { model, sizes, options, gap } = ctx;
    const scene = emptyScene();
    const appearance = [];
    model.edges.forEach(({ from, to }) =>
        [from, to].forEach((id) => {
            if (!appearance.includes(id)) appearance.push(id);
        }),
    );
    model.nodes.forEach((node) => {
        if (!appearance.includes(node.id)) appearance.push(node.id);
    });
    const headerHeight = Math.max(...appearance.map((id) => sizes.get(id).h));
    let x = 0;
    const xOf = new Map();
    appearance.forEach((id) => {
        const size = sizes.get(id);
        const widestMessage = Math.max(0, ...model.edges.filter((edge) => edge.from === id && edge.label).map((edge) => ctx.metrics.textWidth(edge.label, 12)));
        xOf.set(id, x + size.w / 2);
        place(scene, id, x + size.w / 2, headerHeight / 2, size, { role: "participant" });
        x += size.w + Math.max(PARTICIPANT_GAP * gap, widestMessage * 0.55);
    });
    const top = headerHeight + HEADER_GAP;
    const rows = model.edges.map((edge, index) => ({ edge, y: top + index * MESSAGE_ROW * gap }));
    const bottom = top + Math.max(1, model.edges.length) * MESSAGE_ROW * gap;
    appearance.forEach((id) =>
        scene.marks.push({
            type: "line",
            points: [
                { x: xOf.get(id), y: headerHeight },
                { x: xOf.get(id), y: bottom },
            ],
            tone: "muted",
            dashed: true,
            behind: true,
        }),
    );

    rows.forEach(({ edge, y }, index) => {
        const fromX = xOf.get(edge.from);
        const toX = xOf.get(edge.to);
        const reply = edge.kind === "reply" || edge.kind === "return";
        if (edge.from === edge.to) {
            scene.edges.push({
                ...edge,
                free: true,
                points: [
                    { x: fromX, y },
                    { x: fromX + SELF_LOOP, y },
                    { x: fromX + SELF_LOOP, y: y + MESSAGE_ROW * 0.45 },
                    { x: fromX, y: y + MESSAGE_ROW * 0.45 },
                ],
                dashed: reply,
                order: index,
            });
            return;
        }
        const inset = options.frames ? ACTIVATION_WIDTH / 2 : 0;
        const direction = Math.sign(toX - fromX);
        scene.edges.push({
            ...edge,
            free: true,
            points: [
                { x: fromX + direction * inset, y },
                { x: toX - direction * inset, y },
            ],
            dashed: reply,
            heads: reply ? { end: "arrow" } : null,
            order: index,
        });
    });

    if (options.frames) {
        // A participant is active from a message it receives until its next reply back.
        rows.forEach(({ edge, y }, index) => {
            if (edge.kind === "reply" || edge.kind === "return" || edge.from === edge.to) return;
            const answer = rows.slice(index + 1).find((row) => row.edge.from === edge.to && row.edge.to === edge.from);
            const end = answer ? answer.y : y + MESSAGE_ROW * 0.6;
            scene.marks.push({ type: "activation", x: xOf.get(edge.to), minY: y - 6, maxY: end + 6, width: ACTIVATION_WIDTH });
        });
        model.groups
            .filter((group) => FRAME_KINDS.test(group.label) || FRAME_KINDS.test(group.id))
            .forEach((group) => {
                const framed = rows.filter((row) => row.edge.kind === group.id);
                if (framed.length === 0) return;
                const xs = framed.flatMap(({ edge }) => [xOf.get(edge.from), xOf.get(edge.to)]);
                scene.groups.push({
                    id: `frame:${group.id}`,
                    label: group.label,
                    kind: "sequence-frame",
                    minX: Math.min(...xs) - FRAME_PAD * 3,
                    maxX: Math.max(...xs) + FRAME_PAD * 3,
                    minY: Math.min(...framed.map((row) => row.y)) - FRAME_PAD * 1.8,
                    maxY: Math.max(...framed.map((row) => row.y)) + FRAME_PAD,
                });
            });
    }
    return scene;
};
