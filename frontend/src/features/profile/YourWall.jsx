import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import { useStoneScene } from "@/components/stoneScene/useStoneScene";
import { createYourWallScene } from "./yourWallScene";
import styles from "./YourWall.module.css";

// Each first as a 5 by 5 inlay; an unearned one is only chalk.
const INLAYS = {
    firstBoard: { name: "First board", art: [".....", ".###.", ".#.#.", ".###.", "....."] },
    roomOfFive: { name: "A room of five", art: ["#.#.#", ".....", "#.#.#", ".....", "..#.."] },
    firstMerge: { name: "First merge", art: ["#...#", "#...#", ".#.#.", "..#..", "..#.."] },
    thousandPieces: { name: "A thousand pieces", art: ["#####", "#.#.#", "#####", "#.#.#", "#####"] },
    firstShare: { name: "First board shared", art: [".#...", ".##..", ".###.", ".##..", ".#..."] },
    agentInTheRoom: { name: "An agent in the room", art: [".###.", "#.#.#", "#####", ".#.#.", ".#.#."] },
    tenBoards: { name: "Ten boards", art: ["..#..", ".###.", "#####", ".#.#.", ".###."] },
};

const earnedOn = (at) => new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

function Field({ days }) {
    const { canvasRef } = useStoneScene(({ calm }) => createYourWallScene({ days, calm }));
    return <canvas ref={canvasRef} className={styles.field} aria-hidden="true" />;
}

// A person's year of work on their Profile: a field that only ever gains tiles, and inlays set for firsts.
export default function YourWall({ token }) {
    const [wall, setWall] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!token) return;
        axiosInstance
            .get("/api/activity/wall", { headers: { Authorization: `Bearer ${token}` } })
            .then(({ data }) => setWall(data))
            .catch(() => setFailed(true));
    }, [token]);

    if (failed) return <p className={styles.note}>Your wall couldn&apos;t load just now.</p>;
    if (!wall) return <div className={styles.placeholder} aria-hidden="true" />;

    const busiest = wall.days.reduce((best, day) => (day.pieces > best.pieces ? day : best), wall.days[0]);
    const activeDays = wall.days.filter((day) => day.pieces > 0).length;
    return (
        <div className={styles.wall}>
            <dl className={styles.stats}>
                <div>
                    <dt>Pieces set</dt>
                    <dd data-gold>{wall.pieces.toLocaleString("en-GB")}</dd>
                </div>
                <div>
                    <dt>Days at work</dt>
                    <dd>{activeDays}</dd>
                </div>
                <div>
                    <dt>Boards</dt>
                    <dd>{wall.boards}</dd>
                </div>
            </dl>
            <div
                className={styles.fieldFrame}
                tabIndex={0}
                role="img"
                aria-label={`${wall.pieces} pieces over the last year across ${activeDays} days${busiest.pieces ? `, most on ${busiest.day}` : ""}.`}
            >
                <Field days={wall.days} />
            </div>
            <p className={styles.note}>
                Each change you make on a board sets one piece for that day; what an agent does for you earns an inlay instead. New pieces arrive within about
                15 seconds of the board saving.
            </p>
            <ul className={styles.inlays} aria-label="Firsts">
                {wall.firsts.map(({ name, at }) => (
                    <li key={name} data-earned={Boolean(at) || undefined}>
                        <span className={styles.inlay} aria-hidden="true">
                            {INLAYS[name].art
                                .join("")
                                .split("")
                                .map((cell, n) => (
                                    <i key={n} data-on={cell === "#" || undefined} />
                                ))}
                        </span>
                        <span className={styles.inlayName}>{INLAYS[name].name}</span>
                        <span className={styles.inlayWhen}>{at ? earnedOn(at) : "Not yet"}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
