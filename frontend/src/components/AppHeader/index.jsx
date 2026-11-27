import { Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import Dropdown from "@/components/ui/Dropdown";
import useAppSession from "@/hooks/useAppSession";
import { useTheme } from "@/theme/ThemeProvider";
import { headerItemClick } from "@/store/headerSlice";
import NotificationBell from "@/features/notifications/NotificationBell";
import styles from "./index.module.css";
import { signOutOfMosaic } from "@/lib/signOutOfMosaic";

export const initialsOf = (name = "") =>
    name
        .split(/[\s_.-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("") || "?";

const SearchIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
    </svg>
);

const ChevronIcon = () => (
    <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        className={styles.chevron}
    >
        <path d="M9 6l6 6-6 6" />
    </svg>
);

export default function AppHeader({ crumbs, search, children }) {
    const router = useRouter();
    const dispatch = useDispatch();
    const { session } = useAppSession();
    const { theme, setTheme } = useTheme();
    const username = session?.user?.username || session?.user?.name || "";

    return (
        <header className={styles.header}>
            <nav className={styles.crumbs} aria-label="Breadcrumb">
                <Link href="/" className={styles.wordmark}>
                    Mosaic
                </Link>
                <span className={styles.rule} aria-hidden="true" />
                {crumbs.map((crumb, index) => (
                    <Fragment key={crumb.label}>
                        {index > 0 && <ChevronIcon />}
                        {crumb.href ? (
                            <Link href={crumb.href} className={styles.crumbLink}>
                                {crumb.label}
                            </Link>
                        ) : (
                            <span className={index === crumbs.length - 1 && crumbs.length > 1 ? styles.crumbCurrent : styles.crumbLink} aria-current="page">
                                {crumb.label}
                            </span>
                        )}
                    </Fragment>
                ))}
            </nav>

            {search && (
                <label className={styles.search}>
                    <SearchIcon />
                    <input
                        type="search"
                        value={search.value}
                        onChange={(event) => search.onChange(event.target.value)}
                        placeholder={search.placeholder}
                        aria-label={search.label || search.placeholder}
                    />
                    {search.busy && <span className={styles.searchBusy} aria-label="Searching" />}
                </label>
            )}

            {children}

            <NotificationBell token={session?.accessToken} className={styles.inbox} rootClassName={search ? undefined : styles.pushRight} />

            <Dropdown
                align="end"
                trigger={
                    <button type="button" className={styles.account} aria-label={`Account menu for ${username || "you"}`}>
                        {initialsOf(username)}
                    </button>
                }
                header={
                    <div className={styles.menuHeader}>
                        <strong>@{username}</strong>
                        <span>Signed in</span>
                    </div>
                }
                items={[
                    { key: "profile", label: "Profile", onSelect: () => router.push("/profile") },
                    { key: "boards", label: "All boards", onSelect: () => router.push("/dashboard") },
                    { key: "help", label: "Help and resources", onSelect: () => dispatch(headerItemClick("Help")) },
                    { key: "about", label: "How it works", onSelect: () => router.push("/about") },
                    {
                        key: "theme",
                        label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
                        onSelect: () => setTheme(theme === "dark" ? "light" : "dark"),
                    },
                    { divider: true },
                    { key: "signout", label: "Sign out", dangerOnHover: true, onSelect: () => signOutOfMosaic({ callbackUrl: "/" }) },
                ]}
            />
        </header>
    );
}
