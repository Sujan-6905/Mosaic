import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import axiosInstance from "@/lib/axiosInstance";
import { pendingOAuthDraft, verifiedEmailOf } from "@/lib/oauthBridge";
import { clientIpOf, trustedServerHeaders } from "@/lib/trustedServerHeaders";

const RATE_LIMITED_ERROR = "rate-limited";
const EMAIL_IN_USE_ERROR = "EmailInUse";
const ACCOUNT_LOCKED_ERROR = "account-locked";
// Renewed this far ahead of expiry; the client polls the session more often
// than this, so an open tab never sends a lapsed token.
const RENEW_BEFORE_MS = 5 * 60 * 1000;
// Matches the backend's longest sign-in; the refresh token is the real limit.
const SIGN_IN_MAX_SECONDS = 30 * 24 * 60 * 60;

const backendSession = (data) => ({
    accessToken: data.token,
    refreshToken: data.refreshToken,
    accessTokenExpires: data.accessTokenExpiresAt,
});

const applyBackendSession = (token, data) => {
    Object.assign(token, backendSession(data));
    delete token.error;
};

const renewBackendSession = async (token, backendHeaders) => {
    try {
        const { data } = await axiosInstance.post("/api/auth/session/refresh", { refreshToken: token.refreshToken }, backendHeaders);
        applyBackendSession(token, data);
    } catch (err) {
        // A refused refresh token ends the sign-in; anything else (the backend
        // briefly unreachable) keeps the token so the next poll tries again.
        if (err.response?.status === 401) {
            delete token.accessToken;
            delete token.refreshToken;
            delete token.accessTokenExpires;
            token.error = "SessionEnded";
        } else {
            console.error("Session refresh error:", err.response?.data || err.message);
        }
    }
    return token;
};

// Built per request so every call this server makes on the browser's behalf carries the browser's address,
// which the backend's per-address rate limits key on.
export const authOptionsFor = (req) => {
    const backendHeaders = trustedServerHeaders(clientIpOf(req));
    return {
        providers: [
            CredentialsProvider({
                id: "credentials",
                name: "Credentials",
                credentials: {
                    username: { label: "Username", type: "text" },
                    password: { label: "Password", type: "password" },
                },
                async authorize(credentials) {
                    try {
                        const { data } = await axiosInstance.post(
                            "/api/auth/login",
                            {
                                username: credentials.username,
                                password: credentials.password,
                            },
                            backendHeaders,
                        );

                        if (data?.user && data?.token) {
                            return { ...data.user, ...backendSession(data) };
                        }
                        return null;
                    } catch (err) {
                        console.error("Credentials login error:", err.response?.data || err.message);
                        if (err.response?.data?.code === "account_locked") throw new Error(ACCOUNT_LOCKED_ERROR);
                        if (err.response?.status === 429) throw new Error(RATE_LIMITED_ERROR);
                        return null;
                    }
                },
            }),
            // Called by the username step of a first social sign-in, so the finished account gets an ordinary
            // NextAuth session rather than a raw token the browser would have to manage.
            CredentialsProvider({
                id: "oauth-complete",
                name: "OAuthComplete",
                // Only the chosen username comes from the browser; the provider identity
                // is the one this server stored in the session during the real handshake.
                credentials: { username: {} },
                async authorize(credentials, req) {
                    try {
                        const draft = await pendingOAuthDraft(req);
                        if (!draft) return null;
                        const { data } = await axiosInstance.post(
                            "/api/auth/oauth-complete",
                            {
                                provider: draft.provider,
                                providerAccountId: draft.providerAccountId,
                                email: draft.email,
                                emailVerified: draft.emailVerified,
                                name: draft.name,
                                username: credentials.username,
                            },
                            backendHeaders,
                        );

                        if (data?.user && data?.token) {
                            return { ...data.user, ...backendSession(data) };
                        }
                        return null;
                    } catch (err) {
                        console.error("OAuth signup completion error:", err.response?.data || err.message);
                        return null;
                    }
                },
            }),
            GoogleProvider({
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            }),
            GitHubProvider({
                clientId: process.env.GITHUB_CLIENT_ID,
                clientSecret: process.env.GITHUB_CLIENT_SECRET,
            }),
        ],

        session: { strategy: "jwt", maxAge: SIGN_IN_MAX_SECONDS },

        events: {
            // Ends the backend sign-in too, so the refresh token is dead the moment
            // someone signs out, not just forgotten by this browser.
            async signOut({ token }) {
                if (!token?.refreshToken) return;
                await axiosInstance.post("/api/auth/session/end", { refreshToken: token.refreshToken }, backendHeaders).catch(() => {});
            },
        },

        callbacks: {
            async jwt({ token, user, account, profile, trigger, session }) {
                // A provider that resolved a backend user wins outright and clears any pending username step.
                if (user?.accessToken) {
                    token.accessToken = user.accessToken;
                    token.refreshToken = user.refreshToken;
                    token.accessTokenExpires = user.accessTokenExpires;
                    delete token.error;
                    token.id = user._id || user.id;
                    token.username = user.username;
                    delete token.needsUsername;
                    delete token.oauthDraft;
                }

                // Google/GitHub's own OAuth handshake: profile is only present here,
                // never on the credentials providers above.
                if (account?.provider && profile && (account.provider === "google" || account.provider === "github")) {
                    try {
                        const { data } = await axiosInstance.post(
                            "/api/auth/oauth-login",
                            {
                                provider: account.provider,
                                providerAccountId: account.providerAccountId,
                                ...(await verifiedEmailOf(account, profile)),
                                name: profile.name,
                            },
                            backendHeaders,
                        );

                        if (data?.needsUsername) {
                            // No account yet: stay signed out with the draft until the oauth-complete provider finishes it.
                            token.needsUsername = true;
                            token.oauthDraft = data.draft;
                            delete token.accessToken;
                        } else if (data?.user && data?.token) {
                            applyBackendSession(token, data);
                            token.id = data.user._id || data.user.id;
                            token.username = data.user.username;
                            delete token.needsUsername;
                            delete token.oauthDraft;
                        }
                    } catch (err) {
                        console.error("OAuth login error:", err.response?.data || err.message);
                        // Stays signed out, carrying why, so the page can say so.
                        if (err.response?.data?.code === "email_in_use") return { error: EMAIL_IN_USE_ERROR };
                        return null;
                    }
                    return token;
                }

                // The browser asks for a renewal (update({ renew: true })) when the
                // backend refused a token this side still thought was fresh.
                const forced = trigger === "update" && session?.renew;
                if (token.refreshToken && (forced || Date.now() > token.accessTokenExpires - RENEW_BEFORE_MS)) {
                    return renewBackendSession(token, backendHeaders);
                }
                return token;
            },
            async session({ session, token }) {
                session.user.id = token.id;
                session.user.username = token.username;
                // Username/password accounts carry no display name; the username is how
                // collaborators see them in presence, comments and mentions.
                session.user.name ||= token.username;
                session.accessToken = token.accessToken;
                session.error = token.error || null;
                session.needsUsername = !!token.needsUsername;
                session.oauthDraft = token.oauthDraft || null;
                return session;
            },
        },

        // Sign-in happens in a dialog over the app, which opens itself for these query strings.
        pages: {
            signIn: "/",
            error: "/",
        },
    };
};

export default function auth(req, res) {
    return NextAuth(req, res, authOptionsFor(req));
}
