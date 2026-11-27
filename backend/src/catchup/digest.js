// What changed since someone's last visit, from the op log with no model: what, who and
// where. Strokes the grounding layer groups report as one object.
const MAX_CHANGE_ITEMS = 30;
const MAX_COMMENT_ITEMS = 20;
const MAX_TEXT_LENGTH = 120;

const clip = (text) => {
    const line = String(text ?? "")
        .trim()
        .replace(/\s+/g, " ");
    return line.length > MAX_TEXT_LENGTH ? `${line.slice(0, MAX_TEXT_LENGTH - 1).trimEnd()}…` : line;
};

const contentOf = (element) => {
    const { version, updatedBy, ...content } = element;
    return JSON.stringify(content);
};

const unionBounds = (boundsList) => {
    const present = boundsList.filter(Boolean);
    if (present.length === 0) return null;
    return {
        minX: Math.min(...present.map((bounds) => bounds.minX)),
        minY: Math.min(...present.map((bounds) => bounds.minY)),
        maxX: Math.max(...present.map((bounds) => bounds.maxX)),
        maxY: Math.max(...present.map((bounds) => bounds.maxY)),
    };
};

const TYPE_NOUNS = {
    path: "a drawing",
    shape: "a shape",
    text: "some text",
    sticky: "a sticky note",
    frame: "a frame",
    image: "an image",
    connector: "a connector",
};
const nameOfElement = (element) => (element.text ? `"${clip(element.text)}"` : (TYPE_NOUNS[element.type] ?? "an element"));

// What the log says happened to each element, net of anything that came and
// went within the window or ended up back where it started.
const summarizeTouchedElements = ({ ops, before, current, classifyChange }) => {
    const touched = new Map();
    for (const op of ops) {
        if (!op.elementId) continue;
        const entry = touched.get(op.elementId) ?? { authorIds: new Set(), viaAssistant: false, lastAt: 0 };
        entry.authorIds.add(op.authorId);
        entry.viaAssistant ||= Boolean(op.agentId);
        entry.lastAt = Math.max(entry.lastAt, op.ts);
        touched.set(op.elementId, entry);
    }

    const changes = [];
    for (const [elementId, entry] of touched) {
        const was = before[elementId];
        const now = current[elementId];
        if (!was && !now) continue;
        if (was && now && contentOf(was) === contentOf(now)) continue;
        const kind = !was ? "added" : !now ? "removed" : classifyChange(was, now) === "moved" ? "moved" : "edited";
        changes.push({ elementId, kind, ...entry, element: now ?? was });
    }
    return changes;
};

const KIND_ORDER = ["edited", "added", "moved", "removed"];

// A group's kind is the most telling of its members': one edited stroke makes
// the drawing edited, even if the rest only moved with it.
const groupKind = (changes) => {
    const kinds = new Set(changes.map((change) => change.kind));
    if (kinds.size === 1) return changes[0].kind;
    return KIND_ORDER.find((kind) => kinds.has(kind) && kind !== "removed") ?? "edited";
};

const buildChangeItem = ({ id, name, changes, getBounds }) => ({
    id,
    kind: groupKind(changes),
    name,
    elementIds: changes.map((change) => change.elementId),
    bounds: unionBounds(changes.map((change) => getBounds(change.element))),
    authorIds: [...new Set(changes.flatMap((change) => [...change.authorIds]))],
    viaAssistant: changes.some((change) => change.viaAssistant),
    at: Math.max(...changes.map((change) => change.lastAt)),
});

const groupIntoItems = (changes, objects, getBounds) => {
    const objectByElementId = new Map();
    for (const object of objects) {
        for (const elementId of object.memberElementIds ?? []) objectByElementId.set(elementId, object);
    }

    const byGroup = new Map();
    for (const change of changes) {
        const object = objectByElementId.get(change.elementId);
        // A removed element has left the scene, so unnamed ones roll up per
        // person instead of each getting a line.
        const key = object ? `object:${object.ref}` : change.element.text ? `element:${change.elementId}` : `removed:${[...change.authorIds].sort().join(",")}`;
        if (!byGroup.has(key)) byGroup.set(key, { key, object, changes: [] });
        byGroup.get(key).changes.push(change);
    }

    return [...byGroup.values()].map(({ key, object, changes: grouped }) => {
        const name = object?.name ?? (grouped.length === 1 ? nameOfElement(grouped[0].element) : `${grouped.length} elements`);
        return buildChangeItem({ id: key, name, changes: grouped, getBounds });
    });
};

// A thread's timestamp comes from the database and a reply's from Date.now().
const timeOf = (value) => new Date(value).getTime();

const collectCommentItems = (comments, viewerId, sinceTime) => {
    const items = [];
    for (const comment of comments) {
        const shared = { commentId: comment._id ?? comment.id, resolved: Boolean(comment.resolved) };
        const addItem = (kind, message) => {
            const at = timeOf(message.createdAt);
            if (message.authorId === viewerId || !(at > sinceTime)) return;
            items.push({
                ...shared,
                kind,
                authorName: message.authorName,
                text: clip(message.text),
                at,
                mentionsYou: (message.mentions ?? []).includes(viewerId),
            });
        };
        addItem("comment", comment);
        (comment.replies ?? []).forEach((reply) => addItem("reply", reply));
    }
    return items.sort((a, b) => Number(b.mentionsYou) - Number(a.mentionsYou) || b.at - a.at);
};

export const buildCatchUpDigest = ({ viewerId, since, ops, before, current, objects, comments, nameOfUser, classifyChange, getBounds, truncated = false }) => {
    const othersOps = ops.filter((op) => op.authorId !== viewerId);
    const changes = summarizeTouchedElements({ ops: othersOps, before, current, classifyChange });
    const items = groupIntoItems(changes, objects, getBounds).sort((a, b) => b.at - a.at);
    const commentItems = collectCommentItems(comments, viewerId, timeOf(since));

    const authorIds = [...new Set(changes.flatMap((change) => [...change.authorIds]))];
    const people = authorIds.map((authorId) => {
        const own = changes.filter((change) => change.authorIds.has(authorId));
        return {
            userId: authorId,
            name: nameOfUser(authorId),
            added: own.filter((change) => change.kind === "added").length,
            changed: own.filter((change) => change.kind === "edited" || change.kind === "moved").length,
            removed: own.filter((change) => change.kind === "removed").length,
        };
    });

    return {
        since,
        people,
        changes: items.slice(0, MAX_CHANGE_ITEMS).map(({ authorIds: ids, ...item }) => ({ ...item, authorNames: ids.map(nameOfUser) })),
        moreChangeCount: Math.max(0, items.length - MAX_CHANGE_ITEMS),
        comments: commentItems.slice(0, MAX_COMMENT_ITEMS),
        moreCommentCount: Math.max(0, commentItems.length - MAX_COMMENT_ITEMS),
        truncated,
    };
};

export const isDigestEmpty = (digest) => digest.changes.length === 0 && digest.comments.length === 0;

// Plain facts for the summary prompt. Names and comment text are written by
// people on the board, so this is untrusted data and the caller fences it.
export const describeDigestForModel = (digest) => ({
    people: digest.people.map(({ name, added, changed, removed }) => ({ name, added, changed, removed })),
    changes: digest.changes.map(({ kind, name, authorNames, viaAssistant }) => ({ kind, name, by: authorNames, viaAssistant })),
    comments: digest.comments.map(({ kind, authorName, text, mentionsYou }) => ({ kind, by: authorName, text, mentionsYou })),
    moreChanges: digest.moreChangeCount,
});
