import { useState } from "react";
import Link from "next/link";
import { docsPath } from "../docsNavigation";
import styles from "./primitives.module.css";

export function Section({ id, title, children }) {
    return (
        <section className={styles.section} aria-labelledby={id}>
            <h2 id={id} className={styles.heading}>
                <a href={`#${id}`} className={styles.anchor} aria-hidden="true" tabIndex={-1}>
                    #
                </a>
                {title}
            </h2>
            {children}
        </section>
    );
}

export function Steps({ children }) {
    return <ol className={styles.steps}>{children}</ol>;
}

export function Keys({ keys }) {
    return (
        <span className={styles.keys}>
            {keys.map((key, index) => (
                <kbd key={`${key}-${index}`}>{key}</kbd>
            ))}
        </span>
    );
}

const CALLOUT_LABELS = { note: "Note", tip: "Tip", careful: "Careful" };

export function Callout({ tone = "note", title, children }) {
    return (
        <aside className={styles.callout} data-tone={tone}>
            <p className={styles.calloutTitle}>{title ?? CALLOUT_LABELS[tone]}</p>
            <div className={styles.calloutBody}>{children}</div>
        </aside>
    );
}

export function CodeBlock({ code, label }) {
    const [copied, setCopied] = useState(false);
    const copy = () =>
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        });

    return (
        <figure className={styles.code}>
            <figcaption className={styles.codeBar}>
                <span>{label}</span>
                <button type="button" className={styles.copy} onClick={copy}>
                    {copied ? "Copied" : "Copy"}
                </button>
            </figcaption>
            <pre tabIndex={0} aria-label={label}>
                <code>{code}</code>
            </pre>
        </figure>
    );
}

// Links to other docs pages, as cards; `slug` names the page.
export function PageCards({ pages }) {
    return (
        <div className={styles.cards}>
            {pages.map((page) => (
                <Link key={page.slug} href={docsPath(page.slug)} className={styles.card}>
                    <span className={styles.cardTitle}>{page.title}</span>
                    <span className={styles.cardBody}>{page.summary}</span>
                </Link>
            ))}
        </div>
    );
}

export function DocLink({ slug, hash, children }) {
    return <Link href={`${docsPath(slug)}${hash ? `#${hash}` : ""}`}>{children}</Link>;
}
