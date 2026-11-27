// Merges two people typing into the same text box at once, live only while its editor is open.
// The element's plain `text` is still what's saved and drawn everywhere else.
import * as Y from "yjs";

const REMOTE_ORIGIN = "remote";

const commonPrefixLength = (a, b) => {
    const max = Math.min(a.length, b.length);
    let i = 0;
    while (i < max && a[i] === b[i]) i++;
    return i;
};

const commonSuffixLength = (a, b, prefixLength) => {
    const max = Math.min(a.length, b.length) - prefixLength;
    let i = 0;
    while (i < max && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
    return i;
};

// Where a caret belongs after someone else's edit: unmoved before it, shifted along after it.
export const caretAfterChange = (before, after, caret) => {
    const prefixLength = commonPrefixLength(before, after);
    if (caret <= prefixLength) return caret;
    const suffixLength = commonSuffixLength(before, after, prefixLength);
    if (caret >= before.length - suffixLength) return caret + after.length - before.length;
    return after.length - suffixLength;
};

// A textarea only gives its whole new value. The splice is read against what it showed, which may be
// behind the shared text when someone else's words merged since, and then moved to where it belongs now.
const applyTextareaChange = (yText, shown, newValue) => {
    const current = yText.toString();
    const prefixLength = commonPrefixLength(shown, newValue);
    const suffixLength = commonSuffixLength(shown, newValue, prefixLength);
    const from = caretAfterChange(shown, current, prefixLength);
    const to = caretAfterChange(shown, current, shown.length - suffixLength);
    const inserted = newValue.slice(prefixLength, newValue.length - suffixLength);
    if (to > from) yText.delete(from, to - from);
    if (inserted) yText.insert(from, inserted);
};

// FNV-1a over the text, kept inside the range Yjs accepts for a client id.
const seedClientId = (text) => {
    let hash = 2166136261;
    for (const character of text) hash = Math.imul(hash ^ character.codePointAt(0), 16777619) >>> 0;
    return hash % 2147483647 || 1;
};

// The saved text written under a client id derived from the text, so two people who open the
// same note seed identical items and Yjs keeps one copy instead of both.
const seededDoc = (text) => {
    const seed = new Y.Doc();
    seed.clientID = seedClientId(text);
    if (text) seed.getText("content").insert(0, text);
    const doc = new Y.Doc();
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(seed));
    seed.destroy();
    return doc;
};

// `emitUpdate` relays each local change over the socket; `onRemoteText` runs after a remote one merges.
// Someone opening a note that another person is already editing sends `openingRequest()`; whoever
// is editing answers with `fullState()`, which the newcomer takes as it is until they type.
export const createTextCollabSession = ({ initialText, emitUpdate, onRemoteText }) => {
    let doc;
    let typed = false;
    const text = () => doc.getText("content").toString();
    const switchTo = (next) => {
        doc?.destroy();
        doc = next;
        doc.on("update", (update, origin) => {
            if (origin !== REMOTE_ORIGIN) emitUpdate(update);
        });
        doc.getText("content").observe((_event, transaction) => {
            if (transaction.origin === REMOTE_ORIGIN) onRemoteText(text());
        });
    };
    switchTo(seededDoc(initialText ?? ""));

    return {
        getText: text,
        openingRequest: () => Y.encodeStateAsUpdate(new Y.Doc()),
        fullState: () => Y.encodeStateAsUpdate(doc),
        applyLocalChange: (shown, newValue) => {
            typed = true;
            doc.transact(() => applyTextareaChange(doc.getText("content"), shown, newValue));
            return text();
        },
        applyRemoteUpdate: (update) => Y.applyUpdate(doc, update, REMOTE_ORIGIN),
        applyRemoteState: (update) => {
            if (typed) {
                Y.applyUpdate(doc, update, REMOTE_ORIGIN);
                return;
            }
            const adopted = new Y.Doc();
            Y.applyUpdate(adopted, update);
            switchTo(adopted);
            onRemoteText(text());
        },
        destroy: () => doc.destroy(),
    };
};

// Socket.io payloads are JSON: a raw Yjs update is a Uint8Array, so it
// travels as base64 rather than needing a binary-capable transport.
export const encodeUpdateToBase64 = (update) => {
    let binary = "";
    update.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
};

export const decodeBase64ToUpdate = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
};
