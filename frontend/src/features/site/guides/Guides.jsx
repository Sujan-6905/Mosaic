import Link from "next/link";
import { useRef } from "react";
import PageSeo from "../seo/PageSeo";
import { breadcrumbStructuredData, guidesStructuredData } from "../seo/structuredData";

import SitePage from "../shell/SitePage";
import SiteNav from "../shell/SiteNav";
import SiteFooter from "../shell/SiteFooter";
import { TOUR_TRACKS } from "@/features/tour/tourSteps";
import { HELP_GUIDE_ORDER, SOURCE_URL } from "../siteContent";
import { useSiteMotion } from "../shell/useSiteMotion";
import styles from "./Guides.module.css";

const GUIDES = HELP_GUIDE_ORDER.map((id) => ({ id, ...TOUR_TRACKS[id] }));

const FOOTER_COLUMNS = [
    { heading: "Guides", links: HELP_GUIDE_ORDER.slice(0, 4).map((id) => ({ href: `#${id}`, label: TOUR_TRACKS[id].label })) },
    {
        heading: "Mosaic",
        links: [
            { href: "/", label: "Home" },
            { href: "/about", label: "How it works" },
            { href: "/docs", label: "Documentation" },
            { href: "/pieces", label: "Pieces gallery" },
            { href: SOURCE_URL, label: "Source on GitHub" },
        ],
    },
];

const animateGuides = ({ gsap }) => {
    gsap.utils.toArray("[data-guide]").forEach((guide) => {
        gsap.from(guide.querySelectorAll("li"), {
            y: 14,
            autoAlpha: 0,
            duration: 0.55,
            ease: "power3.out",
            stagger: 0.05,
            scrollTrigger: { trigger: guide, start: "top 82%", once: true },
        });
    });
};

// The same words the in-board tutorials use, readable without opening a board.
export default function Guides({ isAuthenticated, onSignIn, onGetStarted }) {
    const rootRef = useRef(null);
    useSiteMotion(rootRef, animateGuides);

    return (
        <SitePage>
            <PageSeo
                title="Help and guides · Mosaic"
                description="How to draw, style tables, collaborate, run a workshop, use the AI assistant and diagram styles, and work with history, replay, branches, pieces, export and shortcuts in Mosaic."
                path="/help"
                structuredData={[breadcrumbStructuredData("/help", "Help and guides"), guidesStructuredData(GUIDES)]}
            />
            <div id="top" ref={rootRef}>
                <SiteNav
                    links={[
                        { href: "/", label: "Home" },
                        { href: "/about", label: "How it works" },
                        { href: "/docs", label: "Docs" },
                        { href: SOURCE_URL, label: "GitHub" },
                    ]}
                    isAuthenticated={isAuthenticated}
                    onSignIn={onSignIn}
                    onStartDrawing={onGetStarted}
                />
                <main id="main" className={styles.main}>
                    <header className={styles.hero}>
                        <h1 className={styles.title}>Help and guides</h1>
                        <p className={styles.lede}>
                            The essentials, one guide per topic. On a board, press Help for the same guides as guided tutorials that open the real panels and
                            walk you through them. For connecting AI agents, embeds, cover letters and everything else, read the{" "}
                            <Link href="/docs">documentation</Link>.
                        </p>
                    </header>
                    <div className={styles.layout}>
                        <nav className={styles.toc} aria-label="Guides">
                            {HELP_GUIDE_ORDER.map((id) => (
                                <a key={id} href={`#${id}`}>
                                    {TOUR_TRACKS[id].label}
                                </a>
                            ))}
                        </nav>
                        <div className={styles.guides}>
                            {HELP_GUIDE_ORDER.map((id) => (
                                <section key={id} id={id} className={styles.guide} data-guide>
                                    <h2 className={styles.guideTitle}>{TOUR_TRACKS[id].label}</h2>
                                    <ol className={styles.steps}>
                                        {TOUR_TRACKS[id].steps.map((step) => (
                                            <li key={step.id}>
                                                <h3>{step.title}</h3>
                                                <p>{step.body}</p>
                                                {step.tryIt && <p className={styles.tryIt}>{step.tryIt}</p>}
                                            </li>
                                        ))}
                                    </ol>
                                </section>
                            ))}
                        </div>
                    </div>
                </main>
                <SiteFooter columns={FOOTER_COLUMNS} />
            </div>
        </SitePage>
    );
}
