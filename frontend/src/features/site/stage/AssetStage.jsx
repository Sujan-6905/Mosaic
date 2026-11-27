import { useEffect, useRef } from "react";
import { isCalm } from "@/lib/calmMode";

import Stage, { pickQuality, webglAvailable } from "./runtime";
import { createAssetFactory } from "./assets";

// Owns the page's single WebGL context and reports a controller up, so slots never import three and the page
// renders server-side while the renderer loads later.

export default function AssetStage({ className, onState }) {
    const canvas = useRef(null);
    const handlers = useRef({ onState });
    handlers.current = { onState };

    useEffect(() => {
        const report = handlers.current.onState;

        if (!webglAvailable()) {
            report?.({ controller: null, unavailable: true });
            return undefined;
        }

        let stage;
        try {
            stage = new Stage(canvas.current, { quality: pickQuality() });
        } catch {
            report?.({ controller: null, unavailable: true });
            return undefined;
        }

        stage.reduced = isCalm();
        const factory = createAssetFactory(stage);
        stage.start();

        report?.({
            unavailable: false,
            controller: {
                async mount(kind, element) {
                    const asset = await factory.create(kind);
                    const release = stage.add(asset, element);
                    return { asset, release };
                },
            },
        });

        const onResize = () => stage.handleResize();
        // One pointer position in the -1..1 range that every asset reads the
        // same way, whatever rectangle of the canvas it occupies.
        const onPointerMove = (event) => {
            stage.setPointer((event.clientX / window.innerWidth) * 2 - 1, (event.clientY / window.innerHeight) * 2 - 1);
        };
        const onVisibility = () => {
            if (document.hidden) stage.stop();
            else stage.start();
        };

        window.addEventListener("resize", onResize);
        window.addEventListener("pointermove", onPointerMove, { passive: true });
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            window.removeEventListener("resize", onResize);
            window.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("visibilitychange", onVisibility);
            factory.dispose();
            stage.dispose();
            handlers.current.onState?.({ controller: null, unavailable: false });
        };
    }, []);

    return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
