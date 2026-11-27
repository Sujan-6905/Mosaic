// Icons travel as plain path data, never SVG markup, so one can't carry a script, link
// or remote reference. Paint is the element's own ink or a fixed hex.

const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]*$/;
const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;
const MAX_PATHS = 64;
const MAX_PATH_LENGTH = 12000;
export const LINE_CAPS = ["round", "butt", "square"];
export const LINE_JOINS = ["round", "miter", "bevel"];

const isSafePathData = (d) => typeof d === "string" && d.length > 0 && d.length <= MAX_PATH_LENGTH && PATH_DATA.test(d);
const isIconPaint = (value) => value === "ink" || value === "none" || HEX.test(value ?? "");

const attributesOf = (tag) => {
    const attributes = {};
    tag.replace(/([a-zA-Z-:]+)\s*=\s*"([^"]*)"/g, (_, name, value) => {
        attributes[name] = value;
        return "";
    });
    return attributes;
};

const number = (value, fallback = 0) => (Number.isFinite(Number.parseFloat(value)) ? Number.parseFloat(value) : fallback);

const primitiveToPath = (name, a) => {
    switch (name) {
        case "path":
            return a.d ?? null;
        case "circle": {
            const [cx, cy, r] = [number(a.cx), number(a.cy), number(a.r)];
            return r > 0 ? `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z` : null;
        }
        case "ellipse": {
            const [cx, cy, rx, ry] = [number(a.cx), number(a.cy), number(a.rx), number(a.ry)];
            return rx > 0 && ry > 0 ? `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z` : null;
        }
        case "rect": {
            const [x, y, w, h] = [number(a.x), number(a.y), number(a.width), number(a.height)];
            const r = Math.min(number(a.rx, number(a.ry)), w / 2, h / 2);
            if (w <= 0 || h <= 0) return null;
            if (r <= 0) return `M${x} ${y}h${w}v${h}h${-w}Z`;
            return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
        }
        case "line":
            return `M${number(a.x1)} ${number(a.y1)}L${number(a.x2)} ${number(a.y2)}`;
        case "polyline":
        case "polygon": {
            const values = (a.points ?? "")
                .trim()
                .split(/[\s,]+/)
                .map(Number)
                .filter(Number.isFinite);
            if (values.length < 4) return null;
            const pairs = [];
            for (let i = 0; i + 1 < values.length; i += 2) pairs.push(`${values[i]} ${values[i + 1]}`);
            return `M${pairs.join("L")}${name === "polygon" ? "Z" : ""}`;
        }
        default:
            return null;
    }
};

// A gradient fill keeps its first stop, which is close enough at icon size.
const gradientColours = (body) => {
    const colours = {};
    body.replace(/<(linearGradient|radialGradient)\b([^>]*)>([\s\S]*?)<\/\1>/g, (_, __, attributes, stops) => {
        const id = attributesOf(attributes).id;
        const first = /stop-color="([^"]+)"/.exec(stops)?.[1];
        if (id && first) colours[id] = first;
        return "";
    });
    return colours;
};

const paintFrom = (value, gradients) => {
    if (value === undefined) return undefined;
    if (value === "none") return "none";
    if (value === "currentColor") return "ink";
    const gradient = /^url\(#([^)]+)\)$/.exec(value);
    if (gradient) return gradients[gradient[1]] && HEX.test(gradients[gradient[1]]) ? gradients[gradient[1]] : "ink";
    return HEX.test(value) ? value : value === "white" ? "#ffffff" : value === "black" ? "#000000" : "ink";
};

// Returns { viewBox: [x, y, w, h], paths: [{ d, fill, stroke, width, cap, join, evenOdd }] },
// or null when the icon uses something this can't express (transforms, masks, images).
export const iconFromSvgBody = (body, { width = 24, height = 24, left = 0, top = 0 } = {}) => {
    if (/<(image|use|mask|clipPath|filter|foreignObject|text|pattern)\b/i.test(body) || /\btransform=/.test(body)) return null;
    const gradients = gradientColours(body);
    const cleaned = body.replace(/<defs>[\s\S]*?<\/defs>/g, "");
    const stack = [{ fill: "ink", stroke: "none", width: 1, cap: null, join: null, evenOdd: false }];
    const paths = [];
    const tagPattern = /<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g;
    let match;
    while ((match = tagPattern.exec(cleaned))) {
        const [, closing, name, rawAttributes, selfClosing] = match;
        if (closing) {
            if (name === "g" && stack.length > 1) stack.pop();
            continue;
        }
        const attributes = attributesOf(rawAttributes);
        const inherited = stack[stack.length - 1];
        const style = {
            fill: paintFrom(attributes.fill, gradients) ?? inherited.fill,
            stroke: paintFrom(attributes.stroke, gradients) ?? inherited.stroke,
            width: attributes["stroke-width"] !== undefined ? number(attributes["stroke-width"], 1) : inherited.width,
            cap: attributes["stroke-linecap"] ?? inherited.cap,
            join: attributes["stroke-linejoin"] ?? inherited.join,
            evenOdd: attributes["fill-rule"] ? attributes["fill-rule"] === "evenodd" : inherited.evenOdd,
        };
        if (name === "g") {
            if (!selfClosing) stack.push(style);
            continue;
        }
        const d = primitiveToPath(name, attributes);
        if (!d || !isSafePathData(d)) continue;
        if (attributes.opacity === "0" || (style.fill === "none" && style.stroke === "none")) continue;
        paths.push({
            d,
            fill: style.fill,
            stroke: style.stroke,
            width: style.width,
            cap: style.cap === "round" ? "round" : null,
            join: style.join === "round" ? "round" : null,
            evenOdd: style.evenOdd,
        });
        if (paths.length > MAX_PATHS) return null;
    }
    return paths.length ? { viewBox: [left, top, width, height], paths } : null;
};

// What a stored icon may contain, checked again wherever one is accepted.
export const isValidIcon = (icon) =>
    Boolean(icon) &&
    Array.isArray(icon.viewBox) &&
    icon.viewBox.length === 4 &&
    icon.viewBox.every(Number.isFinite) &&
    icon.viewBox[2] > 0 &&
    icon.viewBox[3] > 0 &&
    Array.isArray(icon.paths) &&
    icon.paths.length > 0 &&
    icon.paths.length <= MAX_PATHS &&
    icon.paths.every(
        (path) =>
            isSafePathData(path.d) &&
            isIconPaint(path.fill) &&
            isIconPaint(path.stroke) &&
            (path.width === undefined || path.width === null || (Number.isFinite(path.width) && path.width >= 0 && path.width <= 64)) &&
            (path.cap === undefined || path.cap === null || LINE_CAPS.includes(path.cap)) &&
            (path.join === undefined || path.join === null || LINE_JOINS.includes(path.join)) &&
            (path.evenOdd === undefined || typeof path.evenOdd === "boolean"),
    );

// Fits an icon's view box into a box, centred, keeping its proportions.
export const iconTransform = (icon, box) => {
    const [left, top, width, height] = icon.viewBox;
    const scale = Math.min((box.maxX - box.minX) / width, (box.maxY - box.minY) / height);
    return {
        scale,
        x: box.minX + (box.maxX - box.minX - width * scale) / 2 - left * scale,
        y: box.minY + (box.maxY - box.minY - height * scale) / 2 - top * scale,
    };
};
