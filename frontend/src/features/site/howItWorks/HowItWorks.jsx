import { useRef } from "react";
import PageSeo from "../seo/PageSeo";
import { breadcrumbStructuredData } from "../seo/structuredData";
import Link from "next/link";

import SitePage from "../shell/SitePage";
import SiteNav from "../shell/SiteNav";
import SiteFooter from "../shell/SiteFooter";
import { CAPABILITIES, CAPABILITY_COUNT, SOURCE_URL, STACK } from "../siteContent";
import { riseHeadingsOnArrival, useSiteMotion } from "../shell/useSiteMotion";
import { BundleCard, EditBenchmarkCard, ElementFieldCard, FrameTimeCard, GOLD_TONES } from "./HowItWorksNumbers";
import TwoRooms from "./TwoRooms";
import StorageBenchmark from "./StorageBenchmark";
import ModelBenchmark from "./ModelBenchmark";
import styles from "./HowItWorks.module.css";
import DecisionExplorer from "./DecisionExplorer";

const NAV_LINKS = [
    { href: "#decisions", label: "Decisions" },
    { href: "#numbers", label: "Numbers" },
    { href: "#storage", label: "Storage" },
    { href: "#models", label: "Models" },
    { href: "#index", label: "Everything" },
];

const FOOTER_COLUMNS = [
    {
        heading: "On this page",
        links: [
            { href: "#decisions", label: "Nine choices" },
            { href: "#numbers", label: "Why it holds up" },
            { href: "#storage", label: "Where boards live" },
            { href: "#models", label: "Which models can draw" },
            { href: "#index", label: "Everything that shipped" },
        ],
    },
    {
        heading: "Mosaic",
        links: [
            { href: "/", label: "Home" },
            { href: "/docs", label: "Documentation" },
            { href: "/help", label: "Help and guides" },
            { href: "/pieces", label: "Pieces gallery" },
            { href: SOURCE_URL, label: "Source on GitHub" },
        ],
    },
];

const AREA_TONES = ["#ffd27a", "#9fd3ff", "#ffb3a7", "#b8e6b0", "#d9c2ff", "#ffd27a", "#9fd3ff", "#ffb3a7", "#b8e6b0"];

const animateHowItWorks = (tools) => {
    const { gsap } = tools;

    riseHeadingsOnArrival(tools);

    gsap.utils.toArray("[data-area]").forEach((area) => {
        gsap.from(area.querySelectorAll("li"), {
            y: 10,
            autoAlpha: 0,
            duration: 0.45,
            ease: "power2.out",
            stagger: 0.035,
            scrollTrigger: { trigger: area, start: "top 85%", once: true },
        });
    });

    // Scattered tiles scrub into one picture as the page closes: the name, in motion.
    gsap.from("[data-tile]", {
        x: () => gsap.utils.random(-260, 260),
        y: () => gsap.utils.random(-120, 120),
        rotate: () => gsap.utils.random(-70, 70),
        scale: 0.6,
        opacity: 0,
        ease: "power2.out",
        stagger: { amount: 0.25, from: "random" },
        scrollTrigger: { trigger: "[data-tiles]", start: "top 95%", end: "top 45%", scrub: 0.8 },
    });
};

const TILES = (() => {
    let seed = 41;
    const rand = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
    return Array.from({ length: 84 }, () => (rand() < 0.42 ? GOLD_TONES[Math.floor(rand() * GOLD_TONES.length)] : null));
})();

const Check = () => (
    <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M5 12l5 5L20 7" />
    </svg>
);

export default function HowItWorks({ isAuthenticated, onSignIn, onGetStarted }) {
    const rootRef = useRef(null);
    useSiteMotion(rootRef, animateHowItWorks);

    return (
        <SitePage>
            <PageSeo
                title="How it works · Mosaic"
                description="The engineering under Mosaic: conflict resolution for live multi-user editing, an infinite canvas priced by the viewport, an append-only history with replay and branches, and an AI assistant that never places anything itself."
                path="/about"
                structuredData={[breadcrumbStructuredData("/about", "How it works")]}
            />

            <div id="top" ref={rootRef}>
                <SiteNav links={NAV_LINKS} isAuthenticated={isAuthenticated} onSignIn={onSignIn} onStartDrawing={onGetStarted} />

                <main id="main">
                    <header className={styles.hero}>
                        <div className={styles.heroCopy}>
                            <p className={styles.eyebrow}>How it works</p>
                            <h1 className={styles.heroTitle} data-rise>
                                The interesting part <em className={styles.accentBlock}>is underneath.</em>
                            </h1>
                            <p className={styles.lede} data-rise style={{ "--rise-order": 1 }}>
                                Mosaic looks like a whiteboard. What makes it hold up as one is a set of deliberate decisions about state, conflict, and what to
                                compute where.
                            </p>
                        </div>
                        <dl className={styles.stack}>
                            {STACK.map((row, index) => (
                                <div key={row.label} className={styles.stackRow} data-rise style={{ "--rise-order": index + 2 }}>
                                    <dt>{row.label}</dt>
                                    <dd>{row.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </header>

                    <section id="decisions" className={`${styles.section} ${styles.fit}`}>
                        <h2 className={styles.sectionTitle} data-heading>
                            Nine choices that shaped it.
                        </h2>
                        <DecisionExplorer onSignIn={onSignIn} />
                    </section>

                    <section id="two-rooms" className={styles.section}>
                        <div className={styles.sectionHead}>
                            <p className={styles.eyebrow}>Try the conflict rule</p>
                            <h2 className={styles.sectionTitle} data-heading>
                                Two people move the same note. Who wins?
                            </h2>
                            <p className={styles.sectionLede}>
                                The server stamps every change to a shape with that shape&apos;s next version, and a screen only applies a version newer than
                                the one it holds, so both always end the same. Words typed inside a note merge instead, so two people typing keep both. Set the
                                lag on each side and race them.
                            </p>
                        </div>
                        <TwoRooms />
                    </section>

                    <section id="numbers" className={`${styles.section} ${styles.fit}`}>
                        <div className={styles.sectionHead}>
                            <p className={styles.eyebrow}>Why it holds up</p>
                            <h2 className={styles.sectionTitle} data-heading>
                                Built like a tool people keep open, not a demo that survives one click.
                            </h2>
                        </div>
                        <div className={styles.bento} role="group" aria-label="Measurements" tabIndex={0}>
                            <FrameTimeCard />
                            <ElementFieldCard />
                            <BundleCard />
                            <EditBenchmarkCard />
                            <div className={styles.method}>
                                <span>
                                    <strong>Frame time:</strong> same board and machine before and after, on integrated graphics at device pixel ratio 2.
                                </span>
                                <span>
                                    <strong>Board:</strong> seeded by the benchmark harness in this repository.
                                </span>
                                <span>
                                    <strong>Bundle:</strong> production build output for the home route.
                                </span>
                                <span>
                                    <strong>Edits:</strong> 54 instructions on four hand-built boards, graded on the result, in <code>benchmark/</code>.
                                </span>
                            </div>
                        </div>
                    </section>

                    <section id="storage" className={`${styles.section} ${styles.fit}`}>
                        <div className={styles.sectionHead}>
                            <p className={styles.eyebrow}>Where boards live</p>
                            <h2 className={styles.sectionTitle} data-heading>
                                Couchbase wins the one path a live board leans on. MongoDB wins the queries.
                            </h2>
                        </div>
                        <StorageBenchmark />
                    </section>

                    <section id="models" className={`${styles.section} ${styles.fit}`}>
                        <div className={styles.sectionHead}>
                            <p className={styles.eyebrow}>Which models can draw</p>
                            <h2 className={styles.sectionTitle} data-heading>
                                The model says what connects to what. The layout engine draws it, so small models keep up.
                            </h2>
                        </div>
                        <ModelBenchmark />
                    </section>

                    <section id="index" className={styles.section}>
                        <div className={styles.indexHead}>
                            <div className={styles.sectionHead}>
                                <p className={styles.eyebrow}>The full index</p>
                                <h2 className={styles.sectionTitle} data-heading>
                                    Everything that shipped.
                                </h2>
                            </div>
                            <p className={styles.indexCount}>
                                <strong>{CAPABILITY_COUNT}</strong> capabilities across <strong>{CAPABILITIES.length}</strong> areas
                            </p>
                        </div>
                        <div className={styles.indexGrid}>
                            {CAPABILITIES.map((group, index) => (
                                <section key={group.area} className={styles.area} data-area>
                                    <h3 className={styles.areaTitle}>
                                        <span style={{ background: AREA_TONES[index] }} />
                                        {group.area}
                                    </h3>
                                    <ul>
                                        {group.items.map((item) => (
                                            <li key={item}>
                                                <Check />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            ))}
                        </div>
                    </section>

                    <section className={styles.closing}>
                        <div className={styles.tiles} data-tiles aria-hidden="true">
                            {TILES.map((tone, index) => (
                                <span key={index} data-tile style={tone ? { background: tone } : undefined} />
                            ))}
                        </div>
                        <h2 className={styles.closingTitle} data-heading>
                            Independent pieces, <em className={styles.accent}>one image.</em>
                        </h2>
                        <p className={styles.lede}>That is what the name means, and the operation log is what lets you watch it assemble.</p>
                        {isAuthenticated ? (
                            <Link className={styles.cta} href="/">
                                Go to your boards
                            </Link>
                        ) : (
                            <button type="button" className={styles.cta} onClick={onGetStarted}>
                                Start drawing free
                            </button>
                        )}
                    </section>
                </main>

                <SiteFooter columns={FOOTER_COLUMNS} />
            </div>
        </SitePage>
    );
}
