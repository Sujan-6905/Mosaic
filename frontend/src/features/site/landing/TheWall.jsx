import { useCallback, useEffect, useRef, useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import { WALL_SIZE } from "../../../../../shared/rules/landingWall.js";
import { WallScene } from "./wallScene";
import { useStoneScene } from "@/components/stoneScene/useStoneScene";
import styles from "./TheWall.module.css";
import { playSound } from "@/lib/soundKit";

const VISITOR_KEY = "mosaic:wall-visitor";
const POLL_MS = 4000;
const PICKABLE = new Set(["open", "busy"]);

const visitorId = () => {
    try {
        const kept = window.localStorage.getItem(VISITOR_KEY);
        if (kept) return kept;
        const fresh = crypto.randomUUID();
        window.localStorage.setItem(VISITOR_KEY, fresh);
        return fresh;
    } catch {
        return crypto.randomUUID();
    }
};

const FOOTNOTES = {
    loading: "Waking the wall. On a quiet day the server takes a moment to answer.",
    resting: "The wall isn't answering right now. It will be here when the server is.",
    open: "Or pick the spot yourself: click any empty place on the wall.",
    setting: "Setting your stone.",
    mine: "It is ringed in gold on the wall. Come back when the picture is finished and it will still be yours.",
    busy: "Everyone nearby got there first. Pick another spot.",
    limited: "That's enough stones from this address for now. Come back later.",
    full: "The picture is finished. Thank you to everyone who set a stone.",
};

// One unseen picture laid a stone per visitor: the picture picks each stone's colour and the visitor only the
// spot, so it can't be defaced. Stones placed while the page is open are other visitors, polled live.
export default function TheWall() {
    const [state, setState] = useState("loading");
    const [laid, setLaid] = useState(0);
    const [here, setHere] = useState(0);
    const sectionRef = useRef(null);
    const visitorRef = useRef(null);
    const stateRef = useRef(state);
    stateRef.current = state;
    const placeRef = useRef(null);
    const { canvasRef, sceneRef } = useStoneScene((options) => new WallScene({ ...options, onPick: (index) => placeRef.current(index) }));

    const place = useCallback(
        async (index) => {
            const scene = sceneRef.current;
            if (!scene) return;
            if (!PICKABLE.has(stateRef.current)) {
                scene.pending = -1;
                return;
            }
            setState("setting");
            try {
                const { data } = await axiosInstance.post(
                    "/api/wall/stones",
                    index === undefined ? { visitor: visitorRef.current } : { visitor: visitorRef.current, index },
                );
                scene.claim(data.index, true);
                playSound("knock");
                setLaid((count) => count + 1);
                setState("mine");
            } catch (error) {
                scene.pending = -1;
                const code = error.response?.data?.code;
                if (code === "already_set" && Number.isInteger(error.response.data.index)) {
                    scene.claim(error.response.data.index, false);
                    setState("mine");
                } else setState(code === "wall_full" ? "full" : code === "wall_rate_limited" ? "limited" : code === "wall_busy" ? "busy" : "resting");
            }
        },
        [sceneRef],
    );
    placeRef.current = place;

    useEffect(() => {
        visitorRef.current = visitorId();
        let cancelled = false;
        let timer = 0;
        let loaded = false;
        let inView = false;

        const look = async () => {
            if (document.hidden || (!inView && loaded)) return;
            try {
                const { data } = await axiosInstance.get("/api/wall", { params: { visitor: visitorRef.current } });
                const scene = sceneRef.current;
                if (cancelled || !scene) return;
                if (!loaded) {
                    scene.load(data.stones, data.mine);
                    loaded = true;
                    setState(data.mine !== null ? "mine" : data.stones.length >= WALL_SIZE ? "full" : "open");
                } else {
                    scene.arrive(
                        data.stones.filter((index) => !scene.isLaid(index)),
                        POLL_MS / 1000,
                    );
                }
                setLaid(data.stones.length);
                setHere(data.here);
            } catch {
                if (!loaded && !cancelled) setState("resting");
            }
        };
        const poll = async () => {
            await look();
            if (!cancelled) timer = setTimeout(poll, POLL_MS);
        };
        const sight = new IntersectionObserver(([entry]) => {
            inView = entry.isIntersecting;
        });
        sight.observe(sectionRef.current);
        poll();
        return () => {
            cancelled = true;
            clearTimeout(timer);
            sight.disconnect();
        };
    }, [sceneRef]);

    const canSet = PICKABLE.has(state);

    return (
        <section ref={sectionRef} id="wall" className={styles.wall} aria-labelledby="wallTitle">
            <div className={styles.copy}>
                <p className={styles.eyebrow}>The wall</p>
                <h2 id="wallTitle" className={styles.title}>
                    One picture. <em>One stone from every visitor.</em>
                </h2>
                <p className={styles.lede}>
                    Nobody has seen what this is. Every visitor sets a single stone, the picture decides its colour, and it resolves as people arrive. Stones
                    landing while you watch were set by someone else, just now.
                </p>
                <dl className={styles.stats}>
                    <div>
                        <dd>{laid.toLocaleString("en-GB")}</dd>
                        <dt>of {WALL_SIZE.toLocaleString("en-GB")} stones set</dt>
                    </div>
                    <div>
                        <dd>{here}</dd>
                        <dt>{here === 1 ? "person here now" : "people here now"}</dt>
                    </div>
                </dl>
                <button type="button" className={styles.set} data-done={!canSet} disabled={!canSet} onClick={() => place(undefined)}>
                    <span className={styles.setDot} aria-hidden="true" />
                    {state === "mine" ? "Your stone is in" : state === "setting" ? "Setting it" : "Set your stone"}
                </button>
                <p className={styles.footnote} role="status">
                    {FOOTNOTES[state]}
                </p>
            </div>
            <div className={styles.frame}>
                <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={`A shared mosaic, ${laid} of ${WALL_SIZE} stones laid`} />
                {state === "open" && laid === 0 && (
                    <p className={styles.first} aria-hidden="true">
                        Nobody has set a stone yet. <em>Be the first.</em>
                    </p>
                )}
            </div>
        </section>
    );
}
