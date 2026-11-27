import axiosInstance from "@/lib/axiosInstance";
import axios from "axios";
import { MENU_ITEMS } from "./toolSettings";
import { menuItemClick } from "@/store/menuSlice";
import { useCallback, useEffect } from "react";
import { viewportWorldBounds } from "../camera/camera";
import { MAX_IMAGE_INSERT_WIDTH, generateElementId, withSchemaV2Fields } from "../state/boardHelpers";

// Pictures from the picker, a paste or a drop upload straight to Cloudinary; the board stores only the link.
export const useImageInsert = (board) => {
    const {
        activeMenuItem,
        addElement,
        cameraRef,
        dispatch,
        elements,
        fileInputRef,
        pendingImagePlacementRef,
        session,
        setSelectedElementIds,
        showToast,
        viewportSizeRef,
    } = board;

    const viewportCenter = useCallback(() => {
        const bounds = viewportWorldBounds(cameraRef.current, viewportSizeRef.current.width, viewportSizeRef.current.height);
        return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
    }, [cameraRef, viewportSizeRef]);

    const insertImageFile = useCallback(
        async (file, placement) => {
            try {
                const { data: signed } = await axiosInstance.get("/api/upload/cloudinary-signature", {
                    headers: { Authorization: `Bearer ${session?.accessToken}` },
                });
                const form = new FormData();
                form.append("file", file);
                form.append("api_key", signed.apiKey);
                form.append("timestamp", signed.timestamp);
                form.append("signature", signed.signature);
                if (signed.folder) form.append("folder", signed.folder);
                const { data: uploaded } = await axios.post(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, form);
                const naturalWidth = uploaded.width || 400;
                const naturalHeight = uploaded.height || 300;
                const displayWidth = Math.min(MAX_IMAGE_INSERT_WIDTH, naturalWidth);
                const displayHeight = displayWidth * (naturalHeight / naturalWidth);
                const elementId = generateElementId();
                addElement(
                    elementId,
                    withSchemaV2Fields(
                        {
                            type: "image",
                            startX: placement.x - displayWidth / 2,
                            startY: placement.y - displayHeight / 2,
                            endX: placement.x + displayWidth / 2,
                            endY: placement.y + displayHeight / 2,
                            src: uploaded.secure_url,
                            publicId: uploaded.public_id,
                            opacity: 100,
                        },
                        elements,
                    ),
                );
                setSelectedElementIds([elementId]);
            } catch (error) {
                showToast?.error("Upload failed", error.response?.data?.message || "Image upload failed");
            }
        },
        [session?.accessToken, elements, addElement, showToast, setSelectedElementIds],
    );

    const handleImageFileSelected = useCallback(
        (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            const placement = pendingImagePlacementRef.current ?? viewportCenter();
            pendingImagePlacementRef.current = null;
            if (file) insertImageFile(file, placement);
        },
        [pendingImagePlacementRef, viewportCenter, insertImageFile],
    );

    // Picking Image opens the file picker at once, rather than waiting for a
    // click on the board that nothing tells you to make.
    useEffect(() => {
        if (activeMenuItem !== MENU_ITEMS.IMAGE) return;
        pendingImagePlacementRef.current = viewportCenter();
        fileInputRef.current?.click();
        dispatch(menuItemClick(MENU_ITEMS.SELECT));
    }, [activeMenuItem, pendingImagePlacementRef, viewportCenter, fileInputRef, dispatch]);

    return { handleImageFileSelected, insertImageFile, viewportCenter };
};
