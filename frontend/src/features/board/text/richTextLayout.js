// Lays out a text box's formatted runs against real glyph metrics, list items hanging after their markers.
import { parseRichText } from "../../../../../shared/canvas/elements/richText.js";

const LIST_INDENT_EM = 1.4;

// `base` is the whole box's own formatting: { size, family, bold, italic, underline, strike }.
export const fontOfStyle = (base, style = {}) => {
    const italic = base.italic || style.italic ? "italic " : "";
    const bold = base.bold || style.bold ? "bold " : "";
    return `${italic}${bold}${base.size}px ${base.family}`;
};

const measure = (context, text, font) => {
    context.font = font;
    return context.measureText(text).width;
};

const piecesOf = (runs) =>
    runs.flatMap((run) =>
        run.text
            .split(/( +)/)
            .filter(Boolean)
            .map((text) => ({ text, run, space: text.startsWith(" ") })),
    );

const breakWord = (context, piece, font, available) => {
    const parts = [];
    let current = "";
    for (const character of piece.text) {
        if (current && measure(context, current + character, font) > available) {
            parts.push({ ...piece, text: current });
            current = character;
        } else {
            current += character;
        }
    }
    if (current) parts.push({ ...piece, text: current });
    return parts;
};

const toSegments = (context, pieces, base) => {
    const segments = [];
    let x = 0;
    pieces.forEach(({ text, run }) => {
        const font = fontOfStyle(base, run);
        const width = measure(context, text, font);
        const last = segments.at(-1);
        if (last && last.run === run) {
            last.text += text;
            last.width += width;
        } else {
            segments.push({
                text,
                x,
                width,
                font,
                run,
                bold: !!(base.bold || run.bold),
                italic: !!(base.italic || run.italic),
                underline: !!(base.underline || run.underline || run.link),
                strike: !!(base.strike || run.strike),
                link: run.link,
            });
        }
        x += width;
    });
    return { segments, width: x };
};

const trimTrailingSpaces = (pieces) => {
    while (pieces.length && pieces.at(-1).space) pieces.pop();
    return pieces;
};

// Lines of `{ text, width, indent, marker, segments }`; `marker` is `{ text, font }` on a list item's first line.
export const layoutRichText = (context, source, maxWidth, base) => {
    const baseFont = fontOfStyle(base);
    const lines = [];
    parseRichText(source).forEach((paragraph) => {
        const unit = base.size * LIST_INDENT_EM;
        const markerWidth = paragraph.marker ? measure(context, paragraph.marker, baseFont) : 0;
        const indent = paragraph.level * unit + (paragraph.marker ? Math.max(unit, markerWidth + base.size * 0.45) : 0);
        const available = Math.max(1, maxWidth - indent);
        const rows = [[]];
        let rowWidth = 0;
        piecesOf(paragraph.runs).forEach((piece) => {
            const font = fontOfStyle(base, piece.run);
            const row = rows.at(-1);
            if (piece.space) {
                if (row.length) {
                    row.push(piece);
                    rowWidth += measure(context, piece.text, font);
                }
                return;
            }
            const width = measure(context, piece.text, font);
            if (rowWidth + width <= available || (!row.length && width <= available)) {
                row.push(piece);
                rowWidth += width;
                return;
            }
            if (row.some((entry) => !entry.space)) {
                trimTrailingSpaces(row);
                rows.push([]);
                rowWidth = 0;
            }
            const parts = width > available ? breakWord(context, piece, font, available) : [piece];
            parts.forEach((part, index) => {
                if (index > 0) rows.push([]);
                rows.at(-1).push(part);
                rowWidth = measure(context, part.text, font);
            });
        });
        rows.forEach((row, index) => {
            const { segments, width } = toSegments(context, trimTrailingSpaces(row), base);
            lines.push({
                text: segments.map((segment) => segment.text).join(""),
                width: indent + width,
                indent,
                marker: index === 0 && paragraph.marker ? { text: paragraph.marker, x: paragraph.level * unit, font: baseFont } : null,
                segments,
            });
        });
    });
    return lines;
};

// Draws one laid-out line with its left edge at `x`; fillStyle is the caller's ink.
// Where a laid-out line starts inside its box for the element's alignment.
export const lineStartX = (align, box, width) => (align === "center" ? box.x + (box.width - width) / 2 : align === "right" ? box.x + box.width - width : box.x);

export const paintRichLine = (context, line, x, baselineY, fontSize) => {
    if (line.marker) {
        context.font = line.marker.font;
        context.fillText(line.marker.text, x + line.marker.x, baselineY);
    }
    line.segments.forEach((segment) => {
        const left = x + line.indent + segment.x;
        context.font = segment.font;
        context.fillText(segment.text, left, baselineY);
        if (!segment.underline && !segment.strike) return;
        context.save();
        context.lineWidth = Math.max(1, fontSize * 0.06);
        context.strokeStyle = context.fillStyle;
        context.beginPath();
        if (segment.underline) {
            context.moveTo(left, baselineY + fontSize * 0.1);
            context.lineTo(left + segment.width, baselineY + fontSize * 0.1);
        }
        if (segment.strike) {
            context.moveTo(left, baselineY - fontSize * 0.3);
            context.lineTo(left + segment.width, baselineY - fontSize * 0.3);
        }
        context.stroke();
        context.restore();
    });
};

// A text box or note with a link is underlined throughout, as it always was; a shape's words are not.
export const baseStyleOf = (element, size, family) => ({
    size,
    family,
    bold: element.fontWeight === "bold",
    italic: element.fontStyle === "italic",
    underline: !!element.underline || (!!element.link && (element.type === "text" || element.type === "sticky")),
    strike: !!element.strikethrough,
});

const escapeXml = (text) => String(text ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch]);

// One laid-out line as SVG text with its left edge at `x`, links kept clickable.
export const richLineToSvg = (line, x, baselineY, { family, size, fill }) => {
    const spans = line.segments.map((segment) => {
        const decoration = [segment.underline && "underline", segment.strike && "line-through"].filter(Boolean).join(" ");
        const span = `<tspan x="${x + line.indent + segment.x}" font-weight="${segment.bold ? "bold" : "normal"}" font-style="${segment.italic ? "italic" : "normal"}"${decoration ? ` text-decoration="${decoration}"` : ""}>${escapeXml(segment.text)}</tspan>`;
        return segment.link ? `<a href="${escapeXml(segment.link)}">${span}</a>` : span;
    });
    const marker = line.marker ? `<tspan x="${x + line.marker.x}">${escapeXml(line.marker.text)}</tspan>` : "";
    return `<text y="${baselineY}" font-family="${escapeXml(family)}" font-size="${size}" fill="${fill}" xml:space="preserve">${marker}${spans.join("")}</text>`;
};
