import { useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import styles from "./profile.module.css";
import own from "./AccountSafety.module.css";
import { signOutOfMosaic } from "@/lib/signOutOfMosaic";
import { downloadBlob } from "@/lib/downloadFile";

// Recovery codes: the way back into a username account, which has no email to reset through.
function RecoveryCodes({ account, authHeaders, showToast }) {
    const [password, setPassword] = useState("");
    const [codes, setCodes] = useState(null);
    const [left, setLeft] = useState(account.recoveryCodesLeft ?? 0);
    const [problem, setProblem] = useState("");

    const create = async (event) => {
        event.preventDefault();
        setProblem("");
        try {
            const { data } = await axiosInstance.post("/api/auth/recovery-codes", { password }, authHeaders);
            setCodes(data.codes);
            setLeft(data.codes.length);
            setPassword("");
        } catch (error) {
            setProblem(error.response?.data?.message || "Couldn't make codes. Try again.");
        }
    };

    const download = () => {
        const blob = new Blob([`Mosaic recovery codes for @${account.username}\nEach code works once.\n\n${codes.join("\n")}\n`], { type: "text/plain" });
        downloadBlob(blob, `mosaic-recovery-codes-${account.username}.txt`);
    };

    return (
        <section className={styles.card} data-rise style={{ "--rise-order": 3 }} aria-labelledby="recoveryHeading">
            <div className={styles.cardHead}>
                <h2 id="recoveryHeading">Recovery codes</h2>
                <p>
                    If you forget your password, one of these gets you back in. {left > 0 ? `${left} unused.` : "You have none yet."} Making new ones replaces
                    the old.
                </p>
            </div>
            {codes ? (
                <>
                    <ul className={own.codes} aria-label="Your recovery codes">
                        {codes.map((code) => (
                            <li key={code}>{code}</li>
                        ))}
                    </ul>
                    <p className={own.warning}>Save these somewhere safe now. They won&apos;t be shown again.</p>
                    <div className={styles.formActions}>
                        <button type="button" className={styles.primary} onClick={download}>
                            Download
                        </button>
                        <button
                            type="button"
                            className={styles.ghost}
                            onClick={() =>
                                navigator.clipboard
                                    ?.writeText(codes.join("\n"))
                                    .then(() => showToast?.success("Copied", "Your recovery codes are on the clipboard."))
                            }
                        >
                            Copy
                        </button>
                        <button type="button" className={styles.ghost} onClick={() => setCodes(null)}>
                            Done
                        </button>
                    </div>
                </>
            ) : (
                <form className={own.inline} onSubmit={create}>
                    <label className={styles.field}>
                        Your password
                        <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
                    </label>
                    <button type="submit" className={styles.primary} disabled={!password}>
                        {left > 0 ? "Make new codes" : "Make codes"}
                    </button>
                    {problem && (
                        <p role="alert" className={styles.error}>
                            {problem}
                        </p>
                    )}
                </form>
            )}
        </section>
    );
}

function DeleteAccount({ account, authHeaders }) {
    const [open, setOpen] = useState(false);
    const [typed, setTyped] = useState("");
    const [password, setPassword] = useState("");
    const [problem, setProblem] = useState("");
    const [busy, setBusy] = useState(false);

    const remove = async () => {
        setBusy(true);
        setProblem("");
        try {
            await axiosInstance.delete("/api/auth/account", { ...authHeaders, data: { username: typed, ...(account.hasPassword ? { password } : {}) } });
            await signOutOfMosaic({ callbackUrl: "/" });
        } catch (error) {
            setProblem(error.response?.data?.message || "Couldn't delete your account. Try again.");
            setBusy(false);
        }
    };

    return (
        <section className={`${styles.card} ${own.dangerCard}`} data-rise style={{ "--rise-order": 6 }} aria-labelledby="deleteHeading">
            <div className={styles.cardHead}>
                <h2 id="deleteHeading" className={styles.smallHeading}>
                    Delete account
                </h2>
                <p>Removes your account, every board you own with its history, and you from boards others shared with you. This can&apos;t be undone.</p>
            </div>
            <div className={styles.formActions}>
                <button type="button" className={`${styles.outline} ${styles.destructive}`} onClick={() => setOpen(true)}>
                    Delete my account
                </button>
            </div>
            <Modal
                isOpen={open}
                onClose={() => !busy && setOpen(false)}
                title="Delete your account?"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                            Keep it
                        </Button>
                        <Button variant="danger" onClick={remove} disabled={busy || typed !== account.username || (account.hasPassword && !password)}>
                            {busy ? "Deleting" : "Delete everything"}
                        </Button>
                    </>
                }
            >
                <div className={own.confirm}>
                    <label className={styles.field}>
                        Type <strong>{account.username}</strong> to confirm
                        <input autoComplete="off" value={typed} onChange={(event) => setTyped(event.target.value)} />
                    </label>
                    {account.hasPassword && (
                        <label className={styles.field}>
                            Your password
                            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
                        </label>
                    )}
                    {problem && (
                        <p role="alert" className={styles.error}>
                            {problem}
                        </p>
                    )}
                </div>
            </Modal>
        </section>
    );
}

export { RecoveryCodes, DeleteAccount };
