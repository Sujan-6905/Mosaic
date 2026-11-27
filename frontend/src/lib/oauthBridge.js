import { getToken } from "next-auth/jwt";

const cookiesOf = (header = "") =>
    Object.fromEntries(
        header
            .split(";")
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => {
                const at = part.indexOf("=");
                return at < 0 ? [part, ""] : [part.slice(0, at), decodeURIComponent(part.slice(at + 1))];
            }),
    );

// The provider identity a first-time social sign-in was given, read from this
// browser's own signed next-auth session rather than from anything it sends.
export const pendingOAuthDraft = async (req) => {
    const token = await getToken({ req: { headers: req?.headers ?? {}, cookies: cookiesOf(req?.headers?.cookie) } });
    return token?.needsUsername ? (token.oauthDraft ?? null) : null;
};

// GitHub lets anyone add an address they haven't proved, so its email counts
// only when GitHub's own list marks it verified; Google says so in the profile.
export const verifiedEmailOf = async (account, profile) => {
    if (account.provider === "google") return { email: profile.email ?? null, emailVerified: profile.email_verified === true };
    try {
        const response = await fetch("https://api.github.com/user/emails", {
            headers: { Authorization: `Bearer ${account.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "mosaic-sign-in" },
        });
        if (!response.ok) return { email: null, emailVerified: false };
        const emails = await response.json();
        const chosen = emails.find((entry) => entry.primary && entry.verified) ?? emails.find((entry) => entry.verified);
        return chosen ? { email: chosen.email, emailVerified: true } : { email: null, emailVerified: false };
    } catch {
        return { email: null, emailVerified: false };
    }
};
