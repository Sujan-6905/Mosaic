import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import styles from "./ClearBoardDialog.module.css";

// Typing the title guards against mistakes; the server enforces owner-only on its own.
const ClearBoardDialog = ({ isOpen, onClose, boardTitle, isOwner, onConfirm, busy }) => {
    const [confirmText, setConfirmText] = useState("");

    useEffect(() => {
        if (isOpen) setConfirmText("");
    }, [isOpen]);

    const canConfirm = isOwner && confirmText === boardTitle;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Clear this board?" size="sm">
            <div className={styles.warning}>
                <FontAwesomeIcon icon={faTriangleExclamation} className={styles.warningIcon} />
                <p>
                    This removes every element from <strong>{boardTitle}</strong> for everyone, right away. You can still undo it, and it stays in version
                    history.
                </p>
            </div>

            {isOwner ? (
                <>
                    <label className={styles.label} htmlFor="clear-board-confirm">
                        Type <strong>{boardTitle}</strong> to confirm
                    </label>
                    <Input id="clear-board-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={boardTitle} autoFocus />
                    <div className={styles.actions}>
                        <Button variant="secondary" onClick={onClose} disabled={busy}>
                            Cancel
                        </Button>
                        <Button variant="danger" onClick={onConfirm} disabled={!canConfirm || busy}>
                            {busy ? "Clearing…" : "Clear board"}
                        </Button>
                    </div>
                </>
            ) : (
                <p className={styles.ownerOnlyNote}>Only the board&apos;s owner can clear it.</p>
            )}
        </Modal>
    );
};

export default ClearBoardDialog;
