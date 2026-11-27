import { useMemo, useRef, useState } from "react";
import StrokeIcon from "@/components/ui/StrokeIcon";
import StaticCanvasPreview from "../rendering/StaticCanvasPreview";
import { STARTER_SETS } from "../../../../../shared/canvas/pieces/starterSets.js";
import { PIECE_DRAG_TYPE, PIECE_FILE_EXTENSION, EXCALIDRAW_LIBRARY_EXTENSION } from "./piecesApi";
import IconBrowser from "./IconBrowser";
import Tabs from "@/components/ui/Tabs";
import Select from "@/components/ui/Select";
import styles from "./PiecesPanel.module.css";

const PieceTile = ({ piece, onPlace, onRemove }) => (
    <li className={styles.tile}>
        <button
            type="button"
            className={styles.tileButton}
            draggable
            onDragStart={(e) => {
                e.dataTransfer.setData(PIECE_DRAG_TYPE, JSON.stringify(piece));
                e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => onPlace(piece)}
            aria-label={`Place ${piece.name}`}
            title="Click to place, or drag onto the board"
        >
            <StaticCanvasPreview elements={piece.elements} width={240} height={150} className={styles.preview} />
            <span className={styles.tileName}>{piece.name}</span>
        </button>
        {onRemove && (
            <button
                type="button"
                className={styles.tileRemove}
                aria-label={`Remove ${piece.name}`}
                title="Remove from this set"
                onClick={() => onRemove(piece)}
            >
                <StrokeIcon name="close" size={12} />
            </button>
        )}
    </li>
);

const LICENSES = [
    { value: "CC0-1.0", label: "CC0: anyone may use them, no credit needed" },
    { value: "CC-BY-4.0", label: "CC BY 4.0: anyone may use them with credit" },
    { value: "MIT", label: "MIT: anyone may use them, keep the notice" },
];

// Listing asks what others may do with the pieces before anyone can install them.
const GalleryListingForm = ({ set, onCancel, onList }) => {
    const [license, setLicense] = useState("CC-BY-4.0");
    const [tags, setTags] = useState("");
    return (
        <form
            className={styles.saveForm}
            onSubmit={(e) => {
                e.preventDefault();
                onList({
                    license,
                    tags: tags
                        .split(",")
                        .map((tag) => tag.trim().toLowerCase())
                        .filter(Boolean)
                        .slice(0, 5),
                });
            }}
        >
            <p className={styles.note}>List &quot;{set.title}&quot; in the public Pieces gallery. Anyone can see it there and add a copy.</p>
            <Select value={license} onChange={setLicense} options={LICENSES} ariaLabel="Licence" className="w-full" />
            <input
                className={styles.input}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Tags, separated by commas"
                maxLength={120}
                aria-label="Tags"
            />
            <div className={styles.row}>
                <button type="button" className={styles.quiet} onClick={onCancel}>
                    Cancel
                </button>
                <button type="submit" className={styles.primary}>
                    List it
                </button>
            </div>
        </form>
    );
};

const SetSection = ({ set, filter, pieces, onPlace }) => {
    const [open, setOpen] = useState(!set.kit);
    const [menuOpen, setMenuOpen] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [listing, setListing] = useState(false);
    const shown = set.pieces.filter((piece) => !filter || piece.name.toLowerCase().includes(filter));
    if (filter && shown.length === 0) return null;
    const own = !set.starter;
    const act = (action) => () => {
        setMenuOpen(false);
        action(set);
    };
    return (
        <section className={styles.set} aria-label={set.title}>
            {renaming ? (
                <form
                    className={styles.renameForm}
                    onSubmit={(e) => {
                        e.preventDefault();
                        const title = new FormData(e.currentTarget).get("title")?.toString().trim();
                        if (title) pieces.renameSet(set, title);
                        setRenaming(false);
                    }}
                >
                    <input
                        autoFocus
                        name="title"
                        defaultValue={set.title}
                        maxLength={60}
                        className={styles.input}
                        aria-label="Set name"
                        onKeyDown={(e) => e.key === "Escape" && setRenaming(false)}
                    />
                    <button type="submit" className={styles.quiet}>
                        Save
                    </button>
                </form>
            ) : listing ? (
                <GalleryListingForm
                    set={set}
                    onCancel={() => setListing(false)}
                    onList={async (choice) => (await pieces.listSet(set, choice)) && setListing(false)}
                />
            ) : confirmingDelete ? (
                <div className={styles.confirm} role="alertdialog" aria-label={`Delete ${set.title}?`}>
                    <span>
                        Delete &quot;{set.title}&quot; and its {set.pieces.length} pieces?
                    </span>
                    <button type="button" className={styles.quiet} onClick={() => setConfirmingDelete(false)}>
                        Keep
                    </button>
                    <button type="button" className={styles.danger} onClick={() => pieces.deleteSet(set)}>
                        Delete
                    </button>
                </div>
            ) : (
                <header className={styles.setHead}>
                    <button type="button" className={styles.setToggle} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
                        <StrokeIcon name="chevronDown" size={11} strokeWidth={3} />
                        <span className={styles.setTitle}>{set.title}</span>
                        <span className={styles.setCount}>{set.pieces.length}</span>
                        {set.listed ? <span className={styles.badge}>In gallery</span> : set.published && <span className={styles.badge}>Shared</span>}
                        {set.installedFrom && <span className={styles.badge}>Installed</span>}
                    </button>
                    {own && (
                        <div className={styles.setMenuWrap}>
                            <button
                                type="button"
                                className={styles.iconButton}
                                aria-label={`${set.title} options`}
                                aria-expanded={menuOpen}
                                onClick={() => setMenuOpen((value) => !value)}
                            >
                                <StrokeIcon name="more" size={16} />
                            </button>
                            {menuOpen && (
                                <div className={styles.setMenu} role="menu">
                                    <button type="button" role="menuitem" onClick={act(pieces.shareSet)}>
                                        {set.published ? "Copy share link" : "Share by link"}
                                    </button>
                                    {set.published && (
                                        <button type="button" role="menuitem" onClick={act(pieces.stopSharingSet)}>
                                            Stop sharing
                                        </button>
                                    )}
                                    {!set.installedFrom &&
                                        (set.listed ? (
                                            <button type="button" role="menuitem" onClick={act(pieces.unlistSet)}>
                                                Take out of the gallery
                                            </button>
                                        ) : (
                                            <button type="button" role="menuitem" onClick={act(() => setListing(true))}>
                                                List in the gallery
                                            </button>
                                        ))}
                                    <button type="button" role="menuitem" onClick={act(pieces.exportSet)}>
                                        Download as a file
                                    </button>
                                    <button type="button" role="menuitem" onClick={act(() => setRenaming(true))}>
                                        Rename
                                    </button>
                                    <button type="button" role="menuitem" data-danger onClick={act(() => setConfirmingDelete(true))}>
                                        Delete set
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </header>
            )}
            {open &&
                (shown.length > 0 ? (
                    <ul className={styles.grid}>
                        {shown.map((piece) => (
                            <PieceTile key={piece.id} piece={piece} onPlace={onPlace} onRemove={own ? (target) => pieces.removePiece(set, target) : null} />
                        ))}
                    </ul>
                ) : (
                    <p className={styles.note}>Nothing here yet. Select something on the board and save it as a piece.</p>
                ))}
        </section>
    );
};

// A library of ready-made board pieces: the starter sets, a person's own sets,
// and ones they've installed from someone else.
const PiecesPanel = ({ isOpen, onClose, pieces, canEdit, selectionCount, saving, setSaving }) => {
    const [filter, setFilter] = useState("");
    const [name, setName] = useState("");
    const [targetSetId, setTargetSetId] = useState("");
    const [link, setLink] = useState("");
    const [tab, setTab] = useState("pieces");
    const fileRef = useRef(null);
    const mine = useMemo(() => pieces.pieceSets ?? [], [pieces.pieceSets]);
    if (!isOpen) return null;
    const needle = filter.trim().toLowerCase();

    const save = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        if (await pieces.saveSelectionAsPiece(name.trim(), targetSetId || null)) {
            setSaving(false);
            setName("");
        }
    };

    return (
        <aside className={styles.panel} aria-label="Pieces" data-board-chrome>
            <header className={styles.header}>
                <h2 className={styles.title}>Pieces</h2>
                <button type="button" className={styles.iconButton} aria-label="Close pieces" onClick={onClose}>
                    <StrokeIcon name="close" size={16} />
                </button>
            </header>

            {canEdit &&
                (saving ? (
                    <form className={styles.saveForm} onSubmit={save}>
                        <input
                            autoFocus
                            className={styles.input}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Name this piece"
                            maxLength={60}
                            aria-label="Piece name"
                        />
                        <Select
                            ariaLabel="Save into"
                            className="w-full"
                            value={targetSetId}
                            onChange={setTargetSetId}
                            options={[
                                { value: "", label: "My pieces" },
                                ...mine.filter((set) => !set.installedFrom && set.title !== "My pieces").map((set) => ({ value: set._id, label: set.title })),
                            ]}
                        />
                        <div className={styles.row}>
                            <button type="button" className={styles.quiet} onClick={() => setSaving(false)}>
                                Cancel
                            </button>
                            <button type="submit" className={styles.primary} disabled={!name.trim()}>
                                Save piece
                            </button>
                        </div>
                    </form>
                ) : (
                    <button type="button" className={styles.primary} disabled={selectionCount === 0} onClick={() => setSaving(true)}>
                        <StrokeIcon name="plus" size={14} />
                        {selectionCount === 0
                            ? "Select something to save it as a piece"
                            : `Save ${selectionCount === 1 ? "this" : `these ${selectionCount}`} as a piece`}
                    </button>
                ))}

            <div className={styles.tabs}>
                <Tabs
                    tabs={[
                        { value: "pieces", label: "Pieces" },
                        { value: "icons", label: "Icons and logos" },
                    ]}
                    value={tab}
                    onChange={setTab}
                    ariaLabel="Library"
                />
            </div>

            {tab === "icons" ? (
                <IconBrowser onPlace={pieces.placePiece} />
            ) : (
                <>
                    <label className={styles.search}>
                        <StrokeIcon name="search" size={14} />
                        <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a piece" aria-label="Find a piece" />
                    </label>

                    <div className={styles.body}>
                        {mine.length > 0 && <p className={styles.group}>Yours</p>}
                        {mine.map((set) => (
                            <SetSection key={set._id} set={set} filter={needle} pieces={pieces} onPlace={pieces.placePiece} />
                        ))}
                        {pieces.pieceSets === null && <p className={styles.note}>Loading your pieces…</p>}
                        <p className={styles.group}>Starter sets</p>
                        {STARTER_SETS.filter((set) => !set.kit).map((set) => (
                            <SetSection key={set._id} set={set} filter={needle} pieces={pieces} onPlace={pieces.placePiece} />
                        ))}
                        <p className={styles.group}>Kits</p>
                        {STARTER_SETS.filter((set) => set.kit).map((set) => (
                            <SetSection key={set._id} set={set} filter={needle} pieces={pieces} onPlace={pieces.placePiece} />
                        ))}
                        <a className={styles.galleryLink} href="/pieces" target="_blank" rel="noopener noreferrer">
                            Browse sets other people have published
                        </a>
                    </div>
                </>
            )}

            <footer className={styles.footer}>
                <form
                    className={styles.install}
                    onSubmit={async (e) => {
                        e.preventDefault();
                        if (await pieces.installFromLink(link)) setLink("");
                    }}
                >
                    <input
                        className={styles.input}
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        placeholder="Paste a set's share link"
                        aria-label="Share link to install"
                    />
                    <button type="submit" className={styles.quiet} disabled={!link.trim()}>
                        Install
                    </button>
                </form>
                <button type="button" className={styles.quiet} onClick={() => fileRef.current?.click()}>
                    <StrokeIcon name="insert" size={13} />
                    Import a {PIECE_FILE_EXTENSION} or Excalidraw library
                </button>
                <input
                    ref={fileRef}
                    type="file"
                    accept={`${PIECE_FILE_EXTENSION},${EXCALIDRAW_LIBRARY_EXTENSION},application/json`}
                    hidden
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) pieces.importSetFile(file);
                        e.target.value = "";
                    }}
                />
            </footer>
        </aside>
    );
};

export default PiecesPanel;
