import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import axiosInstance from "@/lib/axiosInstance";

const EMPTY = { ownedDrawings: [], sharedWithDrawings: [], sweptDrawings: [] };

// The signed-in person's boards and categories, and every change they make to either from the dashboard.
export default function useBoardLibrary({ session, status, isAuthenticated, showToast }) {
    const router = useRouter();
    const authHeaders = useMemo(() => ({ headers: { Authorization: `Bearer ${session?.accessToken}` } }), [session?.accessToken]);
    const [drawings, setDrawings] = useState(EMPTY);
    const [isLoading, setIsLoading] = useState(true);
    const [categoriesBySection, setCategoriesBySection] = useState({ owned: [], shared: [] });

    const fetchDrawings = useCallback(async () => {
        try {
            const { data } = await axiosInstance.get("/api/drawing/get", authHeaders);
            setDrawings({ ...EMPTY, ...data.data });
        } catch (error) {
            if (error.response?.status !== 401) showToast?.error("Couldn't load your boards", "Refresh to try again.");
        } finally {
            setIsLoading(false);
        }
    }, [authHeaders, showToast]);

    const fetchCategories = useCallback(async () => {
        try {
            const [owned, shared] = await Promise.all([
                axiosInstance.get("/api/organization/categories?section=owned", authHeaders),
                axiosInstance.get("/api/organization/categories?section=shared", authHeaders),
            ]);
            setCategoriesBySection({ owned: owned.data.categories, shared: shared.data.categories });
        } catch (error) {
            console.error("Error fetching categories:", error);
        }
    }, [authHeaders]);

    // Once per sign-in: a renewed access token changes the fetchers, not the boards.
    const loadedRef = useRef(false);
    useEffect(() => {
        if (isAuthenticated) {
            if (loadedRef.current) return;
            loadedRef.current = true;
            fetchDrawings();
            fetchCategories();
        } else if (status !== "loading") {
            loadedRef.current = false;
            router.replace(`/?callbackUrl=${encodeURIComponent(router.asPath)}`);
        }
    }, [status, isAuthenticated, fetchDrawings, fetchCategories, router]);

    const applyLocally = (shareId, patch) => {
        setDrawings((previous) => ({
            ...previous,
            ownedDrawings: previous.ownedDrawings.map((d) => (d.shareId === shareId ? { ...d, ...patch } : d)),
            sharedWithDrawings: previous.sharedWithDrawings.map((d) => (d.shareId === shareId ? { ...d, ...patch } : d)),
        }));
    };

    const organize = async (board, patch, failure) => {
        applyLocally(board.shareId, patch);
        try {
            await axiosInstance.put(`/api/organization/boards/${board.shareId}`, patch, authHeaders);
        } catch {
            showToast?.error(failure, "Your change was undone.");
            fetchDrawings();
        }
    };

    const createBoard = async ({ title, categoryId }) => {
        try {
            const { data } = await axiosInstance.post("/api/drawing/create", { title }, authHeaders);
            if (categoryId) await axiosInstance.put(`/api/organization/boards/${data.data.shareId}`, { categoryId }, authHeaders);
            router.push(`/?shareId=${data.data.shareId}`);
            return true;
        } catch {
            showToast?.error("Couldn't create the board", "Check your connection and try again.");
            return false;
        }
    };

    const renameBoard = async (board, title) => {
        if (!title || title === board.title) return;
        try {
            await axiosInstance.put(`/api/drawing/update/${board._id}`, { newTitle: title }, authHeaders);
            applyLocally(board.shareId, { title });
        } catch {
            showToast?.error("Couldn't rename the board", "Try again in a moment.");
        }
    };

    // The board stays on screen while it falls apart; settleSwept files it under Recently deleted afterwards.
    const sweepBoard = async (board) => {
        try {
            await axiosInstance.delete(`/api/drawing/delete/${board._id}`, authHeaders);
            return true;
        } catch {
            showToast?.error("Couldn't delete the board", "Try again in a moment.");
            return false;
        }
    };

    const settleSwept = (board) => {
        setDrawings((previous) => ({
            ...previous,
            ownedDrawings: previous.ownedDrawings.filter((d) => d.shareId !== board.shareId),
            sweptDrawings: [{ ...board, deletedAt: new Date().toISOString() }, ...previous.sweptDrawings.filter((d) => d.shareId !== board.shareId)],
        }));
    };

    const restoreBoard = async (board) => {
        try {
            await axiosInstance.post(`/api/drawing/restore/${board._id}`, {}, authHeaders);
        } catch {
            showToast?.error("Couldn't put the board back", "Try again in a moment.");
            return false;
        }
        setDrawings((previous) => {
            const back = { ...board, deletedAt: null };
            const owned = previous.ownedDrawings.some((d) => d.shareId === board.shareId) ? previous.ownedDrawings : [back, ...previous.ownedDrawings];
            return { ...previous, ownedDrawings: owned, sweptDrawings: previous.sweptDrawings.filter((d) => d.shareId !== board.shareId) };
        });
        return true;
    };

    const purgeBoard = async (board) => {
        try {
            await axiosInstance.delete(`/api/drawing/purge/${board._id}`, authHeaders);
            setDrawings((previous) => ({ ...previous, sweptDrawings: previous.sweptDrawings.filter((d) => d.shareId !== board.shareId) }));
            showToast?.success("Deleted for good", `${board.title || "Untitled board"} and its history are gone.`);
        } catch {
            showToast?.error("Couldn't delete the board", "Try again in a moment.");
        }
    };

    const categoryRequest = async (request, failure) => {
        try {
            await request();
            fetchCategories();
            return true;
        } catch (error) {
            showToast?.error(failure, error.response?.data?.message || "Try again in a moment.");
            return false;
        }
    };

    const categories = {
        create: (section, name) =>
            categoryRequest(() => axiosInstance.post("/api/organization/categories", { section, name }, authHeaders), "Couldn't add the category"),
        rename: (id, name) =>
            categoryRequest(() => axiosInstance.patch(`/api/organization/categories/${id}`, { name }, authHeaders), "Couldn't rename the category"),
        swap: (category, other) =>
            categoryRequest(
                () =>
                    Promise.all([
                        axiosInstance.patch(`/api/organization/categories/${category._id}`, { order: other.order }, authHeaders),
                        axiosInstance.patch(`/api/organization/categories/${other._id}`, { order: category.order }, authHeaders),
                    ]),
                "Couldn't reorder",
            ),
        remove: async (id) => {
            if (await categoryRequest(() => axiosInstance.delete(`/api/organization/categories/${id}`, authHeaders), "Couldn't delete the category"))
                fetchDrawings();
        },
    };

    return {
        authHeaders,
        drawings,
        isLoading,
        categoriesBySection,
        organize,
        createBoard,
        renameBoard,
        sweepBoard,
        settleSwept,
        restoreBoard,
        purgeBoard,
        categories,
    };
}
