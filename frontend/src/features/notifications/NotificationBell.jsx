import { useState } from "react";
import { useRouter } from "next/router";
import axiosInstance from "@/lib/axiosInstance";
import Popover from "@/components/ui/Popover";
import StrokeIcon from "@/components/ui/StrokeIcon";
import { relativeTime } from "@/lib/relativeTime";
import useNotifications from "./useNotifications";
import styles from "./NotificationBell.module.css";

const ROLE_WORDS = { viewer: "view", commenter: "comment on", editor: "edit", owner: "own" };

const describe = ({ kind, actorName, boardTitle, preview }) => {
    const who = actorName ? `@${actorName}` : "Someone";
    const board = boardTitle || "a board";
    if (kind === "mention") return { title: `${who} mentioned you on ${board}`, detail: preview };
    if (kind === "shared") return { title: `${who} shared ${board} with you`, detail: preview ? `You can ${ROLE_WORDS[preview] ?? "open"} it.` : null };
    if (kind === "accessRequest") return { title: `${who} asked to open ${board}`, detail: null };
    return { title: board, detail: preview };
};

// The inbox: mentions, boards shared with you, and requests to open your boards, answered in place.
export default function NotificationBell({ token, className, rootClassName, showToast }) {
    const router = useRouter();
    const { notifications, unread, markRead, headers } = useNotifications(token);
    const [answered, setAnswered] = useState({});

    const open = (notification) => {
        markRead([notification.id]);
        router.push(`/?shareId=${encodeURIComponent(notification.shareId)}`);
    };

    const grant = async (notification, role) => {
        try {
            await axiosInstance.put(`/api/drawing/collaborators/${notification.shareId}`, { username: notification.actorName, role }, headers);
            setAnswered((current) => ({ ...current, [notification.id]: role }));
            markRead([notification.id]);
        } catch (error) {
            showToast?.error("Couldn't share the board", error.response?.data?.message || "Try again in a moment.");
        }
    };

    return (
        <Popover
            align="end"
            className={rootClassName}
            trigger={
                <button type="button" className={className} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
                    <StrokeIcon name="inbox" size={18} />
                    {unread > 0 && (
                        <span className={styles.badge} aria-hidden="true">
                            {unread > 9 ? "9+" : unread}
                        </span>
                    )}
                </button>
            }
        >
            <div className={styles.panel}>
                <div className={styles.head}>
                    <h2>Notifications</h2>
                    {unread > 0 && (
                        <button type="button" className={styles.markAll} onClick={() => markRead()}>
                            Mark all read
                        </button>
                    )}
                </div>
                {notifications.length === 0 ? (
                    <p className={styles.empty}>Nothing yet. Mentions, shared boards and access requests show up here.</p>
                ) : (
                    <ul className={styles.list}>
                        {notifications.map((notification) => {
                            const { title, detail } = describe(notification);
                            const grantedRole = answered[notification.id] ?? notification.grantedRole;
                            return (
                                <li key={notification.id} className={styles.item} data-unread={!notification.read}>
                                    <button type="button" className={styles.itemMain} onClick={() => open(notification)}>
                                        <span className={styles.itemTitle}>{title}</span>
                                        {detail && <span className={styles.itemDetail}>{detail}</span>}
                                        <span className={styles.itemTime}>{relativeTime(notification.createdAt)}</span>
                                    </button>
                                    {notification.kind === "accessRequest" && notification.actorName && (
                                        <div className={styles.answer}>
                                            {grantedRole ? (
                                                <span className={styles.granted}>They can {ROLE_WORDS[grantedRole]} it now</span>
                                            ) : (
                                                <>
                                                    <button type="button" className={styles.answerButton} onClick={() => grant(notification, "viewer")}>
                                                        Let them view
                                                    </button>
                                                    <button type="button" className={styles.answerButton} onClick={() => grant(notification, "editor")}>
                                                        Let them edit
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </Popover>
    );
}
