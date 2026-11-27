// Line icons for the editor chrome, drawn as single stroked paths so every
// icon shares one weight.
const ICONS = {
    select: "M4 3l16 7-7 2.5L10 20z",
    hand: "M18 11V6a2 2 0 00-4 0v5M14 10V4a2 2 0 00-4 0v6M10 10.5V6a2 2 0 00-4 0v8a8 8 0 0016 0v-3a2 2 0 00-4 0",
    pencil: "M3 21l3-1 11-11-2-2L4 18zM14 6l2 2",
    eraser: "M20 20H8l-4-4 10-10 6 6-6 6M9 9l6 6",
    shapes: "M4 4h16v16H4z",
    sticky: "M5 4h14v10l-6 6H5zM13 20v-6h6",
    text: "M5 6V4h14v2M12 4v16M9 20h6",
    insert: "M12 5v14M5 12h14",
    comment: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
    sparkle: "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    undo: "M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3",
    redo: "M15 14l5-5-5-5M20 9H9a5 5 0 000 10h3",
    frame: "M4 8h16M8 4v16M4 4h16v16H4z",
    table: "M4 5h16v14H4zM4 10h16M4 15h16M10 5v14",
    timer: "M12 8v5l3 2M9 2h6M12 22a9 9 0 100-18 9 9 0 000 18z",
    vote: "M12 12m-5 0a5 5 0 1010 0 5 5 0 10-10 0",
    pause: "M8 5v14M16 5v14",
    resume: "M8 5l11 7-11 7z",
    connector: "M5 18a2 2 0 100-4 2 2 0 000 4zM19 10a2 2 0 100-4 2 2 0 000 4zM7 15c4-1 6-5 10-7",
    image: "M4 5h16v14H4zM4 15l5-5 5 5 2-2 4 4M15 9h.01",
    laser: "M12 12m-3 0a3 3 0 106 0 3 3 0 10-6 0M12 2v4M12 18v4M2 12h4M18 12h4",
    assist: "M4 20l4-4M8 4h8l4 4v8M4 12l8-8",
    bell: "M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0",
    history: "M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5M12 7v5l3 2",
    chevronDown: "M6 9l6 6 6-6",
    chevronUp: "M18 15l-6-6-6 6",
    chevronRight: "M9 6l6 6-6 6",
    chevronLeft: "M15 6l-6 6 6 6",
    close: "M6 6l12 12M18 6L6 18",
    lock: "M6 11h12v9H6zM9 11V8a3 3 0 016 0v3",
    eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z",
    inbox: "M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5",
    unlock: "M6 11h12v9H6zM9 11V8a3 3 0 015.8-1",
    duplicate: "M8 8h12v12H8zM4 16V4h12",
    align: "M4 4v16M8 8h10M8 16h6",
    arrange: "M4 8h10v10H4zM10 4h10v10",
    textAlignLeft: "M4 6h16M4 12h10M4 18h13",
    textAlignCenter: "M4 6h16M7 12h10M5.5 18h13",
    textAlignRight: "M4 6h16M10 12h10M7 18h13",
    grid: "M4 4h16v16H4zM4 10h16M4 16h16M10 4v16M16 4v16",
    map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
    fit: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
    crop: "M6 2v14a2 2 0 002 2h14M18 22V8a2 2 0 00-2-2H2",
    plus: "M12 5v14M5 12h14",
    search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-3.5-3.5",
    pieces: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM15.5 13.5l4 4M19.5 13.5l-4 4",
    minus: "M5 12h14",
    star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
    eyedropper: "M2 22l1-4 11-11 3 3-11 11zM14 4l2-2 6 6-2 2",
    trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
    check: "M5 12l5 5L20 7",
    export: "M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4",
    download: "M12 3v12M7 10l5 5 5-5M4 21h16",
    upload: "M12 15V3M7 8l5-5 5 5M4 21h16",
    play: "M12 21a9 9 0 100-18 9 9 0 000 18zM10 8l6 4-6 4z",
    circle: "M12 12m-9 0a9 9 0 1018 0 9 9 0 10-18 0",
    ellipse: "M12 12m-10 0a10 6.5 0 1020 0 10 6.5 0 10-20 0",
    triangle: "M12 3l10 18H2z",
    diamond: "M12 2.5L21.5 12 12 21.5 2.5 12z",
    arrow: "M5 12h14M13 6l6 6-6 6",
    line: "M5 19L19 5",
    lasso: "M12 4c5 0 9 2.5 9 6s-4 6-9 6c-1.5 0-3-.2-4.2-.7M7 15c-2.400-1-4-2.700-4-5 0-3.500 4-6 9-6M6 16a2 2 0 100 4 2 2 0 000-4zM8 20c.5 1 .2 2-.5 2",
    bucket: "M19 12L11 4 3.500 11.500a2 2 0 000 2.800l5.200 5.200a2 2 0 002.800 0zM5 12h14M21 16c.8 1.200 1.500 2.100 1.500 3a1.500 1.500 0 01-3 0c0-.9.7-1.800 1.500-3z",
    link: "M10 14a4 4 0 005.700 0l3-3a4 4 0 00-5.700-5.700l-1 1M14 10a4 4 0 00-5.700 0l-3 3A4 4 0 0011 18.700l1-1",
    embed: "M3 5h18v14H3zM3 9h18M8 13l-2 2 2 2M16 13l2 2-2 2",
    architecture: "M9 3h6v5H9zM3 16h6v5H3zM15 16h6v5h-6zM12 8v4M6 16v-4h12v4",
    code: "M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16",
    pin: "M9 3h6l-1 6 4 4v2H6v-2l4-4zM12 15v6",
    hexagon: "M7 3h10l5 9-5 9H7l-5-9z",
    pentagon: "M12 2.500l9.500 7-3.600 11.500H6.100L2.500 9.500z",
    parallelogram: "M6 5h16l-4 14H2z",
    trapezoid: "M6 5h12l4 14H2z",
    cylinder: "M4 6c0-1.700 3.600-3 8-3s8 1.300 8 3v12c0 1.700-3.600 3-8 3s-8-1.300-8-3zM4 6c0 1.700 3.600 3 8 3s8-1.300 8-3",
    document: "M3 4h18v14c-3-2.500-6 .5-9 1.500S5 20 3 18z",
    cloud: "M7 19a4.500 4.500 0 01-.8-8.900 6 6 0 0111.500-1A5 5 0 0117 19z",
    callout: "M4 4h16a1 1 0 011 1v10a1 1 0 01-1 1h-9l-5 5v-5H4a1 1 0 01-1-1V5a1 1 0 011-1z",
    blockArrow: "M2 8.500h11V4l9 8-9 8v-4.500H2z",
    cross: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6z",
    routeStraight: "M4 19L20 5",
    routeCurved: "M4 19C12 19 12 5 20 5",
    routeElbow: "M4 19h8V5h8",
    swap: "M7 8h13M7 8l4-4M7 8l4 4M17 16H4M17 16l-4-4M17 16l-4 4",
    openExternal: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5",
};

export default function StrokeIcon({ name, size = 17, strokeWidth = 2, className, fill = "none" }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={fill}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={className}
        >
            <path d={ICONS[name]} />
        </svg>
    );
}
