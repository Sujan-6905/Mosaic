import { deriveTree } from "../model.js";
import { emptyScene, place, treeEdges, branchIndexes, sceneBounds } from "./common.js";

const SIBLING_GAP = 28;
const LEVEL_GAP = 70;
const INDENT = 36;
const ROW_GAP = 10;

// A tidy tree: every subtree gets a band as wide as its widest level, children
// sit side by side under their parent and the parent centres over them.
const layoutAlongAxis = (tree, sizes, ids, { breadthOf, lengthOf, gap }) => {
    const span = new Map();
    const measure = (id) => {
        const children = tree.childrenOf.get(id);
        const own = breadthOf(sizes.get(id));
        if (children.length === 0) {
            span.set(id, own);
            return own;
        }
        const total = children.reduce((sum, child) => sum + measure(child), 0) + SIBLING_GAP * gap * (children.length - 1);
        span.set(id, Math.max(own, total));
        return span.get(id);
    };
    const levelLength = [];
    const noteLevel = (id, depth) => {
        levelLength[depth] = Math.max(levelLength[depth] ?? 0, lengthOf(sizes.get(id)));
        tree.childrenOf.get(id).forEach((child) => noteLevel(child, depth + 1));
    };
    ids.forEach((id) => {
        measure(id);
        noteLevel(id, 1);
    });
    const levelStart = [0];
    for (let depth = 1; depth < levelLength.length + 1; depth += 1) {
        levelStart[depth] = (levelStart[depth - 1] ?? 0) + (levelLength[depth - 1] ?? 0) / 2 + (levelLength[depth] ?? 0) / 2 + LEVEL_GAP * gap;
    }
    const placed = new Map();
    const lay = (id, from, depth) => {
        const children = tree.childrenOf.get(id);
        placed.set(id, { across: from + span.get(id) / 2, along: levelStart[depth] ?? 0, depth });
        let cursor = from + (span.get(id) - (children.reduce((sum, child) => sum + span.get(child), 0) + SIBLING_GAP * gap * (children.length - 1))) / 2;
        children.forEach((child) => {
            lay(child, cursor, depth + 1);
            cursor += span.get(child) + SIBLING_GAP * gap;
        });
    };
    let cursor = 0;
    ids.forEach((id) => {
        lay(id, cursor, 1);
        cursor += span.get(id) + SIBLING_GAP * gap;
    });
    return { placed, total: cursor - SIBLING_GAP * gap };
};

const elbowDown = (from, to) => {
    const mid = (from.cy + from.h / 2 + to.cy - to.h / 2) / 2;
    return from.cx === to.cx
        ? []
        : [
              { x: from.cx, y: mid },
              { x: to.cx, y: mid },
          ];
};
const elbowRight = (from, to, sign = 1) => {
    const mid = (from.cx + (sign * from.w) / 2 + to.cx - (sign * to.w) / 2) / 2;
    return from.cy === to.cy
        ? []
        : [
              { x: mid, y: from.cy },
              { x: mid, y: to.cy },
          ];
};

export const layoutTree = (ctx) => {
    const { model, sizes, options, gap } = ctx;
    const tree = deriveTree(model);
    const scene = emptyScene();
    if (!tree.rootId) return scene;
    const direction = ctx.levers.direction === "left-right" ? "right" : ctx.levers.direction === "top-down" ? "down" : (options.direction ?? "down");
    const branchOf = branchIndexes(tree);
    const roleOf = (id) => (id === tree.rootId ? "root" : tree.childrenOf.get(id).length === 0 ? "leaf" : "branch");
    const extra = (id, depth) => ({ depth, branch: branchOf.get(id) ?? -1, role: roleOf(id) });

    if (direction === "indented") {
        let y = 0;
        const visit = (id, depth) => {
            const size = sizes.get(id);
            place(scene, id, depth * INDENT * gap + size.w / 2, y + size.h / 2, size, extra(id, depth));
            y += size.h + ROW_GAP * gap;
            tree.childrenOf.get(id).forEach((child) => visit(child, depth + 1));
        };
        visit(tree.rootId, 0);
        treeEdges(model, tree).forEach((edge) => {
            const from = scene.nodes[edge.from];
            const to = scene.nodes[edge.to];
            if (edge.cross) return;
            const railX = from.cx - from.w / 2 + 14;
            scene.edges.push({
                ...edge,
                waypoints: [
                    { x: railX, y: from.cy + from.h / 2 },
                    { x: railX, y: to.cy },
                ],
                heads: { end: "none" },
            });
        });
        return scene;
    }

    const vertical = direction === "down";
    const breadthOf = (size) => (vertical ? size.w : size.h);
    const lengthOf = (size) => (vertical ? size.h : size.w);
    const assign = (placed, sign = 1, depthOffset = -1) =>
        placed.forEach(({ across, along, depth }, id) => {
            const size = sizes.get(id);
            if (vertical) place(scene, id, across, along, size, extra(id, depth + depthOffset));
            else place(scene, id, sign * along, across, size, extra(id, depth + depthOffset));
        });

    if (direction === "both") {
        const children = tree.childrenOf.get(tree.rootId);
        const rightIds = children.filter((_, i) => i % 2 === 0);
        const leftIds = children.filter((_, i) => i % 2 === 1);
        const rootSize = sizes.get(tree.rootId);
        const side = (ids, sign) => {
            if (ids.length === 0) return;
            const { placed, total } = layoutAlongAxis(tree, sizes, ids, { breadthOf, lengthOf, gap });
            const firstLevel = Math.max(...ids.map((id) => lengthOf(sizes.get(id))));
            placed.forEach((spot) => {
                spot.across -= total / 2;
                spot.along += rootSize.w / 2 + LEVEL_GAP * gap + firstLevel / 2;
            });
            assign(placed, sign, 0);
        };
        side(rightIds, 1);
        side(leftIds, -1);
        place(scene, tree.rootId, 0, 0, rootSize, extra(tree.rootId, 0));
    } else {
        const { placed } = layoutAlongAxis(tree, sizes, [tree.rootId], { breadthOf, lengthOf, gap });
        assign(placed);
    }

    const routing = options.routing ?? "elbow";
    treeEdges(model, tree).forEach((edge) => {
        const from = scene.nodes[edge.from];
        const to = scene.nodes[edge.to];
        if (edge.cross) {
            scene.edges.push({ ...edge, routing: "curved", faint: true });
            return;
        }
        if (options.brace) return;
        if (routing !== "elbow") {
            scene.edges.push({ ...edge, routing: routing === "curved" ? "curved" : "straight" });
            return;
        }
        const sign = to.cx < from.cx ? -1 : 1;
        scene.edges.push({ ...edge, waypoints: vertical ? elbowDown(from, to) : elbowRight(from, to, sign) });
    });

    if (options.brace) {
        tree.childrenOf.forEach((children, parentId) => {
            if (children.length === 0) return;
            const parent = scene.nodes[parentId];
            const boxes = children.map((child) => scene.nodes[child]);
            const x = parent.cx + parent.w / 2 + (Math.min(...boxes.map((box) => box.cx - box.w / 2)) - parent.cx - parent.w / 2) / 2;
            scene.marks.push({
                type: "brace",
                x,
                minY: Math.min(...boxes.map((box) => box.cy - box.h / 2)),
                maxY: Math.max(...boxes.map((box) => box.cy + box.h / 2)),
            });
        });
    }

    if (options.levelLabels && vertical) {
        const bounds = sceneBounds(scene);
        const levels = new Map();
        Object.values(scene.nodes).forEach((node) => levels.set(node.depth, node.cy));
        levels.forEach((cy, depth) => {
            const label = options.levelLabels[Math.min(depth, options.levelLabels.length - 1)];
            scene.marks.push({ type: "text", x: bounds.minX - 24, y: cy, text: label, align: "right", tone: "muted", size: 12 });
        });
    }
    return scene;
};
