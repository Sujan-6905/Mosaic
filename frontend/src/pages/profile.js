import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

import AppHeader from "@/components/AppHeader";
import useAppSession from "@/hooks/useAppSession";
import axiosInstance from "@/lib/axiosInstance";
import { useTheme } from "@/theme/ThemeProvider";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "@/lib/passwordStrength";
import AgentAccess from "@/features/profile/AgentAccess";
import MentionAlerts from "@/features/profile/MentionAlerts";
import { DeleteAccount, RecoveryCodes } from "@/features/profile/AccountSafety";
import styles from "@/features/profile/profile.module.css";
import { signOutOfMosaic } from "@/lib/signOutOfMosaic";
import { useCalmChoice } from "@/lib/calmMode";
import { useSoundChoice } from "@/lib/soundKit";
import YourWall from "@/features/profile/YourWall";
import Switch from "@/components/ui/Switch";
import Tessera from "@/components/Tessera/Tessera";

const THEME_LOOKS = {
    dark: { bg: "#15171b", side: "#121418", ink: "#ecebe6", card: "#24282e" },
    light: { bg: "#f6f5f1", side: "#efeee9", ink: "#17181b", card: "#ffffff" },
};

const EMPTY_PASSWORDS = { current: "", next: "", confirm: "" };

const countOf = (count, noun) => `${count} ${noun}${count === 1 ? "" : "s"}`;
const describeEndedAccess = ({ endedSessions = 0, revokedTokens = 0 }) => {
    const ended = [endedSessions && countOf(endedSessions, "other sign-in"), revokedTokens && countOf(revokedTokens, "access token")].filter(Boolean);
    return ended.length ? `${ended.join(" and ")} ended.` : "Nothing else was signed in.";
};

const CheckIcon = ({ met }) => (
    <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={met ? 3 : 2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        {met ? <path d="M5 12l5 5L20 7" /> : <circle cx="12" cy="12" r="8" />}
    </svg>
);

const ArrowIcon = () => (
    <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
);

const ProfilePage = ({ showToast }) => {
    const router = useRouter();
    const { session, status, isAuthenticated } = useAppSession();
    const { theme, setTheme, themes } = useTheme();
    const authHeaders = useMemo(() => ({ headers: { Authorization: `Bearer ${session?.accessToken}` } }), [session?.accessToken]);

    const [account, setAccount] = useState(null);
    const [counts, setCounts] = useState(null);
    const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
    const [passwordError, setPasswordError] = useState("");
    const [saving, setSaving] = useState(false);
    const [tokensVersion, setTokensVersion] = useState(0);

    useEffect(() => {
        if (status !== "loading" && !isAuthenticated) router.replace(`/?callbackUrl=${encodeURIComponent(router.asPath)}`);
    }, [status, isAuthenticated, router]);

    useEffect(() => {
        if (!isAuthenticated) return;
        axiosInstance
            .get("/api/auth/me", authHeaders)
            .then(({ data }) => setAccount(data.data))
            .catch(() => setAccount({}));
        axiosInstance
            .get("/api/drawing/get", authHeaders)
            .then(({ data }) => {
                const all = [...data.data.ownedDrawings, ...data.data.sharedWithDrawings];
                setCounts({
                    owned: data.data.ownedDrawings.length,
                    shared: data.data.sharedWithDrawings.length,
                    starred: all.filter((board) => board.favorite).length,
                });
            })
            .catch(() => setCounts(null));
    }, [isAuthenticated, authHeaders]);

    const username = session?.user?.username || account?.username || "";
    const memberSince = account?.createdAt ? new Date(account.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : null;

    const rules = [
        { label: `${MIN_PASSWORD_LENGTH} or more characters`, met: passwords.next.length >= MIN_PASSWORD_LENGTH },
        { label: "A number or symbol", met: /[^\p{L}]/u.test(passwords.next) },
        { label: "Different from the current one", met: !!passwords.next && passwords.next !== passwords.current },
    ];

    const updatePassword = async (event) => {
        event.preventDefault();
        if (!passwords.current) return setPasswordError("Enter your current password.");
        if (!rules[2].met) return setPasswordError("Pick a password different from your current one.");
        const problem = passwordProblem(passwords.next, { username });
        if (problem) return setPasswordError(problem);
        if (passwords.next !== passwords.confirm) return setPasswordError("The two new passwords don't match.");
        setSaving(true);
        setPasswordError("");
        try {
            const { data } = await axiosInstance.put("/api/auth/password", { oldpassword: passwords.current, password: passwords.next }, authHeaders);
            setPasswords(EMPTY_PASSWORDS);
            setTokensVersion((version) => version + 1);
            showToast?.success("Password updated", `${describeEndedAccess(data)} Use the new password next time you sign in.`);
        } catch (error) {
            setPasswordError(error.response?.status === 400 ? "That current password isn't right." : "Couldn't update it. Try again.");
        } finally {
            setSaving(false);
        }
    };

    const signOutOtherDevices = async () => {
        try {
            const { data } = await axiosInstance.post("/api/auth/session/end-others", {}, authHeaders);
            setTokensVersion((version) => version + 1);
            showToast?.success("Other devices signed out", describeEndedAccess(data));
        } catch {
            showToast?.error("Couldn't sign out other devices", "Try again in a moment.");
        }
    };

    const [calmChosen, setCalmChosen, systemCalm] = useCalmChoice();
    const [soundOn, setSoundOn] = useSoundChoice();

    const setField = (name) => (event) => {
        setPasswords((previous) => ({ ...previous, [name]: event.target.value }));
        setPasswordError("");
    };

    return (
        <div className={styles.page}>
            <Head>
                <title>Profile · Mosaic</title>
                <meta name="robots" content="noindex, nofollow" />
            </Head>
            <AppHeader crumbs={[{ label: "Home", href: "/" }, { label: "Profile" }]} />

            <main id="main" className={styles.main}>
                <aside className={styles.identity} data-rise>
                    <div className={styles.avatar}>
                        <Tessera name={username} size={112} />
                        <span className={styles.avatarCaption}>Your tessera, cut from your name</span>
                    </div>
                    <div className={styles.nameBlock}>
                        <h1 className={styles.username}>@{username}</h1>
                        {memberSince && <p className={styles.since}>Member since {memberSince}</p>}
                    </div>
                    <p className={styles.identityNote}>
                        Your username is your identity across Mosaic. Collaborators see it on every board you share, and it can&apos;t be changed.
                    </p>
                    <dl className={styles.stats}>
                        <div>
                            <dt>Boards</dt>
                            <dd>{counts?.owned ?? "-"}</dd>
                        </div>
                        <div>
                            <dt>Shared</dt>
                            <dd>{counts?.shared ?? "-"}</dd>
                        </div>
                        <div>
                            <dt>Starred</dt>
                            <dd className={styles.starred}>{counts?.starred ?? "-"}</dd>
                        </div>
                    </dl>
                    <Link href="/dashboard" className={styles.allBoards}>
                        Go to all boards
                        <ArrowIcon />
                    </Link>
                </aside>

                <div className={styles.sections}>
                    <section className={styles.card} data-rise>
                        <div className={styles.cardHead}>
                            <h2>Your wall</h2>
                            <p>A year of pieces set, one tile a day. It only ever gains tiles: no streaks, nothing to lose.</p>
                        </div>
                        <YourWall token={session?.accessToken} />
                    </section>

                    <section className={styles.card} data-rise style={{ "--rise-order": 1 }}>
                        <div className={styles.cardHead}>
                            <h2>Appearance</h2>
                            <p>Applies to the app and every board. The marketing pages stay dark.</p>
                        </div>
                        <div role="radiogroup" aria-label="Theme" className={styles.themes}>
                            {themes.map((option) => {
                                const look = THEME_LOOKS[option.id];
                                const selected = theme === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        className={styles.themeOption}
                                        onClick={() => setTheme(option.id)}
                                    >
                                        <span className={styles.themePreview} style={{ background: look.bg }} aria-hidden="true">
                                            <span style={{ background: look.side }} className={styles.previewSide} />
                                            <span className={styles.previewBody}>
                                                <span className={styles.previewTitle} style={{ background: look.ink }} />
                                                <span className={styles.previewCards}>
                                                    <span style={{ background: look.card }} />
                                                    <span style={{ background: look.card }} />
                                                </span>
                                                <span className={styles.previewButton} />
                                            </span>
                                        </span>
                                        <span className={styles.themeLabel}>
                                            <strong>{option.label}</strong>
                                            <span className={styles.radio} />
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <Switch checked={calmChosen} onChange={setCalmChosen} className={styles.settingSwitch}>
                            <span className={styles.calmLabel}>
                                <strong>Calm mode</strong>
                                <span>
                                    {systemCalm
                                        ? "Your system already asks for less motion, so Mosaic stays calm either way."
                                        : "Stones settle in place instead of flying, and every flourish becomes a quiet fade. Set for this browser."}
                                </span>
                            </span>
                        </Switch>
                        <Switch checked={soundOn} onChange={setSoundOn} className={styles.settingSwitch}>
                            <span className={styles.calmLabel}>
                                <strong>Ceramic sounds</strong>
                                <span>A clink when cursors meet, a knock when a stamp lands, three notes for a milestone. Off unless you turn it on here.</span>
                            </span>
                        </Switch>
                    </section>

                    {account?.hasPassword !== false && (
                        <section className={styles.card} data-rise style={{ "--rise-order": 2 }}>
                            <div className={styles.cardHead}>
                                <h2>Password</h2>
                                <p>Used when you sign in with your username instead of Google or GitHub.</p>
                            </div>
                            <form className={styles.passwordForm} onSubmit={updatePassword} noValidate>
                                <label className={styles.field}>
                                    Current password
                                    <input type="password" autoComplete="current-password" value={passwords.current} onChange={setField("current")} />
                                </label>
                                <label className={styles.field}>
                                    New password
                                    <input
                                        type="password"
                                        autoComplete="new-password"
                                        value={passwords.next}
                                        onChange={setField("next")}
                                        aria-describedby="passwordRules"
                                    />
                                </label>
                                <ul id="passwordRules" className={styles.rules}>
                                    {rules.map((rule) => (
                                        <li key={rule.label} data-met={rule.met}>
                                            <CheckIcon met={rule.met} />
                                            {rule.label}
                                        </li>
                                    ))}
                                </ul>
                                <label className={styles.field}>
                                    Confirm new password
                                    <input type="password" autoComplete="new-password" value={passwords.confirm} onChange={setField("confirm")} />
                                </label>
                                {passwordError && (
                                    <p role="alert" className={styles.error}>
                                        {passwordError}
                                    </p>
                                )}
                                <div className={styles.formActions}>
                                    <button type="submit" className={styles.primary} disabled={saving}>
                                        {saving ? "Updating" : "Update password"}
                                    </button>
                                    <button type="button" className={styles.ghost} onClick={() => setPasswords(EMPTY_PASSWORDS)}>
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </section>
                    )}

                    {account?.hasPassword && account.username && <RecoveryCodes account={account} authHeaders={authHeaders} showToast={showToast} />}

                    {session?.accessToken && <MentionAlerts token={session.accessToken} showToast={showToast} />}

                    <AgentAccess key={tokensVersion} token={session?.accessToken} showToast={showToast} />

                    <section className={`${styles.card} ${styles.signOutCard}`} data-rise style={{ "--rise-order": 5 }}>
                        <div className={styles.cardHead}>
                            <h2 className={styles.smallHeading}>Sign out</h2>
                            <p>Boards keep syncing for everyone else. Signing out other devices also revokes your access tokens.</p>
                        </div>
                        <div className={styles.formActions}>
                            <button type="button" className={`${styles.outline} ${styles.destructive}`} onClick={() => signOutOfMosaic({ callbackUrl: "/" })}>
                                Sign out
                            </button>
                            <button type="button" className={styles.outline} onClick={signOutOtherDevices}>
                                Sign out other devices
                            </button>
                        </div>
                    </section>

                    {account?.username && <DeleteAccount account={account} authHeaders={authHeaders} />}
                </div>
            </main>
        </div>
    );
};

export default ProfilePage;
