import safeHandler from "../http/middlewares/safeHandler.js";
import { canComment, canEdit, parsePayload } from "./payloads.js";
import { timerSchema, voteSchema, voteStartSchema, votingActionSchema } from "../validation/workshopSchemas.js";
import { nextTimer, nextVotes, publicVoting, tallyVotes } from "../services/workshop.js";

// Workshop tools everyone on a board shares: a countdown timer and dot voting.
// Both live in the room, so they end when the last person leaves.
export const createWorkshopHandlers = ({ io, canvasStore }) => {
    const timerPayload = (timer) => ({ timer, serverNow: Date.now() });

    const votingPayload = async (shareId) => publicVoting(await canvasStore.getActivity(shareId, "voting"), await canvasStore.getVotes(shareId));

    // A person's own votes go to each of their tabs on the board, never to anyone else.
    const sendOwnVotes = async (shareId, userId, elementIds) => {
        const sockets = await io.in(shareId).fetchSockets();
        sockets.filter((other) => other.data.principal?.userId === userId).forEach((other) => other.emit("server:myVotes", { elementIds }));
    };

    const participantWith = async (socket, shareId, allowed) => {
        if (!socket.rooms.has(shareId)) return null;
        const participant = await canvasStore.getParticipant(shareId, socket.id);
        if (!participant || !allowed(participant.role)) {
            socket.emit("server:canvasAccessDenied");
            return null;
        }
        return participant;
    };

    // Brings a socket that just joined up to date.
    const sendWorkshopState = async (socket, shareId) => {
        const timer = await canvasStore.getActivity(shareId, "timer");
        if (timer) socket.emit("server:timer", timerPayload(timer));
        const voting = await votingPayload(shareId);
        if (!voting) return;
        socket.emit("server:voting", voting);
        socket.emit("server:myVotes", { elementIds: (await canvasStore.getVotes(shareId))[socket.userId] ?? [] });
    };

    const register = (socket) => {
        socket.on(
            "client:timer",
            safeHandler(socket, "client:timer", async (payload) => {
                const request = parsePayload(timerSchema, socket, "client:timer", payload);
                if (!request) return;
                const participant = await participantWith(socket, request.shareId, canEdit);
                if (!participant) return;
                const current = await canvasStore.getActivity(request.shareId, "timer");
                const timer = nextTimer(current, request, Date.now(), participant.name);
                await canvasStore.setActivity(request.shareId, "timer", timer);
                io.to(request.shareId).emit("server:timer", timerPayload(timer));
            }),
        );

        socket.on(
            "client:voteStart",
            safeHandler(socket, "client:voteStart", async (payload) => {
                const parsed = parsePayload(voteStartSchema, socket, "client:voteStart", payload);
                if (!parsed) return;
                const participant = await participantWith(socket, parsed.shareId, canEdit);
                if (!participant) return;
                await canvasStore.clearVotes(parsed.shareId);
                await canvasStore.setActivity(parsed.shareId, "voting", {
                    status: "open",
                    votesPerPerson: parsed.votesPerPerson,
                    startedByName: participant.name,
                    results: null,
                });
                io.to(parsed.shareId).emit("server:voting", await votingPayload(parsed.shareId));
                io.to(parsed.shareId).emit("server:myVotes", { elementIds: [] });
            }),
        );

        socket.on(
            "client:vote",
            safeHandler(socket, "client:vote", async (payload) => {
                const parsed = parsePayload(voteSchema, socket, "client:vote", payload);
                if (!parsed) return;
                const { shareId, elementId, add } = parsed;
                if (!(await participantWith(socket, shareId, canComment))) return;
                const voting = await canvasStore.getActivity(shareId, "voting");
                if (voting?.status !== "open" || (add && !(await canvasStore.getElement(shareId, elementId)))) return;
                const mine = (await canvasStore.getVotes(shareId))[socket.userId] ?? [];
                const next = nextVotes(mine, elementId, add, voting.votesPerPerson);
                if (!next) return;
                await canvasStore.setVotes(shareId, socket.userId, next);
                await sendOwnVotes(shareId, socket.userId, next);
                io.to(shareId).emit("server:voting", await votingPayload(shareId));
            }),
        );

        socket.on(
            "client:voting",
            safeHandler(socket, "client:voting", async (payload) => {
                const parsed = parsePayload(votingActionSchema, socket, "client:voting", payload);
                if (!parsed) return;
                const { shareId, action } = parsed;
                if (!(await participantWith(socket, shareId, canEdit))) return;
                const voting = await canvasStore.getActivity(shareId, "voting");
                if (!voting) return;
                if (action === "end") {
                    await canvasStore.setActivity(shareId, "voting", { ...voting, status: "closed", results: tallyVotes(await canvasStore.getVotes(shareId)) });
                } else {
                    await canvasStore.setActivity(shareId, "voting", null);
                    await canvasStore.clearVotes(shareId);
                    io.to(shareId).emit("server:myVotes", { elementIds: [] });
                }
                io.to(shareId).emit("server:voting", await votingPayload(shareId));
            }),
        );
    };

    return { register, sendWorkshopState };
};
