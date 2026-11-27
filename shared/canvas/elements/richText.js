// Inline formatting kept as light marks in the text, so search and the assistant read plain words:
// **bold**, *italic*, ++underline++, ~~strike~~, [label](url), bare links, and "- " or "1. " lists.

const INLINE_MARKS = { bold: "**", italic: "*", underline: "++", strike: "~~" };
const MARK_ORDER = [
    ["bold", "**"],
    ["underline", "++"],
    ["strike", "~~"],
    ["italic", "*"],
];
const ESCAPABLE = new Set(["*", "+", "~", "[", "]", "\\"]);
const MARKDOWN_LINK = /^\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/;
const BARE_LINK = /^https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"]/;
const BULLET_PREFIX = /^( *)[-*•] +/;
const NUMBER_PREFIX = /^( *)(\d{1,3})[.)] +/;
const MAX_LIST_LEVEL = 3;

const isSpace = (character) => character === undefined || /\s/.test(character);

const tokenize = (line) => {
    const tokens = [];
    let text = "";
    const flush = () => {
        if (text) tokens.push({ type: "text", value: text });
        text = "";
    };
    for (let i = 0; i < line.length;) {
        const rest = line.slice(i);
        if (rest[0] === "\\" && ESCAPABLE.has(rest[1])) {
            text += rest[1];
            i += 2;
            continue;
        }
        const link = MARKDOWN_LINK.exec(rest) ?? (isSpace(line[i - 1]) || line[i - 1] === "(" ? BARE_LINK.exec(rest) : null);
        if (link) {
            flush();
            tokens.push({ type: "link", label: link[1] ?? link[0], url: link[2] ?? link[0] });
            i += link[0].length;
            continue;
        }
        const mark = MARK_ORDER.find(([, raw]) => rest.startsWith(raw));
        if (mark) {
            flush();
            const [kind, raw] = mark;
            tokens.push({ type: "mark", kind, raw, canOpen: !isSpace(line[i + raw.length]), canClose: !isSpace(line[i - 1]) });
            i += raw.length;
            continue;
        }
        text += rest[0];
        i += 1;
    }
    flush();
    return tokens;
};

// A mark only formats when it has a partner; a lone "*" stays an asterisk.
const pairMarks = (tokens) => {
    const openAt = {};
    tokens.forEach((token, index) => {
        if (token.type !== "mark") return;
        if (openAt[token.kind] !== undefined && token.canClose) {
            tokens[openAt[token.kind]].paired = true;
            token.paired = true;
            delete openAt[token.kind];
        } else if (token.canOpen) {
            openAt[token.kind] = index;
        }
    });
};

const sameStyle = (a, b) => a.bold === b.bold && a.italic === b.italic && a.underline === b.underline && a.strike === b.strike && a.link === b.link;

const parseInline = (line) => {
    const tokens = tokenize(line);
    pairMarks(tokens);
    const active = { bold: false, italic: false, underline: false, strike: false };
    const runs = [];
    const push = (text, link = null) => {
        if (!text) return;
        const run = { text, ...active, link };
        const last = runs.at(-1);
        if (last && sameStyle(last, run)) last.text += text;
        else runs.push(run);
    };
    tokens.forEach((token) => {
        if (token.type === "text") push(token.value);
        else if (token.type === "link") push(token.label, token.url);
        else if (token.paired) active[token.kind] = !active[token.kind];
        else push(token.raw);
    });
    return runs;
};

const listPrefixOf = (line) => {
    const bullet = BULLET_PREFIX.exec(line);
    if (bullet) return { kind: "bullet", marker: "•", indent: bullet[1].length, length: bullet[0].length };
    const number = NUMBER_PREFIX.exec(line);
    if (number) return { kind: "number", marker: `${number[2]}.`, number: Number(number[2]), indent: number[1].length, length: number[0].length };
    return null;
};

// One entry per line: its list marker (if any), nesting level and styled runs.
export const parseRichText = (source) =>
    (source || "").split("\n").map((line) => {
        const prefix = listPrefixOf(line);
        return {
            marker: prefix?.marker ?? null,
            level: prefix ? Math.min(MAX_LIST_LEVEL, Math.floor(prefix.indent / 2)) : 0,
            runs: parseInline(prefix ? line.slice(prefix.length) : line),
        };
    });

// The words with every formatting mark removed, list prefixes kept as typed.
export const plainText = (source) =>
    (source || "")
        .split("\n")
        .map((line) => {
            const prefix = listPrefixOf(line);
            const head = prefix ? line.slice(0, prefix.length) : "";
            return (
                head +
                parseInline(line.slice(head.length))
                    .map((run) => run.text)
                    .join("")
            );
        })
        .join("\n");

const lineStartOf = (text, index) => text.lastIndexOf("\n", index - 1) + 1;
const lineEndOf = (text, index) => {
    const end = text.indexOf("\n", index);
    return end === -1 ? text.length : end;
};

const isWrapped = (text, start, end, raw) => {
    if (text.slice(start - raw.length, start) !== raw || text.slice(end, end + raw.length) !== raw) return false;
    // "*" alone must not read the inner half of a "**" pair as italic.
    if (raw !== "*") return true;
    const beforeBold = text.slice(start - 3, start) === "***" || text[start - 2] !== "*";
    const afterBold = text.slice(end, end + 3) === "***" || text[end + 1] !== "*";
    return beforeBold && afterBold;
};

// Wraps the selected words in a mark, or removes it when already there.
// Marks never cross a line, so a selection over several lines is marked line by line.
export const toggleInlineMark = (text, start, end, kind) => {
    const raw = INLINE_MARKS[kind];
    let from = start;
    let to = end;
    while (from < to && /\s/.test(text[from])) from += 1;
    while (to > from && /\s/.test(text[to - 1])) to -= 1;
    if (from === to) return null;
    if (isWrapped(text, from, to, raw)) {
        return { text: text.slice(0, from - raw.length) + text.slice(from, to) + text.slice(to + raw.length), start: from - raw.length, end: to - raw.length };
    }
    const selected = text.slice(from, to);
    if (selected.length > raw.length * 2 && selected.startsWith(raw) && selected.endsWith(raw) && !selected.slice(raw.length, -raw.length).includes("\n")) {
        const inner = selected.slice(raw.length, -raw.length);
        return { text: text.slice(0, from) + inner + text.slice(to), start: from, end: from + inner.length };
    }
    if (!selected.includes("\n")) {
        return { text: `${text.slice(0, from)}${raw}${selected}${raw}${text.slice(to)}`, start: from + raw.length, end: to + raw.length };
    }
    const wrapped = selected
        .split("\n")
        .map((line) => {
            const content = line.trim();
            if (!content) return line;
            const lead = line.slice(0, line.indexOf(content));
            return `${lead}${raw}${content}${raw}${line.slice(lead.length + content.length)}`;
        })
        .join("\n");
    return { text: text.slice(0, from) + wrapped + text.slice(to), start: from, end: from + wrapped.length };
};

// Makes every line the selection touches a bulleted or numbered item, or plain again when it already was.
export const toggleList = (text, start, end, kind) => {
    const from = lineStartOf(text, start);
    const to = lineEndOf(text, end);
    const lines = text.slice(from, to).split("\n");
    const alreadyList = lines.every((line) => listPrefixOf(line)?.kind === kind);
    const rewritten = lines.map((line, index) => {
        const prefix = listPrefixOf(line);
        const indent = prefix ? " ".repeat(prefix.indent) : "";
        const content = prefix ? line.slice(prefix.length) : line;
        if (alreadyList) return indent + content;
        return `${indent}${kind === "bullet" ? "- " : `${index + 1}. `}${content}`;
    });
    const block = rewritten.join("\n");
    return { text: text.slice(0, from) + block + text.slice(to), start: from, end: from + block.length };
};

// Enter inside a list item starts the next item; on an empty item it ends the list.
export const continueList = (text, caret) => {
    const from = lineStartOf(text, caret);
    const line = text.slice(from, caret);
    const prefix = listPrefixOf(line);
    if (!prefix) return null;
    if (!line.slice(prefix.length).trim() && lineEndOf(text, caret) === caret) {
        return { text: text.slice(0, from) + text.slice(caret), caret: from };
    }
    const next = `\n${" ".repeat(prefix.indent)}${prefix.kind === "bullet" ? "- " : `${prefix.number + 1}. `}`;
    return { text: text.slice(0, caret) + next + text.slice(caret), caret: caret + next.length };
};

const LINK_PLACEHOLDER = "https://";

// Turns the selection into a link's label and selects the address to type over.
export const insertLink = (text, start, end) => {
    const label = text.slice(start, end).trim() || "link";
    const link = `[${label}](${LINK_PLACEHOLDER})`;
    const addressAt = start + label.length + 3;
    return { text: text.slice(0, start) + link + text.slice(end), start: addressAt, end: addressAt + LINK_PLACEHOLDER.length };
};
