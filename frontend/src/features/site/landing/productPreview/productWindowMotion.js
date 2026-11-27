// The window opens like an app from a Mac dock: the dock rises and the icon bounces on a clock, so a slow scroll
// can't stretch them, then the scroll-tied window pours up through a clip-path funnel narrowing toward the dock.

const FUNNEL_ROWS = 20;
const NARROWEST_WIDTH = 0.1;
const DOCK_CLEARANCE_PX = 16;
const REVERSE_SPEED = 2.2;

const smoothstep = (t) => t * t * (3 - 2 * t);

const funnelPolygon = (open) => {
    const left = [];
    const right = [];
    for (let row = 0; row <= FUNNEL_ROWS; row += 1) {
        const t = row / FUNNEL_ROWS;
        const widthAtRow = 1 - smoothstep(t) * (1 - NARROWEST_WIDTH) * (1 - open);
        const inset = ((1 - widthAtRow) / 2) * 100;
        left.push(`${inset.toFixed(2)}% ${(t * 100).toFixed(2)}%`);
        right.unshift(`${(100 - inset).toFixed(2)}% ${(t * 100).toFixed(2)}%`);
    }
    return `polygon(${[...left, ...right].join(",")})`;
};

// Waits until the hero's lifting edge has passed where the dock will rest, so the
// dock is never seen cut off by the hero, then brings it up from below the screen.
const launchDockOnArrival = ({ gsap, ScrollTrigger, track, dock }) => {
    const body = dock.querySelector("[data-launch-dock-body]");
    const icon = dock.querySelector("[data-launch-icon]");
    const runningDot = dock.querySelector("[data-launch-dot]");
    const distanceFromScreenBottom = () => body.offsetHeight + parseFloat(getComputedStyle(dock).bottom);

    gsap.set(body, { y: distanceFromScreenBottom() + DOCK_CLEARANCE_PX });
    const launch = gsap
        .timeline({ paused: true })
        .to(body, { y: 0, duration: 0.5, ease: "power3.out" })
        .to(icon, { y: -28, duration: 0.2, ease: "power2.out" }, "+=0.05")
        .to(icon, { y: 0, duration: 0.2, ease: "power2.in" })
        .to(icon, { y: -14, duration: 0.15, ease: "power2.out" })
        .to(icon, { y: 0, duration: 0.15, ease: "power2.in" })
        .from(runningDot, { autoAlpha: 0, duration: 0.2 }, "-=0.1");

    ScrollTrigger.create({
        trigger: track,
        start: () => `top+=${distanceFromScreenBottom() + DOCK_CLEARANCE_PX} top`,
        end: "max",
        onEnter: () => launch.timeScale(1).play(),
        onLeaveBack: () => launch.timeScale(REVERSE_SPEED).reverse(),
    });
};

export const animateProductWindow = ({ gsap, ScrollTrigger, root }) => {
    const track = root.querySelector("[data-preview-track]");
    if (!track) return;
    const win = track.querySelector("[data-window]");
    const dock = track.querySelector("[data-launch-dock]");
    const caption = track.querySelector("[data-preview-caption]");
    const part = (name) => track.querySelectorAll(`[data-part="${name}"]`);

    // A setter rather than onUpdate: ScrollTrigger can render with callbacks suppressed (a page already scrolled
    // past the track), and a clip that missed its last update would cut the open window off for good.
    let open = 0;
    const funnel = {
        get open() {
            return open;
        },
        set open(value) {
            open = value;
            win.style.clipPath = value >= 1 ? "none" : funnelPolygon(value);
        },
    };
    funnel.open = 0;

    const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: track, start: "top top", end: "bottom bottom", scrub: 0.6 },
    });

    launchDockOnArrival({ gsap, ScrollTrigger, track, dock });

    const windowOpensAt = 0.42;
    timeline
        .fromTo(
            win,
            { y: () => window.innerHeight * 0.42, scale: 0.1, rotateX: 22, autoAlpha: 0, transformOrigin: "50% 100%" },
            { y: 0, scale: 1, rotateX: 0, autoAlpha: 1, duration: 1.8, ease: "sine.inOut" },
            windowOpensAt,
        )
        .to(funnel, { open: 1, duration: 1.6, ease: "power2.in" }, windowOpensAt)
        .to(dock, { y: 120, autoAlpha: 0, duration: 0.5, ease: "power2.in" }, windowOpensAt + 1.25);

    // The board travels with the window, as an app's contents do. The live part
    // of the session arrives once it has settled: the assistant, then its proposal.
    const liveAt = windowOpensAt + 1.75;
    timeline
        .from(part("side"), { autoAlpha: 0, x: 40, duration: 0.45, ease: "power2.out", stagger: 0.14 }, liveAt)
        .from(part("flow"), { autoAlpha: 0, scale: 0.8, duration: 0.25, stagger: 0.05 }, liveAt + 0.35)
        .from(part("proposal"), { autoAlpha: 0, duration: 0.3 }, liveAt + 0.5)
        .from(part("selection"), { autoAlpha: 0, duration: 0.25 }, liveAt + 0.6)
        .from(part("cursor"), { autoAlpha: 0, x: -60, y: 40, duration: 0.5, ease: "power2.out", stagger: 0.1 }, liveAt + 0.6)
        .from(caption, { autoAlpha: 0, y: 12, duration: 0.3, ease: "power2.out" }, liveAt + 0.9)
        .to({}, { duration: 0.35 });
};
