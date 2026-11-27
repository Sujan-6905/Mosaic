import Link from "next/link";
import styles from "./SiteNav.module.css";

export default function SiteNav({ links, activeId, isAuthenticated, onSignIn, onStartDrawing }) {
    return (
        <nav className={styles.nav} aria-label="Primary">
            <Link className={styles.wordmark} href="/">
                Mosaic
            </Link>
            <div className={styles.links}>
                {links.map((link) =>
                    link.href.startsWith("#") ? (
                        <a key={link.href} href={link.href} data-active={activeId === link.href.slice(1)}>
                            {link.label}
                        </a>
                    ) : link.href.startsWith("http") ? (
                        <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
                            {link.label}
                        </a>
                    ) : (
                        <Link key={link.href} href={link.href}>
                            {link.label}
                        </Link>
                    ),
                )}
            </div>
            {isAuthenticated ? (
                <Link className={styles.start} href="/">
                    Your boards
                </Link>
            ) : (
                <>
                    <button type="button" className={styles.signIn} onClick={onSignIn}>
                        Sign in
                    </button>
                    <button type="button" className={styles.start} onClick={onStartDrawing} data-cursor="start">
                        Start drawing
                    </button>
                </>
            )}
        </nav>
    );
}
