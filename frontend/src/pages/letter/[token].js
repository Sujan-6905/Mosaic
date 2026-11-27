import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import LetterPlayer from "@/features/sharing/LetterPlayer";
import PuzzleLoader from "@/components/PuzzleLoader/PuzzleLoader";
import { onSiteSurface } from "@/features/site/howItWorks/liveDiagrams";
import styles from "./letter.module.css";

// A cover letter's public page: no account, no app chrome, just the letter and who sent it.
export default function LetterPage() {
    const { query, isReady } = useRouter();
    const [letter, setLetter] = useState(null);
    const [missing, setMissing] = useState(false);

    useEffect(() => {
        if (!isReady || !query.token) return;
        axiosInstance
            .get(`/api/letters/${encodeURIComponent(query.token)}`)
            .then(({ data }) => setLetter(data))
            .catch(() => setMissing(true));
    }, [isReady, query.token]);

    const frames = useMemo(() => letter?.reel.frames.map((frame) => ({ ...frame, elements: onSiteSurface(frame.elements) })) ?? [], [letter]);

    return (
        <div className={`site-theme ${styles.page}`}>
            <Head>
                <title>{letter ? `For ${letter.company} · Mosaic` : "A letter · Mosaic"}</title>
                <meta name="robots" content="noindex, nofollow" />
                <meta name="robots" content="noindex" />
            </Head>
            <header className={styles.header}>
                <Link href="/" className={styles.wordmark}>
                    Mosaic
                </Link>
            </header>
            <main id="main" className={styles.main}>
                {missing ? (
                    <div className={styles.missing}>
                        <h1>This letter isn&apos;t here any more.</h1>
                        <p>Its sender may have taken it back. Ask them for a fresh link.</p>
                    </div>
                ) : !letter ? (
                    <PuzzleLoader label="Opening the letter" />
                ) : frames.length < 2 ? (
                    <div className={styles.missing}>
                        <h1>Hello, {letter.company}.</h1>
                        <p>
                            {letter.from} sent you {letter.title}, but it has no history to play yet.
                        </p>
                    </div>
                ) : (
                    <>
                        <LetterPlayer letter={letter} frames={frames} />
                        <p className={styles.signature}>
                            From <strong>{letter.from}</strong>, drawn on Mosaic: {letter.title}. <Link href="/">Make a board of your own</Link>
                        </p>
                    </>
                )}
            </main>
        </div>
    );
}
