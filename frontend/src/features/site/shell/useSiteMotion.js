import { useEffect } from "react";
import { isCalm } from "@/lib/calmMode";

// Lenis and GSAP load dynamically, so neither ships in the first bundle or runs on the server. `setup` only runs
// without reduced motion, and GSAP's context undoes its work on cleanup.
export function useSiteMotion(rootRef, setup, enabled = true) {
    useEffect(() => {
        if (!enabled) return undefined;

        let cancelled = false;
        let frame = 0;
        let lenis = null;
        let context = null;

        (async () => {
            const [{ default: Lenis }, { default: gsap }, { ScrollTrigger }] = await Promise.all([
                import("lenis"),
                import("gsap"),
                import("gsap/ScrollTrigger"),
            ]);
            if (cancelled) return;

            if (isCalm()) return;

            gsap.registerPlugin(ScrollTrigger);
            lenis = new Lenis({
                duration: 1.1,
                smoothWheel: true,
                anchors: true,
                prevent: (node) => node.hasAttribute?.("data-lenis-prevent"),
            });
            const raf = (time) => {
                lenis?.raf(time);
                frame = requestAnimationFrame(raf);
            };
            frame = requestAnimationFrame(raf);
            lenis.on("scroll", ScrollTrigger.update);

            context = gsap.context(() => setup({ gsap, ScrollTrigger, root: rootRef.current }), rootRef);
            ScrollTrigger.refresh();
        })();

        return () => {
            cancelled = true;
            cancelAnimationFrame(frame);
            context?.revert();
            lenis?.destroy();
            lenis = null;
        };
        // setup is expected to be stable: a module-level function or a useCallback.
    }, [rootRef, setup, enabled]);
}

// Section headings rise as one piece on the way in. One already on screen stays
// put: hiding it now would blink it, since it has been showing since first paint.
export const riseHeadingsOnArrival = ({ gsap }) => {
    gsap.utils.toArray("[data-heading]").forEach((heading) => {
        if (heading.getBoundingClientRect().top < window.innerHeight) return;
        gsap.from(heading, { y: 18, autoAlpha: 0, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: heading, start: "top 88%", once: true } });
    });
};
