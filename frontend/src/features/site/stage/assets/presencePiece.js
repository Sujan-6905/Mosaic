import { Color, Group, MathUtils, PerspectiveCamera, Vector3 } from "three";

import { approach } from "./sceneKit";

// Gold and bone are the site's own; the other three exist so five collaborators read apart at a glance.
const SEAT_COLOURS = [0xffb43c, 0xedebe4, 0x7aa2ff, 0x63d6a4, 0xff8fa3];

export async function buildPresence(kit) {
    const gltf = await kit.load("presence");
    const scene = kit.createScene();
    const root = new Group();
    root.add(gltf.scene);
    root.scale.setScalar(0.48);
    scene.add(root);

    const camera = new PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0.4, 7.9, 7.6);
    camera.lookAt(0, -0.2, 0);

    gltf.scene.getObjectByName("board").material = kit.materials.shade;
    const stroke = gltf.scene.getObjectByName("stroke");
    stroke.material = kit.materials.gold;

    const seatObjects = SEAT_COLOURS.map((colour, index) => {
        const material = kit.material({ color: colour, metalness: 0.55, roughness: 0.28, emissive: new Color(colour).multiplyScalar(0.18) });
        const cursor = gltf.scene.getObjectByName(`cursor_${index}`);
        const tag = gltf.scene.getObjectByName(`tag_${index}`);
        cursor.material = material;
        tag.material = material;
        return {
            cursor,
            tag,
            home: cursor.position.clone(),
            tagHome: tag.position.clone(),
            phase: index * 1.27,
            reach: 0.42 + (index % 3) * 0.24,
        };
    });
    const drift = new Vector3();
    const tagTarget = new Vector3();

    return kit.register({
        scene,
        camera,
        gltf,
        update({ time, delta, progress, pointer }) {
            const settle = MathUtils.smoothstep(progress, 0.0, 0.32);
            root.scale.setScalar(approach(root.scale.x, 0.48 + settle * 0.3, 3.4, delta));
            root.rotation.y = approach(root.rotation.y, -0.22 + pointer.x * 0.16, 2.6, delta);
            root.rotation.x = approach(root.rotation.x, pointer.y * 0.06, 2.6, delta);

            for (const seat of seatObjects) {
                drift
                    .set(
                        Math.sin(time * 0.7 + seat.phase) * seat.reach,
                        Math.sin(time * 0.42 + seat.phase) * 0.16,
                        Math.cos(time * 0.55 + seat.phase * 1.4) * seat.reach * 0.7,
                    )
                    .multiplyScalar(settle);
                seat.cursor.position.copy(seat.home).add(drift);
                // The label trails its cursor, as a name tag lags a fast pointer in the product.
                tagTarget.copy(seat.tagHome).add(drift);
                seat.tag.position.lerp(tagTarget, 1 - Math.exp(-7 * delta));
            }

            const drawn = (Math.sin(time * 0.42) + 1) / 2;
            stroke.scale.x = 0.04 + drawn * 0.96;
            stroke.position.x = -3.1 * (1 - stroke.scale.x);
        },
    });
}
