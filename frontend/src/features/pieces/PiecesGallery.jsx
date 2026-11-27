import { useEffect, useMemo, useState } from "react";
import PageSeo from "@/features/site/seo/PageSeo";
import Link from "next/link";
import { useSession } from "next-auth/react";
import axiosInstance from "@/lib/axiosInstance";
import { piecesApi } from "@/features/board/pieces/piecesApi";
import { PIECE_KITS } from "../../../../shared/canvas/pieces/kits/index.js";
import PieceSetCard from "./PieceSetCard";
import styles from "./PiecesGallery.module.css";

const SEARCH_DELAY_MS = 250;
// The public gallery: sets people have chosen to list, each a copy away from
// anyone's own library, plus the kits every board already has built in.
export default function PiecesGallery({ onAuthClick }) {
    const { data: session, status } = useSession();
    const [query, setQuery] = useState("");
    const [tag, setTag] = useState("");
    const [sort, setSort] = useState("popular");
    const [gallery, setGallery] = useState({ sets: [], tags: [], loading: true, failed: false });
    const [installState, setInstallState] = useState({});

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            axiosInstance
                .get("/api/pieces/gallery", { params: { q: query || undefined, tag: tag || undefined, sort }, signal: controller.signal })
                .then(({ data }) => setGallery({ sets: data.sets, tags: data.tags, loading: false, failed: false }))
                .catch((error) => {
                    if (error?.name !== "CanceledError") setGallery((current) => ({ ...current, loading: false, failed: true }));
                });
        }, SEARCH_DELAY_MS);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query, tag, sort]);

    const kits = useMemo(
        () =>
            PIECE_KITS.map((kit) => ({ ...kit, ownerName: "Mosaic", pieceCount: kit.pieces.length, tags: [], license: null, preview: kit.pieces.slice(0, 4) })),
        [],
    );

    const install = async (setId) => {
        if (status !== "authenticated") {
            onAuthClick?.("login");
            return;
        }
        setInstallState((current) => ({ ...current, [setId]: "adding" }));
        try {
            await piecesApi(session.accessToken).install(setId);
            setInstallState((current) => ({ ...current, [setId]: "added" }));
        } catch (error) {
            setInstallState((current) => ({ ...current, [setId]: error?.response?.data?.message || "Couldn't add it. Try again." }));
        }
    };

    const installButton = (set) => {
        const state = installState[set._id];
        if (state === "added") return <span className={styles.added}>In your pieces. Open a board and press Shift P.</span>;
        return (
            <div className={styles.cardActions}>
                <button type="button" className={styles.primary} disabled={state === "adding"} onClick={() => install(set._id)}>
                    {state === "adding" ? "Adding…" : "Add to my pieces"}
                </button>
                {state && state !== "adding" && <span className={styles.problem}>{state}</span>}
            </div>
        );
    };

    return (
        <main className={styles.page} id="main">
            <PageSeo
                title="Pieces gallery · Mosaic"
                description="Sets of ready-made whiteboard pieces made and shared by Mosaic people: diagram notations, cloud architecture parts, wireframe kits and more."
                path="/pieces"
            />
            <Link href="/" className={styles.back}>
                Mosaic
            </Link>
            <header className={styles.hero}>
                <p className={styles.eyebrow}>Pieces gallery</p>
                <h1 className={styles.title}>Ready-made parts for any board.</h1>
                <p className={styles.lede}>
                    Sets people have made and listed: notations, kits and templates you can add to your own library in one step. Your copy is yours to change.
                    To list a set of your own, open its menu in the Pieces panel on any board.
                </p>
            </header>

            <section className={styles.toolbar} aria-label="Find sets">
                <input
                    className={styles.search}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search sets"
                    aria-label="Search sets"
                />
                <div className={styles.sorts} role="group" aria-label="Order">
                    {[
                        ["popular", "Most installed"],
                        ["new", "Newest"],
                    ].map(([value, label]) => (
                        <button key={value} type="button" className={styles.chip} aria-pressed={sort === value} onClick={() => setSort(value)}>
                            {label}
                        </button>
                    ))}
                </div>
                {gallery.tags.length > 0 && (
                    <div className={styles.tagFilter} role="group" aria-label="Tags">
                        <button type="button" className={styles.chip} aria-pressed={!tag} onClick={() => setTag("")}>
                            All
                        </button>
                        {gallery.tags.map((name) => (
                            <button key={name} type="button" className={styles.chip} aria-pressed={tag === name} onClick={() => setTag(name)}>
                                {name}
                            </button>
                        ))}
                    </div>
                )}
            </section>

            <section aria-label="Listed sets" className={styles.section}>
                <h2 className={styles.sectionTitle}>From the community</h2>
                {gallery.failed && <p className={styles.note}>The gallery couldn&apos;t load. Try again in a moment.</p>}
                {!gallery.failed && !gallery.loading && gallery.sets.length === 0 && (
                    <p className={styles.note}>{query || tag ? "No listed sets match that yet." : "No sets are listed yet. Yours could be the first."}</p>
                )}
                <div className={styles.cards}>
                    {gallery.sets.map((set) => (
                        <PieceSetCard key={set._id} set={set} action={installButton(set)} />
                    ))}
                </div>
            </section>

            <section aria-label="Built-in kits" className={styles.section}>
                <h2 className={styles.sectionTitle}>Built into every board</h2>
                <p className={styles.note}>Open the Pieces panel (Shift P) on any board to use these. They need no install.</p>
                <div className={styles.cards}>
                    {kits.map((kit) => (
                        <PieceSetCard key={kit._id} set={kit} />
                    ))}
                </div>
            </section>
        </main>
    );
}
