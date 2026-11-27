import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "@/lib/socket.js";

// The board's shared timer and dot vote, as the server keeps them for the room.
export const useWorkshop = (board) => {
    const { shareId, hasEditAccess, canComment } = board;
    const [timer, setTimer] = useState(null);
    const [voting, setVoting] = useState(null);
    const [myVotes, setMyVotes] = useState([]);
    // Which setup card is open before a timer or vote starts: "timer", "voting" or null.
    const [workshopSetup, setWorkshopSetup] = useState(null);
    // Server time minus this device's, so a countdown ends at the same moment everywhere.
    const clockOffsetRef = useRef(0);

    useEffect(() => {
        setTimer(null);
        setVoting(null);
        setMyVotes([]);
        const onTimer = ({ timer: next, serverNow }) => {
            clockOffsetRef.current = serverNow - Date.now();
            setTimer(next);
        };
        const onMyVotes = ({ elementIds }) => setMyVotes(elementIds);
        socket.on("server:timer", onTimer);
        socket.on("server:voting", setVoting);
        socket.on("server:myVotes", onMyVotes);
        return () => {
            socket.off("server:timer", onTimer);
            socket.off("server:voting", setVoting);
            socket.off("server:myVotes", onMyVotes);
        };
    }, [shareId]);

    const startTimer = useCallback(
        (durationMs) => {
            socket.emit("client:timer", { shareId, action: "start", durationMs });
            setWorkshopSetup(null);
        },
        [shareId],
    );
    const changeTimer = useCallback((action) => socket.emit("client:timer", { shareId, action }), [shareId]);

    const startVoting = useCallback(
        (votesPerPerson) => {
            socket.emit("client:voteStart", { shareId, votesPerPerson });
            setWorkshopSetup(null);
        },
        [shareId],
    );
    const castVote = useCallback((elementId, add) => socket.emit("client:vote", { shareId, elementId, add }), [shareId]);
    const changeVoting = useCallback((action) => socket.emit("client:voting", { shareId, action }), [shareId]);

    const votingOpen = voting?.status === "open";

    return {
        canRunWorkshop: hasEditAccess,
        canVote: votingOpen && !!canComment,
        castVote,
        changeTimer,
        changeVoting,
        clockOffsetRef,
        myVotes,
        setWorkshopSetup,
        startTimer,
        startVoting,
        timer,
        voting,
        votingOpen,
        workshopSetup,
    };
};
