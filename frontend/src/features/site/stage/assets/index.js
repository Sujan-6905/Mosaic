import { Color, MeshStandardMaterial, Vector2, Vector4 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

import { createTesseraMaterial, createTesseraUniforms, prepareTesseraGeometry } from "../tessera";
import { createScene, screenFootprint } from "./sceneKit";
import { buildField, buildGlyph, buildPortal } from "./tesseraPieces";
import { buildPresence } from "./presencePiece";
import { buildHistory } from "./historyPiece";
import { buildGraph } from "./graphPiece";

// Blender is Z-up and exports with export_yup: pieces authored flat arrive in three's XZ plane, upright ones in XY.
const MODEL = {
    field: "/models/canvas-field.glb",
    presence: "/models/presence-room.glb",
    history: "/models/board-history.glb",
    graph: "/models/graph-lattice.glb",
    portal: "/models/board-portal.glb",
    monogram: "/models/mosaic-monogram.glb",
    agent: "/models/agent-cursor.glb",
    assist: "/models/assist-bubble.glb",
};

// Each builder resolves to `{ scene, camera, update }`; update receives how far the piece has scrolled through the viewport.
const BUILDERS = {
    field: buildField,
    presence: buildPresence,
    history: buildHistory,
    graph: buildGraph,
    portal: buildPortal,
    monogram: (kit) => buildGlyph(kit, "monogram", "monogram"),
    // The chapter cards are wide and short, so the chapter glyphs sit smaller than the footer's monogram.
    agent: (kit) => buildGlyph(kit, "agent", "agent-cursor", 0.7),
    assist: (kit) => buildGlyph(kit, "assist", "assist-bubble", 0.7),
};

export function createAssetFactory(stage) {
    const draco = new DRACOLoader();
    draco.setDecoderPath("/draco/");
    // Every browser that runs the stage has WebAssembly, so the JavaScript decoder is never shipped.
    draco.setDecoderConfig({ type: "wasm" });
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    const loads = new Map();
    const built = [];
    const ownedMaterials = [];
    const own = (material) => {
        ownedMaterials.push(material);
        return material;
    };
    const material = (params) => own(new MeshStandardMaterial(params));

    const kit = {
        material,
        materials: {
            gold: material({ color: 0xffb43c, metalness: 0.92, roughness: 0.21, envMapIntensity: 1.25 }),
            stone: material({ color: 0x3a3a42, metalness: 0.4, roughness: 0.52 }),
            bone: material({ color: 0xedebe4, metalness: 0.14, roughness: 0.4 }),
            shade: material({ color: 0x101014, metalness: 0.25, roughness: 0.68 }),
            // Lit from the far side, so the doorway reads as a way through rather than a hole in the page.
            pane: material({
                color: 0x0d0d11,
                metalness: 0.7,
                roughness: 0.12,
                transparent: true,
                opacity: 0.4,
                emissive: new Color(0xffb43c),
                emissiveIntensity: 0.14,
            }),
        },
        createScene: () => createScene(stage.environment),
        load(kind) {
            if (!loads.has(kind)) loads.set(kind, loader.loadAsync(MODEL[kind]));
            return loads.get(kind);
        },
        // Moves the mesh's baked layers onto the tessera attribute names and gives it the piece's displacement.
        dressTesserae(mesh, { key, displacement }) {
            prepareTesseraGeometry(mesh.geometry, "uv", "uv1");
            const uniforms = createTesseraUniforms({ pointer: new Vector2(0, 0), focus: new Vector4(0, 0, 2.8, 1.6) });
            mesh.material = own(createTesseraMaterial({ key, uniforms, displacement }));
            return uniforms;
        },
        register(asset) {
            built.push(asset);
            asset.footprint = (aspect) => screenFootprint(asset.gltf.scene, asset.camera, aspect);
            return asset;
        },
    };

    return {
        create(kind) {
            const build = BUILDERS[kind];
            if (!build) return Promise.reject(new Error(`unknown asset ${kind}`));
            return build(kit);
        },
        dispose() {
            for (const asset of built) asset.gltf.scene.traverse((child) => child.geometry?.dispose());
            for (const owned of ownedMaterials) owned.dispose();
            draco.dispose();
        },
    };
}
