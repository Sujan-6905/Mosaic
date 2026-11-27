// Quick reactions people drop on a board. Each is a coloured disc with a glyph
// drawn on a 24-unit grid, or short text; `ink` is picked to read on `color`.
export const STAMP_KINDS = [
    { id: "plusOne", label: "Plus one", color: "#2563eb", ink: "#ffffff", text: "+1" },
    { id: "check", label: "Agree", color: "#15803d", ink: "#ffffff", glyph: "M6 12.5l4 4 8-9" },
    { id: "heart", label: "Love it", color: "#e11d48", ink: "#ffffff", glyph: "M12 19s-6.5-4-6.5-9a3.6 3.6 0 016.5-2.2A3.6 3.6 0 0118.5 10c0 5-6.5 9-6.5 9z" },
    { id: "star", label: "Star", color: "#f59e0b", ink: "#1c1917", glyph: "M12 4.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z" },
    { id: "question", label: "Question", color: "#7c3aed", ink: "#ffffff", glyph: "M9.5 9.5a2.5 2.5 0 114.2 1.8c-.9.8-1.7 1.3-1.7 2.7M12 17.5h.01" },
    { id: "idea", label: "Idea", color: "#0e7490", ink: "#ffffff", glyph: "M9.5 17.5h5M10.5 20h3M12 4a5.5 5.5 0 00-3.2 10V15.5h6.4V14A5.5 5.5 0 0012 4z" },
];

export const STAMP_KIND_IDS = STAMP_KINDS.map((kind) => kind.id);
export const stampKindOf = (id) => STAMP_KINDS.find((kind) => kind.id === id) ?? STAMP_KINDS[0];
export const DEFAULT_STAMP_SCREEN_SIZE = 40;
