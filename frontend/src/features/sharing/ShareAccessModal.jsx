import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import StrokeIcon from "@/components/ui/StrokeIcon";
import { initialsOf } from "@/components/AppHeader";
import axiosInstance from "@/lib/axiosInstance";
import { socket } from "@/lib/socket.js";
import styles from "./ShareAccessModal.module.css";

const ROLE_LABELS = { editor: "Editor", commenter: "Commenter", viewer: "Viewer" };
const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));
const AVATAR_TONES = ["#8fb8ff", "#9fe0b4", "#d9c2ff", "#ffb3a7", "#ffd27a", "#9fd3ff"];

const DAY_MS = 24 * 60 * 60 * 1000;
const formatLastSeen = (iso) => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    return days < 30 ? `${days} days ago` : new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

const toneFor = (name = "") => AVATAR_TONES[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_TONES.length];

const ShareAccessModal = ({ isOpen, onClose, shareId, boardTitle, isOwner, showToast, live = false }) => {
    const { data: session } = useSession();
    const token = session?.accessToken || null;
    const authHeaders = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

    const [collaborators, setCollaborators] = useState([]);
    const [owner, setOwner] = useState(null);
    const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());
    const [isFetching, setIsFetching] = useState(false);
    const [query, setQuery] = useState("");
    const [role, setRole] = useState("editor");
    const [suggestions, setSuggestions] = useState([]);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const username = query.trim().replace(/^@/, "");
    const matchedUser = suggestions.find((user) => user.username === username) || null;
    const shareUrl = shareId && typeof window !== "undefined" ? `${window.location.origin}/?shareId=${shareId}` : "";
    const currentUserId = session?.user?.id;
    const ownerId = owner?._id;

    useEffect(() => {
        if (!isOwner || !token || !shareId || !username) {
            setSuggestions([]);
            return undefined;
        }
        const timeout = setTimeout(async () => {
            try {
                const { data } = await axiosInstance.get(`/api/drawing/collaborators/${shareId}/search`, {
                    ...authHeaders,
                    params: { q: username },
                });
                setSuggestions(data.users);
            } catch {
                setSuggestions([]);
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [username, isOwner, token, shareId, authHeaders]);

    const fetchCollaborators = useCallback(async () => {
        if (!shareId || !token) return;
        setIsFetching(true);
        try {
            const { data } = await axiosInstance.get(`/api/drawing/collaborators/${shareId}`, authHeaders);
            setCollaborators(data.collaborators);
            setOwner(data.owner ?? null);
        } catch (error) {
            showToast?.error("Couldn't load who has access", error.response?.data?.message || "Try again in a moment.");
        } finally {
            setIsFetching(false);
        }
    }, [shareId, token, authHeaders, showToast]);

    useEffect(() => {
        if (isOpen && token) fetchCollaborators();
    }, [isOpen, token, fetchCollaborators]);

    useEffect(() => {
        if (!live || !isOpen || !shareId) return undefined;
        const handlePresenceUpdate = (participants) => setOnlineUserIds(new Set(participants.map((participant) => participant.userId)));
        const handleRoleChanged = ({ shareId: changedShareId }) => {
            if (changedShareId === shareId) fetchCollaborators();
        };
        socket.on("server:presenceUpdate", handlePresenceUpdate);
        socket.on("server:roleChanged", handleRoleChanged);
        return () => {
            socket.off("server:presenceUpdate", handlePresenceUpdate);
            socket.off("server:roleChanged", handleRoleChanged);
        };
    }, [live, isOpen, shareId, fetchCollaborators]);

    const invite = async () => {
        if (!matchedUser) {
            showToast?.error("That username isn't on Mosaic", "Pick someone from the suggestions as you type.");
            return;
        }
        try {
            await axiosInstance.put(`/api/drawing/collaborators/${shareId}`, { username, role }, authHeaders);
            showToast?.success(
                matchedUser.alreadyCollaborator ? "Role updated" : "Invited",
                matchedUser.alreadyCollaborator ? `${username} is now a ${ROLE_LABELS[role]}.` : `${username} can open this board now.`,
            );
            setQuery("");
            setRole("editor");
            setSuggestions([]);
            fetchCollaborators();
        } catch (error) {
            showToast?.error("Couldn't invite them", error.response?.data?.message || "Try again in a moment.");
        }
    };

    const removePerson = async (target) => {
        try {
            await axiosInstance.delete(`/api/drawing/collaborators/${shareId}`, { ...authHeaders, data: { username: target } });
            showToast?.success("Removed", `${target} no longer has access.`);
            fetchCollaborators();
        } catch (error) {
            showToast?.error("Couldn't remove them", error.response?.data?.message || "Try again in a moment.");
        }
    };

    const changeRole = async (target, nextRole) => {
        try {
            await axiosInstance.patch(`/api/drawing/collaborators/${shareId}/role`, { username: target, role: nextRole }, authHeaders);
            showToast?.success("Role updated", `${target} is now a ${ROLE_LABELS[nextRole]}.`);
            fetchCollaborators();
        } catch (error) {
            showToast?.error("Couldn't change the role", error.response?.data?.message || "Try again in a moment.");
        }
    };

    const copyLink = async () => {
        await navigator.clipboard?.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
    };

    const onlineCount = collaborators.filter((person) => onlineUserIds.has(person._id)).length + (ownerId && onlineUserIds.has(ownerId) ? 1 : 0);
    const total = collaborators.length + (ownerId ? 1 : 0);
    const showSuggestions = suggestionsOpen && suggestions.length > 0;
    const existingMatch = matchedUser?.alreadyCollaborator ? matchedUser : null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={boardTitle ? `Share ${boardTitle}` : "Share"} size="md">
            <div className={styles.content}>
                {isOwner && (
                    <div className={styles.inviteBlock}>
                        <div className={styles.inviteRow}>
                            <label className={styles.inviteField}>
                                <span className={styles.at}>@</span>
                                <input
                                    type="text"
                                    role="combobox"
                                    value={query}
                                    placeholder="Invite by username"
                                    aria-label="Invite by username"
                                    aria-expanded={showSuggestions}
                                    aria-controls="shareSuggestions"
                                    autoComplete="off"
                                    onFocus={() => setSuggestionsOpen(true)}
                                    onChange={(event) => {
                                        setQuery(event.target.value);
                                        setSuggestionsOpen(true);
                                    }}
                                    onKeyDown={(event) => event.key === "Enter" && invite()}
                                />
                            </label>
                            <Select ariaLabel="Role for the new person" value={role} onChange={setRole} options={ROLE_OPTIONS} />
                            <button type="button" className={styles.invite} onClick={invite} disabled={!matchedUser}>
                                Invite
                            </button>
                        </div>
                        {showSuggestions && (
                            <ul id="shareSuggestions" role="listbox" className={styles.suggestions}>
                                {suggestions.map((user) => (
                                    <li key={user._id} role="option" aria-selected={user.username === username}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setQuery(user.username);
                                                if (user.alreadyCollaborator) setRole(user.role);
                                                setSuggestionsOpen(false);
                                            }}
                                        >
                                            <span className={styles.smallAvatar} style={{ background: toneFor(user.username) }}>
                                                {initialsOf(user.username)}
                                            </span>
                                            <span className={styles.suggestionName}>{user.username}</span>
                                            {user.alreadyCollaborator && (
                                                <span className={styles.suggestionNote}>Has access, {ROLE_LABELS[user.role] || user.role}</span>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {existingMatch && (
                            <p className={styles.hint}>
                                {existingMatch.username} already has access as a {ROLE_LABELS[existingMatch.role] || existingMatch.role}. Inviting again changes
                                their role instead.
                            </p>
                        )}
                    </div>
                )}

                <div className={styles.people}>
                    <div className={styles.peopleHead}>
                        <h3>People with access</h3>
                        {!isFetching && (
                            <span>
                                {total} {total === 1 ? "person" : "people"}
                                {live ? `, ${onlineCount} online` : ""}
                            </span>
                        )}
                    </div>
                    {ownerId && (
                        <div className={styles.person}>
                            <span className={styles.avatarWrap}>
                                <span className={styles.avatar} style={{ background: "var(--color-brand-fill)" }}>
                                    {initialsOf(owner.username || "Owner")}
                                </span>
                                {onlineUserIds.has(ownerId) && <span className={styles.onlineDot} title="Online now" />}
                            </span>
                            <span className={styles.personText}>
                                <strong>
                                    {owner.username || "Board owner"}
                                    {ownerId === currentUserId ? " (you)" : ""}
                                </strong>
                                <span>Created this board</span>
                            </span>
                            <span className={styles.fixedRole}>Owner</span>
                        </div>
                    )}
                    {collaborators.map((person) => (
                        <div key={person._id} className={styles.person}>
                            <span className={styles.avatarWrap}>
                                <span className={styles.avatar} style={{ background: toneFor(person.username) }}>
                                    {initialsOf(person.username)}
                                </span>
                                {onlineUserIds.has(person._id) && <span className={styles.onlineDot} title="Online now" />}
                            </span>
                            <span className={styles.personText}>
                                <strong>
                                    {person.username}
                                    {person._id === currentUserId ? " (you)" : ""}
                                </strong>
                                {onlineUserIds.has(person._id) ? (
                                    <span>Online now</span>
                                ) : (
                                    person.lastSeenAt && <span>Last seen {formatLastSeen(person.lastSeenAt)}</span>
                                )}
                            </span>
                            {isOwner ? (
                                <>
                                    <Select
                                        ariaLabel={`Role for ${person.username}`}
                                        value={person.role}
                                        onChange={(nextRole) => changeRole(person.username, nextRole)}
                                        options={ROLE_OPTIONS}
                                    />
                                    <button
                                        type="button"
                                        className={styles.remove}
                                        aria-label={`Remove ${person.username}`}
                                        onClick={() => removePerson(person.username)}
                                    >
                                        <StrokeIcon name="close" size={13} strokeWidth={2.4} />
                                    </button>
                                </>
                            ) : (
                                <span className={styles.fixedRole}>{ROLE_LABELS[person.role] || person.role}</span>
                            )}
                        </div>
                    ))}
                    {!isFetching && collaborators.length === 0 && (
                        <p className={styles.hint}>
                            {isOwner ? "Just you so far. Invite someone by their username above." : "Nobody else has been invited yet."}
                        </p>
                    )}
                </div>

                <div className={styles.linkBlock} data-tour="share-link">
                    <span className={styles.linkLabel}>Board link</span>
                    <div className={styles.linkRow}>
                        <span className={styles.link}>{shareUrl}</span>
                        <button type="button" className={styles.copy} onClick={copyLink}>
                            <StrokeIcon name="duplicate" size={14} />
                            {copied ? "Copied" : "Copy link"}
                        </button>
                    </div>
                    <p className={styles.lockNote}>
                        <StrokeIcon name="lock" size={14} />
                        Only people listed above can open this link. Invite someone first, then send it.
                    </p>
                </div>
            </div>
        </Modal>
    );
};

export default ShareAccessModal;
