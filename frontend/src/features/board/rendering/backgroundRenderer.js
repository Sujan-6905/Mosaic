import { viewportWorldBounds } from "../camera/camera";
import { resolveElementColor } from "./colorResolver";

export const BACKGROUND_TYPES = ["blank", "dot", "square", "lined", "isometric", "solid"];

// Colours for a solid background; the grid patterns always use the canvas-grid token.
export const SOLID_BACKGROUND_TOKENS = ["bg-canvas", "bg-sunken", "bg-surface", "accent-muted"];

export const DEFAULT_BACKGROUND = { type: "blank", colorToken: null };

const GRID_SIZE = 32;
const DOT_RADIUS = 1.5;

// Below this on-screen spacing a pattern turns to noise, or endless lines when zoomed far out, so it is skipped.
const MIN_SCREEN_SPACING_PX = 6;

// One family of parallel lines; square, lined and isometric are one or more of these at different angles.
const drawLineFamily = (context, bounds, angleRadians, spacing) => {
    const direction = { x: Math.cos(angleRadians), y: Math.sin(angleRadians) };
    const normal = { x: -direction.y, y: direction.x };
    const corners = [
        { x: bounds.minX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.minY },
        { x: bounds.minX, y: bounds.maxY },
        { x: bounds.maxX, y: bounds.maxY },
    ];
    const projected = corners.map((c) => c.x * normal.x + c.y * normal.y);
    const minD = Math.min(...projected);
    const maxD = Math.max(...projected);

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const centerD = centerX * normal.x + centerY * normal.y;
    const halfDiagonal = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2 + spacing;

    const startD = Math.floor(minD / spacing) * spacing;
    for (let d = startD; d <= maxD; d += spacing) {
        const offset = d - centerD;
        const px = centerX + normal.x * offset;
        const py = centerY + normal.y * offset;
        context.moveTo(px - direction.x * halfDiagonal, py - direction.y * halfDiagonal);
        context.lineTo(px + direction.x * halfDiagonal, py + direction.y * halfDiagonal);
    }
};

const paintDotGrid = (context, bounds) => {
    const startX = Math.floor(bounds.minX / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(bounds.minY / GRID_SIZE) * GRID_SIZE;
    context.beginPath();
    for (let x = startX; x <= bounds.maxX; x += GRID_SIZE) {
        for (let y = startY; y <= bounds.maxY; y += GRID_SIZE) {
            context.moveTo(x + DOT_RADIUS, y);
            context.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
        }
    }
    context.fill();
};

const paintLineFamilies = (context, bounds, angles) => {
    context.beginPath();
    angles.forEach((angle) => drawLineFamily(context, bounds, angle, GRID_SIZE));
    context.stroke();
};

// Draws in world space under the camera transform already set, so the pattern pans and zooms with the board.
export const paintBackground = (context, camera, viewportWidth, viewportHeight, config) => {
    const { type, colorToken } = config || DEFAULT_BACKGROUND;
    if (!type || type === "blank") return;

    const bounds = viewportWorldBounds(camera, viewportWidth, viewportHeight);

    if (type === "solid") {
        context.save();
        context.fillStyle = resolveElementColor(colorToken, "#efece5");
        context.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
        context.restore();
        return;
    }

    if (GRID_SIZE * camera.zoom < MIN_SCREEN_SPACING_PX) return;

    const gridColor = resolveElementColor("canvas-grid", "#e4e0d4");
    context.save();
    context.fillStyle = gridColor;
    context.strokeStyle = gridColor;
    context.lineWidth = 1 / camera.zoom;

    if (type === "dot") paintDotGrid(context, bounds);
    else if (type === "square") paintLineFamilies(context, bounds, [0, Math.PI / 2]);
    else if (type === "lined") paintLineFamilies(context, bounds, [0]);
    else if (type === "isometric") paintLineFamilies(context, bounds, [Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]);

    context.restore();
};
