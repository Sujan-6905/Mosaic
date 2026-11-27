import { Group, MathUtils, PerspectiveCamera } from "three";

import { approach } from "./sceneKit";

const FIELD_DISPLACEMENT = /* glsl */ `
    vec3 tileCentre = vec3(aCentre.x, 0.0, -aCentre.y);
    float seed = aTile.x;

    // uFocus is the rectangle a viewport query would ask for: centre in xy, half-extent in zw.
    vec2 reach = abs(aCentre - uFocus.xy) - uFocus.zw;
    float inside = 1.0 - smoothstep(-0.45, 0.45, max(reach.x, reach.y));

    float loose = 1.0 - uOpen;
    float spread = loose * loose + uBurst;
    mat3 spin = tesseraSpin(seed, spread * 0.8);

    vec3 offset = normalize(vec3(tileCentre.x, 3.0, tileCentre.z)) * spread * (2.0 + seed * 5.0);
    offset.y += inside * (0.34 + seed * 0.26) * uOpen;
    offset.y -= (1.0 - inside) * 0.16 * uOpen;
    offset.y += sin(tileCentre.x * 0.55 + uTime * 0.6)
              * cos(tileCentre.z * 0.7 - uTime * 0.45) * uWave * uOpen;

    vGold = max(aTile.y, inside * 0.5);
    vSeed = seed;
    vLit = inside * 0.8;
`;

const PORTAL_DISPLACEMENT = /* glsl */ `
    vec3 tileCentre = vec3(aCentre.x, aCentre.y, 0.0);
    float seed = aTile.x;
    float along = aTile.y;

    float loose = 1.0 - uOpen;
    float spread = loose * loose + uBurst;
    mat3 spin = tesseraSpin(seed, spread * 1.3);

    vec2 radial = normalize(vec2(tileCentre.x, tileCentre.y - 0.9) + vec2(0.001));
    vec3 offset = vec3(radial * (1.1 + seed * 3.6), (seed - 0.5) * 3.2) * spread;

    // A light runs the length of the jamb, the way a board's operation log runs end to end.
    float pulse = smoothstep(0.78, 1.0, sin((along - uTime * 0.13) * 12.566371));
    offset.z += pulse * 0.16 * uOpen;
    offset += vec3(uPointer * 0.24, 0.0) * uOpen;

    vGold = max(step(0.72, seed), pulse);
    vSeed = seed;
    vLit = pulse * 0.9;
`;

// Upright tile glyphs (the monogram, the agent cursor, the assistant bubble) assemble, wave and scatter alike.
const GLYPH_DISPLACEMENT = /* glsl */ `
    vec3 tileCentre = vec3(aCentre.x, aCentre.y, 0.0);
    float seed = aTile.x;

    float loose = 1.0 - uOpen;
    float spread = loose * loose + uBurst;
    mat3 spin = tesseraSpin(seed, spread);

    vec3 outward = normalize(vec3(tileCentre.x, tileCentre.y, 0.8 + seed) + vec3(0.001));
    vec3 offset = outward * (1.4 + seed * 3.4) * spread;

    float pull = 1.0 - smoothstep(0.0, 1.7, distance(tileCentre.xy, uPointer * 2.6));
    offset.z += pull * 0.42 * uOpen;
    offset.z += sin(tileCentre.x * 1.3 + uTime * 0.85)
              * cos(tileCentre.y * 1.1 - uTime * 0.6) * uWave * uOpen;

    vGold = max(aTile.y, pull * 0.7);
    vSeed = seed;
    vLit = pull * 0.6;
`;

export async function buildField(kit) {
    const gltf = await kit.load("field");
    const uniforms = kit.dressTesserae(gltf.scene.getObjectByName("field"), { key: "mosaic-field", displacement: FIELD_DISPLACEMENT });

    const scene = kit.createScene();
    const root = new Group();
    root.add(gltf.scene);
    root.rotation.y = -0.34;
    root.scale.setScalar(0.86);
    scene.add(root);

    const frame = gltf.scene.getObjectByName("gold_frame");
    frame.material = kit.materials.gold;
    // The joined frame keeps the origin of the bar it was joined onto, so it moves relative to where it sits.
    const frameHome = frame.position.clone();

    const camera = new PerspectiveCamera(31, 1, 0.1, 100);
    camera.position.set(0, 9.8, 11.2);
    camera.lookAt(0, 0, 0);

    uniforms.uWave.value = 0.09;
    const focus = uniforms.uFocus.value;

    return kit.register({
        scene,
        camera,
        gltf,
        update({ time, delta, progress, pointer }) {
            const settle = MathUtils.smoothstep(progress, 0.0, 0.32);
            uniforms.uOpen.value = approach(uniforms.uOpen.value, settle, 3.2, delta);
            uniforms.uTime.value = time;

            focus.x = Math.sin(time * 0.24) * 3.6 + pointer.x * 2.0;
            focus.y = Math.cos(time * 0.19) * 2.0 - pointer.y * 1.2;
            frame.position.set(frameHome.x + focus.x, frameHome.y + 0.14 * uniforms.uOpen.value, frameHome.z - focus.y);
            root.rotation.x = approach(root.rotation.x, -0.05 + pointer.y * 0.03, 2.4, delta);
        },
    });
}

export async function buildPortal(kit) {
    const gltf = await kit.load("portal");
    const uniforms = kit.dressTesserae(gltf.scene.getObjectByName("jamb"), { key: "mosaic-portal", displacement: PORTAL_DISPLACEMENT });

    const scene = kit.createScene();
    const root = new Group();
    root.add(gltf.scene);
    scene.add(root);

    const pane = gltf.scene.getObjectByName("pane");
    pane.material = kit.materials.pane;

    const camera = new PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 9.6);
    camera.lookAt(0, -0.15, 0);

    let burst = 0;

    return kit.register({
        scene,
        camera,
        gltf,
        burst() {
            burst = 1;
        },
        resize({ width }) {
            root.scale.setScalar(width >= 900 ? 1 : 0.84);
        },
        update({ time, delta, progress, pointer }) {
            const settle = MathUtils.smoothstep(progress, 0.0, 0.35);
            uniforms.uOpen.value = approach(uniforms.uOpen.value, settle, 3.0, delta);
            // A burst decays on its own, so the easter egg reassembles without a reset.
            burst = approach(burst, 0, 1.5, delta);
            uniforms.uBurst.value = burst;
            uniforms.uTime.value = time;
            uniforms.uPointer.value.copy(pointer);
            root.rotation.y = approach(root.rotation.y, pointer.x * 0.2, 2.4, delta);
            root.rotation.x = approach(root.rotation.x, -pointer.y * 0.1, 2.4, delta);
            pane.material.opacity = 0.06 + uniforms.uOpen.value * 0.16;
            pane.material.emissiveIntensity = 0.1 + uniforms.uOpen.value * 0.55;
        },
    });
}

export async function buildGlyph(kit, kind, node, scale = 1) {
    const gltf = await kit.load(kind);
    const uniforms = kit.dressTesserae(gltf.scene.getObjectByName(node), { key: `mosaic-${node}`, displacement: GLYPH_DISPLACEMENT });

    const scene = kit.createScene();
    const root = new Group();
    root.add(gltf.scene);
    root.scale.setScalar(scale);
    scene.add(root);

    const camera = new PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0, 7.4);
    camera.lookAt(0, 0, 0);

    uniforms.uWave.value = 0.06;
    let burst = 0;

    return kit.register({
        scene,
        camera,
        gltf,
        burst() {
            burst = 1;
        },
        update({ time, delta, progress, pointer }) {
            const settle = MathUtils.smoothstep(progress, 0.0, 0.32);
            uniforms.uOpen.value = approach(uniforms.uOpen.value, settle, 3.4, delta);
            burst = approach(burst, 0, 1.3, delta);
            uniforms.uBurst.value = burst;
            uniforms.uTime.value = time;
            uniforms.uPointer.value.copy(pointer);
            root.rotation.y = approach(root.rotation.y, pointer.x * 0.34, 2.6, delta);
            root.rotation.x = approach(root.rotation.x, -pointer.y * 0.2, 2.6, delta);
        },
    });
}
