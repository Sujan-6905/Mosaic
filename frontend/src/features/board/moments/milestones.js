// The piece counts a board marks once, quietly: a hundred, five hundred, then every thousand.
export const milestoneCrossed = (before, after) => {
    if (after <= before) return null;
    const marks = [100, 500];
    for (let mark = 1000; mark <= after; mark += 1000) marks.push(mark);
    return marks.filter((mark) => before < mark && mark <= after).at(-1) ?? null;
};

const ORDINALS = { 100: "hundredth", 500: "five hundredth", 1000: "thousandth" };
export const ordinalPiece = (mark) => ORDINALS[mark] ?? `${(mark / 1000).toLocaleString("en-GB")} thousandth`;

const KIND_NAMES = {
    sticky: "a sticky note",
    text: "some text",
    path: "a pen stroke",
    connector: "an arrow",
    stamp: "a stamp",
    image: "an image",
    frame: "a frame",
    table: "a table",
};
export const pieceName = (element) => KIND_NAMES[element?.type] ?? "a shape";
