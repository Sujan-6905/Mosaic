import { useState } from "react";
import styles from "./HiddenDetails.module.css";

// Each moment is a tile face down: where to look on the front, how to set it off on the back.
const MOMENTS = [
    {
        where: "Home page",
        name: "The wall",
        how: "Every visitor sets one stone of a picture nobody has seen yet. The picture picks the colour; you pick the spot.",
    },
    { where: "Home page", name: "Say the name", how: "Type the word mosaic anywhere on the home page and every 3D piece scatters, then puts itself back." },
    { where: "Home page footer", name: "The monogram", how: "Click the tiled M at the bottom of the page and it bursts apart, then reassembles on its own." },
    { where: "Home page", name: "Knock", how: "The doorway near the end of the page is a sign-up button. Knock on it and it opens." },
    {
        where: "Sign-up",
        name: "The guard dog",
        how: "As your password gets stronger, a guard dog is laid in stone beside it, as Roman houses set one at the door.",
    },
    {
        where: "Sign-in",
        name: "HAVE",
        how: "A wrong password knocks stones loose. The right one turns them to spell HAVE, the greeting set in a Pompeii doorway.",
    },
    {
        where: "Username",
        name: "Your tessera",
        how: "Your username becomes a mirrored tile of its own. It signs your cursor, your avatar and your place in the room.",
    },
    {
        where: "On a board",
        name: "Draw the sun",
        how: "Hold G and draw a sun to switch to the light theme, or a crescent moon for dark. The change sweeps out from your stroke.",
    },
    { where: "On a board", name: "Clink", how: "When two people's cursors meet, they touch with a small spark." },
    { where: "On a board", name: "Shake it loose", how: "Shake a shape quickly while dragging it and it comes free of the connectors holding it." },
    {
        where: "On a board",
        name: "The mend",
        how: "Lose the connection and the board greys to its grout lines. When it returns, a seam of gold crosses and it is current again.",
    },
    {
        where: "Waking the server",
        name: "The kiln",
        how: "If the server was asleep, a board opens on a drawing pad while it wakes. Whatever you draw there is on the board when it opens.",
    },
    { where: "Your home page", name: "Watch it made", how: "Hover a board card and its history plays. Move sideways across it to scrub through every change." },
    { where: "Browser tab", name: "The favicon", how: "On a board, the four tiles of the tab icon light for the people in the room." },
    { where: "Browser console", name: "A signature", how: "Open the developer console on any page for a note from whoever made Mosaic." },
    { where: "A missing page", name: "The stray tile", how: "On a page that doesn't exist, drag the loose tile back into its gap." },
    {
        where: "Profile",
        name: "Your wall",
        how: "A year of your work rises as a field of tiles, taller and more golden on busier days, with inlays for your firsts.",
    },
    {
        where: "Profile",
        name: "Ceramic sounds",
        how: "Turn them on for a clink when cursors meet, a knock when a stamp lands and three notes when a board passes a milestone.",
    },
    { where: "These docs", name: "The last tile", how: "The strip along the top of every page fills as you read. Reach the end and the last tile sets." },
];

export default function HiddenDetails() {
    const [turned, setTurned] = useState(() => new Set());
    const turn = (name) => setTurned((current) => new Set(current).add(name));

    return (
        <>
            <p className={styles.count} aria-live="polite">
                {turned.size === MOMENTS.length ? "You turned every tile." : `${turned.size} of ${MOMENTS.length} turned over`}
            </p>
            <ul className={styles.grid}>
                {MOMENTS.map((moment, index) => {
                    const open = turned.has(moment.name);
                    return (
                        <li key={moment.name} style={{ "--i": index }}>
                            <button type="button" className={styles.tile} data-open={open} aria-expanded={open} onClick={() => turn(moment.name)}>
                                <span className={styles.face}>
                                    <span className={styles.where}>{moment.where}</span>
                                    <span className={styles.name}>{moment.name}</span>
                                    <span className={styles.cue}>Turn over</span>
                                </span>
                                <span className={styles.back} aria-hidden={!open}>
                                    <span className={styles.name}>{moment.name}</span>
                                    <span className={styles.how}>{moment.how}</span>
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </>
    );
}
