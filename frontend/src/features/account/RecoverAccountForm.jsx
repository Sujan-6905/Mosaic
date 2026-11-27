import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import { isCalm } from "@/lib/calmMode";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "@/lib/passwordStrength";
import { useStoneScene } from "@/components/stoneScene/useStoneScene";
import { createRestorationScene } from "./restorationScene";
import styles from "./AuthModal.module.css";

const CODE_CHARACTERS = 16;
const SEAL_MS = 1100;

// How much of the missing patch is back: a third for the name, the code and a good new password.
const stepsDone = (form) =>
    [
        form.username.trim().length > 0,
        form.code.replace(/[^a-z0-9]/gi, "").length === CODE_CHARACTERS,
        !passwordProblem(form.password, { username: form.username }),
    ].filter(Boolean).length;

// A forgotten password, replaced with one of the account's recovery codes.
export default function RecoverAccountForm({ initialUsername = "", onBack, onRecovered }) {
    const [form, setForm] = useState({ username: initialUsername, code: "", password: "" });
    const [problem, setProblem] = useState(null);
    const [busy, setBusy] = useState(false);
    const { canvasRef, sceneRef } = useStoneScene(createRestorationScene);

    useEffect(() => {
        sceneRef.current?.setProgress(stepsDone(form));
    }, [form, sceneRef]);

    const setField = (name) => (event) => {
        setForm((current) => ({ ...current, [name]: event.target.value }));
        setProblem(null);
    };

    const submit = async (event) => {
        event.preventDefault();
        if (!form.username || !form.code) return setProblem("Enter your username and one of your recovery codes.");
        const weak = passwordProblem(form.password, { username: form.username });
        if (weak) return setProblem(weak);
        setBusy(true);
        try {
            await axiosInstance.post("/api/auth/recover", form);
            sceneRef.current?.seal();
            await new Promise((resolve) => setTimeout(resolve, isCalm() ? 300 : SEAL_MS));
            onRecovered(form.username);
        } catch (error) {
            setProblem(error.response?.data?.message || "Something went wrong on our side. Please try again.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className={styles.form} onSubmit={submit} noValidate>
            <canvas ref={canvasRef} className={styles.restoration} aria-hidden="true" />
            <div className={styles.heading}>
                <h2 id="authTitle" className={styles.title}>
                    Reset your password
                </h2>
                <p className={styles.lede}>Use one of the recovery codes you saved from your profile. Each code works once.</p>
            </div>
            {problem && (
                <p role="alert" className={styles.alert}>
                    {problem}
                </p>
            )}
            <label className={styles.field}>
                Username
                <input className={styles.input} name="username" autoComplete="username" value={form.username} onChange={setField("username")} disabled={busy} />
            </label>
            <label className={styles.field}>
                Recovery code
                <input
                    className={styles.input}
                    name="code"
                    autoComplete="one-time-code"
                    placeholder="abcd-efgh-jkmn-pqrs"
                    value={form.code}
                    onChange={setField("code")}
                    disabled={busy}
                />
            </label>
            <label className={styles.field}>
                <span className={styles.fieldLabel}>
                    New password
                    <span className={styles.fieldHint}>At least {MIN_PASSWORD_LENGTH} characters</span>
                </span>
                <input
                    className={styles.input}
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={setField("password")}
                    disabled={busy}
                />
            </label>
            <button type="submit" className={styles.submit} disabled={busy}>
                {busy ? "One moment" : "Set new password"}
            </button>
            <p className={styles.switch}>
                No recovery codes? Accounts made with Google or GitHub sign in through them.{" "}
                <button type="button" onClick={onBack}>
                    Back to sign in
                </button>
            </p>
        </form>
    );
}
