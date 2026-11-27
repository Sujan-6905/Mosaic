import { wordsOf } from "../../../../../shared/canvas/elements/elementWords.js";
import { TimerPill, TimerSetup } from "./TimerPill";
import { VotePill, VoteSetup } from "./VotePill";
import styles from "./WorkshopBar.module.css";

const LABEL_LENGTH = 28;
const KIND_LABELS = {
    sticky: "A note",
    shape: "A shape",
    text: "A text box",
    frame: "A frame",
    image: "An image",
    table: "A table",
    path: "A drawing",
    connector: "An arrow",
    embed: "A web page",
};

// What a voted item is called in the results: its first words, or what kind of thing it is.
const describeElement = (element) => {
    const words = wordsOf(element).split("\n")[0].trim();
    if (!words) return KIND_LABELS[element?.type] ?? "An item";
    return words.length > LABEL_LENGTH ? `${words.slice(0, LABEL_LENGTH - 1)}\u2026` : words;
};

// The board's shared timer and dot vote, centred at the top while either is in use.
const WorkshopBar = ({ workshop, elements, onShowElement }) => {
    const {
        timer,
        voting,
        myVotes,
        workshopSetup,
        setWorkshopSetup,
        canRunWorkshop,
        canVote,
        clockOffsetRef,
        startTimer,
        changeTimer,
        startVoting,
        changeVoting,
    } = workshop;
    const showTimerSetup = workshopSetup === "timer" && !timer;
    const showVoteSetup = workshopSetup === "voting" && !voting;
    if (!timer && !voting && !showTimerSetup && !showVoteSetup) return null;
    return (
        <div className={styles.bar} data-board-chrome>
            {timer && <TimerPill timer={timer} clockOffsetRef={clockOffsetRef} canControl={canRunWorkshop} onChange={changeTimer} />}
            {showTimerSetup && <TimerSetup onStart={startTimer} onClose={() => setWorkshopSetup(null)} />}
            {voting && (
                <VotePill
                    voting={voting}
                    myVotes={myVotes}
                    canVote={canVote}
                    canControl={canRunWorkshop}
                    onChange={changeVoting}
                    onShowElement={onShowElement}
                    describeElement={(id) => describeElement(elements[id])}
                />
            )}
            {showVoteSetup && <VoteSetup onStart={startVoting} onClose={() => setWorkshopSetup(null)} />}
        </div>
    );
};

export default WorkshopBar;
