import { useEffect, useRef } from "react";
import styles from "./LaunchDock.module.css";

const Squircle = ({ fill }) => <rect x="2" y="2" width="60" height="60" rx="14" fill={fill} />;

const FilesIcon = () => (
    <>
        <defs>
            <linearGradient id="dock-files" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#7fd4ff" />
                <stop offset="1" stopColor="#1f7ff0" />
            </linearGradient>
            <linearGradient id="dock-files-front" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="1" stopColor="#cfe6ff" />
            </linearGradient>
        </defs>
        <Squircle fill="url(#dock-files)" />
        <path d="M13 21a3 3 0 013-3h10l4 4h18a3 3 0 013 3v4H13z" fill="#d6ecff" opacity="0.75" />
        <rect x="13" y="26" width="38" height="22" rx="3.5" fill="url(#dock-files-front)" />
    </>
);

const BrowserIcon = () => (
    <>
        <defs>
            <linearGradient id="dock-browser-rim" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="1" stopColor="#d5dbe3" />
            </linearGradient>
            <linearGradient id="dock-browser-face" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#33c6fb" />
                <stop offset="1" stopColor="#1668ee" />
            </linearGradient>
        </defs>
        <Squircle fill="url(#dock-browser-rim)" />
        <circle cx="32" cy="32" r="23" fill="url(#dock-browser-face)" />
        <circle cx="32" cy="32" r="20" fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="2" strokeDasharray="1.2 4.04" />
        <path d="M44 20L35 35 29 29z" fill="#ff4238" />
        <path d="M20 44L29 29 35 35z" fill="#ffffff" />
    </>
);

const MessagesIcon = () => (
    <>
        <defs>
            <linearGradient id="dock-messages" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#74ef84" />
                <stop offset="1" stopColor="#0fb93a" />
            </linearGradient>
        </defs>
        <Squircle fill="url(#dock-messages)" />
        <path
            d="M32 14c-11.6 0-21 7.4-21 16.5 0 5.6 3.6 10.6 9 13.6-.5 2.3-1.8 4.6-3.6 6.2 4 .1 7.6-1.5 10.2-4 1.8.4 3.6.7 5.4.7 11.6 0 21-7.4 21-16.5S43.6 14 32 14z"
            fill="#ffffff"
        />
    </>
);

const MailIcon = () => (
    <>
        <defs>
            <linearGradient id="dock-mail" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#6ccbff" />
                <stop offset="1" stopColor="#0c74f2" />
            </linearGradient>
        </defs>
        <Squircle fill="url(#dock-mail)" />
        <rect x="11" y="18" width="42" height="29" rx="4" fill="#ffffff" />
        <path d="M12.5 20.500L32 35l19.5-14.5" fill="none" stroke="#9cc4ee" strokeWidth="2.2" strokeLinejoin="round" />
    </>
);

const TerminalIcon = () => (
    <>
        <defs>
            <linearGradient id="dock-terminal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#40444c" />
                <stop offset="1" stopColor="#1b1d21" />
            </linearGradient>
        </defs>
        <Squircle fill="url(#dock-terminal)" />
        <path d="M15 22l11 9-11 9" fill="none" stroke="#e8eaed" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M30 42h17" stroke="#e8eaed" strokeWidth="3.4" strokeLinecap="round" />
    </>
);

const CalendarIcon = () => (
    <>
        <Squircle fill="#fbfbfd" />
        <path d="M2 21V16A14 14 0 0116 2h32a14 14 0 0114 14v5z" fill="#ff3b30" />
        <text x="32" y="16.5" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffffff" fontFamily="system-ui, sans-serif">
            OCT
        </text>
        <text x="32" y="50" textAnchor="middle" fontSize="28" fontWeight="500" fill="#1d1d1f" fontFamily="system-ui, sans-serif">
            17
        </text>
    </>
);

const NotesIcon = () => (
    <>
        <defs>
            <linearGradient id="dock-notes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffe066" />
                <stop offset="1" stopColor="#ffc107" />
            </linearGradient>
        </defs>
        <Squircle fill="#fdfcf6" />
        <path d="M2 20V16A14 14 0 0116 2h32a14 14 0 0114 14v4z" fill="url(#dock-notes)" />
        <path d="M11 30h42M11 39h42M11 48h26" stroke="#c9c7bc" strokeWidth="1.8" strokeLinecap="round" />
    </>
);

const MusicIcon = () => (
    <>
        <defs>
            <linearGradient id="dock-music" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ff6d86" />
                <stop offset="1" stopColor="#f5203c" />
            </linearGradient>
        </defs>
        <Squircle fill="url(#dock-music)" />
        <path d="M26 44V21l20-4.500V39" fill="none" stroke="#ffffff" strokeWidth="3.4" strokeLinejoin="round" />
        <ellipse cx="20.5" cy="44" rx="6.5" ry="5" fill="#ffffff" />
        <ellipse cx="40.5" cy="39.5" rx="6.5" ry="5" fill="#ffffff" />
    </>
);

const TrashIcon = () => (
    <>
        <defs>
            <linearGradient id="dock-trash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f4f5f7" stopOpacity="0.92" />
                <stop offset="1" stopColor="#aeb4bd" stopOpacity="0.82" />
            </linearGradient>
        </defs>
        <path d="M14 15h36l-3.5 41a3.5 3.5 0 01-3.5 3H21a3.5 3.5 0 01-3.5-3z" fill="url(#dock-trash)" />
        <ellipse cx="32" cy="15" rx="20" ry="5" fill="#e9ebef" stroke="#8a9099" strokeWidth="1" />
        <ellipse cx="32" cy="15" rx="15" ry="2.8" fill="#5d636c" />
        <path d="M24 24l1.5 29M32 24v29M40 24l-1.5 29" stroke="#7d838c" strokeOpacity="0.7" strokeWidth="1.6" strokeLinecap="round" />
    </>
);

const APPS_BEFORE_BROWSER = [
    { name: "Files", Icon: FilesIcon, running: true },
    { name: "Terminal", Icon: TerminalIcon, running: true },
    { name: "Messages", Icon: MessagesIcon, wide: true },
    { name: "Mail", Icon: MailIcon, wide: true },
];

const APPS_AFTER_BROWSER = [
    { name: "Calendar", Icon: CalendarIcon },
    { name: "Notes", Icon: NotesIcon, wide: true },
    { name: "Music", Icon: MusicIcon, wide: true },
];

const MAX_MAGNIFICATION = 0.55;
const MAGNIFICATION_REACH_PX = 140;
const MAGNIFICATION_EASE_PER_SECOND = 16;
const SETTLED_SCALE_DELTA = 0.001;
const LONGEST_FRAME_SECONDS = 0.05;

const magnificationAt = (distance) => {
    if (distance >= MAGNIFICATION_REACH_PX) return 0;
    return MAX_MAGNIFICATION * Math.cos((Math.PI / 2) * (distance / MAGNIFICATION_REACH_PX)) ** 2;
};

// Scale follows each icon's eased distance from the pointer, so moving along the dock is one continuous wave;
// the glass grows by what the icons gain and neighbours slide apart.
const useDockMagnification = (bodyRef) => {
    useEffect(() => {
        const body = bodyRef.current;
        if (!body || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return undefined;

        const items = [...body.children];
        const scales = items.map(() => 1);
        let centres = [];
        let widths = [];
        let pointerX = null;
        let frame = 0;
        let lastFrameAt = 0;

        const renderFrame = (now) => {
            const seconds = Math.min((now - lastFrameAt) / 1000, LONGEST_FRAME_SECONDS);
            lastFrameAt = now;
            const blend = 1 - Math.exp(-MAGNIFICATION_EASE_PER_SECOND * seconds);

            let settled = true;
            let totalGrowth = 0;
            items.forEach((item, index) => {
                const canScale = item.hasAttribute("data-name");
                const target = pointerX !== null && canScale ? 1 + magnificationAt(Math.abs(pointerX - centres[index])) : 1;
                scales[index] += (target - scales[index]) * blend;
                if (Math.abs(target - scales[index]) > SETTLED_SCALE_DELTA) settled = false;
                else scales[index] = target;
                totalGrowth += widths[index] * (scales[index] - 1);
            });

            let leftEdge = -totalGrowth / 2;
            items.forEach((item, index) => {
                const growth = widths[index] * (scales[index] - 1);
                item.style.transform = `translate3d(${(leftEdge + growth / 2).toFixed(2)}px, 0, 0) scale(${scales[index].toFixed(4)})`;
                item.style.setProperty("--app-scale", scales[index].toFixed(4));
                leftEdge += growth;
            });
            body.style.setProperty("--dock-growth", `${totalGrowth.toFixed(2)}px`);

            frame = settled ? 0 : requestAnimationFrame(renderFrame);
        };

        const wake = () => {
            if (frame) return;
            lastFrameAt = performance.now();
            frame = requestAnimationFrame(renderFrame);
        };
        const trackPointer = (event) => {
            pointerX = event.clientX - body.getBoundingClientRect().left;
            wake();
        };
        const measure = (event) => {
            centres = items.map((item) => item.offsetLeft + item.offsetWidth / 2);
            widths = items.map((item) => item.offsetWidth);
            trackPointer(event);
        };
        const release = () => {
            pointerX = null;
            wake();
        };

        body.addEventListener("pointerenter", measure);
        body.addEventListener("pointermove", trackPointer);
        body.addEventListener("pointerleave", release);
        return () => {
            cancelAnimationFrame(frame);
            body.removeEventListener("pointerenter", measure);
            body.removeEventListener("pointermove", trackPointer);
            body.removeEventListener("pointerleave", release);
        };
    }, [bodyRef]);
};

const DockApp = ({ name, Icon, running, wide }) => (
    <span className={styles.launchApp} data-name={name} data-wide-only={wide || undefined}>
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <Icon />
        </svg>
        {running && <i className={styles.runningDot} />}
    </span>
);

// A desktop dock, drawn rather than screenshotted. Mosaic is a web app, so its window
// opens from the browser, which sits in the middle for the funnel to narrow onto.
export default function LaunchDock() {
    const bodyRef = useRef(null);
    useDockMagnification(bodyRef);

    return (
        <div className={styles.launchDock} data-launch-dock aria-hidden="true">
            <div className={styles.launchDockBody} ref={bodyRef} data-launch-dock-body>
                {APPS_BEFORE_BROWSER.map((app) => (
                    <DockApp key={app.name} {...app} />
                ))}
                <span className={styles.launchApp} data-name="Browser">
                    <svg viewBox="0 0 64 64" aria-hidden="true" data-launch-icon>
                        <BrowserIcon />
                    </svg>
                    <i className={styles.runningDot} data-launch-dot />
                </span>
                {APPS_AFTER_BROWSER.map((app) => (
                    <DockApp key={app.name} {...app} />
                ))}
                <span className={styles.dockDivider} />
                <DockApp name="Trash" Icon={TrashIcon} />
            </div>
        </div>
    );
}
