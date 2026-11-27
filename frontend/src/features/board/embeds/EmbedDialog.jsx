import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { toEmbedUrl } from "../../../../../shared/canvas/elements/links.js";

const EmbedDialog = ({ isOpen, onClose, onInsert }) => {
    const [address, setAddress] = useState("");
    const [problem, setProblem] = useState(null);

    const submit = (event) => {
        event.preventDefault();
        const url = toEmbedUrl(address);
        if (!url) {
            setProblem("That doesn't look like a web address.");
            return;
        }
        onInsert(url);
        setAddress("");
        setProblem(null);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Embed a web page">
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Input
                    autoFocus
                    aria-label="Web address"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                />
                {problem && (
                    <p role="alert" style={{ margin: 0, color: "var(--color-danger)", fontSize: "0.8rem" }}>
                        {problem}
                    </p>
                )}
                <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
                    YouTube, Vimeo, Loom, Figma, Google Docs, CodePen and Spotify work well. Some sites refuse to appear inside other pages; those stay as a
                    link you can open.
                </p>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit">Embed</Button>
                </div>
            </form>
        </Modal>
    );
};

export default EmbedDialog;
