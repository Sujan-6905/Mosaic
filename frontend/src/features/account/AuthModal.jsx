import { useEffect, useRef, useState } from "react";
import { MIN_PASSWORD_LENGTH, passwordProblem, passwordStrength } from "@/lib/passwordStrength";
import { isCalm } from "@/lib/calmMode";
import { GuardianArt, ThresholdArt } from "./AuthStones";
import Tessera from "@/components/Tessera/Tessera";
import RecoverAccountForm from "./RecoverAccountForm";
import styles from "./AuthModal.module.css";

// Manual signup takes only a username and password, so the copy says the username is created here.
// OAuth signup is finished by OnboardingUsernameModal.

const COPY = {
    login: {
        title: "Welcome back",
        lede: "Sign in and pick up wherever the board was left.",
        art: "A board is independent pieces that resolve into one image.",
        usernamePlaceholder: "Your username",
        submit: "Sign in",
        retry: "Try again",
        switchPrompt: "New here?",
        switchAction: "Create an account",
        lit: [3, 9, 14, 20, 27, 33, 38, 44],
    },
    register: {
        title: "Create your account",
        lede: "Your first board is one step away. Free, nothing to install.",
        art: "Bring four people and watch the cursors show up.",
        usernamePlaceholder: "Pick something people will recognise",
        submit: "Create account",
        retry: "Create account",
        switchPrompt: "Already have an account?",
        switchAction: "Sign in",
        lit: [1, 10, 12, 19, 25, 30, 36, 41, 46],
    },
};

const EMPTY_FORM = { username: "", password: "" };

const CloseIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
    </svg>
);

const EyeIcon = ({ crossed }) => (
    <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
        {crossed && <path d="M3 3l18 18" />}
    </svg>
);

const GitHubIcon = () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 00-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.4-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 011-2.7 3.6 3.6 0 01.1-2.7s.8-.3 2.8 1a9.6 9.6 0 015 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7a3.9 3.9 0 011 2.7c0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0012 2z" />
    </svg>
);

const AlertIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
    </svg>
);

const ArrowIcon = () => (
    <svg
        width="15"
        height="15"
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

export function AuthArt({ lit, line }) {
    return (
        <div className={styles.art} aria-hidden="true">
            <div className={styles.tiles}>
                {Array.from({ length: 48 }, (_unused, index) => (
                    <span key={index} data-lit={lit.includes(index) ? (index % 2 ? "deep" : "gold") : undefined} />
                ))}
            </div>
            <span className={styles.artWordmark}>Mosaic</span>
            <p className={styles.artLine}>{line}</p>
            <ul className={styles.artList}>
                <li>Real-time rooms</li>
                <li>Replayable history</li>
                <li>Free to use</li>
            </ul>
        </div>
    );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AuthDialog({ titleId, onClose, children }) {
    const dialogRef = useRef(null);

    // Focus goes back to whatever opened the dialog once it closes.
    useEffect(() => {
        const previous = document.body.style.overflow;
        const opener = document.activeElement;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
        };
    }, []);

    // Tab and Shift+Tab stay inside the dialog, so nothing behind it can be reached while it is open.
    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === "Escape" && onClose) onClose();
            if (event.key !== "Tab" || !dialogRef.current) return;
            const focusable = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter((element) => element.offsetParent !== null);
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const inside = dialogRef.current.contains(document.activeElement);
            if (event.shiftKey && (document.activeElement === first || !inside)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
                event.preventDefault();
                first.focus();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose]);

    // data-lenis-prevent hands the wheel back from the landing page's smooth
    // scroll to this subtree.
    return (
        <div className={styles.overlay} onClick={onClose} role="presentation" data-lenis-prevent>
            <div
                ref={dialogRef}
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(event) => event.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
}

// The wall only plays HAVE where it can be seen and motion is welcome.
const WALL_HIDDEN_QUERY = "(max-width: 900px)";
const WELCOME_TIMEOUT_MS = 4000;

const AuthModal = ({
    isOpen,
    onClose,
    mode = "login",
    onSwitchMode,
    onSubmit,
    onSocialAuth,
    onDismissError,
    loading = false,
    error,
    welcomedAs = null,
    onWelcomed,
}) => {
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [showPassword, setShowPassword] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const [recovering, setRecovering] = useState(false);
    const [notice, setNotice] = useState(null);
    const [failures, setFailures] = useState(0);
    const firstField = useRef(null);
    const welcomedRef = useRef(onWelcomed);
    welcomedRef.current = onWelcomed;

    const isLogin = mode === "login";
    const copy = isLogin ? COPY.login : COPY.register;
    const strength = passwordStrength(formData.password, { username: formData.username });

    useEffect(() => {
        if (isOpen) firstField.current?.focus();
        else setFailures(0);
    }, [isOpen]);

    useEffect(() => {
        if (error && isLogin) setFailures((count) => count + 1);
    }, [error, isLogin]);

    useEffect(() => {
        if (welcomedAs === null) return undefined;
        if (isCalm() || window.matchMedia(WALL_HIDDEN_QUERY).matches) {
            welcomedRef.current?.();
            return undefined;
        }
        const fallback = setTimeout(() => welcomedRef.current?.(), WELCOME_TIMEOUT_MS);
        return () => clearTimeout(fallback);
    }, [welcomedAs]);

    if (!isOpen) return null;

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setFormData((previous) => ({ ...previous, [name]: value }));
        if (fieldErrors[name]) setFieldErrors((previous) => ({ ...previous, [name]: "" }));
    };

    const validate = () => {
        const found = {};
        if (!formData.username) found.username = "Enter a username.";
        else if (formData.username.length < 3) found.username = "Usernames are at least 3 characters.";
        else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) found.username = "Letters, numbers and underscores only.";

        const problem = isLogin ? null : passwordProblem(formData.password, { username: formData.username });
        if (!formData.password) found.password = "Enter a password.";
        else if (problem) found.password = problem;

        setFieldErrors(found);
        return Object.keys(found).length === 0;
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        if (validate()) onSubmit?.(formData);
    };

    const handleSwitchMode = () => {
        setFormData(EMPTY_FORM);
        setFieldErrors({});
        setShowPassword(false);
        setNotice(null);
        onSwitchMode?.();
    };

    const fieldInvalid = (name) => !!fieldErrors[name] || (!!error && isLogin);

    if (recovering) {
        return (
            <AuthDialog titleId="authTitle" onClose={onClose}>
                <AuthArt lit={copy.lit} line={copy.art} />
                <RecoverAccountForm
                    initialUsername={formData.username}
                    onBack={() => setRecovering(false)}
                    onRecovered={(username) => {
                        setRecovering(false);
                        setFormData({ ...EMPTY_FORM, username });
                        setNotice("Password changed. Sign in with it now.");
                    }}
                />
            </AuthDialog>
        );
    }

    const welcoming = welcomedAs !== null;

    return (
        <AuthDialog titleId="authTitle" onClose={onClose}>
            {isLogin ? (
                <ThresholdArt failures={failures} trying={loading} welcomedAs={welcomedAs} onOpened={onWelcomed} />
            ) : (
                <GuardianArt score={strength.score} length={formData.password.length} />
            )}
            <form className={styles.form} onSubmit={handleSubmit} noValidate>
                <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
                    <CloseIcon />
                </button>

                <div className={styles.heading}>
                    <h2 id="authTitle" className={styles.title}>
                        {copy.title}
                    </h2>
                    <p className={styles.lede}>{copy.lede}</p>
                </div>

                <div className={styles.socials}>
                    <button type="button" className={styles.social} onClick={() => onSocialAuth?.("google")} disabled={loading}>
                        <span className={styles.googleMark}>G</span>
                        Google
                    </button>
                    <button type="button" className={styles.social} onClick={() => onSocialAuth?.("github")} disabled={loading}>
                        <GitHubIcon />
                        GitHub
                    </button>
                </div>
                <div className={styles.divider}>or with a username</div>

                {notice && !error && isLogin && (
                    <p role="status" className={styles.notice}>
                        {notice}
                    </p>
                )}
                {error && (
                    <p role="alert" className={styles.alert}>
                        <AlertIcon />
                        {error}
                    </p>
                )}

                <label className={styles.field}>
                    <span className={styles.fieldLabel}>
                        Username
                        {!isLogin && (
                            <span className={styles.tesseraHint}>
                                {formData.username ? "Your tessera" : "Type to cut your tessera"}
                                <Tessera name={formData.username} size={22} />
                            </span>
                        )}
                    </span>
                    <input
                        ref={firstField}
                        type="text"
                        name="username"
                        autoComplete="username"
                        className={styles.input}
                        placeholder={copy.usernamePlaceholder}
                        value={formData.username}
                        onChange={handleInputChange}
                        aria-invalid={fieldInvalid("username")}
                        aria-describedby={fieldErrors.username ? "authUsernameError" : undefined}
                        disabled={loading}
                    />
                    {fieldErrors.username && (
                        <span id="authUsernameError" className={styles.fieldError}>
                            {fieldErrors.username}
                        </span>
                    )}
                </label>

                <label className={styles.field}>
                    <span className={styles.fieldLabel}>
                        Password
                        {!isLogin && <span className={styles.fieldHint}>At least {MIN_PASSWORD_LENGTH} characters</span>}
                    </span>
                    <span className={styles.inputWrap} data-invalid={fieldInvalid("password")}>
                        <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            autoComplete={isLogin ? "current-password" : "new-password"}
                            className={styles.bareInput}
                            placeholder="Your password"
                            value={formData.password}
                            onChange={handleInputChange}
                            aria-invalid={fieldInvalid("password")}
                            aria-describedby={!isLogin ? "authPasswordHint" : undefined}
                            disabled={loading}
                        />
                        <button
                            type="button"
                            className={styles.reveal}
                            onClick={() => setShowPassword((shown) => !shown)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            <EyeIcon crossed={showPassword} />
                        </button>
                    </span>
                    {!isLogin && (
                        <>
                            <span className={styles.meter} aria-hidden="true">
                                {[1, 2, 3, 4].map((bar) => (
                                    <span key={bar} data-on={strength.score >= bar} />
                                ))}
                            </span>
                            <span id="authPasswordHint" className={fieldErrors.password ? styles.fieldError : styles.meterHint}>
                                {fieldErrors.password || strength.hint}
                            </span>
                        </>
                    )}
                    {isLogin && fieldErrors.password && <span className={styles.fieldError}>{fieldErrors.password}</span>}
                </label>
                {isLogin && (
                    <button
                        type="button"
                        className={styles.forgot}
                        onClick={() => {
                            onDismissError();
                            setRecovering(true);
                        }}
                    >
                        Forgot password?
                    </button>
                )}

                <button type="submit" className={styles.submit} disabled={loading || welcoming} data-welcoming={welcoming}>
                    {welcoming ? "Welcome back" : loading ? "One moment" : error ? copy.retry : copy.submit}
                    <ArrowIcon />
                </button>
                <p className={styles.switch}>
                    {copy.switchPrompt}{" "}
                    <button type="button" onClick={handleSwitchMode}>
                        {copy.switchAction}
                    </button>
                </p>
            </form>
        </AuthDialog>
    );
};

export default AuthModal;
