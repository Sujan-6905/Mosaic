import { getCorrelationId } from "@/lib/correlationId";
import { setConnected } from "@/store/connectionSlice";
import { socket } from "@/lib/socket.js";
import { useCallback, useEffect, useRef } from "react";
import { viewportWorldBounds } from "../camera/camera";
import { LASER_TRAIL_MS } from "./boardHelpers";

export const useBoardCore = (board) => {
    const {
        awaitingJoinRef,
        background,
        bumpCursorTick,
        cameraRef,
        cursorRafScheduled,
        dispatch,
        dragStateRef,
        elementVersionsRef,
        elements,
        elementsRef,
        emitCameraMoveRef,
        followingSocketId,
        followingSocketIdRef,
        isConnected,
        isFollowUpdateRef,
        laserAgingRafRef,
        localLaserTrailRef,
        onRoleChange,
        pendingFullRepaintSnapshotRef,
        pendingInsertsForRepaintRef,
        remoteElementChangesRef,
        remoteLaserTrailsRef,
        remoteRepaintNeededRef,
        role,
        session,
        setElements,
        setFollowingSocketId,
        shareId,
        spatialIndexRef,
        staticNeedsFullRepaintRef,
        staticPendingInsertsRef,
        status,
        tileChangedIdsRef,
        tileDrawZoomRef,
        viewportSize,
    } = board;

    useEffect(() => {
        elementsRef.current = elements;
    }, [elements, elementsRef]);
    const drawZoom = useCallback(() => tileDrawZoomRef.current ?? cameraRef.current.zoom, [cameraRef, tileDrawZoomRef]);
    useEffect(() => {
        followingSocketIdRef.current = followingSocketId;
        if (shareId) socket.emit("client:followUpdate", { shareId, targetSocketId: followingSocketId });
    }, [followingSocketId, shareId, followingSocketIdRef]);
    const setCamera = useCallback(
        (next) => {
            cameraRef.current = typeof next === "function" ? next(cameraRef.current) : next;
            // The camera is part of every draw call, so any camera change repaints; culling keeps that cheap.
            staticNeedsFullRepaintRef.current = true;

            if (isFollowUpdateRef.current) return;

            if (followingSocketIdRef.current) {
                followingSocketIdRef.current = null;
                setFollowingSocketId(null);
            }
            if (shareId) {
                emitCameraMoveRef.current(shareId, cameraRef.current.x, cameraRef.current.y, cameraRef.current.zoom);
            }
        },
        [shareId, cameraRef, emitCameraMoveRef, followingSocketIdRef, isFollowUpdateRef, setFollowingSocketId, staticNeedsFullRepaintRef],
    );
    const viewportSizeRef = useRef(viewportSize);
    viewportSizeRef.current = viewportSize;
    useEffect(() => {
        onRoleChange?.(role);
    }, [role, onRoleChange]);

    const scheduleCursorRender = useCallback(() => {
        if (cursorRafScheduled.current) return;
        cursorRafScheduled.current = true;
        requestAnimationFrame(() => {
            cursorRafScheduled.current = false;
            bumpCursorTick();
        });
    }, [bumpCursorTick, cursorRafScheduled]);

    // Laser trails keep fading with no new points, so a small frame loop runs while any trail is left.
    const ageLaserTrails = useCallback(() => {
        const cutoff = Date.now() - LASER_TRAIL_MS;
        localLaserTrailRef.current = localLaserTrailRef.current.filter((p) => p.t > cutoff);
        let anyRemaining = localLaserTrailRef.current.length > 0;
        Object.keys(remoteLaserTrailsRef.current).forEach((socketId) => {
            const pruned = remoteLaserTrailsRef.current[socketId].filter((p) => p.t > cutoff);
            if (pruned.length > 0) {
                remoteLaserTrailsRef.current[socketId] = pruned;
                anyRemaining = true;
            } else {
                delete remoteLaserTrailsRef.current[socketId];
            }
        });
        bumpCursorTick();
        if (anyRemaining) {
            laserAgingRafRef.current = requestAnimationFrame(ageLaserTrails);
        } else {
            laserAgingRafRef.current = null;
        }
    }, [bumpCursorTick, laserAgingRafRef, localLaserTrailRef, remoteLaserTrailsRef]);
    const startLaserAging = useCallback(() => {
        if (laserAgingRafRef.current) return;
        laserAgingRafRef.current = requestAnimationFrame(ageLaserTrails);
    }, [ageLaserTrails, laserAgingRafRef]);

    // The workspace chrome outside this component's tree disables live-only actions while offline.
    useEffect(() => {
        dispatch(setConnected(isConnected));
    }, [dispatch, isConnected]);

    const getVisibleCanvasBounds = useCallback(() => {
        const bounds = viewportWorldBounds(cameraRef.current, viewportSize.width, viewportSize.height);
        return { x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY };
    }, [viewportSize, cameraRef]);

    // The only two ways a change asks the board layer to repaint.
    // `elementsSnapshot` is exactly the next elements value the caller is setting.
    const requestStaticFullRepaint = useCallback(
        (elementsSnapshot, knownChange = null) => {
            // Naming what changed saves comparing the whole board, but only holds
            // when the new snapshot was built directly on the one already due.
            if (knownChange?.basedOn === pendingFullRepaintSnapshotRef.current && tileChangedIdsRef.current) {
                knownChange.ids.forEach((id) => tileChangedIdsRef.current.add(id));
            } else {
                tileChangedIdsRef.current = null;
            }
            pendingFullRepaintSnapshotRef.current = elementsSnapshot;
            pendingInsertsForRepaintRef.current = [];
            staticNeedsFullRepaintRef.current = true;
        },
        [pendingFullRepaintSnapshotRef, pendingInsertsForRepaintRef, staticNeedsFullRepaintRef, tileChangedIdsRef],
    );
    // A background change leaves elements alone, so it reuses whatever snapshot is already queued.
    useEffect(() => {
        staticNeedsFullRepaintRef.current = true;
    }, [background, staticNeedsFullRepaintRef]);
    // Every element arriving fresh, from a draw, an undo or a drag's end, goes through here and into the spatial index.
    // It also joins the queued full-repaint snapshot, or the next full repaint would erase it while it stays selectable.
    const enqueueStaticInsert = useCallback(
        (elementId, element) => {
            staticPendingInsertsRef.current.push({ elementId, element });
            spatialIndexRef.current.update(elementId, element);
            pendingInsertsForRepaintRef.current.push({ elementId, element });
        },
        [pendingInsertsForRepaintRef, spatialIndexRef, staticPendingInsertsRef],
    );

    // Copying the board costs real time at this size, so a burst of socket
    // messages shares one copy per frame instead of taking one each.
    const queueRemoteElementChange = useCallback(
        (elementId, element, { repaint = false } = {}) => {
            remoteElementChangesRef.current.push([elementId, element]);
            if (repaint) remoteRepaintNeededRef.current = true;
        },
        [remoteElementChangesRef, remoteRepaintNeededRef],
    );
    const flushRemoteElementChanges = useCallback(() => {
        const changes = remoteElementChangesRef.current;
        if (changes.length === 0) return;
        const repaint = remoteRepaintNeededRef.current;
        remoteElementChangesRef.current = [];
        remoteRepaintNeededRef.current = false;
        setElements((prev) => {
            const next = { ...prev };
            for (const [elementId, element] of changes) {
                if (element) next[elementId] = element;
                else delete next[elementId];
            }
            if (repaint) requestStaticFullRepaint(next, { basedOn: prev, ids: changes.map(([elementId]) => elementId) });
            return next;
        });
    }, [requestStaticFullRepaint, remoteElementChangesRef, remoteRepaintNeededRef, setElements]);

    // No connection until there's a valid session token, and the token is re-applied when it renews.
    useEffect(() => {
        if (status !== "authenticated" || !session?.accessToken) return;
        socket.auth = { token: session.accessToken, correlationId: getCorrelationId() };
        if (!socket.connected) {
            socket.connect();
        }
    }, [status, session?.accessToken]);

    const emitJoinRoom = useCallback(() => {
        awaitingJoinRef.current = true;
        socket.emit("client:joinRoom", { shareId });
    }, [shareId, awaitingJoinRef]);

    // Only once connected: joining mid-handshake would queue a second join and count this tab twice.
    useEffect(() => {
        if (shareId && status === "authenticated" && socket.connected) {
            emitJoinRoom();
        }
    }, [shareId, status, emitJoinRoom]);

    // An incoming element applies only if it is newer, except one this client is dragging right now,
    // whose own frames are fresher than any echo; the drag's final emit settles its version on release.
    const shouldApplyIncoming = useCallback(
        (elementId, incomingVersion) => {
            if (dragStateRef.current?.ids?.includes(elementId)) return false;
            return incomingVersion > (elementVersionsRef.current[elementId] ?? 0);
        },
        [dragStateRef, elementVersionsRef],
    );

    return {
        drawZoom,
        emitJoinRoom,
        enqueueStaticInsert,
        flushRemoteElementChanges,
        getVisibleCanvasBounds,
        queueRemoteElementChange,
        requestStaticFullRepaint,
        scheduleCursorRender,
        setCamera,
        shouldApplyIncoming,
        startLaserAging,
        viewportSizeRef,
    };
};
