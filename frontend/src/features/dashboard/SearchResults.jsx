import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import axiosInstance from "@/lib/axiosInstance";
import styles from "./index.module.css";

// Debounced: a query goes out 350ms after typing stops. `results` is null while there is no query.
export function useBoardSearch({ query, enabled, authHeaders, showToast }) {
    const [results, setResults] = useState(null);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        const trimmed = query.trim();
        if (!trimmed || !enabled) {
            setResults(null);
            return undefined;
        }
        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const { data } = await axiosInstance.get(`/api/search?q=${encodeURIComponent(trimmed)}`, authHeaders);
                setResults(data.results);
            } catch {
                showToast?.error("Search failed", "Try again in a moment.");
                setResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [query, enabled, authHeaders, showToast]);

    return { results, isSearching };
}

export default function SearchResults({ query, results }) {
    const router = useRouter();

    const open = (result) => {
        const params = new URLSearchParams({ shareId: result.shareId });
        if (result.match?.elementId) {
            params.set("focusElementId", result.match.elementId);
        } else if (result.match?.x != null && result.match?.y != null) {
            params.set("focusX", result.match.x);
            params.set("focusY", result.match.y);
        }
        router.push(`/?${params.toString()}`);
    };

    return (
        <section className={styles.results}>
            <div className={styles.titleRow}>
                <div>
                    <h1 className={styles.title}>Search</h1>
                    <p className={styles.subtitle}>
                        {results.length} board{results.length === 1 ? "" : "s"} mention &ldquo;{query.trim()}&rdquo;
                    </p>
                </div>
            </div>
            {results.length === 0 ? (
                <p className={styles.emptyGroup}>Nothing on your boards matches that. Try a word that would be written on one.</p>
            ) : (
                <ul className={styles.resultList}>
                    {results.map((result) => (
                        <li key={result.shareId}>
                            <button type="button" className={styles.result} onClick={() => open(result)}>
                                <strong>{result.title || "Untitled board"}</strong>
                                {result.match && (
                                    <span className={styles.snippet}>
                                        <span className={styles.sourceType}>{result.match.sourceType}</span>
                                        &ldquo;{result.match.text}&rdquo;
                                    </span>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
