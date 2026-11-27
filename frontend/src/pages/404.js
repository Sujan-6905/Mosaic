import PageSeo from "@/features/site/seo/PageSeo";
import Link from "next/link";
import { useState } from "react";
import StrayTile from "@/features/site/notFound/StrayTile";
import styles from "./404.module.css";

export default function NotFound() {
    const [mended, setMended] = useState(false);
    return (
        <div className={`site-theme ${styles.page}`}>
            <PageSeo title="Page not found · Mosaic" noindex />
            <header className={styles.header}>
                <Link href="/" className={styles.wordmark}>
                    Mosaic
                </Link>
            </header>
            <main id="main" className={styles.main}>
                <StrayTile onHome={() => setMended(true)} />
                <div className={styles.copy}>
                    <p className={styles.code}>404</p>
                    <h1 className={styles.title} aria-live="polite">
                        This tile <em>{mended ? "is home." : "is missing."}</em>
                    </h1>
                    <p className={styles.body}>
                        {mended
                            ? "That one was easy to put back. The page you asked for still isn't here, though: if someone sent you a board link, it may have been deleted, or you may need to be invited to it."
                            : "The page you asked for isn't here. If someone sent you a board link, it may have been deleted, or you may need to be invited to it. The tile, at least, you can put back."}
                    </p>
                    <div className={styles.actions}>
                        <Link href="/" className={styles.primary}>
                            Back to home
                        </Link>
                        <Link href="/dashboard" className={styles.secondary}>
                            Open all boards
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
