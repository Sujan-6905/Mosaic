// Keeps the newest short-lived backend access token and renews it on demand (a 401, a refused socket) through
// next-auth, once for however many callers are waiting.
let latestToken = null;
let renewer = null;
let pending = null;
let renewed = { token: null, at: 0 };

// A token refused this soon after it was minted means renewing isn't the fix.
const FRESH_REFUSAL_MS = 60 * 1000;

export const noteAccessToken = (token) => {
    latestToken = token || null;
};

export const setSessionRenewer = (renew) => {
    renewer = renew;
};

// Resolves to a fresh access token, or null when the sign-in has ended.
const renewAccessToken = () => {
    if (!renewer) return Promise.resolve(null);
    pending ??= renewer()
        .then((session) => {
            const token = session?.error ? null : (session?.accessToken ?? null);
            noteAccessToken(token);
            renewed = { token, at: Date.now() };
            return token;
        })
        .catch(() => null)
        .finally(() => {
            pending = null;
        });
    return pending;
};

// A newer token if another caller already renewed, else a fresh renewal, or null if `sentToken` was itself just renewed.
export const tokenAfterRefusal = (sentToken) => {
    if (latestToken && latestToken !== sentToken) return Promise.resolve(latestToken);
    if (sentToken && sentToken === renewed.token && Date.now() - renewed.at < FRESH_REFUSAL_MS) return Promise.resolve(null);
    return renewAccessToken();
};
