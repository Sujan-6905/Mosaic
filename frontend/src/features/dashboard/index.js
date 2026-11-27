import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import axiosInstance from "@/lib/axiosInstance";
import useAppSession from "@/hooks/useAppSession";
import AppHeader from "@/components/AppHeader";
import ShareAccessModal from "@/features/sharing/ShareAccessModal";
import Select from "@/components/ui/Select";
import TourOverlay from "@/features/tour/TourOverlay.jsx";
import { markTourCompleted } from "@/features/tour/tourCompletion";
import HelpMenu from "@/components/HelpMenu/index.jsx";
import { headerItemClick } from "@/store/headerSlice";
import { useRouter } from "next/router";
import BoardCard from "./BoardCard";
import SearchResults, { useBoardSearch } from "./SearchResults";
import SweptBoards from "./SweptBoards";
import { CategoryManager, CreateBoardDialog, RenameBoardDialog } from "./DashboardDialogs";
import useBoardLibrary from "./useBoardLibrary";
import styles from "./index.module.css";

const DASHBOARD_TOUR_TRACK_IDS = ["organisation"];
const CATEGORY_TONES = ["#ffd27a", "#9fd3ff", "#ffb3a7", "#b8e6b0", "#d9c2ff"];
const UNCATEGORIZED_KEY = "__uncategorized__";
const VIEW_KEY = "mosaic:boardsView";

const SECTIONS = [
    { id: "owned", label: "My boards" },
    { id: "shared", label: "Shared with me" },
    { id: "starred", label: "Starred" },
    { id: "swept", label: "Recently deleted" },
];

const SORTS = [
    { value: "edited", label: "Last edited" },
    { value: "created", label: "Date created" },
    { value: "name", label: "Name" },
];

const stampOf = (board, field) => new Date(board[field] || board.createdAt || 0).getTime();
const SORTERS = {
    edited: (left, right) => stampOf(right, "updatedAt") - stampOf(left, "updatedAt"),
    created: (left, right) => stampOf(right, "createdAt") - stampOf(left, "createdAt"),
    name: (left, right) => (left.title || "").localeCompare(right.title || ""),
};

const toneFor = (index) => CATEGORY_TONES[index % CATEGORY_TONES.length];

const PlusIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
    </svg>
);

const Dashboard = ({ showToast }) => {
    const router = useRouter();
    const dispatch = useDispatch();
    const { session, status, isAuthenticated } = useAppSession();
    const { actionHeaderItem } = useSelector((state) => state.header);
    const library = useBoardLibrary({ session, status, isAuthenticated, showToast });
    const { drawings, categoriesBySection, authHeaders } = library;

    const [section, setSection] = useState("owned");
    const [sort, setSort] = useState("edited");
    const [view, setView] = useState("grid");
    const [searchQuery, setSearchQuery] = useState("");
    // Home hands a search over here when it only matched titles.
    useEffect(() => {
        if (router.isReady && typeof router.query.q === "string") setSearchQuery(router.query.q);
    }, [router.isReady, router.query.q]);
    const { results: searchResults, isSearching } = useBoardSearch({ query: searchQuery, enabled: isAuthenticated, authHeaders, showToast });

    const [createDialog, setCreateDialog] = useState(null);
    const [renameDialog, setRenameDialog] = useState(null);
    const [shareDialog, setShareDialog] = useState(null);
    const [manageOpen, setManageOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [activeTourTrack, setActiveTourTrack] = useState(null);

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(VIEW_KEY);
            if (stored === "grid" || stored === "list") setView(stored);
        } catch {
            // A remembered view is a convenience; grid is fine without it.
        }
    }, []);

    const chooseView = (next) => {
        setView(next);
        try {
            window.localStorage.setItem(VIEW_KEY, next);
        } catch {
            // Same as above.
        }
    };

    // The global Help action lands here while this page is mounted.
    useEffect(() => {
        if (actionHeaderItem !== "Help") return;
        setHelpOpen(true);
        dispatch(headerItemClick(null));
    }, [actionHeaderItem, dispatch]);

    const categorySection = section === "shared" ? "shared" : "owned";
    const categories = categoriesBySection[categorySection];

    const createBoard = async () => {
        const title = createDialog.title.trim();
        if (!title) return;
        if (!(await library.createBoard({ title, categoryId: createDialog.categoryId }))) setCreateDialog(null);
    };

    const renameBoard = () => {
        const { board, title } = renameDialog;
        setRenameDialog(null);
        library.renameBoard(board, title.trim());
    };

    const ownedIds = useMemo(() => new Set(drawings.ownedDrawings.map((d) => d.shareId)), [drawings.ownedDrawings]);
    const starred = useMemo(() => [...drawings.ownedDrawings, ...drawings.sharedWithDrawings].filter((d) => d.favorite), [drawings]);
    const boardsBySection = { owned: drawings.ownedDrawings, shared: drawings.sharedWithDrawings, starred, swept: drawings.sweptDrawings };
    const sectionBoards = (section === "swept" ? [] : boardsBySection[section]).slice().sort(SORTERS[sort]);

    const groups =
        section === "starred"
            ? [{ key: "starred", name: "Starred", tone: "#ffb43c", boards: sectionBoards }]
            : [
                  ...categories.map((category, index) => ({
                      key: category._id,
                      categoryId: category._id,
                      name: category.name,
                      tone: toneFor(index),
                      boards: sectionBoards.filter((d) => d.categoryId === category._id),
                  })),
                  {
                      key: UNCATEGORIZED_KEY,
                      name: "Uncategorised",
                      tone: "var(--color-border-strong)",
                      boards: sectionBoards.filter((d) => !d.categoryId || !categories.some((c) => c._id === d.categoryId)),
                  },
              ].filter((group) => group.categoryId || group.boards.length > 0);

    const cardActions = {
        open: (event, board) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
            event.preventDefault();
            router.push(`/?shareId=${board.shareId}`);
        },
        share: (board, isOwner) => setShareDialog({ shareId: board.shareId, title: board.title, isOwner }),
        rename: (board) => setRenameDialog({ board, title: board.title || "" }),
        toggleStar: (board) => library.organize(board, { favorite: !board.favorite }, "Couldn't update starred"),
        move: (board, categoryId) => library.organize(board, { categoryId }, "Couldn't move the board"),
        sweep: library.sweepBoard,
        restore: library.restoreBoard,
        settle: library.settleSwept,
        loadReel: (board) => axiosInstance.get(`/api/drawing/${board.shareId}/replay/reel`, authHeaders).then(({ data }) => data),
    };

    const finishTour = () => {
        if (activeTourTrack && session?.user?.id) markTourCompleted(session.user.id, activeTourTrack);
        setActiveTourTrack(null);
    };

    const counts = Object.fromEntries(Object.entries(boardsBySection).map(([id, boards]) => [id, boards.length]));
    const sectionLabel = SECTIONS.find((s) => s.id === section).label;
    const namedCategoryCount = groups.filter((group) => group.categoryId).length;
    const loading = library.isLoading || status === "loading";
    const showCategories = section === "owned" || section === "shared";

    const renderBoards = (boards) => (
        <div className={view === "grid" ? styles.grid : styles.list}>
            {boards.map((board) => (
                <BoardCard
                    key={board.shareId}
                    board={board}
                    isOwner={ownedIds.has(board.shareId)}
                    view={view}
                    categories={categoriesBySection[ownedIds.has(board.shareId) ? "owned" : "shared"]}
                    actions={cardActions}
                />
            ))}
        </div>
    );

    return (
        <div className={styles.page}>
            <AppHeader
                crumbs={[{ label: "Home", href: "/" }, { label: "All boards" }]}
                search={{
                    value: searchQuery,
                    onChange: setSearchQuery,
                    placeholder: "Search titles and the words on boards",
                    label: "Search boards",
                    busy: isSearching,
                }}
            />

            <div className={styles.layout}>
                <aside className={styles.sidebar}>
                    <button type="button" className={styles.newBoard} onClick={() => setCreateDialog({ title: "Untitled board", categoryId: "" })}>
                        <PlusIcon />
                        New board
                    </button>
                    <nav aria-label="Board sections" className={styles.sections}>
                        {SECTIONS.map((item, index) => (
                            <button
                                key={item.id}
                                type="button"
                                className={styles.navItem}
                                data-rise
                                style={{ "--rise-order": index + 1 }}
                                aria-current={section === item.id ? "page" : undefined}
                                onClick={() => {
                                    setSection(item.id);
                                    setSearchQuery("");
                                }}
                                data-tour={item.id === "starred" ? "favourites-section" : undefined}
                            >
                                <span>{item.label}</span>
                                <span className={styles.navCount}>{loading ? "" : counts[item.id]}</span>
                            </button>
                        ))}
                    </nav>
                    {showCategories && (
                        <div className={styles.categories}>
                            <span className={styles.categoriesLabel}>Categories</span>
                            {categories.map((category, index) => (
                                <a key={category._id} href={`#category-${category._id}`} className={styles.navItem}>
                                    <span className={styles.dot} style={{ background: toneFor(index) }} />
                                    <span className={styles.navLabel}>{category.name}</span>
                                    <span className={styles.navCount}>{sectionBoards.filter((d) => d.categoryId === category._id).length}</span>
                                </a>
                            ))}
                            <button type="button" className={styles.manage} onClick={() => setManageOpen(true)} data-tour="manage-categories">
                                <PlusIcon />
                                Manage categories
                            </button>
                        </div>
                    )}
                </aside>

                <main id="main" className={styles.main} data-tour="dashboard-search">
                    {searchResults !== null ? (
                        <SearchResults query={searchQuery} results={searchResults} />
                    ) : section === "swept" ? (
                        <>
                            <div className={styles.titleRow}>
                                <div>
                                    <h1 className={styles.title}>{sectionLabel}</h1>
                                    <p className={styles.subtitle}>Put a board back, or let it go for good.</p>
                                </div>
                            </div>
                            <SweptBoards boards={drawings.sweptDrawings} onRestore={library.restoreBoard} onPurge={library.purgeBoard} />
                        </>
                    ) : (
                        <>
                            <div className={styles.titleRow}>
                                <div>
                                    <h1 className={styles.title}>{sectionLabel}</h1>
                                    <p className={styles.subtitle}>
                                        {loading
                                            ? "Loading"
                                            : `${sectionBoards.length} board${sectionBoards.length === 1 ? "" : "s"}${section === "starred" || namedCategoryCount === 0 ? "" : ` in ${namedCategoryCount} categor${namedCategoryCount === 1 ? "y" : "ies"}`}`}
                                    </p>
                                </div>
                                <div className={styles.controls}>
                                    <Select value={sort} onChange={setSort} options={SORTS} ariaLabel="Sort boards" />
                                    <span role="group" aria-label="View" className={styles.viewToggle}>
                                        <button type="button" aria-pressed={view === "grid"} aria-label="Grid view" onClick={() => chooseView("grid")}>
                                            <svg
                                                width="15"
                                                height="15"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                aria-hidden="true"
                                            >
                                                <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
                                            </svg>
                                        </button>
                                        <button type="button" aria-pressed={view === "list"} aria-label="List view" onClick={() => chooseView("list")}>
                                            <svg
                                                width="15"
                                                height="15"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                aria-hidden="true"
                                            >
                                                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                                            </svg>
                                        </button>
                                    </span>
                                </div>
                            </div>

                            {loading ? (
                                <div className={styles.grid}>
                                    {Array.from({ length: 4 }, (_unused, index) => (
                                        <span key={index} className={styles.skeleton} />
                                    ))}
                                </div>
                            ) : sectionBoards.length === 0 && groups.length === 0 ? (
                                <div className={styles.emptyGroup}>
                                    <span>
                                        {section === "owned"
                                            ? "No boards yet. Your first one is a click away."
                                            : section === "shared"
                                              ? "Nobody has shared a board with you yet. Boards you're invited to land here."
                                              : "Nothing starred. Star a board from its menu to keep it here."}
                                    </span>
                                    {section === "owned" && (
                                        <button
                                            type="button"
                                            className={styles.outline}
                                            onClick={() => setCreateDialog({ title: "Untitled board", categoryId: "" })}
                                        >
                                            New board
                                        </button>
                                    )}
                                </div>
                            ) : (
                                groups.map((group) => (
                                    <section key={group.key} id={group.categoryId ? `category-${group.categoryId}` : undefined} className={styles.group}>
                                        <h2 className={styles.groupTitle}>
                                            <span className={styles.dot} style={{ background: group.tone }} />
                                            {group.name}
                                            <span className={styles.groupCount}>{group.boards.length}</span>
                                        </h2>
                                        {group.boards.length > 0 ? (
                                            renderBoards(group.boards)
                                        ) : (
                                            <div className={styles.emptyGroup}>
                                                <span>Nothing here yet. Move a board in from its menu, or start one inside this category.</span>
                                                {section === "owned" && (
                                                    <button
                                                        type="button"
                                                        className={styles.outline}
                                                        onClick={() => setCreateDialog({ title: "Untitled board", categoryId: group.categoryId })}
                                                    >
                                                        New board in {group.name}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </section>
                                ))
                            )}
                        </>
                    )}
                </main>
            </div>

            <CreateBoardDialog
                draft={createDialog}
                onChange={setCreateDialog}
                onClose={() => setCreateDialog(null)}
                onCreate={createBoard}
                categories={categoriesBySection.owned}
            />
            <RenameBoardDialog draft={renameDialog} onChange={setRenameDialog} onClose={() => setRenameDialog(null)} onRename={renameBoard} />
            <CategoryManager
                isOpen={manageOpen}
                onClose={() => setManageOpen(false)}
                sectionName={categorySection === "owned" ? "My boards" : "Shared with me"}
                categories={categories}
                toneFor={toneFor}
                actions={{ ...library.categories, create: (name) => library.categories.create(categorySection, name) }}
            />

            <ShareAccessModal
                isOpen={!!shareDialog}
                onClose={() => setShareDialog(null)}
                shareId={shareDialog?.shareId}
                boardTitle={shareDialog?.title}
                isOwner={!!shareDialog?.isOwner}
                showToast={showToast}
                onCollaboratorsChange={library.updateCollaborators}
            />

            {activeTourTrack && <TourOverlay trackId={activeTourTrack} onFinish={finishTour} />}
            <HelpMenu
                isOpen={helpOpen}
                onClose={() => setHelpOpen(false)}
                tourTrackIds={DASHBOARD_TOUR_TRACK_IDS}
                onStartTour={(trackId) => {
                    setHelpOpen(false);
                    setActiveTourTrack(trackId);
                }}
            />
        </div>
    );
};

export default Dashboard;
