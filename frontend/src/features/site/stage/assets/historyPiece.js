import { Group, MathUtils, PerspectiveCamera } from "three";

import { approach } from "./sceneKit";

// Must match the model: sixteen marks authored in drawing order, five ticks at these fractions of the rail.
const RECORD = {
    marks: 16,
    ticks: [0.14, 0.33, 0.52, 0.68, 0.88],
    railHalfWidth: 3.05,
    cycle: 13,
    drawUntil: 0.68,
    holdUntil: 0.86,
};

// Scrubber position from 0 (empty board) to 1 (finished); the visible rewind makes it read as a control.
function scrubAt(time) {
    const phase = (time % RECORD.cycle) / RECORD.cycle;
    if (phase < RECORD.drawUntil) return phase / RECORD.drawUntil;
    if (phase < RECORD.holdUntil) return 1;
    return 1 - (phase - RECORD.holdUntil) / (1 - RECORD.holdUntil);
}

export async function buildHistory(kit) {
    const gltf = await kit.load("history");
    const scene = kit.createScene();
    const root = new Group();
    root.add(gltf.scene);
    root.scale.setScalar(0.6);
    scene.add(root);

    const camera = new PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0.35, -0.25, 8.6);
    camera.lookAt(0, -0.25, 0);

    const { gold, bone, stone, shade } = kit.materials;
    const marks = [];
    const snapshots = [];
    const ticks = [];
    gltf.scene.traverse((child) => {
        if (!child.isMesh) return;
        if (child.name.startsWith("mark_")) {
            child.material = bone;
            marks.push({ mesh: child, home: child.position.clone() });
        } else if (child.name.startsWith("snap_")) {
            child.material = stone;
            snapshots.push({ mesh: child, home: child.position.clone() });
        } else if (child.name.startsWith("tick_")) {
            child.material = stone;
            ticks.push(child);
        } else if (child.name === "board" || child.name === "branch") {
            child.material = shade;
        } else if (child.name === "branch_mark") {
            child.material = bone;
        } else if (child.name === "head") {
            child.material = gold;
        } else {
            child.material = stone;
        }
    });
    // Names carry the drawing order, which traversal order does not guarantee.
    const byName = (a, b) => a.mesh.name.localeCompare(b.mesh.name);
    marks.sort(byName);
    snapshots.sort(byName);
    ticks.sort((a, b) => a.name.localeCompare(b.name));

    const head = gltf.scene.getObjectByName("head");
    const headHome = head.position.clone();

    // The branch pieces hang off one group pinned at the fork, so the spur grows out as a single gesture.
    const fork = new Group();
    fork.position.set(-RECORD.railHalfWidth + RECORD.ticks[3] * RECORD.railHalfWidth * 2, gltf.scene.getObjectByName("rail").position.y, 0);
    for (const name of ["branch_rail", "branch", "branch_mark"]) {
        const piece = gltf.scene.getObjectByName(name);
        piece.position.sub(fork.position);
        fork.add(piece);
    }
    gltf.scene.add(fork);

    return kit.register({
        scene,
        camera,
        gltf,
        update({ time, delta, progress, pointer }) {
            const settle = MathUtils.smoothstep(progress, 0.0, 0.35);
            root.rotation.y = approach(root.rotation.y, -0.12 + pointer.x * 0.18, 2.6, delta);
            root.rotation.x = approach(root.rotation.x, 0.05 - pointer.y * 0.07, 2.6, delta);

            // A frozen clock (reduced motion) shows the finished board rather than the blank one.
            const scrub = time > 0 ? scrubAt(time) : 1;
            const drawn = scrub * RECORD.marks;

            head.position.x = headHome.x + (scrub - 0.5) * RECORD.railHalfWidth * 2;
            head.position.y = headHome.y + Math.sin(time * 2.4) * 0.03;

            marks.forEach((mark, index) => {
                // Each mark lands within part of its own slot, so they arrive one at a time.
                const age = drawn - index;
                const landed = MathUtils.clamp(age / 0.65, 0, 1);
                mark.mesh.visible = landed > 0.002;
                if (!mark.mesh.visible) return;
                const eased = MathUtils.smoothstep(landed, 0, 1);
                mark.mesh.scale.setScalar(eased);
                mark.mesh.position.z = mark.home.z + (1 - eased) * 0.5;
                mark.mesh.material = age < 1.1 ? gold : bone;
            });

            snapshots.forEach((snapshot, index) => {
                const tick = RECORD.ticks[index];
                const saved = MathUtils.smoothstep(scrub, tick - 0.015, tick + 0.05);
                snapshot.mesh.position.x = snapshot.home.x - saved * 0.5 * settle;
                snapshot.mesh.position.y = snapshot.home.y + saved * 0.34 * settle;
                const fresh = saved > 0.5 && scrub < tick + 0.14;
                snapshot.mesh.material = fresh ? gold : saved > 0.5 ? bone : stone;
                ticks[index].material = saved > 0.5 ? gold : stone;
            });

            // The spur leaves at the fourth version and stays.
            const forked = MathUtils.smoothstep(scrub, RECORD.ticks[3], RECORD.ticks[3] + 0.12);
            fork.scale.setScalar(Math.max(forked * settle, 0.0001));
            fork.visible = forked > 0.01;
        },
    });
}
