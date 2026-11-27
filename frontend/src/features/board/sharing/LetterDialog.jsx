import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import axiosInstance from "@/lib/axiosInstance";
import styles from "./LetterDialog.module.css";

const NOTE_LIMIT = 160;

const letterUrl = (token) => `${window.location.origin}/letter/${token}`;

// Cover letters for this board: each a public link that greets one company by name and plays the board drawing itself.
export default function LetterDialog({ isOpen, onClose, shareId, token, showToast }) {
    const [letters, setLetters] = useState([]);
    const [draft, setDraft] = useState({ company: "", note: "" });
    const [busy, setBusy] = useState(false);
    const headers = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
    const base = `/api/letters/board/${encodeURIComponent(shareId)}`;

    useEffect(() => {
        if (!isOpen) return;
        axiosInstance
            .get(base, headers)
            .then(({ data }) => setLetters(data.letters))
            .catch(() => showToast?.error("Couldn't load letters", "Try again in a moment."));
    }, [isOpen, base, headers, showToast]);

    const copy = (letter) =>
        navigator.clipboard
            .writeText(letterUrl(letter.token))
            .then(() => showToast?.success("Copied", `The letter to ${letter.company} is on your clipboard.`));

    const write = async (event) => {
        event.preventDefault();
        if (!draft.company.trim()) return;
        setBusy(true);
        try {
            const { data } = await axiosInstance.post(base, { company: draft.company.trim(), note: draft.note.trim() || undefined }, headers);
            setLetters((current) => [data.letter, ...current]);
            setDraft({ company: "", note: "" });
            copy(data.letter);
        } catch (error) {
            showToast?.error("Couldn't write the letter", error.response?.data?.message || "Try again in a moment.");
        } finally {
            setBusy(false);
        }
    };

    const revoke = async (letter) => {
        try {
            await axiosInstance.delete(`/api/letters/${letter.token}`, headers);
            setLetters((current) => current.filter((item) => item.token !== letter.token));
        } catch {
            showToast?.error("Couldn't take it back", "Try again in a moment.");
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Cover letters" size="sm">
            <p className={styles.lede}>
                A public link made for one reader. It writes &ldquo;Hello,&rdquo; and their name, then plays this board being drawn from its history. Nothing
                else about the board is shown, and you can take the link back at any time.
            </p>
            <form className={styles.form} onSubmit={write}>
                <Input
                    label="Who it's for"
                    placeholder="A company or a person"
                    value={draft.company}
                    maxLength={60}
                    onChange={(event) => setDraft({ ...draft, company: event.target.value })}
                />
                <Input
                    label="A line from you (optional)"
                    placeholder="Why I built this, in a sentence"
                    value={draft.note}
                    maxLength={NOTE_LIMIT}
                    onChange={(event) => setDraft({ ...draft, note: event.target.value })}
                />
                <Button type="submit" disabled={busy || !draft.company.trim()}>
                    {busy ? "Writing" : "Write and copy the link"}
                </Button>
            </form>
            {letters.length > 0 && (
                <ul className={styles.list} aria-label="Letters for this board">
                    {letters.map((letter) => (
                        <li key={letter.token}>
                            <span className={styles.company}>{letter.company}</span>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(letterUrl(letter.token), "_blank", "noopener")}
                                aria-label={`Open the letter to ${letter.company}`}
                            >
                                Open
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => copy(letter)} aria-label={`Copy the link to the letter to ${letter.company}`}>
                                Copy link
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => revoke(letter)} aria-label={`Take back the letter to ${letter.company}`}>
                                Take back
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </Modal>
    );
}
