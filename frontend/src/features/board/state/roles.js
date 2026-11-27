// The same rank order as backend/models/accessControl.js; the server re-checks every change anyway.
const ROLE_RANK = { viewer: 0, commenter: 1, editor: 2, owner: 3 };

export const hasCommentAccess = (role) => role != null && ROLE_RANK[role] >= ROLE_RANK.commenter;
export const hasEditAccess = (role) => role != null && ROLE_RANK[role] >= ROLE_RANK.editor;
