import { ProviderError, PROVIDER_ERROR_CODES } from "../model/provider.js";

const INVALID_OUTPUT_CONTENT = "";

// A provider-side JSON failure and a schema failure mean the same thing to this
// turn, so both land in the single re-ask path above.
export const completeOrInvalid = async (complete) => {
    try {
        return await complete();
    } catch (error) {
        if (error instanceof ProviderError && error.code === PROVIDER_ERROR_CODES.INVALID_OUTPUT) return { content: INVALID_OUTPUT_CONTENT };
        throw error;
    }
};

export const askAgainOrInvalid = async (askAgain, complaint) => {
    try {
        return await askAgain(complaint);
    } catch (error) {
        if (error instanceof ProviderError && error.code === PROVIDER_ERROR_CODES.INVALID_OUTPUT)
            return { type: "invalid", error: "provider rejected the output" };
        throw error;
    }
};
