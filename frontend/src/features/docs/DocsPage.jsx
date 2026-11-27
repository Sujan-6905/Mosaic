import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import BrandTiles from "@/components/BrandTiles";
import { useTheme } from "@/theme/ThemeProvider";
import PageSeo from "@/features/site/seo/PageSeo";
import { breadcrumbStructuredData } from "@/features/site/seo/structuredData";
import { SOURCE_URL } from "@/features/site/siteContent";
import { ARTICLES } from "./articles";
import { DOC_SECTIONS, docNeighbours, docTitle, docsPath, findDocPage } from "./docsNavigation";
import DocsSearch from "./DocsSearch";
import ReadingTiles from "./ReadingTiles";
import styles from "./DocsPage.module.css";

const Icon = ({ d }) => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d={d} />
    </svg>
);

const ICONS = {
    search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-3.5-3.5",
    sun: "M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
    moon: "M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z",
    menu: "M3 6h18M3 12h18M3 18h18",
    close: "M18 6L6 18M6 6l12 12",
};

// The h2s an article renders become the "On this page" list, highlighted as each one scrolls past.
function useArticleOutline(articleRef) {
    const [outline, setOutline] = useState([]);
    const [current, setCurrent] = useState(null);

    useLayoutEffect(() => {
        const headings = [...(articleRef.current?.querySelectorAll("h2[id]") ?? [])];
        setOutline(headings.map((heading) => ({ id: heading.id, title: heading.textContent.replace(/^#/, "") })));
        setCurrent(headings[0]?.id ?? null);
        if (!headings.length) return undefined;
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setCurrent(visible[0].target.id);
            },
            { rootMargin: "-80px 0px -65% 0px" },
        );
        headings.forEach((heading) => observer.observe(heading));
        return () => observer.disconnect();
    }, [articleRef]);

    return { outline, current };
}

function Sidebar({ slug, onNavigate }) {
    return (
        <nav className={styles.nav} aria-label="Documentation">
            {DOC_SECTIONS.map((section) => (
                <div key={section.title} className={styles.navSection}>
                    <p className={styles.navTitle}>{section.title}</p>
                    <ul>
                        {section.pages.map((page) => (
                            <li key={page.slug}>
                                <Link
                                    href={docsPath(page.slug)}
                                    className={styles.navLink}
                                    aria-current={page.slug === slug ? "page" : undefined}
                                    onClick={onNavigate}
                                >
                                    {page.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </nav>
    );
}

export default function DocsPage({ slug, onAuthClick }) {
    const { theme, setTheme } = useTheme();
    const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
    const page = findDocPage(slug);
    const Article = ARTICLES[slug];
    const { previous, next } = docNeighbours(slug);
    const articleRef = useRef(null);
    const { outline, current } = useArticleOutline(articleRef);
    const [searching, setSearching] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const onKeyDown = (event) => {
            const typing = event.target.closest?.("input, textarea, [contenteditable]");
            if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") || (event.key === "/" && !typing)) {
                event.preventDefault();
                setSearching(true);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    return (
        <div className={styles.docs}>
            <PageSeo
                title={docTitle(page)}
                description={page.summary}
                path={docsPath(slug)}
                structuredData={[breadcrumbStructuredData(docsPath(slug), slug ? page.title : "Documentation")]}
            />

            <header className={styles.top}>
                <div className={styles.topInner}>
                    <button type="button" className={styles.menuButton} aria-label="Open the docs menu" onClick={() => setMenuOpen(true)}>
                        <Icon d={ICONS.menu} />
                    </button>
                    <Link href="/docs" className={styles.brand}>
                        <BrandTiles />
                        <span className={styles.brandName}>Mosaic</span>
                        <span className={styles.brandTag}>Docs</span>
                    </Link>
                    <button type="button" className={styles.searchButton} onClick={() => setSearching(true)}>
                        <Icon d={ICONS.search} />
                        <span>Search</span>
                        <kbd>Ctrl K</kbd>
                    </button>
                    <nav className={styles.topLinks} aria-label="Site">
                        <Link href="/about">How it works</Link>
                        <a href={SOURCE_URL} target="_blank" rel="noreferrer">
                            GitHub
                        </a>
                    </nav>
                    <button
                        type="button"
                        className={`${styles.iconButton} ${styles.themeButton}`}
                        aria-label="Switch between light and dark"
                        onClick={toggleTheme}
                    >
                        <span className={styles.toDark}>
                            <Icon d={ICONS.moon} />
                        </span>
                        <span className={styles.toLight}>
                            <Icon d={ICONS.sun} />
                        </span>
                    </button>
                    <Link href="/" className={styles.openApp}>
                        Open Mosaic
                    </Link>
                </div>
                <ReadingTiles />
            </header>

            <div className={styles.layout}>
                <aside className={styles.sidebar}>
                    <Sidebar slug={slug} />
                </aside>

                <main id="main" className={styles.main}>
                    <article ref={articleRef} className={styles.article}>
                        <p className={styles.eyebrow}>{page.section}</p>
                        <h1 className={styles.title}>{slug ? page.title : "Mosaic documentation"}</h1>
                        <p className={styles.lede}>{page.summary}</p>
                        <Article onSignIn={() => onAuthClick?.("login")} />
                    </article>

                    <nav className={styles.pager} aria-label="Next and previous pages">
                        {previous ? (
                            <Link href={docsPath(previous.slug)} className={styles.pagerLink}>
                                <span>Previous</span>
                                {previous.title}
                            </Link>
                        ) : (
                            <span />
                        )}
                        {next && (
                            <Link href={docsPath(next.slug)} className={styles.pagerLink} data-next>
                                <span>Next</span>
                                {next.title}
                            </Link>
                        )}
                    </nav>
                </main>

                <aside className={styles.toc} aria-label="On this page">
                    {outline.length > 0 && (
                        <>
                            <p className={styles.tocTitle}>On this page</p>
                            <ul>
                                {outline.map((heading) => (
                                    <li key={heading.id}>
                                        <a href={`#${heading.id}`} aria-current={heading.id === current ? "location" : undefined}>
                                            {heading.title}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </aside>
            </div>

            {menuOpen && (
                <div className={styles.drawerScrim} onMouseDown={(event) => event.target === event.currentTarget && setMenuOpen(false)}>
                    <div className={styles.drawer} role="dialog" aria-modal="true" aria-label="Docs menu">
                        <button type="button" className={styles.iconButton} aria-label="Close the docs menu" onClick={() => setMenuOpen(false)}>
                            <Icon d={ICONS.close} />
                        </button>
                        <Sidebar slug={slug} onNavigate={() => setMenuOpen(false)} />
                    </div>
                </div>
            )}

            <DocsSearch open={searching} onClose={() => setSearching(false)} />
        </div>
    );
}
