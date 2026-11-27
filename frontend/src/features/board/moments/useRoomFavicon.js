import { useEffect } from "react";

const SIZE = 64;
const EMPTY = "#2e333a";

const roomIcon = (colors) => {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const g = canvas.getContext("2d");
    g.fillStyle = "#15171b";
    g.beginPath();
    g.roundRect(0, 0, SIZE, SIZE, 14);
    g.fill();
    const tile = 23;
    const gap = 4;
    const start = (SIZE - tile * 2 - gap) / 2;
    for (let n = 0; n < 4; n += 1) {
        g.fillStyle = colors[n] ?? EMPTY;
        g.beginPath();
        g.roundRect(start + (n % 2) * (tile + gap), start + Math.floor(n / 2) * (tile + gap), tile, tile, 5);
        g.fill();
    }
    return canvas.toDataURL("image/png");
};

// The tab's four tiles become the people on this board, so a glance at the tab says who is here.
export function useRoomFavicon(participants) {
    const colors = participants
        .slice(0, 4)
        .map((person) => person.color)
        .join(",");

    useEffect(() => {
        const icons = [...document.querySelectorAll('link[rel="icon"]')];
        if (icons.length === 0) return undefined;
        const originals = icons.map((icon) => icon.href);
        const href = roomIcon(colors ? colors.split(",") : []);
        for (const icon of icons) icon.href = href;
        return () =>
            icons.forEach((icon, index) => {
                icon.href = originals[index];
            });
    }, [colors]);
}
