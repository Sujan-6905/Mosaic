import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import styles from "./index.module.css";

export function CreateBoardDialog({ draft, onChange, onClose, onCreate, categories }) {
    return (
        <Modal
            isOpen={!!draft}
            onClose={onClose}
            title="New board"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={onCreate} disabled={!draft?.title.trim()}>
                        Create board
                    </Button>
                </>
            }
        >
            {draft && (
                <div className={styles.dialogFields}>
                    <Input
                        autoFocus
                        label="Name"
                        value={draft.title}
                        onChange={(event) => onChange({ ...draft, title: event.target.value })}
                        onKeyDown={(event) => event.key === "Enter" && onCreate()}
                        maxLength={100}
                    />
                    {categories.length > 0 && (
                        <div className={styles.dialogField}>
                            <span>Category</span>
                            <Select
                                ariaLabel="Category"
                                value={draft.categoryId}
                                onChange={(categoryId) => onChange({ ...draft, categoryId })}
                                options={[{ value: "", label: "No category" }, ...categories.map((c) => ({ value: c._id, label: c.name }))]}
                            />
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}

export function RenameBoardDialog({ draft, onChange, onClose, onRename }) {
    return (
        <Modal
            isOpen={!!draft}
            onClose={onClose}
            title="Rename board"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={onRename}>Rename</Button>
                </>
            }
        >
            {draft && (
                <Input
                    autoFocus
                    label="Name"
                    value={draft.title}
                    onChange={(event) => onChange({ ...draft, title: event.target.value })}
                    onKeyDown={(event) => event.key === "Enter" && onRename()}
                    maxLength={100}
                />
            )}
        </Modal>
    );
}

export function CategoryManager({ isOpen, onClose, sectionName, categories, toneFor, actions }) {
    const [newName, setNewName] = useState("");
    const [renaming, setRenaming] = useState(null);

    const add = async () => {
        const name = newName.trim();
        if (name && (await actions.create(name))) setNewName("");
    };
    const finishRename = () => {
        const { id, name } = renaming;
        setRenaming(null);
        if (name.trim()) actions.rename(id, name.trim());
    };
    const move = (category, index, direction) => {
        const other = categories[index + direction];
        if (other) actions.swap(category, other);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Categories in ${sectionName}`}>
            <div className={styles.manager}>
                <div className={styles.managerAdd}>
                    <Input
                        label="New category"
                        value={newName}
                        onChange={(event) => setNewName(event.target.value)}
                        onKeyDown={(event) => event.key === "Enter" && add()}
                        placeholder="Product, Rituals, Personal"
                    />
                    <Button variant="secondary" onClick={add} disabled={!newName.trim()}>
                        Add
                    </Button>
                </div>
                {categories.length === 0 ? (
                    <p className={styles.dialogText}>No categories yet. Boards stay uncategorised until you add one.</p>
                ) : (
                    <ul className={styles.managerList}>
                        {categories.map((category, index) => (
                            <li key={category._id}>
                                <span className={styles.dot} style={{ background: toneFor(index) }} />
                                {renaming?.id === category._id ? (
                                    <input
                                        autoFocus
                                        className={styles.inlineInput}
                                        value={renaming.name}
                                        aria-label={`Rename ${category.name}`}
                                        onChange={(event) => setRenaming({ id: category._id, name: event.target.value })}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") finishRename();
                                            if (event.key === "Escape") setRenaming(null);
                                        }}
                                        onBlur={finishRename}
                                    />
                                ) : (
                                    <span className={styles.managerName}>{category.name}</span>
                                )}
                                <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => move(category, index, -1)}>
                                    Up
                                </Button>
                                <Button size="sm" variant="ghost" disabled={index === categories.length - 1} onClick={() => move(category, index, 1)}>
                                    Down
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setRenaming({ id: category._id, name: category.name })}>
                                    Rename
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => actions.remove(category._id)}
                                    aria-label={`Delete ${category.name}; its boards become uncategorised`}
                                >
                                    Delete
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </Modal>
    );
}
