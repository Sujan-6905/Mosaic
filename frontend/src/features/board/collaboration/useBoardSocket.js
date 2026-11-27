import { DEFAULT_BACKGROUND } from "../rendering/backgroundRenderer";
import { decodeBase64ToUpdate, encodeUpdateToBase64 } from "../text/textCollab";
import { changedFields } from "../../../../../shared/canvas/editing/changedFields.js";
import { dispatchSessionExpired } from "@/lib/axiosInstance";
import { tokenAfterRefusal } from "@/lib/accessToken";
import { socket } from "@/lib/socket.js";
import { useCallback, useEffect } from "react";

const HANDSHAKE_RETRY_MS = 2000;

const ROLE_CHANGE_MESSAGES = {
    owner: "You own this board now.",
    editor: "You can now edit this board.",
    commenter: "You can now comment on this board, but not edit it.",
    viewer: "This board is now view only for you.",
};

export const useBoardSocket = (board) => {
    const {
        awaitingJoinRef,
        confirmedElementsRef,
        editingElementId,
        elementVersionsRef,
        emitJoinRoom,
        enqueueStaticInsert,
        followingSocketIdRef,
        isFollowUpdateRef,
        participantsRef,
        queueRemoteElementChange,
        remoteCameraRef,
        remoteCursorsRef,
        remoteElementChangesRef,
        remoteLaserTrailsRef,
        requestStaticFullRepaint,
        router,
        scheduleCursorRender,
        setActiveCommentId,
        setBackground,
        setCamera,
        setComments,
        setElements,
        setFollowerSocketIds,
        setHasJoinedOnce,
        setIsConnected,
        setParticipants,
        setPresentingSocketIds,
        setRole,
        setRoomJoined,
        setSaveStatus,
        setSelectedElementIds,
        setUnavailableReason,
        shareId,
        shouldApplyIncoming,
        showToast,
        socketMessageCounterRef,
        spatialIndexRef,
        startLaserAging,
        textCollabSessionRef,
    } = board;

    useEffect(() => {
        let renewedForHandshake = false;
        let announceNextRole = false;
        const handleConnect = () => {
            renewedForHandshake = false;
            setIsConnected(true);
            if (shareId) {
                emitJoinRoom();
            }
        };
        const handleDisconnect = () => {
            setIsConnected(false);
            setRoomJoined(false);
            setParticipants([]);
            remoteCursorsRef.current = {};
            participantsRef.current = {};
        };
        const handleConnectError = (error) => {
            // The server couldn't check the sign-in just now, which says nothing about whether it ended.
            if (error?.message === "unavailable") {
                setTimeout(() => socket.connect(), HANDSHAKE_RETRY_MS);
                return;
            }
            if (error?.message === "unauthorized") {
                // A lapsed token in the handshake is renewed and the socket reconnects once; only an ended sign-in signs out.
                const refused = socket.auth?.token;
                const retry = renewedForHandshake ? Promise.resolve(null) : tokenAfterRefusal(refused);
                renewedForHandshake = true;
                retry.then((token) => {
                    if (!token || token === refused) {
                        dispatchSessionExpired();
                        return;
                    }
                    socket.auth = { ...socket.auth, token };
                    socket.connect();
                });
            } else {
                showToast?.error("Connection error", "Could not reach the collaboration server");
            }
        };
        const handleJoinedRoom = ({ elements: canvasElements, background: canvasBackground, comments: canvasComments, role: joinedRole }) => {
            awaitingJoinRef.current = false;
            setRoomJoined(true);
            setHasJoinedOnce(true);
            setUnavailableReason(null);
            setRole(joinedRole || null);
            if (announceNextRole) {
                announceNextRole = false;
                showToast?.info("Your access changed", ROLE_CHANGE_MESSAGES[joinedRole] ?? "Your access to this board changed.");
            }
            remoteElementChangesRef.current = [];
            setElements(canvasElements || {});
            requestStaticFullRepaint(canvasElements || {});
            spatialIndexRef.current.load(canvasElements || {});
            // A full resync is authoritative, so it resets the known versions the next update is checked against.
            elementVersionsRef.current = Object.fromEntries(Object.entries(canvasElements || {}).map(([id, el]) => [id, el.version || 0]));
            confirmedElementsRef.current = { ...(canvasElements || {}) };
            setBackground(canvasBackground || DEFAULT_BACKGROUND);
            setComments(canvasComments || []);
        };
        const handleCanvasNotFound = () => setUnavailableReason("missing");
        const handleCanvasFull = ({ reason }) => {
            awaitingJoinRef.current = false;
            setUnavailableReason(reason === "tooManyConnections" ? "tooManyConnections" : "full");
        };
        const handleAccessRevoked = ({ shareId: revokedShareId }) => {
            if (revokedShareId !== shareId) return;
            setRoomJoined(false);
            setUnavailableReason("noAccess");
        };
        const handleBoardLoadFailed = () => setUnavailableReason("loadFailed");
        const handleBoardDeleted = ({ shareId: deletedShareId }) => {
            if (deletedShareId === shareId) setUnavailableReason("deleted");
        };
        const handleCanvasAccessDenied = () => {
            if (awaitingJoinRef.current) {
                awaitingJoinRef.current = false;
                setUnavailableReason("noAccess");
                return;
            }
            // The server holds a lower role than this screen assumed: fetch the real one.
            emitJoinRoom();
            showToast?.error("View only", "You can look around this board, but not change it.");
        };
        const handleAddNewElement = ({ elementId, element }) => {
            socketMessageCounterRef.current += 1;
            if (!shouldApplyIncoming(elementId, element.version)) return;
            elementVersionsRef.current[elementId] = element.version;
            confirmedElementsRef.current[elementId] = element;
            queueRemoteElementChange(elementId, element);
            // New elements queue and draw together on the next frame, however many arrive at once.
            enqueueStaticInsert(elementId, element);
        };
        const handleDeleteElement = ({ elementId, version }) => {
            socketMessageCounterRef.current += 1;
            if (!shouldApplyIncoming(elementId, version)) return;
            elementVersionsRef.current[elementId] = version;
            delete confirmedElementsRef.current[elementId];
            spatialIndexRef.current.remove(elementId);
            queueRemoteElementChange(elementId, null, { repaint: true });
            setSelectedElementIds((prev) => prev.filter((id) => id !== elementId));
        };
        const handleUpdateElement = ({ elementId, element }) => {
            socketMessageCounterRef.current += 1;
            if (!shouldApplyIncoming(elementId, element.version)) return;
            elementVersionsRef.current[elementId] = element.version;
            confirmedElementsRef.current[elementId] = element;
            spatialIndexRef.current.update(elementId, element);
            queueRemoteElementChange(elementId, element, { repaint: true });
        };
        // The server refused this client's change and sent back what the room holds instead.
        const handleElementRejected = ({ elementId, element, reason }) => {
            if (element) {
                elementVersionsRef.current[elementId] = element.version;
                confirmedElementsRef.current[elementId] = element;
                spatialIndexRef.current.update(elementId, element);
            } else {
                delete confirmedElementsRef.current[elementId];
                spatialIndexRef.current.remove(elementId);
                setSelectedElementIds((prev) => prev.filter((id) => id !== elementId));
            }
            queueRemoteElementChange(elementId, element, { repaint: true });
            // A refusal for lack of access already has its own message.
            if (reason === "invalid") {
                showToast?.error("Change not saved", "The board couldn't accept that change, so it was undone.");
            }
        };
        const handleSaved = () => {
            setSaveStatus("saved");
        };
        const handleBackgroundUpdated = ({ background: updatedBackground }) => {
            setBackground(updatedBackground);
        };
        const handlePresenceUpdate = (participantList) => {
            const activeSocketIds = new Set(participantList.map((participant) => participant.socketId));
            participantsRef.current = Object.fromEntries(participantList.map((participant) => [participant.socketId, participant]));
            Object.keys(remoteCursorsRef.current).forEach((socketId) => {
                if (!activeSocketIds.has(socketId)) {
                    delete remoteCursorsRef.current[socketId];
                }
            });
            setParticipants(participantList);
            scheduleCursorRender();
        };
        const handleCursorMove = ({ socketId, x, y }) => {
            const participant = participantsRef.current[socketId];
            remoteCursorsRef.current[socketId] = {
                x,
                y,
                color: participant?.color || "#6366f1",
                name: participant?.name || "Guest",
            };
            scheduleCursorRender();
        };
        // Laser points only extend that person's fading trail; nothing is stored.
        const handleLaserPoint = ({ socketId, x, y }) => {
            const trail = remoteLaserTrailsRef.current[socketId] || [];
            remoteLaserTrailsRef.current[socketId] = [...trail, { x, y, t: Date.now() }];
            startLaserAging();
        };
        // Only someone with this element's editor open applies the live text; others get the saved text when it closes.
        const handleTextSync = ({ elementId, update, wantsState, isState }) => {
            const session = textCollabSessionRef.current;
            if (elementId !== editingElementId || !session) return;
            if (isState) session.applyRemoteState(decodeBase64ToUpdate(update));
            else session.applyRemoteUpdate(decodeBase64ToUpdate(update));
            if (wantsState) socket.emit("client:textSync", { shareId, elementId, update: encodeUpdateToBase64(session.fullState()), isState: true });
        };
        const handleCommentAdded = (comment) => {
            setComments((prev) => [...prev, comment]);
        };
        const handleCommentUpdated = (comment) => {
            setComments((prev) => prev.map((existing) => (existing._id === comment._id ? comment : existing)));
        };
        const handleCommentDeleted = ({ commentId }) => {
            setComments((prev) => prev.filter((existing) => existing._id !== commentId));
            setActiveCommentId((prev) => (prev === commentId ? null : prev));
        };
        const handleMentioned = ({ authorName, preview }) => {
            showToast?.info(`${authorName} mentioned you`, preview);
        };
        // Remote cameras stay in a ref because they arrive about 30 times a second.
        // When the camera is the one being followed, this view jumps to match it straight away.
        const handleCameraMove = ({ socketId, x, y, zoom }) => {
            remoteCameraRef.current[socketId] = { x, y, zoom };
            if (followingSocketIdRef.current === socketId) {
                isFollowUpdateRef.current = true;
                setCamera({ x, y, zoom });
                isFollowUpdateRef.current = false;
            }
            scheduleCursorRender();
        };
        const handlePresentationUpdate = ({ socketId, presenting }) => {
            setPresentingSocketIds((prev) => {
                const next = new Set(prev);
                if (presenting) next.add(socketId);
                else next.delete(socketId);
                return next;
            });
        };
        // This person's role on the board changed: rejoining applies the new role, or the refusal, without a reload.
        const handleRoleChanged = ({ shareId: changedShareId }) => {
            if (changedShareId !== shareId) return;
            announceNextRole = true;
            emitJoinRoom();
        };
        socket.on("connect", handleConnect);
        // connect only fires on a fresh handshake, not when this effect re-subscribes to a connected socket.
        if (socket.connected) setIsConnected(true);
        socket.on("disconnect", handleDisconnect);
        socket.on("connect_error", handleConnectError);
        socket.on("server:joinedRoom", handleJoinedRoom);
        socket.on("server:canvasNotFound", handleCanvasNotFound);
        socket.on("server:canvasFull", handleCanvasFull);
        socket.on("server:accessRevoked", handleAccessRevoked);
        socket.on("server:boardLoadFailed", handleBoardLoadFailed);
        socket.on("server:boardDeleted", handleBoardDeleted);
        socket.on("server:canvasAccessDenied", handleCanvasAccessDenied);
        socket.on("server:addNewElement", handleAddNewElement);
        socket.on("server:deleteElement", handleDeleteElement);
        socket.on("server:updateElement", handleUpdateElement);
        socket.on("server:elementRejected", handleElementRejected);
        socket.on("server:saved", handleSaved);
        socket.on("server:backgroundUpdated", handleBackgroundUpdated);
        socket.on("server:presenceUpdate", handlePresenceUpdate);
        socket.on("server:cursorMove", handleCursorMove);
        socket.on("server:laserPoint", handleLaserPoint);
        socket.on("server:textSync", handleTextSync);
        socket.on("server:commentAdded", handleCommentAdded);
        socket.on("server:commentUpdated", handleCommentUpdated);
        socket.on("server:commentDeleted", handleCommentDeleted);
        socket.on("server:mentioned", handleMentioned);
        socket.on("server:cameraMove", handleCameraMove);
        const handleFollowersUpdate = ({ followers }) => setFollowerSocketIds(followers);
        socket.on("server:presentationUpdate", handlePresentationUpdate);
        socket.on("server:followersUpdate", handleFollowersUpdate);
        socket.on("server:roleChanged", handleRoleChanged);
        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            socket.off("connect_error", handleConnectError);
            socket.off("server:joinedRoom", handleJoinedRoom);
            socket.off("server:canvasNotFound", handleCanvasNotFound);
            socket.off("server:canvasFull", handleCanvasFull);
            socket.off("server:accessRevoked", handleAccessRevoked);
            socket.off("server:boardLoadFailed", handleBoardLoadFailed);
            socket.off("server:boardDeleted", handleBoardDeleted);
            socket.off("server:canvasAccessDenied", handleCanvasAccessDenied);
            socket.off("server:addNewElement", handleAddNewElement);
            socket.off("server:deleteElement", handleDeleteElement);
            socket.off("server:updateElement", handleUpdateElement);
            socket.off("server:elementRejected", handleElementRejected);
            socket.off("server:saved", handleSaved);
            socket.off("server:backgroundUpdated", handleBackgroundUpdated);
            socket.off("server:presenceUpdate", handlePresenceUpdate);
            socket.off("server:cursorMove", handleCursorMove);
            socket.off("server:laserPoint", handleLaserPoint);
            socket.off("server:textSync", handleTextSync);
            socket.off("server:commentAdded", handleCommentAdded);
            socket.off("server:commentUpdated", handleCommentUpdated);
            socket.off("server:commentDeleted", handleCommentDeleted);
            socket.off("server:mentioned", handleMentioned);
            socket.off("server:cameraMove", handleCameraMove);
            socket.off("server:presentationUpdate", handlePresentationUpdate);
            socket.off("server:followersUpdate", handleFollowersUpdate);
            socket.off("server:roleChanged", handleRoleChanged);
        };
    }, [
        queueRemoteElementChange,
        shareId,
        showToast,
        router,
        emitJoinRoom,
        scheduleCursorRender,
        shouldApplyIncoming,
        requestStaticFullRepaint,
        enqueueStaticInsert,
        startLaserAging,
        editingElementId,
        setCamera,
        awaitingJoinRef,
        confirmedElementsRef,
        elementVersionsRef,
        followingSocketIdRef,
        isFollowUpdateRef,
        participantsRef,
        remoteCameraRef,
        remoteCursorsRef,
        remoteElementChangesRef,
        remoteLaserTrailsRef,
        setActiveCommentId,
        setBackground,
        setComments,
        setElements,
        setFollowerSocketIds,
        setHasJoinedOnce,
        setIsConnected,
        setParticipants,
        setPresentingSocketIds,
        setRole,
        setRoomJoined,
        setSaveStatus,
        setSelectedElementIds,
        setUnavailableReason,
        socketMessageCounterRef,
        spatialIndexRef,
        textCollabSessionRef,
    ]);

    // Every change goes out through here, which flips the save indicator to saving until the server confirms.
    const emitCanvasUpdate = useCallback(
        (payload) => {
            const confirmed = payload.operation === "update" ? confirmedElementsRef.current[payload.elementId] : null;
            const changed = confirmed ? changedFields(confirmed, payload.element) : null;
            if (changed?.length === 0) return;
            setSaveStatus("saving");
            socket.emit("client:updateCanvas", changed ? { ...payload, changed } : payload);
        },
        [setSaveStatus, confirmedElementsRef],
    );

    // Applied straight away and then confirmed by the server's broadcast, like every other change.
    const updateBackground = useCallback(
        (nextBackground) => {
            setBackground(nextBackground);
            setSaveStatus("saving");
            socket.emit("client:updateBackground", { shareId, background: nextBackground });
        },
        [shareId, setBackground, setSaveStatus],
    );

    return {
        emitCanvasUpdate,
        updateBackground,
    };
};
