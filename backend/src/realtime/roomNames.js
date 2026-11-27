// Signed-out and embedded viewers get element and background changes only, never presence or
// comments. "embed" is a view framed in another page; "link" is the board's own link.
export const WATCH_KINDS = ["embed", "link"];
export const watchRoom = (shareId, via) => `${via}:${shareId}`;
export const boardAndWatchers = (shareId) => [shareId, ...WATCH_KINDS.map((via) => watchRoom(shareId, via))];
