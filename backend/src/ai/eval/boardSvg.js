// A plain SVG of a board's elements, enough to judge a model's result by eye.
const MARGIN = 40;
const CHAR_WIDTH_RATIO = 0.56;

const escapeText = (text) =>
    String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;");

const boundsOf = (element) => {
    if (element.type === "path") {
        const xs = element.points.map((point) => point.x);
        const ys = element.points.map((point) => point.y);
        return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
    if (element.type === "text" || element.type === "sticky")
        return [element.x, element.y, element.x + (element.width ?? 200), element.y + (element.height ?? (element.size ?? 16) * 1.6)];
    return [
        Math.min(element.startX, element.endX),
        Math.min(element.startY, element.endY),
        Math.max(element.startX, element.endX),
        Math.max(element.startY, element.endY),
    ];
};

// Greedy word wrap by an average glyph width; close enough to read a label in a review image.
const wrapWords = (text, width, fontSize) => {
    const perLine = Math.max(4, Math.floor(width / (fontSize * CHAR_WIDTH_RATIO)));
    return String(text ?? "")
        .split("\n")
        .flatMap((paragraph) =>
            paragraph.split(/\s+/).reduce((lines, word) => {
                const last = lines.at(-1);
                if (last !== undefined && `${last} ${word}`.length <= perLine) lines[lines.length - 1] = `${last} ${word}`;
                else lines.push(word);
                return lines;
            }, []),
        );
};

const centredText = (text, [minX, minY, maxX, maxY], { fontSize, color, weight = "normal" }) => {
    const lines = wrapWords(text, maxX - minX - 8, fontSize);
    const top = (minY + maxY) / 2 - ((lines.length - 1) * fontSize * 1.2) / 2 + fontSize * 0.35;
    return lines
        .map(
            (line, index) =>
                `<text x="${(minX + maxX) / 2}" y="${top + index * fontSize * 1.2}" font-size="${fontSize}" font-weight="${weight}" text-anchor="middle" fill="${color}">${escapeText(line)}</text>`,
        )
        .join("");
};

// Where a segment from the box's centre towards `toward` leaves the box, so bound arrows stop at the edge.
const edgePoint = ([minX, minY, maxX, maxY], toward) => {
    const centre = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    const dx = toward.x - centre.x;
    const dy = toward.y - centre.y;
    if (dx === 0 && dy === 0) return centre;
    const scale = Math.min(dx ? (maxX - minX) / 2 / Math.abs(dx) : Infinity, dy ? (maxY - minY) / 2 / Math.abs(dy) : Infinity);
    return { x: centre.x + dx * scale, y: centre.y + dy * scale };
};

// The point halfway along a route, where a connector's label sits.
const midpointOf = (points) => {
    const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
    let remaining = lengths.reduce((sum, length) => sum + length, 0) / 2;
    for (let index = 0; index < lengths.length; index += 1) {
        if (remaining <= lengths[index] && lengths[index] > 0) {
            const t = remaining / lengths[index];
            return { x: points[index].x + (points[index + 1].x - points[index].x) * t, y: points[index].y + (points[index + 1].y - points[index].y) * t };
        }
        remaining -= lengths[index];
    }
    return points[0];
};

const renderConnector = (element, byId, style) => {
    const bends = element.waypoints ?? [];
    let start = { x: element.startX, y: element.startY };
    let end = { x: element.endX, y: element.endY };
    const startBox = byId.get(element.startElementId);
    const endBox = byId.get(element.endElementId);
    if (startBox) start = edgePoint(boundsOf(startBox), bends[0] ?? end);
    if (endBox) end = edgePoint(boundsOf(endBox), bends.at(-1) ?? start);
    const points = [start, ...bends, end];
    const heads = `${element.arrowEnd || element.endHead === "arrow" ? ' marker-end="url(#arrow)"' : ""}${element.arrowStart || element.startHead === "arrow" ? ' marker-start="url(#arrow)"' : ""}`;
    const middle = midpointOf(points);
    const label = element.text
        ? centredText(element.text, [middle.x - 60, middle.y - 10, middle.x + 60, middle.y + 10], { fontSize: 12, color: element.color ?? "#111111" })
        : "";
    return `<polyline points="${points.map((point) => `${point.x},${point.y}`).join(" ")}" ${style}${heads}/>${label}`;
};

const renderShape = (element, style, bounds, rotation) => {
    const [minX, minY, maxX, maxY] = bounds;
    const [centerX, centerY] = [(minX + maxX) / 2, (minY + maxY) / 2];
    if (element.shapeType === "Ellipse" || element.shapeType === "Circle")
        return `<ellipse cx="${centerX}" cy="${centerY}" rx="${(maxX - minX) / 2}" ry="${(maxY - minY) / 2}" ${style}${rotation}/>`;
    if (element.shapeType === "Diamond")
        return `<polygon points="${centerX},${minY} ${maxX},${centerY} ${centerX},${maxY} ${minX},${centerY}" ${style}${rotation}/>`;
    if (element.shapeType === "Line" || element.shapeType === "Arrow")
        return `<line x1="${element.startX}" y1="${element.startY}" x2="${element.endX}" y2="${element.endY}" ${style}${element.shapeType === "Arrow" ? ' marker-end="url(#arrow)"' : ""}/>`;
    const radius = element.cornerRadius ? ` rx="${element.cornerRadius}"` : "";
    return `<rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}"${radius} ${style}${rotation}/>`;
};

const renderElement = (element, byId) => {
    const stroke = element.color ?? "#111111";
    const fill = element.fillColor ?? "none";
    const opacity = (element.opacity ?? 100) / 100;
    const style = `stroke="${stroke}" stroke-width="${element.size ?? 2}" fill="${fill}" opacity="${opacity}"`;
    const bounds = boundsOf(element);
    const [minX, minY, maxX, maxY] = bounds;
    const rotation = element.rotation ? ` transform="rotate(${element.rotation} ${(minX + maxX) / 2} ${(minY + maxY) / 2})"` : "";
    if (element.type === "path")
        return `<polyline points="${element.points.map(({ x, y }) => `${x},${y}`).join(" ")}" stroke-linejoin="round" stroke-linecap="round" ${style}${rotation}/>`;
    if (element.type === "text") {
        const size = element.size ?? 16;
        return `<text x="${minX}" y="${minY + size}" font-size="${size}" font-weight="${element.fontWeight ?? "normal"}" fill="${stroke}" opacity="${opacity}"${rotation}>${escapeText(element.text)}</text>`;
    }
    if (element.type === "sticky")
        return `<g${rotation}><rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" fill="${element.fillColor ?? "#fef3c7"}" opacity="${opacity}"/>${centredText(element.text, bounds, { fontSize: 16, color: stroke })}</g>`;
    if (element.type === "connector")
        return renderConnector(element, byId, `stroke="${stroke}" stroke-width="${element.size ?? 2}" fill="none" opacity="${opacity}"`);
    const words = element.text
        ? centredText(element.text, bounds, { fontSize: element.fontSize ?? 14, color: element.textColor ?? stroke, weight: element.fontWeight })
        : "";
    return `${renderShape(element, style, bounds, rotation)}${words}`;
};

// `elementsById` is the board's own map, so connectors can find the shapes they are bound to.
export const renderBoardSvg = (elementsById) => {
    const elements = Object.values(elementsById);
    if (elements.length === 0) return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80"><text x="20" y="40">Empty board</text></svg>`;
    const byId = new Map(Object.entries(elementsById));
    const boxes = elements.map(boundsOf);
    const [minX, minY] = [Math.min(...boxes.map((box) => box[0])) - MARGIN, Math.min(...boxes.map((box) => box[1])) - MARGIN];
    const [maxX, maxY] = [Math.max(...boxes.map((box) => box[2])) + MARGIN, Math.max(...boxes.map((box) => box[3])) + MARGIN];
    const ordered = [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const arrowHead = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" width="${Math.min(1400, maxX - minX)}" font-family="Helvetica, Arial, sans-serif">${arrowHead}<rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" fill="#f6f6f3"/>${ordered.map((element) => renderElement(element, byId)).join("")}</svg>`;
};
