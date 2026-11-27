import { deriveTree, valueOf } from "../model.js";
import { emptyScene, place, treeEdges, branchIndexes } from "./common.js";

const RING_STEP = 200;
const NODE_GAP = 36;
const SUNBURST_CORE = 70;
const SUNBURST_RING = 78;
const ARC_STEPS_PER_RADIAN = 14;

// Each branch keeps a wedge of the circle sized by the leaves (or, for a
// sunburst, the total value) under it, so a branch's children sit beside it.
const wedges = (tree, weightOf) => {
    const weight = new Map();
    const measure = (id) => {
        const children = tree.childrenOf.get(id);
        const total = children.length === 0 ? weightOf(id) : children.reduce((sum, child) => sum + measure(child), 0);
        weight.set(id, total);
        return total;
    };
    measure(tree.rootId);
    const angles = new Map();
    const assign = (id, from, to) => {
        angles.set(id, { from, to, mid: (from + to) / 2 });
        let start = from;
        tree.childrenOf.get(id).forEach((child) => {
            const share = ((to - from) * weight.get(child)) / (weight.get(id) || 1);
            assign(child, start, start + share);
            start += share;
        });
    };
    assign(tree.rootId, -Math.PI, Math.PI);
    return { angles, weight };
};

const annularSector = (inner, outer, from, to) => {
    const steps = Math.max(2, Math.ceil((to - from) * ARC_STEPS_PER_RADIAN));
    const outerArc = Array.from({ length: steps + 1 }, (_, i) => from + ((to - from) * i) / steps).map((angle) => ({
        x: outer * Math.cos(angle),
        y: outer * Math.sin(angle),
    }));
    const innerArc = Array.from({ length: steps + 1 }, (_, i) => to - ((to - from) * i) / steps).map((angle) => ({
        x: inner * Math.cos(angle),
        y: inner * Math.sin(angle),
    }));
    return [...outerArc, ...innerArc];
};

export const layoutRadial = (ctx) => {
    const { model, sizes, options, gap } = ctx;
    const tree = deriveTree(model);
    const scene = emptyScene();
    if (!tree.rootId) return scene;
    const branchOf = branchIndexes(tree);
    const nodeById = new Map(model.nodes.map((node) => [node.id, node]));

    if (options.sunburst) {
        const { angles } = wedges(tree, (id) => valueOf(nodeById.get(id)));
        tree.depthOf.forEach((depth, id) => {
            const { from, to, mid } = angles.get(id);
            if (depth === 0) {
                place(scene, id, 0, 0, { w: SUNBURST_CORE * 2, h: SUNBURST_CORE * 2 }, { depth, role: "root", shape: "circle", branch: -1 });
                return;
            }
            const inner = SUNBURST_CORE + (depth - 1) * SUNBURST_RING * gap + 3;
            const outer = inner + SUNBURST_RING * gap - 6;
            const ring = annularSector(inner, outer, from + 0.01, to - 0.01);
            const labelRadius = (inner + outer) / 2;
            place(
                scene,
                id,
                labelRadius * Math.cos(mid),
                labelRadius * Math.sin(mid),
                { w: Math.max(40, (to - from) * labelRadius * 0.9), h: SUNBURST_RING * gap - 14 },
                {
                    depth,
                    branch: branchOf.get(id) ?? 0,
                    role: "segment",
                    shape: "region",
                    ring,
                    textOnly: (to - from) * labelRadius < 36,
                },
            );
        });
        return scene;
    }

    const { angles } = wedges(tree, () => 1);
    const radiusOf = [0];
    const deepest = Math.max(...tree.depthOf.values());
    for (let level = 1; level <= deepest; level += 1) {
        const ring = [...tree.depthOf].filter(([, depth]) => depth === level).map(([id]) => sizes.get(id));
        const needed = ring.reduce((sum, size) => sum + Math.max(size.w, size.h) + NODE_GAP * gap, 0) / (2 * Math.PI);
        radiusOf.push(Math.max(radiusOf[level - 1] + RING_STEP * gap, needed));
    }
    tree.depthOf.forEach((depth, id) => {
        const { mid } = angles.get(id);
        // An organic map writes words on its branches: only the central idea gets a box.
        place(scene, id, radiusOf[depth] * Math.cos(mid), radiusOf[depth] * Math.sin(mid), sizes.get(id), {
            depth,
            branch: branchOf.get(id) ?? -1,
            role: depth === 0 ? "root" : tree.childrenOf.get(id).length === 0 ? "leaf" : "branch",
            ...(options.organic && depth > 0 ? { shape: "none", category: branchOf.get(id) ?? 0 } : {}),
        });
    });
    treeEdges(model, tree).forEach((edge) => {
        const depth = tree.depthOf.get(edge.to) ?? 1;
        scene.edges.push({
            ...edge,
            routing: "curved",
            faint: Boolean(edge.cross),
            // Branches taper as they go out, the way a hand-drawn map does.
            width: options.organic && !edge.cross ? Math.max(1.5, 7 - depth * 2) : null,
            heads: options.organic ? { end: "none" } : null,
            ...(options.organic && !edge.cross ? { category: branchOf.get(edge.to) ?? 0 } : {}),
        });
    });
    return scene;
};
