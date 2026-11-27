import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import axiosInstance from "@/lib/axiosInstance";
import { AuthArt, AuthDialog } from "./AuthModal";
import Tessera from "@/components/Tessera/Tessera";
import authStyles from "./AuthModal.module.css";
import styles from "./OnboardingUsernameModal.module.css";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
const PROVIDER_NAMES = { google: "Google", github: "GitHub" };
const ART_LIT = [0, 9, 18, 27, 36, 45, 21, 29];

const formatProblem = (value) => {
    if (value.length < 3) return "At least 3 characters.";
    if (!USERNAME_PATTERN.test(value)) return "Letters, numbers and underscores only.";
    return null;
};

const CheckIcon = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M5 12l5 5L20 7" />
    </svg>
);

// Shown after Google or GitHub hand back a profile with no Mosaic account yet.
const OnboardingUsernameModal = ({ draft, onComplete, showToast }) => {
    const [username, setUsername] = useState("");
    const [availability, setAvailability] = useState({ state: "idle", suggestions: [] });
    const [submitError, setSubmitError] = useState("");
    const [loading, setLoading] = useState(false);

    const value = username.trim();
    const problem = value ? formatProblem(value) : null;

    useEffect(() => {
        if (!value || problem) {
            setAvailability({ state: "idle", suggestions: [] });
            return undefined;
        }
        setAvailability({ state: "checking", suggestions: [] });
        const timer = setTimeout(async () => {
            const { data } = await axiosInstance.get(`/api/auth/username-available/${encodeURIComponent(value)}`).catch(() => ({ data: {} }));
            if (data?.available === true) setAvailability({ state: "available", suggestions: [] });
            else if (data?.available === false) setAvailability({ state: "taken", suggestions: data.suggestions || [] });
            else setAvailability({ state: "idle", suggestions: [] });
        }, 300);
        return () => clearTimeout(timer);
    }, [value, problem]);

    const submit = async () => {
        if (!value || problem || availability.state === "taken") return;
        setLoading(true);
        setSubmitError("");
        try {
            const result = await signIn("oauth-complete", {
                redirect: false,
                provider: draft.provider,
                providerAccountId: draft.providerAccountId,
                email: draft.email,
                name: draft.name || "",
                username: value,
            });
            if (result?.error) {
                setSubmitError("Could not finish signing you up. Try again in a moment.");
                return;
            }
            showToast?.success("Welcome to Mosaic", "Your account is ready");
            onComplete?.();
        } finally {
            setLoading(false);
        }
    };

    const hint = problem
        ? problem
        : availability.state === "available"
          ? "Available. Letters, numbers and underscores only."
          : availability.state === "taken"
            ? "Taken. Try one of these:"
            : availability.state === "checking"
              ? "Checking"
              : "Letters, numbers and underscores only.";
    const tone = problem || availability.state === "taken" ? "bad" : availability.state === "available" ? "good" : undefined;
    const providerName = PROVIDER_NAMES[draft.provider] || draft.provider;

    return (
        <AuthDialog titleId="usernameTitle">
            <AuthArt lit={ART_LIT} line="Every tessera is signed by whoever set it." />
            <form
                className={authStyles.form}
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
                noValidate
            >
                <div className={authStyles.heading}>
                    <h2 id="usernameTitle" className={authStyles.title}>
                        Pick your name
                    </h2>
                    <p className={authStyles.lede}>This is how you appear on cursors, comments and shared boards.</p>
                </div>

                <div className={styles.provider}>
                    <span className={styles.providerMark}>{providerName.charAt(0)}</span>
                    <span className={styles.providerText}>
                        <strong>Signed in with {providerName}</strong>
                        <span>One step left before your first board.</span>
                    </span>
                </div>

                {submitError && (
                    <p role="alert" className={authStyles.alert}>
                        {submitError}
                    </p>
                )}

                <label className={authStyles.field}>
                    Username
                    <span className={`${authStyles.inputWrap} ${styles.handle}`} data-tone={tone}>
                        <span className={styles.at}>@</span>
                        <input
                            autoFocus
                            type="text"
                            className={authStyles.bareInput}
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            placeholder="your_name"
                            aria-invalid={tone === "bad"}
                            aria-describedby="usernameHint"
                            disabled={loading}
                        />
                        {tone === "good" && (
                            <span className={styles.ok}>
                                <CheckIcon />
                            </span>
                        )}
                        <Tessera name={username} size={26} className={styles.tessera} />
                    </span>
                    <span id="usernameHint" className={styles.hint} data-tone={tone} aria-live="polite">
                        {hint}
                    </span>
                </label>
                {availability.suggestions.length > 0 && (
                    <div className={styles.suggestions}>
                        {availability.suggestions.map((suggestion) => (
                            <button key={suggestion} type="button" onClick={() => setUsername(suggestion)}>
                                @{suggestion}
                            </button>
                        ))}
                    </div>
                )}

                <p className={styles.note}>Collaborators see this name on every board you share, and it can&apos;t be changed later.</p>
                <button type="submit" className={authStyles.submit} disabled={loading || !value || !!problem || availability.state === "taken"}>
                    {loading ? "Creating your account" : "Continue to Mosaic"}
                </button>
            </form>
        </AuthDialog>
    );
};

export default OnboardingUsernameModal;
