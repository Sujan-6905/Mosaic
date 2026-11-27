import { useEffect, useRef } from "react";
import { drawSceneStatic, drawDiffMarker } from "./staticSceneRenderer";
import { getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { cameraToFit } from "../camera/viewport";

// A standalone read-only canvas for version previews, replay and the branch diff, with optional diff outlines.
// `fitElements` frames the camera instead of `elements`, so a sequence of frames holds still.
const StaticCanvasPreview = ({ elements, background, diffMarkers = [], fitElements, width = 320, height = 220, className }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, width, height);

        const bounds = getUnionBounds([...Object.values(fitElements || elements || {}), ...diffMarkers.map((m) => m.element)].filter(Boolean));
        const padding = Math.round(Math.min(width, height) * 0.08);
        const camera = cameraToFit(bounds, width, height, padding, { clamp: false }) || { x: 0, y: 0, zoom: 1 };

        drawSceneStatic(context, elements || {}, background || { type: "blank", colorToken: null }, camera, width, height);

        context.setTransform(camera.zoom, 0, 0, camera.zoom, -camera.x * camera.zoom, -camera.y * camera.zoom);
        diffMarkers.forEach(({ element, color, dashed }) => drawDiffMarker(context, element, color, { dashed }));
    }, [elements, background, diffMarkers, fitElements, width, height]);

    return <canvas ref={canvasRef} className={className} width={width} height={height} />;
};

export default StaticCanvasPreview;
