import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import AssetSlot from "../stage/AssetSlot";
import { NAME_NOTE } from "../siteContent";
import styles from "./SiteFooter.module.css";

// Each letter carries a `--lit` value the pointer writes as it passes, lighting the word like the strip above it.
function FooterWordmark() {
    const word = useRef(null);

    useEffect(() => {
        const element = word.current;
        if (!window.matchMedia("(pointer: fine)").matches) return undefined;

        const letters = Array.from(element.children);
        let frame = 0;
        let x = 0;
        let y = 0;

        const write = () => {
            frame = 0;
            for (const letter of letters) {
                const box = letter.getBoundingClientRect();
                const offX = (x - (box.left + box.width / 2)) / box.width;
                const offY = (y - (box.top + box.height / 2)) / box.height;
                const reach = Math.hypot(offX, offY * 0.8);
                letter.style.setProperty("--lit", Math.max(0, 1 - reach / 1.35).toFixed(3));
            }
        };

        const onMove = (event) => {
            x = event.clientX;
            y = event.clientY;
            if (!frame) frame = requestAnimationFrame(write);
        };

        const onLeave = () => {
            for (const letter of letters) letter.style.setProperty("--lit", "0");
        };

        element.addEventListener("pointermove", onMove);
        element.addEventListener("pointerleave", onLeave);
        return () => {
            cancelAnimationFrame(frame);
            element.removeEventListener("pointermove", onMove);
            element.removeEventListener("pointerleave", onLeave);
        };
    }, []);

    return (
        <p ref={word} className={styles.wordmarkGiant} aria-hidden="true">
            {"Mosaic".split("").map((letter, index) => (
                <span key={`${letter}${index}`} className={styles.letter}>
                    {letter}
                </span>
            ))}
        </p>
    );
}

function LocalClock() {
    const [now, setNow] = useState(null);

    // Empty until mounted: a server-rendered clock would be in the wrong
    // timezone and fail hydration.
    useEffect(() => {
        const tick = () => setNow(new Date());
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, []);

    return <span className={styles.clockValue}>{now ? now.toLocaleTimeString(undefined, { hour12: false }) : "--:--:--"}</span>;
}

function FooterLink({ link }) {
    if (link.href.startsWith("/")) return <Link href={link.href}>{link.label}</Link>;
    const external = link.href.startsWith("http");
    return (
        <a href={link.href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
            {link.label}
        </a>
    );
}

export default function SiteFooter({ columns, onMonogramAsset }) {
    const monogram = useRef(null);
    const report = useRef(onMonogramAsset);
    report.current = onMonogramAsset;

    return (
        <footer className={styles.footer}>
            <div className={styles.top}>
                <AssetSlot
                    kind="monogram"
                    className={styles.monogramStage}
                    onAsset={(asset) => {
                        monogram.current = asset;
                        report.current?.(asset);
                    }}
                    onClick={() => monogram.current?.burst?.()}
                    hitClassName={styles.assetHit}
                    hitLabel="Scatter the monogram"
                    data-cursor="shatter"
                    fallback={<span className={styles.monogramFallback}>M</span>}
                />
                <div className={styles.columns}>
                    {columns.map((column) => (
                        <div key={column.heading} className={styles.column}>
                            <h3 className={styles.heading}>{column.heading}</h3>
                            {column.links.map((link) => (
                                <FooterLink key={link.label} link={link} />
                            ))}
                        </div>
                    ))}
                    <div className={styles.nameNote}>
                        <h3 className={styles.heading}>{NAME_NOTE.heading}</h3>
                        <p>{NAME_NOTE.body}</p>
                    </div>
                </div>
            </div>

            <div className={styles.strip} aria-hidden="true">
                {Array.from({ length: 48 }, (_unused, index) => (
                    <span key={index} data-tone={index % 7 === 3 ? "deep" : index % 11 === 5 ? "gold" : undefined} />
                ))}
            </div>

            <FooterWordmark />

            <div className={styles.bar}>
                <span className={styles.wordmark}>Mosaic</span>
                <span>
                    Your local time <LocalClock />
                </span>
                <a href="#top" data-cursor="top">
                    Back to the top
                </a>
            </div>
        </footer>
    );
}
