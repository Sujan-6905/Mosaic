import Link from "next/link";
import AssetSlot from "../stage/AssetSlot";
import { CAPABILITY_COUNT, CHAPTERS, EXTRAS } from "../siteContent";
import Figure from "./Figure";
import styles from "./Chapters.module.css";

const trackPointer = (event) => {
    const card = event.target.closest?.("[data-chapter]");
    if (!card) return;
    const bounds = card.getBoundingClientRect();
    card.style.setProperty("--glow-x", `${event.clientX - bounds.left}px`);
    card.style.setProperty("--glow-y", `${event.clientY - bounds.top}px`);
};

// The tour's chapter cards, each a 3D piece with a flat figure where WebGL is unavailable, then the smaller extras.
export default function LandingChapters({ onAsset }) {
    return (
        <section id="tour" className={styles.chapters}>
            <h2 className={styles.chaptersTitle} data-heading>
                Six things a board does <em className={styles.accent}>that paper can&apos;t.</em>
            </h2>
            <div className={styles.chapterGrid} data-chapter-grid onPointerMove={trackPointer}>
                {CHAPTERS.map((chapter) => (
                    <article key={chapter.id} id={chapter.id} className={styles.chapter} data-chapter>
                        <AssetSlot
                            kind={chapter.asset}
                            className={styles.chapterStage}
                            onAsset={onAsset(chapter.asset)}
                            fallback={<Figure kind={chapter.figure} />}
                        />
                        <div className={styles.chapterText}>
                            <p className={styles.kicker}>{chapter.kicker}</p>
                            <h3 className={styles.chapterTitle}>{chapter.title}</h3>
                            <p className={styles.chapterBody}>{chapter.body}</p>
                        </div>
                    </article>
                ))}
            </div>
            <div className={styles.extras} data-extras>
                {EXTRAS.map((extra) => (
                    <span key={extra} className={styles.chip} data-chip>
                        {extra}
                    </span>
                ))}
                <Link href="/about#index" className={styles.allLink} data-chip>
                    All {CAPABILITY_COUNT} capabilities on How it works
                </Link>
            </div>
        </section>
    );
}
