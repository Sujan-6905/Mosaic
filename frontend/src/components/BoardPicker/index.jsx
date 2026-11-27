import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import styles from "./index.module.css";

// A checklist of every board the signed-in person can open, for limiting a credential to some of them.
export default function BoardPicker({ token, chosen, onChange }) {
    const [boards, setBoards] = useState(null);

    useEffect(() => {
        if (!token) return;
        axiosInstance
            .get("/api/drawing/get", { headers: { Authorization: `Bearer ${token}` } })
            .then(({ data }) => setBoards([...(data.data?.ownedDrawings ?? []), ...(data.data?.sharedWithDrawings ?? [])]))
            .catch(() => setBoards([]));
    }, [token]);

    const toggle = (shareId) => onChange(chosen.includes(shareId) ? chosen.filter((id) => id !== shareId) : [...chosen, shareId]);

    if (!boards) return <p className={styles.note}>Loading your boards.</p>;
    if (boards.length === 0) return <p className={styles.note}>You have no boards to pick yet.</p>;
    return (
        <ul className={styles.boardList}>
            {boards.map((board) => (
                <li key={board.shareId}>
                    <label>
                        <input type="checkbox" checked={chosen.includes(board.shareId)} onChange={() => toggle(board.shareId)} />
                        {board.title || "Untitled board"}
                    </label>
                </li>
            ))}
        </ul>
    );
}
