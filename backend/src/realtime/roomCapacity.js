import { ROLES } from "../models/accessControl.js";

const PRESENCE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];

// A visitor without an account is named after the stone their cursor colour comes from.
const STONE_NAMES = {
    "#ef4444": "Jasper",
    "#f97316": "Carnelian",
    "#eab308": "Citrine",
    "#22c55e": "Malachite",
    "#06b6d4": "Turquoise",
    "#3b82f6": "Lapis",
    "#8b5cf6": "Amethyst",
    "#ec4899": "Rhodonite",
};

export const guestNameFor = (color) => `Guest ${STONE_NAMES[color] ?? "Marble"}`;

// Enough for several tabs and an agent or two, not enough for one account to fill a board.
export const MAX_CONNECTIONS_PER_PERSON = 8;

// The first colour nobody in the room is using, so a colour freed by someone leaving is reused.
export const nextPresenceColor = (present) => {
    const taken = new Set(present.map((participant) => participant.color));
    return PRESENCE_COLORS.find((color) => !taken.has(color)) ?? PRESENCE_COLORS[present.length % PRESENCE_COLORS.length];
};

// A board's cap counts people, not connections, and never shuts out its owner or a connection re-joining.
export const capacityRefusal = ({ present, socketId, userId, role, maxPeople }) => {
    if (present.some((participant) => participant.socketId === socketId)) return null;
    const people = new Set(present.map((participant) => participant.userId));
    const ownConnections = present.filter((participant) => participant.userId === userId).length;
    if (ownConnections >= MAX_CONNECTIONS_PER_PERSON) return { reason: "tooManyConnections", people: people.size };
    if (role === ROLES.OWNER || people.has(userId)) return null;
    return people.size >= maxPeople ? { reason: "full", people: people.size } : null;
};
