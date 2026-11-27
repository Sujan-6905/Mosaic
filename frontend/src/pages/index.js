import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { getServerSession } from "next-auth/next";
import useAppSession from "@/hooks/useAppSession";
import { authOptionsFor } from "./api/auth/[...nextauth]";

import PuzzleLoader from "@/components/PuzzleLoader/PuzzleLoader";
import Landing from "@/features/site/landing/Landing";
import PublicBoard from "@/features/publicBoard/PublicBoard";
import styles from "./index.module.css";

// A visit to `/` is either the landing page or a board, never both; splitting the board out keeps its engine
// off the landing page's first load.
const BoardWorkspace = dynamic(() => import("@/features/board/BoardWorkspace"), {
    ssr: false,
    loading: () => (
        <div className={styles.pageLoading}>
            <PuzzleLoader label="Loading board" />
        </div>
    ),
});
const HomePage = dynamic(() => import("@/features/home"), { ssr: false });

// The session is known while the page renders on the server, so a signed-out
// visitor's first HTML is the landing page itself, not a loading shell.
export async function getServerSideProps({ req, res }) {
    const session = await getServerSession(req, res, authOptionsFor(req));
    return { props: { session: session ? JSON.parse(JSON.stringify(session)) : null } };
}

export default function Home({ onAuthClick, showToast }) {
    const router = useRouter();
    const { status, isAuthenticated } = useAppSession();

    if (status === "loading") {
        return (
            <div className={`site-theme ${styles.bootShell}`} role="status" aria-label="Loading Mosaic">
                <div className={styles.bootTop}>
                    <span className={styles.bootMark}>Mosaic</span>
                    <span className={styles.bootLabel}>Assembling the canvas</span>
                </div>
                <span />
                <span className={styles.bootRule} aria-hidden="true" />
            </div>
        );
    }

    if (!isAuthenticated && router.query.shareId) {
        return <PublicBoard shareId={String(router.query.shareId)} onAuthClick={onAuthClick} />;
    }

    if (!isAuthenticated) {
        return <Landing onGetStarted={() => onAuthClick?.("register")} onSignIn={() => onAuthClick?.("login")} />;
    }

    if (router.query.shareId) {
        return <BoardWorkspace shareId={router.query.shareId} showToast={showToast} />;
    }

    return <HomePage showToast={showToast} />;
}
