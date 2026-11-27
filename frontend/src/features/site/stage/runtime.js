// One fixed canvas covers the viewport and each piece's DOM box sets the renderer scissor per frame, so the pieces
// share one context, renderer and environment map while the page lays out normally.

import { ACESFilmicToneMapping, PMREMGenerator, SRGBColorSpace, Vector2, WebGLRenderer } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export function webglAvailable() {
    try {
        const probe = document.createElement("canvas");
        return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
    } catch {
        return false;
    }
}

export function pickQuality() {
    if (typeof window === "undefined") return "high";
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;
    if (window.innerWidth < 760 || cores <= 4 || memory <= 4) return "low";
    if (cores <= 8) return "medium";
    return "high";
}

const PIXEL_RATIO_CAP = { low: 1.25, medium: 1.6, high: 2 };

export default class Stage {
    constructor(canvas, { quality = "high" } = {}) {
        this.quality = quality;
        this.slots = [];
        this.pointer = new Vector2(0, 0);
        this.pointerTarget = new Vector2(0, 0);
        this.disposed = false;
        this.running = false;
        this.drewLastFrame = false;
        this.clockStart = performance.now();
        this.lastFrame = this.clockStart;
        this.size = { width: 0, height: 0 };

        this.renderer = new WebGLRenderer({
            canvas,
            antialias: quality !== "low",
            alpha: true,
            powerPreference: "high-performance",
        });
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP[quality]));
        this.renderer.outputColorSpace = SRGBColorSpace;
        this.renderer.toneMapping = ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.12;

        const pmrem = new PMREMGenerator(this.renderer);
        this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();

        this.handleResize();
    }

    handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        if (width === this.size.width && height === this.size.height) return;
        this.size = { width, height };
        this.renderer.setSize(width, height, false);
        for (const slot of this.slots) slot.asset.resize?.(this.size);
    }

    setPointer(x, y) {
        this.pointerTarget.set(x, y);
    }

    add(asset, element) {
        const slot = { asset, element };
        this.slots.push(slot);
        asset.resize?.(this.size);
        return () => {
            this.slots = this.slots.filter((entry) => entry !== slot);
            asset.dispose?.();
        };
    }

    start() {
        if (this.running || this.disposed) return;
        this.running = true;
        this.lastFrame = performance.now();
        const tick = () => {
            if (this.disposed || !this.running) return;
            this.frame = requestAnimationFrame(tick);
            this.render();
        };
        this.frame = requestAnimationFrame(tick);
    }

    stop() {
        this.running = false;
        if (this.frame) cancelAnimationFrame(this.frame);
    }

    render() {
        const now = performance.now();
        // Frame-rate independent smoothing: a per-frame lerp crawls on a slow
        // device and snaps on a 120Hz one.
        const delta = Math.min((now - this.lastFrame) / 1000, 0.1);
        this.lastFrame = now;
        // Under reduced motion the clock freezes, stopping every idle animation while scroll and pointer response stay.
        const time = this.reduced ? 0 : (now - this.clockStart) / 1000;
        const approach = 1 - Math.exp(-3.6 * delta);
        this.pointer.lerp(this.pointerTarget, approach);

        const { width, height } = this.size;
        const renderer = this.renderer;
        const visible = [];

        for (const slot of this.slots) {
            const rect = slot.element.getBoundingClientRect();
            if (rect.width < 2 || rect.height < 2) continue;
            if (rect.bottom <= 0 || rect.top >= height) continue;
            visible.push({ slot, rect });
        }

        // Nothing on screen and nothing left over from last frame: the canvas
        // is already empty, so scrolling past the 3D costs nothing at all.
        if (!visible.length && !this.drewLastFrame) return;
        this.drewLastFrame = visible.length > 0;

        renderer.setScissorTest(false);
        renderer.clear();
        renderer.setScissorTest(true);

        for (const { slot, rect } of visible) {
            const bottom = height - rect.bottom;
            renderer.setViewport(rect.left, bottom, rect.width, rect.height);
            renderer.setScissor(rect.left, bottom, rect.width, rect.height);

            const { asset } = slot;
            const camera = asset.camera;
            const aspect = rect.width / rect.height;
            if (camera.isPerspectiveCamera && camera.aspect !== aspect) {
                camera.aspect = aspect;
                camera.updateProjectionMatrix();
            }

            asset.update({
                time,
                delta,
                // 0 as the element's middle sits on the bottom edge of the
                // screen, 1 as it leaves through the top.
                progress: 1 - (rect.top + rect.height / 2) / height,
                pointer: this.pointer,
                width: rect.width,
                height: rect.height,
            });

            renderer.render(asset.scene, camera);
        }

        renderer.setScissorTest(false);
    }

    dispose() {
        this.disposed = true;
        this.stop();
        for (const slot of this.slots) slot.asset.dispose?.();
        this.slots = [];
        this.environment?.dispose();
        this.renderer.dispose();
    }
}
