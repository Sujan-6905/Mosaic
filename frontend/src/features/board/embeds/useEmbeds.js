import { MENU_ITEMS } from "../tools/toolSettings";
import { menuItemClick } from "@/store/menuSlice";
import { useCallback, useEffect, useState } from "react";
import { generateElementId, withSchemaV2Fields } from "../state/boardHelpers";

const EMBED_WIDTH = 640;
const EMBED_HEIGHT = 400;

const titleFor = (url) => {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
};

// Live web pages on the board. The page itself is a DOM layer that follows the
// camera; it only takes the pointer once someone chooses to interact with it.
export const useEmbeds = (board) => {
    const { activeMenuItem, addElement, dispatch, elements, setSelectedElementIds, viewportCenter } = board;
    const [embedDialogOpen, setEmbedDialogOpen] = useState(false);
    const [activeEmbedId, setActiveEmbedId] = useState(null);

    useEffect(() => {
        if (activeMenuItem !== MENU_ITEMS.EMBED) return;
        setEmbedDialogOpen(true);
        dispatch(menuItemClick(MENU_ITEMS.SELECT));
    }, [activeMenuItem, dispatch]);

    const insertEmbed = useCallback(
        (url, at) => {
            const center = at ?? viewportCenter();
            const elementId = generateElementId();
            addElement(
                elementId,
                withSchemaV2Fields(
                    {
                        type: "embed",
                        startX: center.x - EMBED_WIDTH / 2,
                        startY: center.y - EMBED_HEIGHT / 2,
                        endX: center.x + EMBED_WIDTH / 2,
                        endY: center.y + EMBED_HEIGHT / 2,
                        url,
                        title: titleFor(url),
                        opacity: 100,
                    },
                    elements,
                ),
            );
            setSelectedElementIds([elementId]);
        },
        [viewportCenter, addElement, elements, setSelectedElementIds],
    );

    return { activeEmbedId, embedDialogOpen, insertEmbed, setActiveEmbedId, setEmbedDialogOpen };
};
