import { valueOf } from "../model.js";
import { emptyScene, place } from "./common.js";

const ITERATIONS = 320;
const SPRING_LENGTH = 190;
const REPULSION = 52000;
const GRAVITY = 0.015;
const OVERLAP_PASSES = 60;
const CLEARANCE = 22;
const MAX_GROWTH = 2.2;

// Strongly connected components with more than one member, so a dependency
// graph can flag every edge that sits on a cycle.
const cyclicEdges = (model) => {
    const index = new Map();
    const low = new Map();
    const stack = [];
    const onStack = new Set();
    const componentOf = new Map();
    let counter = 0;
    let component = 0;
    const strongConnect = (id) => {
        index.set(id, counter);
        low.set(id, counter);
        counter += 1;
        stack.push(id);
        onStack.add(id);
        model.edges
            .filter((edge) => edge.from === id)
            .forEach(({ to }) => {
                if (!index.has(to)) {
                    strongConnect(to);
                    low.set(id, Math.min(low.get(id), low.get(to)));
                } else if (onStack.has(to)) low.set(id, Math.min(low.get(id), index.get(to)));
            });
        if (low.get(id) === index.get(id)) {
            let member;
            const members = [];
            do {
                member = stack.pop();
                onStack.delete(member);
                members.push(member);
            } while (member !== id);
            members.forEach((m) => componentOf.set(m, members.length > 1 ? component : -1));
            component += 1;
        }
    };
    model.nodes.forEach((node) => {
        if (!index.has(node.id)) strongConnect(node.id);
    });
    return new Set(
        model.edges.filter((edge) => edge.from === edge.to || (componentOf.get(edge.from) !== -1 && componentOf.get(edge.from) === componentOf.get(edge.to))),
    );
};

export const layoutForce = (ctx) => {
    const { model, sizes, options, gap } = ctx;
    const scene = emptyScene();
    const ids = model.nodes.map((node) => node.id);
    const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
    const boxes = new Map(ids.map((id) => [id, { ...sizes.get(id) }]));
    if (options.sizeBy === "value") {
        const values = model.nodes.map((node) => valueOf(node));
        const smallest = Math.min(...values);
        ids.forEach((id) => {
            const box = boxes.get(id);
            const grown = Math.max(box.w, box.h) * Math.sqrt(valueOf(nodeById.get(id)) / smallest);
            const capped = Math.min(grown, Math.max(box.w, box.h) * MAX_GROWTH, 320);
            if (options.nodeShape === "circle") boxes.set(id, { w: capped, h: capped });
            else boxes.set(id, { w: Math.max(box.w, capped), h: Math.max(box.h, capped * 0.5) });
        });
    }

    // A golden-angle spiral start makes the result the same every time.
    const position = new Map(
        ids.map((id, i) => {
            const angle = i * 2.39996;
            const radius = 40 * Math.sqrt(i + 1);
            return [id, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }];
        }),
    );
    const spring = SPRING_LENGTH * gap;
    for (let step = 0; step < ITERATIONS; step += 1) {
        const cooling = 1 - step / ITERATIONS;
        const force = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));
        for (let i = 0; i < ids.length; i += 1) {
            for (let j = i + 1; j < ids.length; j += 1) {
                const a = position.get(ids[i]);
                const b = position.get(ids[j]);
                const dx = a.x - b.x || 0.01;
                const dy = a.y - b.y || 0.01;
                const distanceSquared = Math.max(dx * dx + dy * dy, 100);
                const push = REPULSION / distanceSquared;
                const distance = Math.sqrt(distanceSquared);
                force.get(ids[i]).x += (dx / distance) * push;
                force.get(ids[i]).y += (dy / distance) * push;
                force.get(ids[j]).x -= (dx / distance) * push;
                force.get(ids[j]).y -= (dy / distance) * push;
            }
        }
        model.edges.forEach(({ from, to }) => {
            if (from === to) return;
            const a = position.get(from);
            const b = position.get(to);
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distance = Math.hypot(dx, dy) || 1;
            const pull = (distance - spring) * 0.06;
            force.get(from).x += (dx / distance) * pull;
            force.get(from).y += (dy / distance) * pull;
            force.get(to).x -= (dx / distance) * pull;
            force.get(to).y -= (dy / distance) * pull;
        });
        ids.forEach((id) => {
            const point = position.get(id);
            const { x, y } = force.get(id);
            const limit = 40 * cooling + 2;
            point.x += Math.max(-limit, Math.min(limit, x - point.x * GRAVITY));
            point.y += Math.max(-limit, Math.min(limit, y - point.y * GRAVITY));
        });
    }
    // Forces leave boxes touching; push any overlapping pair apart along the shorter axis.
    for (let pass = 0; pass < OVERLAP_PASSES; pass += 1) {
        let moved = false;
        for (let i = 0; i < ids.length; i += 1) {
            for (let j = i + 1; j < ids.length; j += 1) {
                const a = position.get(ids[i]);
                const b = position.get(ids[j]);
                const boxA = boxes.get(ids[i]);
                const boxB = boxes.get(ids[j]);
                const overlapX = (boxA.w + boxB.w) / 2 + CLEARANCE - Math.abs(a.x - b.x);
                const overlapY = (boxA.h + boxB.h) / 2 + CLEARANCE - Math.abs(a.y - b.y);
                if (overlapX <= 0 || overlapY <= 0) continue;
                moved = true;
                if (overlapX < overlapY) {
                    const shift = (overlapX / 2) * Math.sign(a.x - b.x || 1);
                    a.x += shift;
                    b.x -= shift;
                } else {
                    const shift = (overlapY / 2) * Math.sign(a.y - b.y || 1);
                    a.y += shift;
                    b.y -= shift;
                }
            }
        }
        if (!moved) break;
    }
    ids.forEach((id) => place(scene, id, position.get(id).x, position.get(id).y, boxes.get(id), { role: "node", fixedSize: options.sizeBy === "value" }));
    const flagged = options.flagCycles ? cyclicEdges(model) : new Set();
    model.edges.forEach((edge) =>
        scene.edges.push({ ...edge, routing: "curved", alert: flagged.has(edge), faint: options.sizeBy === "value" && !options.flagCycles }),
    );
    return scene;
};
