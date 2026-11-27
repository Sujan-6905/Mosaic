import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import axiosInstance from "@/lib/axiosInstance";
import { THEMES, DEFAULT_THEME, isValidTheme } from "./themes";

const STORAGE_KEY = "mosaic:theme";
const ThemeContext = createContext(null);

const readInitialTheme = () => {
    if (typeof window === "undefined") return DEFAULT_THEME;
    // Matches _document.js's boot script so there's no mismatch between
    // what was painted before hydration and what React thinks is active.
    const attr = document.documentElement.getAttribute("data-theme");
    if (isValidTheme(attr)) return attr;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isValidTheme(stored) ? stored : DEFAULT_THEME;
};

// Every token is scoped under `[data-theme]`, so switching theme is this one attribute write.
const ThemeProvider = ({ children }) => {
    const { data: session, status } = useSession();
    const [theme, setThemeState] = useState(readInitialTheme);
    const appliedServerPreference = useRef(false);
    const chosenThisPage = useRef(false);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        // The canvas colour resolver has no other way to learn the tokens changed; this clears its cache and repaints once.
        window.dispatchEvent(new CustomEvent("mosaic:theme-changed", { detail: { theme } }));
    }, [theme]);

    // A signed-in user's saved preference beats the boot guess. It is read from the backend, not the session, which
    // only knows the theme at sign-in, and only once per page load so it never fights a later change.
    useEffect(() => {
        if (status !== "authenticated" || !session?.accessToken || appliedServerPreference.current) return;
        appliedServerPreference.current = true;
        axiosInstance
            .get("/api/auth/me", { headers: { Authorization: `Bearer ${session.accessToken}` } })
            .then(({ data }) => {
                const serverTheme = data.data?.themePreference;
                if (!isValidTheme(serverTheme) || chosenThisPage.current) return;
                setThemeState(serverTheme);
                window.localStorage.setItem(STORAGE_KEY, serverTheme);
            })
            .catch(() => {
                // The device's own choice stands when the preference can't be read.
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    const setTheme = useCallback(
        (next) => {
            if (!isValidTheme(next)) return;
            chosenThisPage.current = true;
            setThemeState(next);
            window.localStorage.setItem(STORAGE_KEY, next);
            if (session?.accessToken) {
                axiosInstance.put("/api/auth/theme", { theme: next }, { headers: { Authorization: `Bearer ${session.accessToken}` } }).catch(() => {
                    // Best-effort cross-device sync: localStorage above
                    // already made the change stick on this device.
                });
            }
        },
        [session?.accessToken],
    );

    const value = useMemo(() => ({ theme, setTheme, themes: THEMES }), [theme, setTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
    return ctx;
};

export { ThemeProvider, useTheme };
