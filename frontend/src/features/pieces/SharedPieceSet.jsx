import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import StaticCanvasPreview from "@/features/board/rendering/StaticCanvasPreview";
import { piecesApi } from "@/features/board/pieces/piecesApi";
import styles from "./SharedPieceSet.module.css";

// What someone sees when a piece set is shared with them: the pieces, who made
// them, and one button that adds a copy to their own library.
export default function SharedPieceSet({ onAuthClick }) {
    const router = useRouter();
    const { setId } = router.query;
    const { data: session, status } = useSession();
    const [set, setSet] = useState(null);
    const [problem, setProblem] = useState(null);
    const [installing, setInstalling] = useState(false);
    const [installed, setInstalled] = useState(false);

    useEffect(() => {
        if (!setId || !session?.accessToken) return;
        piecesApi(session.accessToken)
            .shared(setId)
            .then(setSet)
            .catch((error) => setProblem(error?.response?.data?.message || "This piece set couldn't be opened."));
    }, [setId, session?.accessToken]);

    const install = async () => {
        setInstalling(true);
        try {
            await piecesApi(session.accessToken).install(setId);
            setInstalled(true);
        } catch (error) {
            setProblem(error?.response?.data?.message || "Installing didn't work. Try again.");
        } finally {
            setInstalling(false);
        }
    };

    return (
        <main className={styles.page} id="main">
            <Head>
                <title>{set ? `${set.title} · Mosaic pieces` : "Shared pieces · Mosaic"}</title>
                <meta name="robots" content="noindex, nofollow" />
            </Head>
            <Link href="/" className={styles.back}>
                Mosaic
            </Link>
            {status === "unauthenticated" && (
                <section className={styles.card}>
                    <h1 className={styles.title}>Sign in to see these pieces</h1>
                    <p className={styles.lede}>Someone shared a set of board pieces with you. Sign in to look through them and add them to your library.</p>
                    <button type="button" className={styles.primary} onClick={() => onAuthClick?.("login")}>
                        Sign in
                    </button>
                </section>
            )}
            {problem && (
                <section className={styles.card}>
                    <h1 className={styles.title}>{problem}</h1>
                    <Link href="/" className={styles.quiet}>
                        Go to your boards
                    </Link>
                </section>
            )}
            {set && !problem && (
                <section className={styles.card}>
                    <p className={styles.eyebrow}>Pieces shared by {set.ownerName}</p>
                    <h1 className={styles.title}>{set.title}</h1>
                    {set.description && <p className={styles.lede}>{set.description}</p>}
                    <div className={styles.actions}>
                        {installed ? (
                            <>
                                <span className={styles.done}>Added to your pieces. Open any board and press Shift P.</span>
                                <Link href="/" className={styles.quiet}>
                                    Go to your boards
                                </Link>
                            </>
                        ) : (
                            <button type="button" className={styles.primary} disabled={installing} onClick={install}>
                                {installing ? "Adding…" : `Add ${set.pieces.length} pieces to my library`}
                            </button>
                        )}
                    </div>
                    <ul className={styles.grid}>
                        {set.pieces.map((piece) => (
                            <li key={piece.id}>
                                <StaticCanvasPreview elements={piece.elements} width={320} height={200} className={styles.preview} />
                                <span>{piece.name}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </main>
    );
}
