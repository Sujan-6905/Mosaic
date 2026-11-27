import { SOURCE_URL } from "@/features/site/siteContent";

const MARK = ["#.....#", "##...##", "#.#.#.#", "#..#..#", "#.....#", "#.....#", "#.....#"];
const GOLD = ["#ffb43c", "#f39515", "#e8a838", "#c97f14"];
const GROUND = "#24282e";
const TILE = 14;
const GAP = 3;
// Two tiles sit loose, the way the footer's monogram scatters when it is clicked.
const LOOSE = { "1,1": [5, -4, 14], "5,4": [-3, 4, -11] };

const markSvg = () => {
    const size = MARK.length * (TILE + GAP) + 8;
    const tiles = MARK.flatMap((row, y) =>
        [...row].map((cell, x) => {
            const [dx, dy, turn] = LOOSE[`${x},${y}`] ?? [0, 0, 0];
            const left = 4 + x * (TILE + GAP) + dx;
            const top = 4 + y * (TILE + GAP) + dy;
            const fill = cell === "#" ? GOLD[(x * 3 + y * 5) % GOLD.length] : GROUND;
            return `<rect x="${left}" y="${top}" width="${TILE}" height="${TILE}" rx="2.5" fill="${fill}" transform="rotate(${turn} ${left + TILE / 2} ${top + TILE / 2})"/>`;
        }),
    );
    return { size, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${tiles.join("")}</svg>` };
};

let signed = false;

// A note for whoever opens DevTools: the mark laid in tiles, who made it, and where to look next.
export function signConsole() {
    if (signed || typeof window === "undefined") return;
    signed = true;
    const { size, svg } = markSvg();
    console.info(
        "%c ",
        `font-size:1px;padding:${size / 2}px ${size / 2}px;background:url("data:image/svg+xml,${encodeURIComponent(svg)}") no-repeat center/contain`,
    );
    console.info(
        "%cMosaic%c  a whiteboard laid one tile at a time\n\n" +
            "%cYou opened the console, so here is the short version:\n" +
            "  every board keeps its whole history (open Replay and drag the scrubber),\n" +
            "  agents join a board through the MCP endpoint at /mcp,\n" +
            "  and on the home page, typing the name does something.\n\n" +
            `%cDocs ${window.location.origin}/docs   Source ${SOURCE_URL}`,
        "font:700 20px Georgia,serif;color:#ffb43c",
        "font:italic 13px Georgia,serif;color:#a4a7ae",
        "font:12px ui-monospace,monospace;color:#9a9da4;line-height:1.7",
        "font:12px ui-monospace,monospace;color:#c07d1c",
    );
}
