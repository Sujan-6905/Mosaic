// Enough of a Couchbase collection for KV with CAS, for tests of code that
// keeps its state as raw keys.
class DocumentNotFoundError extends Error {
    name = "DocumentNotFoundError";
}
class DocumentExistsError extends Error {
    name = "DocumentExistsError";
}
class CasMismatchError extends Error {
    name = "CasMismatchError";
}

export const fakeKvCollection = () => {
    const docs = new Map();
    let cas = 0;
    return {
        docs,
        async get(key) {
            if (!docs.has(key)) throw new DocumentNotFoundError();
            return { content: structuredClone(docs.get(key).content), cas: docs.get(key).cas };
        },
        async insert(key, content) {
            if (docs.has(key)) throw new DocumentExistsError();
            docs.set(key, { content: structuredClone(content), cas: ++cas });
        },
        async upsert(key, content) {
            docs.set(key, { content: structuredClone(content), cas: ++cas });
        },
        async replace(key, content, { cas: expected } = {}) {
            if (!docs.has(key)) throw new DocumentNotFoundError();
            if (expected !== undefined && docs.get(key).cas !== expected) throw new CasMismatchError();
            docs.set(key, { content: structuredClone(content), cas: ++cas });
        },
        async remove(key, { cas: expected } = {}) {
            if (!docs.has(key)) throw new DocumentNotFoundError();
            if (expected !== undefined && docs.get(key).cas !== expected) throw new CasMismatchError();
            docs.delete(key);
        },
    };
};
