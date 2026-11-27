import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StrokeIcon from "@/components/ui/StrokeIcon";
import {
    AnimatedDropdown,
    AnimatedDropdownContent,
    AnimatedDropdownItem,
    AnimatedDropdownTrigger,
    AnimatedDropdownTriggerIndicator,
} from "@/components/vendor/sona/animated-dropdown";
import useEmbedScene from "./useEmbedScene";
import useEmbedSignIn from "./useEmbedSignIn";
import useEmbedCamera from "./useEmbedCamera";
import { createHostBridge } from "./hostBridge";
import EmbedComments from "./EmbedComments";
import styles from "./Embed.module.css";
import { SITE_URL } from "@/features/site/seo/siteMetadata";

const CAMERA_EVENT_MS = 200;

const StateCard = ({ title, detail, action }) => (
    <div className={styles.stateCard} role="status">
        <p className={styles.stateTitle}>{title}</p>
        {detail && <p className={styles.stateDetail}>{detail}</p>}
        {action}
    </div>
);

// One board (or one frame of it, or one saved version) inside someone else's
// page: live, read-only, with zoom, fit and a way into Mosaic.
export default function EmbedView({ shareId, frameId, version, sites, showComments }) {
    const { token, signIn } = useEmbedSignIn(shareId);
    const { scene, elements, comments, mode, canComment, addComment, onChange } = useEmbedScene({ shareId, frameId, version, token });
    const [signInError, setSignInError] = useState(null);
    const bridgeRef = useRef(null);
    const lastCameraEvent = useRef(0);

    const announceCamera = useCallback((camera) => {
        if (Date.now() - lastCameraEvent.current < CAMERA_EVENT_MS) return;
        lastCameraEvent.current = Date.now();
        bridgeRef.current?.send("camera", { x: camera.x, y: camera.y, zoom: camera.zoom });
    }, []);
    const camera = useEmbedCamera({ elements, background: scene.background, onCameraChange: announceCamera });
    const cameraRef = useRef(camera);
    cameraRef.current = camera;

    const frames = useMemo(() => scene.frames ?? [], [scene.frames]);

    useEffect(() => {
        const bridge = createHostBridge({
            sites,
            onCommand: (command, message) => {
                const current = cameraRef.current;
                if (command === "fit") current.fit();
                if (command === "zoomIn") current.zoomIn();
                if (command === "zoomOut") current.zoomOut();
                if (command === "setZoom" && Number.isFinite(message.zoom)) current.setZoom(message.zoom);
                if (command === "setCamera" && [message.x, message.y].every(Number.isFinite))
                    current.setCamera({ x: message.x, y: message.y, zoom: Number.isFinite(message.zoom) ? message.zoom : undefined });
                if (command === "goToFrame" || command === "focusElement") current.focusElement(String(message.frameId ?? message.elementId ?? ""));
            },
        });
        bridgeRef.current = bridge;
        return () => bridge.close();
    }, [sites]);

    useEffect(() => {
        if (scene.status === "ready") bridgeRef.current?.send("ready", { title: scene.title, frames, version: scene.version ?? null });
    }, [scene.status, scene.title, scene.version, frames]);

    useEffect(() => onChange((elementIds) => bridgeRef.current?.send("changed", { elementIds })), [onChange]);

    const boardUrl = `${SITE_URL}/?shareId=${encodeURIComponent(shareId)}`;
    const startSignIn = async () => {
        setSignInError(null);
        try {
            await signIn();
        } catch (error) {
            setSignInError(error.message);
        }
    };
    // Editing happens in Mosaic itself, in a window over this page; the embed follows along live.
    const openEditor = () => window.open(boardUrl, "mosaic-editor", "popup,width=1280,height=820");

    if (scene.status === "loading") return <div className={styles.shell} aria-busy="true" />;
    if (scene.status === "missing")
        return (
            <div className={styles.shell}>
                <StateCard title="This board isn't here" detail="It may have been deleted, or the link is wrong." />
            </div>
        );
    if (scene.status === "error")
        return (
            <div className={styles.shell}>
                <StateCard title="Couldn't load this board" detail="Check your connection and reload the page." />
            </div>
        );
    if (scene.status === "signIn") {
        return (
            <div className={styles.shell}>
                <StateCard
                    title="Sign in to view"
                    detail={signInError ?? "This board is shared with its collaborators only."}
                    action={
                        <button type="button" className={styles.primary} onClick={startSignIn}>
                            Sign in to Mosaic
                        </button>
                    }
                />
                <a className={styles.badge} href={SITE_URL} target="_blank" rel="noopener noreferrer">
                    Mosaic
                </a>
            </div>
        );
    }

    return (
        <div className={styles.shell}>
            <canvas
                ref={camera.canvasRef}
                className={styles.canvas}
                aria-label={`${scene.title || "Board"}, read-only view`}
                {...camera.handlers}
                onClick={(event) => {
                    const point = camera.worldPointOf(event);
                    if (point) bridgeRef.current?.send("click", { x: point.x, y: point.y });
                }}
            />
            {showComments && (canComment || comments.length > 0) && (
                <EmbedComments comments={comments} canComment={canComment} onAdd={addComment} camera={camera} elements={elements} />
            )}
            <div className={styles.toolbar} role="toolbar" aria-label="View controls">
                {frames.length > 1 && !frameId && (
                    <AnimatedDropdown modal={false}>
                        <AnimatedDropdownTrigger aria-label="Go to frame" className={styles.frameSelect}>
                            Frames
                            <AnimatedDropdownTriggerIndicator />
                        </AnimatedDropdownTrigger>
                        <AnimatedDropdownContent align="end" className={styles.frameMenu}>
                            {frames.map((frame) => (
                                <AnimatedDropdownItem key={frame.id} onClick={() => camera.focusElement(frame.id)}>
                                    {frame.name}
                                </AnimatedDropdownItem>
                            ))}
                        </AnimatedDropdownContent>
                    </AnimatedDropdown>
                )}
                <button type="button" className={styles.tool} onClick={camera.zoomOut} aria-label="Zoom out">
                    <StrokeIcon name="minus" size={16} />
                </button>
                <button type="button" className={styles.tool} onClick={camera.zoomIn} aria-label="Zoom in">
                    <StrokeIcon name="plus" size={16} />
                </button>
                <button type="button" className={styles.tool} onClick={camera.fit} aria-label="Fit to view">
                    <StrokeIcon name="fit" size={16} />
                </button>
                {scene.canEdit && token && !version ? (
                    <button type="button" className={styles.open} onClick={openEditor}>
                        Edit
                    </button>
                ) : (
                    <a className={styles.open} href={boardUrl} target="_blank" rel="noopener noreferrer">
                        Open in Mosaic
                    </a>
                )}
            </div>
            {(version || mode === "snapshot") && <p className={styles.note}>{version ? `Version ${version}` : "Updates every 30 seconds"}</p>}
            <a className={styles.badge} href={SITE_URL} target="_blank" rel="noopener noreferrer" aria-label="Made with Mosaic">
                Mosaic
            </a>
        </div>
    );
}
