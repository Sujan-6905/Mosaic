import { useState } from "react";
import cx from "clsx";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import styles from "./ImportDialog.module.css";

// Checks the file locally only to fail fast with a clear message; the server validates every element anyway.
const ImportDialog = ({ isOpen, onClose, canEdit, onImportNew, onImportMerge }) => {
    const [file, setFile] = useState(null);
    const [title, setTitle] = useState("");
    const [dragOver, setDragOver] = useState(false);
    const [busy, setBusy] = useState(false);

    const reset = () => {
        setFile(null);
        setTitle("");
        setDragOver(false);
        setBusy(false);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const pickFile = (nextFile) => {
        if (!nextFile) return;
        setFile(nextFile);
        setTitle(nextFile.name.replace(/\.mosaic$|\.json$/i, ""));
    };

    const runImport = async (action) => {
        setBusy(true);
        try {
            await action();
            reset();
            onClose();
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Import" size="sm">
            <label
                className={cx(styles.dropzone, { [styles.dragOver]: dragOver })}
                data-tour="import-drop"
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    pickFile(e.dataTransfer.files?.[0]);
                }}
            >
                <input type="file" accept=".mosaic,.json,application/json" className={styles.fileInput} onChange={(e) => pickFile(e.target.files?.[0])} />
                {file ? <span>{file.name}</span> : <span>Drag a .mosaic or .json scene file here, or click to choose one</span>}
            </label>

            {file && (
                <>
                    <div className={styles.titleRow}>
                        <Input placeholder="Board title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
                    </div>
                    <div className={styles.actions}>
                        <Button disabled={busy || !title.trim()} onClick={() => runImport(() => onImportNew(file, title.trim()))}>
                            Import into new board
                        </Button>
                        {canEdit && (
                            <Button variant="secondary" disabled={busy} onClick={() => runImport(() => onImportMerge(file))}>
                                Merge into this board
                            </Button>
                        )}
                    </div>
                </>
            )}
        </Modal>
    );
};

export default ImportDialog;
