import axiosInstance from "@/lib/axiosInstance";
import { resolveCommentWorldPosition } from "../comments/comments";
import { socket } from "@/lib/socket.js";
import { useCallback, useEffect } from "react";

export const useBoardCollab = (board) => {
    const {
        elementUpdateFlushTimerRef,
        elementUpdateLastFlushRef,
        elements,
        emitCanvasUpdate,
        followingSocketIdRef,
        isFollowUpdateRef,
        pendingElementUpdatesRef,
        remoteCameraRef,
        role,
        roomJoined,
        session,
        setActiveCommentId,
        setCamera,
        setCollaborators,
        setComments,
        setFollowingSocketId,
        setIsPresenting,
        setPendingCommentAnchor,
        shareId,
        viewportSize,
    } = board;

    // The board's collaborators, fetched once per join, for mention autocomplete and @username tokens.
    useEffect(() => {
        if (!roomJoined || !shareId || !session?.accessToken) return;
        axiosInstance
            .get(`/api/drawing/collaborators/${shareId}`, {
                headers: { Authorization: `Bearer ${session.accessToken}` },
            })
            .then(({ data }) => {
                const owner = data.owner?._id ? [{ userId: data.owner._id, username: session?.user?.name || "Owner" }] : [];
                setCollaborators([...owner, ...data.collaborators.map((c) => ({ userId: c._id, username: c.username }))]);
            })
            .catch(() => {
                // Non-fatal: mentions/authorship still render from each
                // comment's own authorName field, just without autocomplete.
            });
    }, [roomJoined, shareId, session?.accessToken, session?.user?.name, setCollaborators]);

    const submitNewComment = useCallback(
        (anchor, text, mentions) => {
            socket.emit("client:addComment", { shareId, anchor, text, mentions });
            setPendingCommentAnchor(null);
        },
        [shareId, setPendingCommentAnchor],
    );

    const submitCommentReply = useCallback(
        (commentId, text, mentions) => {
            socket.emit("client:addCommentReply", { shareId, commentId, text, mentions });
        },
        [shareId],
    );

    const toggleCommentResolved = useCallback(
        (commentId, resolved) => {
            socket.emit("client:resolveComment", { shareId, commentId, resolved });
        },
        [shareId],
    );

    // Dragging a pin only relocates it, so an element-anchored comment becomes a point.
    // Applied locally at once, or the pin would jump back to its old spot until the server answered.
    const moveCommentAnchor = useCallback(
        (commentId, worldX, worldY) => {
            setComments((prev) =>
                prev.map((comment) => (comment._id === commentId ? { ...comment, anchorType: "point", x: worldX, y: worldY, elementId: null } : comment)),
            );
            socket.emit("client:moveComment", { shareId, commentId, anchor: { type: "point", x: worldX, y: worldY } });
        },
        [shareId, setComments],
    );

    const deleteCommentThread = useCallback(
        (commentId) => {
            socket.emit("client:deleteComment", { shareId, commentId });
            setActiveCommentId((prev) => (prev === commentId ? null : prev));
        },
        [shareId, setActiveCommentId],
    );

    // The same rule as the server: the author, or the board's owner. Others aren't offered the controls at all.
    const canManageComment = useCallback((comment) => comment.authorId === session?.user?.id || role === "owner", [session?.user?.id, role]);

    const openCommentThread = useCallback(
        (commentId) => {
            socket.emit("client:markCommentRead", { shareId, commentId });
            setActiveCommentId(commentId);
        },
        [shareId, setActiveCommentId],
    );

    const jumpToComment = useCallback(
        (comment) => {
            const position = resolveCommentWorldPosition(comment, elements);
            if (position) {
                setCamera((prev) => ({ ...prev, x: position.x - viewportSize.width / 2 / prev.zoom, y: position.y - viewportSize.height / 2 / prev.zoom }));
            }
            openCommentThread(comment._id);
        },
        [elements, viewportSize, setCamera, openCommentThread],
    );

    // Clicking someone jumps to their camera and follows it; clicking them again stops, leaving the view where it is.
    const toggleFollow = useCallback(
        (socketId) => {
            const alreadyFollowing = followingSocketIdRef.current === socketId;
            setFollowingSocketId(alreadyFollowing ? null : socketId);
            if (alreadyFollowing) return;

            const lastKnownCamera = remoteCameraRef.current[socketId];
            if (lastKnownCamera) {
                isFollowUpdateRef.current = true;
                setCamera(lastKnownCamera);
                isFollowUpdateRef.current = false;
            }
        },
        [setCamera, followingSocketIdRef, isFollowUpdateRef, remoteCameraRef, setFollowingSocketId],
    );

    const togglePresenting = useCallback(() => {
        setIsPresenting((prev) => {
            const next = !prev;
            socket.emit("client:presentationUpdate", { shareId, presenting: next });
            return next;
        });
    }, [shareId, setIsPresenting]);

    // Drag updates are throttled per element, since one plain throttle would keep only the last id of a multi-selection.
    // The release sends each final position unthrottled and drops anything still queued.
    const ELEMENT_UPDATE_THROTTLE_MS = 50;
    const flushPendingElementUpdates = useCallback(() => {
        elementUpdateLastFlushRef.current = Date.now();
        const pending = pendingElementUpdatesRef.current;
        pendingElementUpdatesRef.current = new Map();
        pending.forEach((element, elementId) => {
            emitCanvasUpdate({ shareId, operation: "update", elementId, element });
        });
    }, [emitCanvasUpdate, shareId, elementUpdateLastFlushRef, pendingElementUpdatesRef]);
    const queueElementUpdates = useCallback(
        (updatedById) => {
            Object.entries(updatedById).forEach(([id, element]) => pendingElementUpdatesRef.current.set(id, element));
            const remaining = ELEMENT_UPDATE_THROTTLE_MS - (Date.now() - elementUpdateLastFlushRef.current);
            if (remaining <= 0) {
                flushPendingElementUpdates();
            } else if (!elementUpdateFlushTimerRef.current) {
                elementUpdateFlushTimerRef.current = setTimeout(() => {
                    elementUpdateFlushTimerRef.current = null;
                    flushPendingElementUpdates();
                }, remaining);
            }
        },
        [flushPendingElementUpdates, elementUpdateFlushTimerRef, elementUpdateLastFlushRef, pendingElementUpdatesRef],
    );
    // Called before a drag's final emit, so a queued older position can't land after it.
    const cancelPendingElementUpdates = useCallback(
        (ids) => {
            if (elementUpdateFlushTimerRef.current) {
                clearTimeout(elementUpdateFlushTimerRef.current);
                elementUpdateFlushTimerRef.current = null;
            }
            ids.forEach((id) => pendingElementUpdatesRef.current.delete(id));
        },
        [elementUpdateFlushTimerRef, pendingElementUpdatesRef],
    );

    return {
        canManageComment,
        cancelPendingElementUpdates,
        deleteCommentThread,
        jumpToComment,
        moveCommentAnchor,
        openCommentThread,
        queueElementUpdates,
        submitCommentReply,
        submitNewComment,
        toggleCommentResolved,
        toggleFollow,
        togglePresenting,
    };
};
