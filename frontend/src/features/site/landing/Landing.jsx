import { useCallback, useEffect, useRef, useState } from "react";
import PageSeo from "../seo/PageSeo";
import { SITE_TITLE } from "../seo/siteMetadata";
import { homeStructuredData } from "../seo/structuredData";
import Link from "next/link";
import dynamic from "next/dynamic";

import Preloader from "./Preloader";
import TheWall from "./TheWall";
import SitePage from "../shell/SitePage";
import SiteNav from "../shell/SiteNav";
import SiteFooter from "../shell/SiteFooter";
import ProductPreview from "./productPreview/ProductPreview";
import AssetSlot from "../stage/AssetSlot";
import { CHAPTERS, HERO, SOURCE_URL } from "../siteContent";
import LandingChapters from "./LandingChapters";
import { animateProductWindow } from "./productPreview/productWindowMotion";
import { riseHeadingsOnArrival, useSiteMotion } from "../shell/useSiteMotion";
import OneMinuteTour from "./OneMinuteTour";
import styles from "./Landing.module.css";

// Only ever used once the visitor has reached the last section, and useless
// without a pointer, so it stays out of the first bundle.
const ScratchPad = dynamic(() => import("./ScratchPad"), { ssr: false });

const SECRET = "mosaic";

const NAV_LINKS = [
    { href: "#product", label: "Product" },
    { href: "#tour", label: "Tour" },
    { href: "/about", label: "How it works" },
    { href: "/docs", label: "Docs" },
    { href: SOURCE_URL, label: "GitHub" },
];

const FOOTER_COLUMNS = [
    {
        heading: "The tour",
        links: CHAPTERS.map((chapter) => ({ href: `#${chapter.id}`, label: chapter.kicker })),
    },
    {
        heading: "The project",
        links: [
            { href: "/about", label: "How it works" },
            { href: "/docs", label: "Documentation" },
            { href: "/help", label: "Help and guides" },
            { href: "/pieces", label: "Pieces gallery" },
            { href: SOURCE_URL, label: "Source on GitHub" },
        ],
    },
];

const SCRATCH_PROMPTS = [
    "This section is a whiteboard. Drag anywhere on it.",
    "That is one stroke. A board is just more of them.",
    "Now imagine three other cursors doing that.",
    "You have the idea. Make it a real board.",
];

const ArrowIcon = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
);

const animateLanding = (tools) => {
    const { gsap } = tools;

    animateProductWindow(tools);
    riseHeadingsOnArrival(tools);

    gsap.from("[data-chapter]", {
        y: 44,
        autoAlpha: 0,
        duration: 1,
        ease: "power3.out",
        stagger: 0.12,
        scrollTrigger: { trigger: "[data-chapter-grid]", start: "top 80%", once: true },
    });

    gsap.from("[data-chip]", {
        y: 12,
        scale: 0.92,
        autoAlpha: 0,
        duration: 0.5,
        ease: "power3.out",
        stagger: 0.05,
        scrollTrigger: { trigger: "[data-extras]", start: "top 92%", once: true },
    });

    gsap.from("[data-closing-rise]", {
        y: 20,
        autoAlpha: 0,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: { trigger: "[data-closing]", start: "top 65%", once: true },
    });
};

export default function Landing({ onGetStarted, onSignIn }) {
    const [progress, setProgress] = useState(0);
    const [loaderDone, setLoaderDone] = useState(false);
    const [activeSection, setActiveSection] = useState(null);
    const [strokes, setStrokes] = useState(0);
    const [secretFound, setSecretFound] = useState(false);
    const [touring, setTouring] = useState(false);
    const [knocking, setKnocking] = useState(false);

    const rootRef = useRef(null);
    const knockTimer = useRef(null);
    const assets = useRef({});

    const holdAsset = useCallback(
        (kind) => (asset) => {
            assets.current[kind] = asset;
        },
        [],
    );

    // The modal opens only once the door has reassembled, so it never covers the knock animation.
    const knock = useCallback(() => {
        if (knockTimer.current) return;
        assets.current.portal?.burst?.();
        setKnocking(true);
        knockTimer.current = setTimeout(() => {
            knockTimer.current = null;
            setKnocking(false);
            onGetStarted?.();
        }, 1450);
    }, [onGetStarted]);

    useEffect(() => () => clearTimeout(knockTimer.current), []);

    // A page with no WebGL still has to leave the preloader.
    const handleStageState = useCallback((next) => {
        if (next.unavailable) setProgress(1);
    }, []);

    // Type is what the preloader waits on; the 3D assets arrive as their
    // sections come near, so arriving late looks intentional.
    useEffect(() => {
        let cancelled = false;
        if (typeof document === "undefined" || !document.fonts) return undefined;
        document.fonts.ready.then(() => {
            if (!cancelled) setProgress(1);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    // Nothing on this page is worth holding someone behind a counter for more
    // than a few seconds, however slow the network turns out to be.
    useEffect(() => {
        const timer = setTimeout(() => setProgress(1), 6000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) setActiveSection(entry.target.dataset.navSection);
                }
            },
            { rootMargin: "-45% 0px -45% 0px" },
        );
        document.querySelectorAll("[data-nav-section]").forEach((section) => observer.observe(section));
        return () => observer.disconnect();
    }, []);

    // Type the product's name anywhere on the page and every mosaic on it
    // comes apart at once.
    useEffect(() => {
        let typed = "";
        const onKeyDown = (event) => {
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            if (event.key.length !== 1) return;
            typed = (typed + event.key.toLowerCase()).slice(-SECRET.length);
            if (typed !== SECRET) return;
            setSecretFound(true);
            for (const asset of Object.values(assets.current)) asset?.burst?.();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    useEffect(() => {
        if (!secretFound) return undefined;
        const timer = setTimeout(() => setSecretFound(false), 5200);
        return () => clearTimeout(timer);
    }, [secretFound]);

    useSiteMotion(rootRef, animateLanding, loaderDone);

    return (
        <SitePage onStageState={handleStageState}>
            <PageSeo title={SITE_TITLE} path="/" structuredData={[homeStructuredData()]} />

            {!loaderDone && <Preloader progress={progress} onComplete={() => setLoaderDone(true)} />}

            <div ref={rootRef} id="top">
                <SiteNav links={NAV_LINKS} activeId={activeSection} onSignIn={onSignIn} onStartDrawing={onGetStarted} />

                <main id="main">
                    <header className={styles.hero} data-rise-held={!loaderDone || undefined}>
                        <p className={styles.eyebrow} data-rise style={{ "--rise-order": 0 }}>
                            {HERO.eyebrow}
                        </p>
                        <h1 className={styles.heroTitle} data-rise style={{ "--rise-order": 1 }}>
                            {HERO.title} <em className={styles.accent}>{HERO.accent}</em>
                        </h1>
                        <p className={styles.lede} data-rise style={{ "--rise-order": 2 }}>
                            {HERO.lede}
                        </p>
                        <button type="button" className={styles.primaryCta} onClick={onGetStarted} data-cursor="start" data-rise style={{ "--rise-order": 3 }}>
                            Start drawing free
                            <ArrowIcon />
                        </button>
                        <button type="button" className={styles.tourCue} onClick={() => setTouring(true)} data-rise style={{ "--rise-order": 3 }}>
                            Or take the one-minute tour
                        </button>
                        <a className={styles.scrollCue} href="#product" data-rise style={{ "--rise-order": 4 }}>
                            See it open
                            <span aria-hidden="true" />
                        </a>
                    </header>

                    <ProductPreview />

                    <LandingChapters onAsset={holdAsset} />

                    <TheWall />
                    {touring && <OneMinuteTour onFinish={() => setTouring(false)} />}

                    <section className={styles.closing} aria-label="Try it" data-closing>
                        <ScratchPad className={styles.scratch} onStroke={() => setStrokes((count) => count + 1)} />

                        <div className={styles.closingInner}>
                            <div className={styles.closingCopy}>
                                <p className={styles.eyebrow} data-closing-rise>
                                    End of the tour
                                </p>
                                <h2 className={styles.closingTitle} data-heading>
                                    Open a board.
                                    <em className={styles.closingAccent}>Fill it together.</em>
                                </h2>
                                <p className={styles.closingText} data-closing-rise>
                                    Free to use, nothing to install, and it works in any modern browser. Bring four people and watch the cursors show up.
                                </p>
                                <div className={styles.closingActions} data-closing-rise>
                                    <button type="button" className={styles.primaryCta} onClick={onGetStarted} data-cursor="create">
                                        Create your first board
                                        <ArrowIcon />
                                    </button>
                                    <button type="button" className={styles.outlineCta} onClick={onSignIn}>
                                        I already have an account
                                    </button>
                                </div>
                                <p className={styles.scratchPrompt} data-lit={strokes > 0} data-closing-rise>
                                    <span className={styles.scratchCount}>{String(strokes).padStart(2, "0")}</span>
                                    {SCRATCH_PROMPTS[Math.min(strokes, SCRATCH_PROMPTS.length - 1)]}
                                </p>
                            </div>

                            <div className={styles.portalWrap}>
                                <AssetSlot
                                    kind="portal"
                                    className={styles.portalStage}
                                    onAsset={holdAsset("portal")}
                                    onClick={knock}
                                    hitClassName={styles.assetHit}
                                    hitLabel="Knock on the door to sign up"
                                    data-cursor="knock"
                                    fallback={<span className={styles.portalFallback} />}
                                />
                                <span className={styles.portalHint} data-knocking={knocking}>
                                    {knocking ? "Someone is opening it" : "Knock."}
                                </span>
                            </div>
                        </div>
                    </section>
                </main>

                <SiteFooter columns={FOOTER_COLUMNS} onMonogramAsset={holdAsset("monogram")} />
            </div>

            <p className={styles.secret} data-found={secretFound} role="status">
                You found the tesserae. They put themselves back.
            </p>
        </SitePage>
    );
}
