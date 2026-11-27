import StrokeIcon from "@/components/ui/StrokeIcon";
import { initialsOf } from "@/components/AppHeader";
import styles from "./BoardStates.module.css";
import { TOUR_TRACKS } from "@/features/tour/tourSteps";
import PuzzleLoader from "@/components/PuzzleLoader/PuzzleLoader";

const GOLD_TILES = ["#ffb43c", "#e09a2c", "#c07d1c"];

function Tiles({ lit }) {
    return (
        <div className={styles.tiles} aria-hidden="true">
            {Array.from({ length: 12 }, (_unused, index) => (
                <span key={index} style={{ background: lit.includes(index) ? GOLD_TILES[index % 3] : undefined }} />
            ))}
        </div>
    );
}

export function JoiningOverlay() {
    return (
        <div className={styles.joining}>
            <PuzzleLoader label="Joining the board" />
        </div>
    );
}

export function ReconnectBanner({ onTryNow }) {
    return (
        <div className={styles.reconnect} role="alert" data-board-chrome>
            <span className={styles.spinner} />
            <span className={styles.reconnectText}>
                <strong>Connection lost. Reconnecting.</strong>
                <span>Editing is paused. The board reloads from the server once you&apos;re back.</span>
            </span>
            <button type="button" className={styles.tryNow} onClick={onTryNow}>
                Try now
            </button>
        </div>
    );
}

// Sits in the middle of an empty board without blocking it: only the card
// itself takes pointer events, so a stroke can start anywhere around it.
export function EmptyBoard({ canStartWithAi, onStartWithAi, onImport, onTakeTour }) {
    const quickStarts = [
        ...(canStartWithAi ? [{ label: "Draft a diagram with AI", note: "Describe it in a sentence", icon: "sparkle", onClick: onStartWithAi }] : []),
        { label: "Import a .mosaic file", note: "Merge an export in", icon: "export", onClick: onImport },
        { label: "Take the tour", note: `${TOUR_TRACKS.basics.steps.length} steps`, icon: "play", onClick: onTakeTour },
    ];

    return (
        <>
            <span className={`${styles.hint} ${styles.hintDock}`} aria-hidden="true">
                Pick a tool, or press its letter
                <svg width="120" height="70" viewBox="0 0 120 70">
                    <path d="M10 8 C 40 10, 70 30, 96 58" />
                    <path d="M84 56 L 97 59 L 95 46" />
                </svg>
            </span>
            <span className={`${styles.hint} ${styles.hintShare}`} aria-hidden="true">
                Invite people when you&apos;re ready
                <svg width="80" height="60" viewBox="0 0 80 60">
                    <path d="M8 52 C 30 48, 52 34, 62 10" />
                    <path d="M52 16 L 63 8 L 68 21" />
                </svg>
            </span>
            <section className={styles.empty} aria-label="Start this board" data-board-chrome>
                <Tiles lit={[1, 6, 8]} />
                <div className={styles.emptyHeading}>
                    <h1>A blank board</h1>
                    <p>Start drawing anywhere, or begin with one of these.</p>
                </div>
                <div className={styles.quickStarts}>
                    {quickStarts.map((quick) => (
                        <button key={quick.label} type="button" className={styles.quick} onClick={quick.onClick}>
                            <StrokeIcon name={quick.icon} className={styles.quickIcon} />
                            <span className={styles.quickLabel}>{quick.label}</span>
                            <span className={styles.quickNote}>{quick.note}</span>
                        </button>
                    ))}
                </div>
                <p className={styles.emptyFoot}>This goes away as soon as you add something.</p>
            </section>
        </>
    );
}

export function PresenterBar({ audience, followerSocketIds, onStop }) {
    const followers = audience.filter((person) => followerSocketIds.includes(person.socketId));
    const shown = followers.length > 0 ? followers : audience;
    return (
        <>
            <div className={styles.presenterFrame} aria-hidden="true" />
            <div className={styles.presenterBar} role="status" data-board-chrome>
                <span className={styles.live} />
                <strong>You&apos;re presenting</strong>
                {shown.length > 0 && (
                    <span className={styles.audience}>
                        {shown.slice(0, 3).map((person) => (
                            <span key={person.socketId} style={{ background: person.color }}>
                                {initialsOf(person.name)}
                            </span>
                        ))}
                    </span>
                )}
                <span className={styles.audienceCount}>
                    {audience.length === 0
                        ? "Nobody else here yet"
                        : followers.length > 0
                          ? `${followers.length} following`
                          : `${audience.length} here can follow`}
                </span>
                <button type="button" onClick={onStop}>
                    Stop presenting
                </button>
            </div>
            <span className={styles.presenterNote}>Followers move and zoom with you</span>
        </>
    );
}

export function FollowInvite({ presenter, onFollow, onDismiss }) {
    return (
        <div className={styles.invite} role="status" data-board-chrome>
            <span className={styles.inviteHead}>
                <span className={styles.inviteAvatar} style={{ background: presenter.color }}>
                    {initialsOf(presenter.name)}
                    <span className={styles.inviteLive} />
                </span>
                <span className={styles.inviteText}>
                    <strong>{presenter.name} is presenting</strong>
                    <span>Follow to see what they see</span>
                </span>
            </span>
            <span className={styles.inviteActions}>
                <button type="button" className={styles.follow} onClick={onFollow}>
                    Follow
                </button>
                <button type="button" className={styles.notNow} onClick={onDismiss}>
                    Not now
                </button>
            </span>
        </div>
    );
}

export function FollowingFrame({ person, onStop }) {
    return (
        <>
            <div className={styles.followFrame} aria-hidden="true" />
            <div className={styles.followBar} role="status" data-board-chrome>
                <span className={styles.followAvatar}>{initialsOf(person.name)}</span>
                <strong>Following {person.name}</strong>
                <button type="button" onClick={onStop}>
                    Stop following
                </button>
            </div>
            <span className={styles.followNote}>Panning or zooming yourself also stops following</span>
        </>
    );
}
