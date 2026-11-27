// Shared shader for the merged mosaic meshes: Blender bakes each tile's centre and per-tile scalars into the
// `uv`/`uv1` layers, and each asset supplies only its own `displacement` GLSL snippet.

import { Color, MeshStandardMaterial } from "three";

const GOLD = new Color("#ffb43c");
const STONE = new Color("#3a3a42");

/* A snippet must declare `tileCentre`, `spin` and `offset`, and set the
   varyings; the two replacements below consume exactly those names. */
const CHASSIS = /* glsl */ `
attribute vec2 aCentre;
attribute vec2 aTile;

uniform float uTime;
uniform float uOpen;
uniform float uBurst;
uniform float uWave;
uniform vec2  uPointer;
uniform vec4  uFocus;

varying float vGold;
varying float vSeed;
varying float vLit;

mat3 tesseraSpin(float seed, float amount) {
    vec3 axis = normalize(vec3(
        sin(seed * 12.9898),
        cos(seed * 78.233),
        sin(seed * 43.7585) + 0.35
    ));
    float angle = (seed - 0.5) * 6.2831853 * amount * 1.7;
    float s = sin(angle);
    float c = cos(angle);
    float t = 1.0 - c;
    return mat3(
        t * axis.x * axis.x + c,          t * axis.x * axis.y - s * axis.z, t * axis.x * axis.z + s * axis.y,
        t * axis.x * axis.y + s * axis.z, t * axis.y * axis.y + c,          t * axis.y * axis.z - s * axis.x,
        t * axis.x * axis.z - s * axis.y, t * axis.y * axis.z + s * axis.x, t * axis.z * axis.z + c
    );
}
`;

const FRAGMENT_HEAD = /* glsl */ `
uniform vec3 uGold;
uniform vec3 uStone;
varying float vGold;
varying float vSeed;
varying float vLit;
`;

// Uniforms are built up front and merged in at compile time, so values set before the program exists still land.
export function createTesseraUniforms(extra = {}) {
    return {
        uTime: { value: 0 },
        uOpen: { value: 0 },
        uBurst: { value: 0 },
        uWave: { value: 0 },
        uPointer: { value: extra.pointer },
        uFocus: { value: extra.focus },
        uGold: { value: GOLD },
        uStone: { value: STONE },
    };
}

export function createTesseraMaterial({ key, uniforms, displacement, metalness = 0.6, roughness = 0.32 }) {
    const material = new MeshStandardMaterial({
        color: 0xffffff,
        metalness,
        roughness,
        envMapIntensity: 1.1,
    });

    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);

        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>\n${CHASSIS}`)
            .replace("#include <beginnormal_vertex>", `${displacement}\n#include <beginnormal_vertex>\n    objectNormal = spin * objectNormal;`)
            .replace("#include <begin_vertex>", "vec3 transformed = tileCentre + spin * (position - tileCentre) + offset;");

        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>\n${FRAGMENT_HEAD}`)
            .replace("#include <color_fragment>", "diffuseColor.rgb *= mix(uStone, uGold, vGold) * (0.80 + vSeed * 0.3 + vLit * 0.55);")
            .replace("#include <metalnessmap_fragment>", "float metalnessFactor = mix(0.18, 1.0, vGold);")
            .replace("#include <roughnessmap_fragment>", "float roughnessFactor = mix(0.62, 0.19 + vSeed * 0.1, vGold);");
    };

    // Each asset needs its own compiled program, and three keys the cache on
    // the material's own settings, which are identical across all of them.
    material.customProgramCacheKey = () => key;
    return material;
}

// three reserves `uv`/`uv1`, so the baked layers move to new names or the custom attribute declaration collides.
export function prepareTesseraGeometry(geometry, centreLayer = "uv", attrLayer = "uv1") {
    const centre = geometry.attributes[centreLayer];
    const attr = geometry.attributes[attrLayer];
    if (!centre || !attr) {
        throw new Error(`asset is missing its per-tile layers (${centreLayer}, ${attrLayer})`);
    }
    geometry.setAttribute("aCentre", centre);
    geometry.setAttribute("aTile", attr);
    geometry.deleteAttribute(centreLayer);
    geometry.deleteAttribute(attrLayer);
    return geometry;
}
