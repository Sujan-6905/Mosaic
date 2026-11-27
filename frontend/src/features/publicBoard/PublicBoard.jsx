import { useEffect, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import BrandTiles from "@/components/BrandTiles";
import Button from "@/components/ui/Button";
import StrokeIcon from "@/components/ui/StrokeIcon";
import useEmbedScene from "@/features/embed/useEmbedScene";
import useEmbedCamera from "@/features/embed/useEmbedCamera";
import styles from "./PublicBoard.module.css";

const STATES = {
    missing: { title: "This board doesn't exist", body: "The link may be mistyped, or the board was deleted.", icon: "frame" },
    error: { title: "This board couldn't load", body: "Check your connection, then reload the page.", icon: "frame" },
    signIn: { title: "This board is private", body: "Only the people its owner invited can open it. Sign in with one of those accounts.", icon: "lock" },
};

const BrandMark = () => (
    <Link href="/" className={styles.mark} aria-label="Mosaic home">
        <BrandTiles />
    </Link>
);

// A board shared by link, as someone with no account sees it: live, read-only, nothing to sign.
export default function PublicBoard({ shareId, onAuthClick }) {
    const { scene, elements, mode } = useEmbedScene({ shareId, token: null, via: "link" });
    const camera = useEmbedCamera({ elements, background: scene.background });
    const state = STATES[scene.status];

    // A private board can only be opened by signing in, so the sign-in comes up once, at once.
    const promptedSignIn = useRef(false);
    useEffect(() => {
        if (scene.status !== "signIn" || promptedSignIn.current) return;
        promptedSignIn.current = true;
        onAuthClick?.("login");
    }, [scene.status, onAuthClick]);

    if (scene.status === "loading") return <main id="main" className={styles.shell} aria-busy="true" />;

    if (state) {
        return (
            <main id="main" className={`${styles.shell} ${styles.dotted}`}>
                <section className={styles.card} aria-labelledby="publicBoardState">
                    <span className={styles.stateIcon}>
                        <StrokeIcon name={state.icon} size={24} />
                    </span>
                    <h1 id="publicBoardState" className={styles.stateTitle}>
                        {state.title}
                    </h1>
                    <p className={styles.stateBody}>{state.body}</p>
                    <div className={styles.stateActions}>
                        {scene.status === "signIn" ? (
                            <Button variant="primary" className={styles.pill} onClick={() => onAuthClick?.("login")}>
                                Sign in
                            </Button>
                        ) : (
                            <Button variant="primary" className={styles.pill} onClick={() => window.location.reload()}>
                                Try again
                            </Button>
                        )}
                        <Link href="/" className={styles.homeLink}>
                            About Mosaic
                        </Link>
                    </div>
                </section>
            </main>
        );
    }

    const title = scene.title || "Untitled board";
    return (
        <main id="main" className={styles.shell}>
            <Head>
                <title>{`${title} · Mosaic`}</title>
                <meta name="robots" content="noindex, nofollow" />
            </Head>
            <canvas ref={camera.canvasRef} className={styles.canvas} aria-label={`${title}, view only`} {...camera.handlers} />
            <header className={styles.bar}>
                <div className={styles.titlePill}>
                    <BrandMark />
                    <h1 className={styles.title}>{title}</h1>
                    <span className={styles.viewOnly} title="View only">
                        <StrokeIcon name="eye" size={14} />
                        <span className={styles.viewOnlyLabel}>View only</span>
                    </span>
                </div>
                <div className={styles.actionsPill}>
                    <button type="button" className={styles.textButton} onClick={() => onAuthClick?.("login")}>
                        Sign in
                    </button>
                    <button type="button" className={styles.primary} onClick={() => onAuthClick?.("register")}>
                        Create account
                    </button>
                </div>
            </header>
            <div className={styles.toolbar} role="toolbar" aria-label="View controls">
                <button type="button" className={styles.tool} onClick={camera.zoomOut} aria-label="Zoom out">
                    <StrokeIcon name="minus" size={16} />
                </button>
                <button type="button" className={styles.tool} onClick={camera.zoomIn} aria-label="Zoom in">
                    <StrokeIcon name="plus" size={16} />
                </button>
                <button type="button" className={styles.tool} onClick={camera.fit} aria-label="Fit to view">
                    <StrokeIcon name="fit" size={16} />
                </button>
            </div>
            {mode === "snapshot" && <p className={styles.note}>Many people are watching, so this view updates every 30 seconds.</p>}
        </main>
    );
}
