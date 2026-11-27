import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { DOC_PAGES, docsPath } from "./docsNavigation";
import styles from "./DocsSearch.module.css";

const matches = (page, needle) => `${page.title} ${page.summary} ${page.section}`.toLowerCase().includes(needle);

// Page search over titles and summaries; arrows move, Enter opens, Escape closes.
export default function DocsSearch({ open, onClose }) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(0);
    const inputRef = useRef(null);

    const results = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return needle ? DOC_PAGES.filter((page) => matches(page, needle)) : DOC_PAGES;
    }, [query]);

    useEffect(() => {
        if (!open) return;
        setQuery("");
        setActive(0);
        inputRef.current?.focus();
    }, [open]);

    if (!open) return null;

    const go = (page) => {
        onClose();
        router.push(docsPath(page.slug));
    };

    const onKeyDown = (event) => {
        if (event.key === "Escape") onClose();
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActive((current) => (current + step + results.length) % Math.max(results.length, 1));
        }
        if (event.key === "Enter" && results[active]) go(results[active]);
    };

    return (
        <div className={styles.overlay} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
            <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Search the docs">
                <input
                    ref={inputRef}
                    className={styles.input}
                    placeholder="Search the docs"
                    aria-label="Search the docs"
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setActive(0);
                    }}
                    onKeyDown={onKeyDown}
                />
                <ul className={styles.results} role="listbox" aria-label="Pages">
                    {results.map((page, index) => (
                        <li key={page.slug} role="option" aria-selected={index === active}>
                            <button
                                type="button"
                                className={styles.result}
                                data-active={index === active}
                                onMouseEnter={() => setActive(index)}
                                onClick={() => go(page)}
                            >
                                <span className={styles.resultSection}>{page.section}</span>
                                <span className={styles.resultTitle}>{page.title}</span>
                                <span className={styles.resultSummary}>{page.summary}</span>
                            </button>
                        </li>
                    ))}
                    {results.length === 0 && <li className={styles.empty}>No page matches that. Try a feature name, such as replay or agents.</li>}
                </ul>
            </div>
        </div>
    );
}
