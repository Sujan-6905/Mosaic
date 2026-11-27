// Authorization over any { owner, collaborators } object, testable without a database.
const ROLES = { OWNER: "owner", EDITOR: "editor", COMMENTER: "commenter", VIEWER: "viewer" };

// Higher rank subsumes every capability of the ranks below it: editing
// implies commenting implies viewing.
const ROLE_RANK = {
    [ROLES.VIEWER]: 0,
    [ROLES.COMMENTER]: 1,
    [ROLES.EDITOR]: 2,
    [ROLES.OWNER]: 3,
};

// What a board's owner lets agents (MCP tokens and connected apps) do on it.
// Even "edit" stops short of owner: an agent never deletes a board or changes who has access.
const AGENT_ACCESS = ["edit", "comment", "read", "none"];
const AGENT_CEILING = { edit: ROLES.EDITOR, comment: ROLES.COMMENTER, read: ROLES.VIEWER, none: null };
// Anything but "none" lets anyone with the link see the board, signed in or not;
// "commenter" and "editor" also let anyone signed in with it comment or edit.
const LINK_ACCESS = ["none", ROLES.VIEWER, ROLES.COMMENTER, ROLES.EDITOR];
const isLinkShared = (drawing) => drawing.linkAccess !== "none" && LINK_ACCESS.includes(drawing.linkAccess);

const hasAtLeastRank = (role, minRole) => role !== null && role !== undefined && ROLE_RANK[role] >= ROLE_RANK[minRole];

const capAt = (role, ceiling) => {
    if (!role || !ceiling) return null;
    return ROLE_RANK[role] > ROLE_RANK[ceiling] ? ceiling : role;
};

// `who` is a user id or a token's { userId, scope, boards, agent }: board-limited tokens see
// no other boards, read-only tokens never write, agents never exceed the owner's allowance.
const asCaller = (who) => (typeof who === "string" ? { userId: who } : who);

// A person's own sign-in, not an agent, a board-limited token or an embed's sign-in.
const isFullSignIn = (who) => {
    const caller = asCaller(who);
    return Boolean(caller?.userId) && !caller.agent && !caller.boards;
};
const callerId = (who) => asCaller(who)?.userId ?? null;

// A swept board is out of reach for everyone, its owner included, until it is put back.
const isSwept = (drawing) => Boolean(drawing.deletedAt);

const getRole = (drawing, who) => {
    const caller = asCaller(who);
    if (!caller?.userId || isSwept(drawing)) return null;
    if (caller.boards && !caller.boards.includes(drawing.shareId)) return null;
    let role = drawing.owner === caller.userId ? ROLES.OWNER : ((drawing.collaborators || []).find((c) => c.userId === caller.userId)?.role ?? null);
    // A link's comment or edit rights reach only the person themself; anything acting for them by link alone only views.
    if (!role && isLinkShared(drawing)) role = isFullSignIn(caller) ? drawing.linkAccess : ROLES.VIEWER;
    if (caller.agent) role = capAt(role, AGENT_CEILING[drawing.agentAccess ?? "edit"]);
    if (caller.scope === "read") role = capAt(role, ROLES.VIEWER);
    return role;
};

// What someone may do from a board's link: their own role if signed in, else
// a viewer's, with no account at all, when the board is shared by link.
const linkRole = (drawing, who) => (who ? getRole(drawing, who) : null) ?? (isLinkShared(drawing) && !isSwept(drawing) ? ROLES.VIEWER : null);

// The same inside someone else's page, where a signed-out viewer also needs the owner to have turned embedding on.
const embedRole = (drawing, who) => (who ? getRole(drawing, who) : null) ?? (drawing.embed?.enabled ? linkRole(drawing, null) : null);

// The rule each watch room admits by.
const WATCH_ROLES = { embed: embedRole, link: linkRole };

const hasAtLeastRole = (drawing, who, minRole) => hasAtLeastRank(getRole(drawing, who), minRole);

const hasViewAccess = (drawing, who) => hasAtLeastRole(drawing, who, ROLES.VIEWER);
const hasCommentAccess = (drawing, who) => hasAtLeastRole(drawing, who, ROLES.COMMENTER);
const hasEditAccess = (drawing, who) => hasAtLeastRole(drawing, who, ROLES.EDITOR);
// Owner only: an editor must never remove the board or reassign roles.
const hasDeleteAccess = (drawing, who) => getRole(drawing, who) === ROLES.OWNER;

export {
    ROLES,
    AGENT_ACCESS,
    LINK_ACCESS,
    isLinkShared,
    isFullSignIn,
    isSwept,
    ROLE_RANK,
    getRole,
    embedRole,
    linkRole,
    WATCH_ROLES,
    callerId,
    hasAtLeastRank,
    hasViewAccess,
    hasCommentAccess,
    hasEditAccess,
    hasDeleteAccess,
};
