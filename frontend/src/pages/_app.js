import { Provider, useDispatch, useSelector } from "react-redux";
import Head from "next/head";
import { useRouter } from "next/router";
import { SessionProvider, signIn, signOut } from "next-auth/react";
import useAppSession from "@/hooks/useAppSession";
import useSessionRenewal, { SESSION_POLL_SECONDS } from "@/hooks/useSessionRenewal";
import store from "@/store/index";
import AuthModal from "@/features/account/AuthModal";
import OnboardingUsernameModal from "@/features/account/OnboardingUsernameModal";
import HelpMenu from "@/components/HelpMenu";
import BackendStatusPill from "@/components/BackendStatusPill";
import { headerItemClick } from "@/store/headerSlice";
import Toast, { useToast } from "@/components/ui/Toast";
import { ThemeProvider } from "@/theme/ThemeProvider";
import "@/styles/globals.css";
import axiosInstance, { resetSessionExpiredGuard, clearErrorToastSuppression } from "@/lib/axiosInstance";
import ErrorBoundary from "@/components/ErrorBoundary";
import { installGlobalErrorReporting } from "@/lib/reportClientError";
import { useEffect, useState } from "react";
import { signOutOfMosaic } from "@/lib/signOutOfMosaic";
import { syncCalmAttribute } from "@/lib/calmMode";
import { signConsole } from "@/lib/consoleSignature";

function AppContent({ Component, pageProps }) {
    const router = useRouter();
    const { session, status, isAuthenticated } = useAppSession();
    const { toasts, removeToast, showToast } = useToast();
    useSessionRenewal();

    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authMode, setAuthMode] = useState("login");
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState(null);
    const [welcomedAs, setWelcomedAs] = useState(null);

    // Mid-OAuth signup has a provider profile but no backend accessToken, so it must not unlock signed-in UI.
    const needsUsername = !!session?.needsUsername;
    const handleAuthClick = (mode) => {
        setAuthMode(mode);
        setAuthError(null);
        setIsAuthModalOpen(true);
    };

    // Only the board and dashboard answer the global Help button with help of their own; elsewhere _app opens the
    // menu without page-specific sections.
    const pageOwnsHelp = router.pathname === "/dashboard" || (router.pathname === "/" && !!router.query.shareId);
    const { actionHeaderItem } = useSelector((state) => state.header);
    const dispatch = useDispatch();
    const [genericHelpOpen, setGenericHelpOpen] = useState(false);

    useEffect(() => {
        if (actionHeaderItem !== "Help" || pageOwnsHelp) return;
        setGenericHelpOpen(true);
        dispatch(headerItemClick(null));
    }, [actionHeaderItem, pageOwnsHelp, dispatch]);

    // After a 401 that renewal couldn't fix, or a refused refresh token: clear the session, say why, reopen sign-in.
    useEffect(() => {
        const handleSessionExpired = async () => {
            await signOut({ redirect: false });
            resetSessionExpiredGuard();
            showToast.info("Session expired", "Please sign in again to continue");
            router.push("/");
            setAuthMode("login");
            setIsAuthModalOpen(true);
        };
        // A Google or GitHub account whose email another Mosaic account already uses never signs in.
        const handleEmailInUse = async () => {
            await signOut({ redirect: false });
            showToast.error("Couldn't sign you in", "Another Mosaic account already uses this email. Sign in the way you did before.");
        };
        window.addEventListener("mosaic:session-expired", handleSessionExpired);
        window.addEventListener("mosaic:email-in-use", handleEmailInUse);
        return () => {
            window.removeEventListener("mosaic:session-expired", handleSessionExpired);
            window.removeEventListener("mosaic:email-in-use", handleEmailInUse);
        };
    }, [router, showToast]);

    // next-auth sends a refused or cancelled provider sign-in, and a page that needs one, back here.
    // A board link opened while signed out shows the board when it's shared by link, and asks for a sign-in otherwise.
    const { error: signInProblem, callbackUrl: pendingDestination } = router.query;
    useEffect(() => {
        if (status !== "unauthenticated" || (!signInProblem && !pendingDestination)) return;
        setAuthMode("login");
        setAuthError(signInProblem ? "That sign-in didn't finish. Try again, or use a username and password." : null);
        setIsAuthModalOpen(true);
    }, [status, signInProblem, pendingDestination]);

    const handleAuthSubmit = async (formData) => {
        setAuthLoading(true);
        // A deliberate auth attempt always reports its own outcome, even while expiry error toasts are suppressed.
        clearErrorToastSuppression();
        setAuthError(null);
        try {
            if (authMode === "register") {
                await axiosInstance.post("/api/auth/register", {
                    username: formData.username,
                    password: formData.password,
                });
            }

            const result = await signIn("credentials", {
                redirect: false,
                username: formData.username,
                password: formData.password,
                callbackUrl: router.query.callbackUrl || router.asPath,
            });

            if (result?.error) {
                if (authMode === "register") setAuthMode("login");
                setAuthError(
                    result.error === "rate-limited"
                        ? "Too many attempts. Wait a minute, then try again."
                        : result.error === "account-locked"
                          ? "Too many wrong tries for this account. Wait 15 minutes, then try again."
                          : authMode === "register"
                            ? "Your account was created, but signing in failed. Sign in with your new username."
                            : "That username and password don't match. Check for typos, or create an account if you're new.",
                );
                return;
            }

            router.push(result.url || "/");
            if (authMode === "register") {
                setIsAuthModalOpen(false);
                showToast.success("Account created", "You're signed in and ready to draw");
            } else {
                // The modal stays until the sign-in wall has parted on the board behind it.
                setWelcomedAs(formData.username);
            }
        } catch (error) {
            console.error("Auth error:", error);
            const suggestions = error.response?.data?.suggestions ?? [];
            setAuthError(
                suggestions.length > 0
                    ? `That username is taken. Try ${suggestions.slice(0, -1).join(", ")}${suggestions.length > 1 ? " or " : ""}${suggestions.at(-1)}.`
                    : error.response?.data?.message || "Something went wrong on our side. Please try again.",
            );
        } finally {
            setAuthLoading(false);
        }
    };

    const handleWelcomed = () => {
        setWelcomedAs(null);
        setIsAuthModalOpen(false);
        showToast.success("Welcome back!", "Successfully signed in");
    };

    const handleSocialAuth = async (provider) => {
        setAuthLoading(true);
        clearErrorToastSuppression();
        try {
            await signIn(provider, { callbackUrl: router.query.callbackUrl || router.asPath });
        } catch (error) {
            console.error("Social auth error:", error);
            showToast.error("Authentication failed", "Social authentication failed");
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLogout = () => {
        signOutOfMosaic({ callbackUrl: "/" });
        showToast.info("Signed out", "You have been successfully signed out");
    };

    const handleSwitchAuthMode = () => {
        setAuthError(null);
        setAuthMode(authMode === "login" ? "register" : "login");
    };

    useEffect(() => {
        installGlobalErrorReporting();
        syncCalmAttribute();
        signConsole();
    }, []);

    return (
        <div className="app">
            {/* Default title; a page's own next/head <title> renders later and wins. */}
            <Head>
                <title>Mosaic</title>
            </Head>
            <a className="skip-link" href="#main">
                Skip to content
            </a>
            <div className="main-content">
                <ErrorBoundary key={router.pathname} label="Something went wrong loading this page.">
                    <Component
                        {...pageProps}
                        isAuthenticated={isAuthenticated}
                        user={session?.user || null}
                        onAuthClick={handleAuthClick}
                        showToast={showToast}
                        onLogout={handleLogout}
                    />
                </ErrorBoundary>
            </div>

            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                mode={authMode}
                onSwitchMode={handleSwitchAuthMode}
                onSubmit={handleAuthSubmit}
                onSocialAuth={handleSocialAuth}
                onDismissError={() => setAuthError(null)}
                loading={authLoading}
                error={authError}
                welcomedAs={welcomedAs}
                onWelcomed={handleWelcomed}
            />

            <HelpMenu isOpen={genericHelpOpen} onClose={() => setGenericHelpOpen(false)} />

            {needsUsername && session.oauthDraft && (
                <OnboardingUsernameModal draft={session.oauthDraft} showToast={showToast} onComplete={() => router.push("/")} />
            )}

            {/* Boards explain a cold start with the kiln, and embeds stay chrome-free. */}
            {!router.pathname.startsWith("/embed") && !router.query.shareId && <BackendStatusPill />}
            <Toast toasts={toasts} removeToast={removeToast} />
        </div>
    );
}

export default function App({ Component, pageProps }) {
    return (
        <Provider store={store}>
            <SessionProvider session={pageProps.session} refetchInterval={SESSION_POLL_SECONDS}>
                <ThemeProvider>
                    <AppContent Component={Component} pageProps={pageProps} />
                </ThemeProvider>
            </SessionProvider>
        </Provider>
    );
}
