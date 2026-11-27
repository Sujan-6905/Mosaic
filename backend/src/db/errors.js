// A miss arrives as a thrown class from either package, so compare by name. Anything else
// is an outage and must never read as "doesn't exist".
const named = (name) => (error) => error?.constructor?.name === name || error?.name === name;
const isDocumentMissing = named("DocumentNotFoundError");
export const isDocumentExists = named("DocumentExistsError");
export const isCasMismatch = named("CasMismatchError");

export const nullIfMissing = async (find) => {
    try {
        return await find();
    } catch (error) {
        if (isDocumentMissing(error)) return null;
        throw error;
    }
};
