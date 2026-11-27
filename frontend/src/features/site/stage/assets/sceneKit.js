import { AmbientLight, Box3, DirectionalLight, Scene, Vector3 } from "three";

export const approach = (current, target, rate, delta) => current + (target - current) * (1 - Math.exp(-rate * delta));

export function createScene(environment) {
    const scene = new Scene();
    scene.environment = environment;
    const key = new DirectionalLight(0xfff0dc, 2.3);
    key.position.set(4.2, 5.5, 4.0);
    const rim = new DirectionalLight(0x9fc4ff, 1.15);
    rim.position.set(-5.0, 1.4, -3.2);
    scene.add(key, rim, new AmbientLight(0xffffff, 0.22));
    return scene;
}

const FOOTPRINT_CORNER = new Vector3();

// The model's on-screen box as fractions of its slot, so only the object itself is clickable, not the empty slot.
// Aspect is passed in because the render loop only writes it to the camera once the slot is on screen.
export function screenFootprint(object, camera, aspect) {
    object.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(object);
    if (box.isEmpty()) return null;

    const view = camera.clone();
    view.aspect = aspect;
    view.updateProjectionMatrix();
    view.updateMatrixWorld(true);

    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;

    for (let corner = 0; corner < 8; corner += 1) {
        FOOTPRINT_CORNER.set(corner & 1 ? box.max.x : box.min.x, corner & 2 ? box.max.y : box.min.y, corner & 4 ? box.max.z : box.min.z).project(view);
        left = Math.min(left, (FOOTPRINT_CORNER.x + 1) / 2);
        right = Math.max(right, (FOOTPRINT_CORNER.x + 1) / 2);
        top = Math.min(top, (1 - FOOTPRINT_CORNER.y) / 2);
        bottom = Math.max(bottom, (1 - FOOTPRINT_CORNER.y) / 2);
    }

    const clamp = (value) => Math.min(Math.max(value, 0), 1);
    return {
        left: clamp(left),
        top: clamp(top),
        width: clamp(right) - clamp(left),
        height: clamp(bottom) - clamp(top),
    };
}
