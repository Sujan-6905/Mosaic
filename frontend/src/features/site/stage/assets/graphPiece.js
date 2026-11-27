import { Group, MathUtils, PerspectiveCamera, Vector3 } from "three";

import { approach } from "./sceneKit";

export async function buildGraph(kit) {
    const gltf = await kit.load("graph");
    const scene = kit.createScene();
    const root = new Group();
    root.add(gltf.scene);
    root.scale.setScalar(0.74);
    scene.add(root);

    const camera = new PerspectiveCamera(33, 1, 0.1, 100);
    camera.position.set(0, 7.4, 4.2);
    camera.lookAt(0, 0, -0.3);

    const { gold, bone, stone } = kit.materials;
    const nodes = [];
    const edges = [];
    gltf.scene.traverse((child) => {
        if (!child.isMesh) return;
        if (child.name.startsWith("node_")) {
            const index = Number(child.name.slice(5));
            child.material = index === 0 || index === 6 ? gold : bone;
            nodes.push({
                mesh: child,
                home: child.position.clone(),
                // Where an unconstrained model guess would have put it, before the deterministic layout ran.
                loose: child.position
                    .clone()
                    .add(new Vector3(Math.sin(index * 12.9898) * 2.8, 1.4 + Math.cos(index * 4.1414) * 1.2, Math.sin(index * 7.233) * 2.4)),
            });
        } else if (child.name.startsWith("edge_")) {
            child.material = stone;
            edges.push(child);
        } else {
            child.material = gold;
        }
    });

    const prompt = gltf.scene.getObjectByName("prompt");
    const promptHome = prompt.position.clone();

    return kit.register({
        scene,
        camera,
        gltf,
        update({ time, delta, progress, pointer }) {
            const settle = MathUtils.smoothstep(progress, 0.0, 0.35);
            root.rotation.y = approach(root.rotation.y, pointer.x * 0.22, 2.6, delta);
            root.rotation.x = approach(root.rotation.x, -0.04 - pointer.y * 0.05, 2.6, delta);

            for (const node of nodes) {
                node.mesh.position.lerpVectors(node.loose, node.home, settle);
                node.mesh.position.y += Math.sin(time * 0.8 + node.home.x) * 0.05 * settle;
                node.mesh.scale.setScalar(0.45 + settle * 0.55);
            }
            // Rods were authored along their own Z, so scaling only that axis keeps their thickness.
            const drawn = MathUtils.smoothstep(settle, 0.3, 1);
            for (const edge of edges) edge.scale.z = drawn;

            prompt.position.z = promptHome.z + (1 - settle) * 1.4;
            prompt.position.y = promptHome.y + Math.sin(time * 0.9) * 0.06;
        },
    });
}
