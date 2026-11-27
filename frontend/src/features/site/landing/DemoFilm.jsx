import { useEffect, useRef } from "react";
import styles from "./DemoFilm.module.css";

export const DEMO_FILM = {
    src: "/media/mosaic-trailer.mp4",
    poster: "/media/mosaic-trailer.jpg",
    captions: "/media/mosaic-trailer.vtt",
    length: "2:50",
};

// A modal <dialog> keeps focus inside, closes on Escape and sits above the site's fixed chrome.
export default function DemoFilm({ onClose }) {
    const dialogRef = useRef(null);
    const videoRef = useRef(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        dialog.showModal();
        videoRef.current?.play().catch(() => {});
        return () => dialog.close();
    }, []);

    return (
        <dialog
            ref={dialogRef}
            className={styles.dialog}
            aria-label="Mosaic demo film"
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
            onClick={(event) => event.target === dialogRef.current && onClose()}
        >
            <div className={styles.frame}>
                <video ref={videoRef} className={styles.video} src={DEMO_FILM.src} poster={DEMO_FILM.poster} controls playsInline preload="metadata">
                    <track kind="captions" src={DEMO_FILM.captions} srcLang="en" label="English" />
                </video>
                <button type="button" className={styles.close} onClick={onClose} aria-label="Close the film">
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        aria-hidden="true"
                    >
                        <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                </button>
            </div>
            <p className={styles.credit}>
                Recorded from the running app. Music: &ldquo;Simplicity&rdquo; by{" "}
                <a href="https://www.scottbuckley.com.au" target="_blank" rel="noopener noreferrer">
                    Scott Buckley
                </a>
                , licensed under{" "}
                <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">
                    CC BY 4.0
                </a>
                .
            </p>
        </dialog>
    );
}
