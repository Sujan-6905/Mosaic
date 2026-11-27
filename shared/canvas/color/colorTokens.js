// Pure black and white flip with the theme; every other colour stays literal hex.
const BLACK = "#000000";
const WHITE = "#ffffff";

export const colorTokenFor = (hexColor) => {
    if (hexColor === BLACK) return "ink-primary";
    if (hexColor === WHITE) return "ink-inverse";
    return null;
};
