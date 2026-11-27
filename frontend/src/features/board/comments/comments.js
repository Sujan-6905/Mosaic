import { getElementBounds } from "../../../../../shared/canvas/geometry/bounds.js";

// A point anchor is fixed; an element anchor follows the element's live bounds, so pins move with it.
// Null when that element was deleted, so the pin isn't drawn.
export const resolveCommentWorldPosition = (comment, elements) => {
    if (comment.anchorType === "element") {
        const bounds = getElementBounds(elements[comment.elementId]);
        if (!bounds) return null;
        return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
    }
    return { x: comment.x, y: comment.y };
};

// Unread while it mentions the person and they haven't opened it; read marks the whole thread, not each message.
export const isCommentUnreadFor = (comment, userId) => {
    if (!userId || comment.readBy?.includes(userId)) return false;
    const allMentions = [comment.mentions || [], ...(comment.replies || []).map((reply) => reply.mentions || [])].flat();
    return allMentions.includes(userId);
};

export const isCommentMine = (comment, userId) => comment.authorId === userId;

// Splits text into plain and @mention parts, matching longest names first so @ada doesn't take @adam.
export const splitMentionSegments = (text, usernames) => {
    if (!usernames?.length) return [{ text, isMention: false }];

    const sorted = [...usernames].sort((a, b) => b.length - a.length);
    const pattern = new RegExp(`@(${sorted.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "g");

    const segments = [];
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index), isMention: false });
        segments.push({ text: match[0], isMention: true });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), isMention: false });
    return segments;
};

// The ids of the collaborators the text mentions, without duplicates, in order.
export const extractMentionedUserIds = (text, collaborators) => {
    const idByUsername = new Map(collaborators.map((c) => [c.username, c.userId]));
    const mentionedUsernames = splitMentionSegments(
        text,
        collaborators.map((c) => c.username),
    )
        .filter((segment) => segment.isMention)
        .map((segment) => segment.text.slice(1));
    return [...new Set(mentionedUsernames.map((username) => idByUsername.get(username)).filter(Boolean))];
};

// The @partial the caret is inside, for filtering autocomplete and splicing the choice back; null when none.
export const findActiveMentionQuery = (text, caretIndex) => {
    const beforeCaret = text.slice(0, caretIndex);
    const match = beforeCaret.match(/(?:^|\s)@(\w*)$/);
    if (!match) return null;
    return { query: match[1], start: caretIndex - match[1].length - 1 };
};

// Splices `username` in place of the active "@partial" token, leaving the
// caret positioned right after the inserted mention plus a trailing space.
export const insertMention = (text, activeMention, username) => {
    const before = text.slice(0, activeMention.start);
    const after = text.slice(activeMention.start + activeMention.query.length + 1);
    const inserted = `${before}@${username} `;
    return { text: inserted + after, caretIndex: inserted.length };
};
