import { bucketOf, bucketsOf, flowOrder, matchFixedBucket } from "../model.js";
import { emptyScene, place, longestPathRanks } from "./common.js";
import { linkPads, routeLaneLinks } from "./laneLinks.js";

const LANE_HEADER = 150;
const COLUMN_HEADER = 52;
const CELL_GAP = 40;
const LANE_PAD = 26;
const STACK_GAP = 16;
const CURVE_ROOM = 150;

const KANBAN_ORDER = ["backlog", "to do", "todo", "ready", "doing", "in progress", "review", "blocked", "done"];

// Which lane each node is in, honouring a structure's fixed lanes.
const assignLanes = (model, options) => {
    const field = options.field ?? "lane";
    if (options.fixed) {
        const fallback = options.fallback ?? options.fixed[0];
        const laneOf = new Map(model.nodes.map((node) => [node.id, matchFixedBucket(node, options.fixed, field) ?? fallback]));
        return { lanes: options.fixed.map((label) => ({ key: label, label })), laneOf };
    }
    let lanes = bucketsOf(model, field);
    if (field === "status") {
        const rank = (label) => {
            const index = KANBAN_ORDER.indexOf(label.toLowerCase());
            return index === -1 ? KANBAN_ORDER.length : index;
        };
        lanes = [...lanes].sort((a, b) => rank(a.label) - rank(b.label));
    }
    return { lanes, laneOf: new Map(model.nodes.map((node) => [node.id, bucketOf(node, field)])) };
};

// A lane's nodes ordered under the nodes they link to in lanes already placed, so links cross less.
const byNeighbours = (ids, model, scene) => {
    const placedX = (id) =>
        model.edges
            .filter((edge) => edge.from === id || edge.to === id)
            .map((edge) => scene.nodes[edge.from === id ? edge.to : edge.from]?.cx)
            .filter(Number.isFinite);
    const keyed = ids.map((id, index) => {
        const xs = placedX(id);
        return { id, index, x: xs.length ? xs.reduce((sum, value) => sum + value, 0) / xs.length : null };
    });
    const anchored = keyed.filter((entry) => entry.x !== null).sort((a, b) => a.x - b.x || a.index - b.index);
    return [...anchored, ...keyed.filter((entry) => entry.x === null)].map((entry) => entry.id);
};

export const layoutLanes = (ctx) => {
    const { model, sizes, options, gap } = ctx;
    const scene = emptyScene();
    const { lanes, laneOf } = assignLanes(model, options);
    const order = flowOrder(model);
    const rank = options.flow ? longestPathRanks(model, order) : new Map(order.map((id, index) => [id, index]));
    const byLane = new Map(lanes.map((lane) => [lane.key, order.filter((id) => laneOf.get(id) === lane.key)]));
    const sticky = options.cards === "sticky";
    const laneIndex = new Map(lanes.map((lane, index) => [lane.key, index]));
    const laneIndexOf = (id) => laneIndex.get(laneOf.get(id));
    const nodeExtra = (id) => ({ lane: laneOf.get(id), sticky, role: model.nodes.find((node) => node.id === id).kind ?? "step" });

    if (options.orientation === "rows") {
        const columns = Math.max(1, ...[...rank.values()].map((value) => value + 1));
        const columnWidth = new Array(columns).fill(0);
        order.forEach((id) => {
            const column = options.flow ? rank.get(id) : 0;
            columnWidth[column] = Math.max(columnWidth[column], sizes.get(id).w);
        });
        const columnX = [];
        let x = LANE_HEADER + LANE_PAD;
        for (let column = 0; column < columns; column += 1) {
            columnX[column] = x + columnWidth[column] / 2;
            x += columnWidth[column] + CELL_GAP * gap * 1.4;
        }
        let y = 0;
        let maxRight = x;
        const rows = [];
        const pads = options.links ? linkPads(model, laneIndexOf, lanes.length, LANE_PAD) : null;
        lanes.forEach((lane, laneIndex) => {
            const top = pads?.[laneIndex].top ?? LANE_PAD;
            const bottom = pads?.[laneIndex].bottom ?? LANE_PAD;
            const ids = options.links ? byNeighbours(byLane.get(lane.key), model, scene) : byLane.get(lane.key);
            const stacks = new Map();
            ids.forEach((id) => {
                const column = options.flow ? rank.get(id) : null;
                const key = column ?? "row";
                stacks.set(key, [...(stacks.get(key) ?? []), id]);
            });
            const stackHeight = (stack, key) =>
                key === "row" ? Math.max(...stack.map((id) => sizes.get(id).h)) : stack.reduce((sum, id) => sum + sizes.get(id).h + STACK_GAP, -STACK_GAP);
            const content = Math.max(90, ...[...stacks].map(([key, stack]) => stackHeight(stack, key)));
            const height = content + top + bottom;
            const middle = y + top + content / 2;
            stacks.forEach((stack, key) => {
                if (key === "row") {
                    let cursor = LANE_HEADER + LANE_PAD;
                    stack.forEach((id) => {
                        place(scene, id, cursor + sizes.get(id).w / 2, middle, sizes.get(id), nodeExtra(id));
                        cursor += sizes.get(id).w + CELL_GAP * gap;
                    });
                    rows.push({ ids: stack, right: cursor - CELL_GAP * gap });
                    maxRight = Math.max(maxRight, cursor);
                    return;
                }
                let cursor = middle - stackHeight(stack, key) / 2;
                stack.forEach((id) => {
                    place(scene, id, columnX[key], cursor + sizes.get(id).h / 2, sizes.get(id), nodeExtra(id));
                    cursor += sizes.get(id).h + STACK_GAP;
                });
            });
            scene.groups.push({
                id: `lane:${lane.key}`,
                label: lane.label,
                kind: options.bands ? "band" : "lane",
                headerSide: "left",
                headerWidth: LANE_HEADER,
                minX: 0,
                minY: y,
                maxX: 0,
                maxY: y + height,
            });
            y += height;
        });
        const widest = Math.max(0, ...rows.map((row) => row.right));
        rows.forEach((row) => row.ids.forEach((id) => (scene.nodes[id].cx += (widest - row.right) / 2)));
        scene.groups.forEach((group) => {
            group.maxX = maxRight;
        });
        scene.marks.push({
            type: "line",
            points: [
                { x: LANE_HEADER, y: 0 },
                { x: LANE_HEADER, y },
            ],
            tone: "muted",
            faint: true,
        });
        if (options.divided) {
            const names = ["Line of interaction", "Line of visibility", "Line of internal interaction"];
            scene.groups.slice(0, -1).forEach((group, index) => {
                scene.marks.push({
                    type: "line",
                    points: [
                        { x: 0, y: group.maxY },
                        { x: maxRight, y: group.maxY },
                    ],
                    dashed: index !== 1,
                    tone: "accent",
                    label: names[index],
                });
            });
        }
    } else {
        let x = 0;
        let tallest = 0;
        const columnBoxes = [];
        lanes.forEach((lane) => {
            const ids = byLane.get(lane.key);
            const width = Math.max(sticky ? 170 : 180, ...ids.map((id) => sizes.get(id).w)) + LANE_PAD * 2;
            let y = COLUMN_HEADER + LANE_PAD + (options.journey ? CURVE_ROOM : 0);
            ids.forEach((id) => {
                place(scene, id, x + width / 2, y + sizes.get(id).h / 2, sizes.get(id), nodeExtra(id));
                y += sizes.get(id).h + STACK_GAP * gap;
            });
            tallest = Math.max(tallest, y + LANE_PAD);
            columnBoxes.push({
                id: `lane:${lane.key}`,
                label: lane.label,
                kind: options.bands ? "band" : "column",
                headerSide: "top",
                count: ids.length,
                minX: x,
                minY: 0,
                maxX: x + width,
                maxY: 0,
            });
            x += width + (options.bands ? 0 : CELL_GAP * gap * 0.5);
        });
        columnBoxes.forEach((box) => {
            box.maxY = Math.max(tallest, 220);
        });
        scene.groups.push(...columnBoxes);
        if (options.journey) {
            // One point per stage, at the average mood of its nodes that carry one.
            const points = lanes.map((lane, index) => {
                const moods = byLane
                    .get(lane.key)
                    .map((id) => model.nodes.find((candidate) => candidate.id === id).value)
                    .filter(Number.isFinite);
                const mood = Math.max(-1, Math.min(1, moods.length ? moods.reduce((sum, value) => sum + value, 0) / moods.length : 0));
                const column = columnBoxes[index];
                return { x: (column.minX + column.maxX) / 2, y: COLUMN_HEADER + CURVE_ROOM / 2 - mood * (CURVE_ROOM / 2 - 18) };
            });
            if (points.length > 1) scene.marks.push({ type: "curve", points, tone: "accent", width: 3 });
            points.forEach((point) => scene.marks.push({ type: "dot", x: point.x, y: point.y, tone: "accent" }));
        }
    }

    if (options.links && options.orientation === "rows") scene.edges.push(...routeLaneLinks(model, scene, laneIndexOf, scene.groups));
    else if (options.flow || options.links) model.edges.forEach((edge) => scene.edges.push({ ...edge }));
    return scene;
};
