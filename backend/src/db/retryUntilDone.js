const FIRST_DELAY_MS = 15_000;
const LONGEST_DELAY_MS = 5 * 60_000;

// Resolves after the first attempt, so startup never waits on the retries.
const retryUntilDone = async (task, onFailure, attempt = 1) => {
    try {
        await task();
    } catch (error) {
        const retryInMs = Math.min(FIRST_DELAY_MS * 2 ** (attempt - 1), LONGEST_DELAY_MS);
        onFailure(error, { attempt, retryInMs });
        setTimeout(() => retryUntilDone(task, onFailure, attempt + 1), retryInMs).unref();
    }
};

export { retryUntilDone };
