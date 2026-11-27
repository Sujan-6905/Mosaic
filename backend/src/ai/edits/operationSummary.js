// One operation as the preview checklist's line ("Align 3 objects to left edge"), using real names.
import { batchRefIndex } from "./editLanguage.js";
import { colorName, normalizeColor } from "../turn/colorNames.js";

const nameOf = (nameByRef, ref) => (batchRefIndex(ref) === null ? nameByRef.get(ref) || ref : `new item ${batchRefIndex(ref) + 1}`);
const namesOf = (nameByRef, refs) => refs.map((ref) => nameOf(nameByRef, ref)).join(", ");

const FONT_WORDS = { hand: "handwritten", sans: "sans", serif: "serif", mono: "monospace" };

// What a restyle does, in the words a person would use: "fill PostgreSQL green and fade it to 60%".
const describeRestyle = ({ ref, props }, nameByRef) => {
    const name = `"${nameOf(nameByRef, ref)}"`;
    const parts = [];
    if ("fillColor" in props) parts.push(props.fillColor ? `fill ${name} ${colorName(props.fillColor) ?? "with a new colour"}` : `clear the fill of ${name}`);
    if (props.color) parts.push(`make ${parts.length ? "its" : `${name}'s`} lines and text ${colorName(props.color) ?? "a new colour"}`);
    if (props.font) parts.push(`set ${parts.length ? "it" : name} in a ${FONT_WORDS[props.font]} font`);
    if (props.size !== undefined) parts.push(`change ${parts.length ? "its" : `${name}'s`} size to ${props.size}`);
    if (props.opacity !== undefined) parts.push(`fade ${parts.length ? "it" : name} to ${props.opacity}%`);
    const sentence = parts.join(" and ");
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
};

const SUMMARIZERS = {
    align: (op, nameByRef) => `Align ${op.refs.length} object${op.refs.length === 1 ? "" : "s"} to ${op.edge}`,
    distribute: (op, nameByRef) => `Distribute ${op.refs.length} objects ${op.axis}ly`,
    place: (op, nameByRef) => `Move "${nameOf(nameByRef, op.ref)}" ${op.relation} "${nameOf(nameByRef, op.anchorRef)}"`,
    resizeToFit: (op, nameByRef) => `Resize "${nameOf(nameByRef, op.ref)}" to fit its contents`,
    connect: (op, nameByRef) => `Connect "${nameOf(nameByRef, op.refA)}" to "${nameOf(nameByRef, op.refB)}"`,
    disconnect: (op, nameByRef) => `Disconnect "${nameOf(nameByRef, op.refA)}" from "${nameOf(nameByRef, op.refB)}"`,
    restyle: describeRestyle,
    setText: (op, nameByRef) => `Change the text on "${nameOf(nameByRef, op.ref)}"`,
    group: (op, nameByRef) => `Group ${op.refs.length} objects: ${namesOf(nameByRef, op.refs)}`,
    ungroup: (op, nameByRef) => `Ungroup "${nameOf(nameByRef, op.ref)}"`,
    duplicate: (op, nameByRef) => `Duplicate "${nameOf(nameByRef, op.ref)}"${op.anchorRef ? ` ${op.relation} "${nameOf(nameByRef, op.anchorRef)}"` : ""}`,
    delete: (op, nameByRef) => `Delete ${op.refs.length} object${op.refs.length === 1 ? "" : "s"}: ${namesOf(nameByRef, op.refs)}`,
    reorder: (op, nameByRef) => `Move "${nameOf(nameByRef, op.ref)}" ${op.direction}`,
    moveToFrame: (op, nameByRef) =>
        op.frameRef ? `Move "${nameOf(nameByRef, op.ref)}" into "${nameOf(nameByRef, op.frameRef)}"` : `Remove "${nameOf(nameByRef, op.ref)}" from its frame`,
    tidy: (op, nameByRef) => `Tidy ${op.refs.length} objects ${op.direction}`,
    add: (op, nameByRef) =>
        `Add a ${op.kind}${op.kind === "table" && op.rows ? ` of ${op.rows.length} rows` : op.text ? ` ${op.kind === "icon" ? "of" : "saying"} "${op.text}"` : ""}${op.anchorRef ? ` ${op.relation ?? "right-of"} "${nameOf(nameByRef, op.anchorRef)}"` : ""}`,
    cleanUp: (op, nameByRef) => `Clean up the hand-drawn strokes in ${namesOf(nameByRef, op.refs)}`,
    resize: (op, nameByRef) => `Resize ${namesOf(nameByRef, op.refs)} to ${Math.round(op.factor * 100)}%`,
    move: (op, nameByRef) => `Move ${namesOf(nameByRef, op.refs)} ${op.direction}`,
    rotate: (op, nameByRef) => `Rotate ${namesOf(nameByRef, op.refs)} by ${op.degrees} degrees`,
    frame: (op, nameByRef) => `Put ${namesOf(nameByRef, op.refs)} in a frame called "${op.name}"`,
    lock: (op, nameByRef) => `Lock ${namesOf(nameByRef, op.refs)}`,
    drawParts: (op) => `Draw ${op.title}`,
};

export const describeOperation = (op, nameByRef) => (SUMMARIZERS[op.op] || (() => op.op))(op, nameByRef);

export const buildNameByRefMap = (groundedScene) => new Map(groundedScene.objects.map((object) => [object.ref, object.name]));

const elementIdsTouchedBy = ({ updatedById = {}, newElementsById = {}, deletedIds = [] }) => [
    ...Object.keys(updatedById),
    ...Object.keys(newElementsById),
    ...deletedIds,
];

// One row per op that applies, in batch order; `index` is what a partial commit filters by, and
// elementIds show what unticking a row affects, and a recolour carries its new colour as a swatch.
export const buildOpsPreview = (ops, nameByRef, opResults) =>
    ops.flatMap((op, index) =>
        opResults[index].applied
            ? [
                  {
                      index,
                      op: op.op,
                      summary: describeOperation(op, nameByRef),
                      elementIds: elementIdsTouchedBy(opResults[index]),
                      ...(op.op === "restyle" && normalizeColor(op.props.fillColor ?? op.props.color)
                          ? { swatch: normalizeColor(op.props.fillColor ?? op.props.color) }
                          : {}),
                  },
              ]
            : [],
    );
