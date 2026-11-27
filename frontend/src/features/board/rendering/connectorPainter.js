// The one place a connector is drawn, for the live board, the read-only renderer and SVG export.
import rough from "roughjs";
import { resolveElementColor } from "./colorResolver";
import { connectorHead, connectorLabelPoint, resolveConnectorPolyline, trimPolyline } from "../../../../../shared/canvas/elements/connectors";

const CIRCLE_SIDES = 18;
const LABEL_FONT_SIZE = 13;
const LABEL_PADDING = 4;

const headLength = (size) => Math.max(11, 7 + (size || 2) * 3);

export const strokeDashFor = (strokeStyle, size) => {
    const width = Math.max(size || 1, 1.5);
    if (strokeStyle === "dashed") return [width * 4, width * 3];
    if (strokeStyle === "dotted") return [0.01, width * 2.6];
    return [];
};

const circlePoints = (center, radius) =>
    Array.from({ length: CIRCLE_SIDES }, (_, i) => {
        const angle = (i * 2 * Math.PI) / CIRCLE_SIDES;
        return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
    });

// A head as plain geometry, so canvas and SVG draw exactly the same thing.
// `fill` is "ink", "ground" or null; `trim` is how much of the line it replaces.
const headGeometry = (kind, tip, from, length) => {
    const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
    const forward = { x: Math.cos(angle), y: Math.sin(angle) };
    const side = { x: -forward.y, y: forward.x };
    const at = (back, across) => ({ x: tip.x - forward.x * back + side.x * across, y: tip.y - forward.y * back + side.y * across });
    const wing = length * 0.5;
    const radius = length * 0.34;
    switch (kind) {
        case "arrow":
            return { trim: 0, parts: [{ points: [at(length, wing), tip, at(length, -wing)], closed: false, fill: null }] };
        case "triangle":
            return { trim: length * 0.7, parts: [{ points: [tip, at(length, wing), at(length, -wing)], closed: true, fill: "ink" }] };
        case "triangle_outline":
            return { trim: length, parts: [{ points: [tip, at(length, wing), at(length, -wing)], closed: true, fill: "ground" }] };
        case "diamond":
            return {
                trim: length,
                parts: [{ points: [tip, at(length * 0.6, wing * 0.75), at(length * 1.2, 0), at(length * 0.6, -wing * 0.75)], closed: true, fill: "ink" }],
            };
        case "diamond_outline":
            return {
                trim: length * 1.2,
                parts: [{ points: [tip, at(length * 0.6, wing * 0.75), at(length * 1.2, 0), at(length * 0.6, -wing * 0.75)], closed: true, fill: "ground" }],
            };
        case "dot":
            return { trim: radius, parts: [{ points: circlePoints(at(radius, 0), radius), closed: true, fill: "ink" }] };
        case "circle_outline":
            return { trim: radius * 2, parts: [{ points: circlePoints(at(radius, 0), radius), closed: true, fill: "ground" }] };
        case "bar":
            return { trim: 0, parts: [{ points: [at(0, wing), at(0, -wing)], closed: false, fill: null }] };
        case "crowfoot_one":
            return { trim: 0, parts: [{ points: [at(length * 0.5, wing), at(length * 0.5, -wing)], closed: false, fill: null }] };
        case "crowfoot_many":
            return { trim: 0, parts: [{ points: [at(0, wing), at(length, 0), at(0, -wing)], closed: false, fill: null }] };
        case "crowfoot_one_many":
            return {
                trim: 0,
                parts: [
                    { points: [at(0, wing), at(length, 0), at(0, -wing)], closed: false, fill: null },
                    { points: [at(length * 1.3, wing), at(length * 1.3, -wing)], closed: false, fill: null },
                ],
            };
        default:
            return { trim: 0, parts: [] };
    }
};

// The trimmed line to stroke and every head part to draw on top of it.
export const connectorGeometry = (connector, polyline) => {
    const length = headLength(connector.size);
    // Measured a head's length back rather than from the last point, so a
    // curve's tiny final segment can't swing the head off its real direction.
    const lastSpan = (route) => {
        const trimmed = trimPolyline(route, 0, length);
        return trimmed[trimmed.length - 1] ?? route[0];
    };
    const reversed = [...polyline].reverse();
    const end = headGeometry(connectorHead(connector, "end"), polyline[polyline.length - 1], lastSpan(polyline), length);
    const start = headGeometry(connectorHead(connector, "start"), polyline[0], lastSpan(reversed), length);
    return {
        line: trimPolyline(polyline, start.trim, end.trim),
        heads: [...start.parts, ...end.parts],
    };
};

// With a corner radius each bend is rounded, never by more than half of either
// run it joins, so short jogs stay jogs.
export const traceConnectorPath = (context, polyline, cornerRadius = 0) => {
    context.moveTo(polyline[0].x, polyline[0].y);
    for (let i = 1; i < polyline.length; i += 1) {
        const point = polyline[i];
        const next = polyline[i + 1];
        if (!cornerRadius || !next) {
            context.lineTo(point.x, point.y);
            continue;
        }
        const previous = polyline[i - 1];
        const radius = Math.min(cornerRadius, Math.hypot(point.x - previous.x, point.y - previous.y) / 2, Math.hypot(next.x - point.x, next.y - point.y) / 2);
        context.arcTo(point.x, point.y, next.x, next.y, radius);
    }
};

const roughGenerator = rough.generator();

// A route's line as a hand would draw it, seeded so it doesn't shimmer as it moves.
export const roughConnectorPaths = (connector, line) => {
    const drawable = roughGenerator.linearPath(
        line.map(({ x, y }) => [x, y]),
        {
            roughness: connector.roughness,
            bowing: connector.roughness,
            seed: Math.abs(Math.floor((connector.zIndex ?? 1) * 1000)) % 2147483647 || 1,
            stroke: "#000",
            strokeWidth: connector.size || 2,
        },
    );
    return roughGenerator.toPaths(drawable).map((part) => part.d);
};

// A pill sits on its own rounded backing with an outline; a tag is the same in small mono capitals.
const labelBox = (element, center, width, fontSize) => {
    const styled = element.labelStyle === "pill" || element.labelStyle === "tag";
    const padX = styled ? LABEL_PADDING * 2.5 : LABEL_PADDING;
    return {
        x: center.x - width / 2 - padX,
        y: center.y - fontSize / 2 - LABEL_PADDING,
        width: width + padX * 2,
        height: fontSize + LABEL_PADDING * 2,
        radius: styled ? (fontSize + LABEL_PADDING * 2) / 2 : 0,
        outlined: styled,
    };
};

const paintLabel = (context, element, polyline, ink, ground) => {
    if (!element.text) return;
    const center = connectorLabelPoint(element, polyline);
    const fontSize = element.fontSize || LABEL_FONT_SIZE;
    const family = element.labelStyle === "tag" ? "'Courier New', monospace" : element.fontFamily || "Arial, sans-serif";
    context.font = `${element.labelStyle === "tag" ? "bold " : ""}${fontSize}px ${family}`;
    const width = context.measureText(element.text).width;
    const box = labelBox(element, center, width, fontSize);
    context.fillStyle = element.labelFill || ground;
    context.beginPath();
    context.roundRect(box.x, box.y, box.width, box.height, box.radius);
    context.fill();
    if (box.outlined) {
        context.lineWidth = 1;
        context.setLineDash([]);
        context.stroke();
    }
    context.fillStyle = ink;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(element.text, center.x, center.y);
    context.textAlign = "start";
    context.textBaseline = "alphabetic";
};

export const paintConnector = (context, element, elementsMap) => {
    const polyline = resolveConnectorPolyline(element, elementsMap);
    if (polyline.length < 2) return;
    const { line, heads } = connectorGeometry(element, polyline);
    const ink = resolveElementColor(element.colorToken, element.color) || "#000000";
    const ground = resolveElementColor("bg-canvas", "#ffffff");
    context.save();
    context.strokeStyle = ink;
    context.fillStyle = ink;
    context.lineWidth = element.size || 2;
    context.globalAlpha = (element.opacity ?? 100) / 100;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.setLineDash(strokeDashFor(element.strokeStyle, element.size));
    if (element.roughness) {
        roughConnectorPaths(element, line).forEach((d) => context.stroke(new Path2D(d)));
    } else {
        context.beginPath();
        traceConnectorPath(context, line, element.cornerRadius);
        context.stroke();
    }
    context.setLineDash([]);
    heads.forEach(({ points, closed, fill }) => {
        context.beginPath();
        traceConnectorPath(context, points);
        if (closed) context.closePath();
        if (fill) {
            context.fillStyle = fill === "ink" ? ink : ground;
            context.fill();
        }
        context.stroke();
    });
    paintLabel(context, element, polyline, ink, ground);
    context.restore();
};
