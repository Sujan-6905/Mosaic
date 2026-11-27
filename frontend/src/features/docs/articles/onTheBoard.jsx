import Link from "next/link";
import { Callout, DocLink, Keys, Section, Steps } from "./primitives";

function Drawing() {
    return (
        <>
            <p>The dock along the bottom of a board holds every tool, grouped from left to right: undo, moving around, drawing, and extras.</p>

            <Section id="freehand" title="Freehand ink">
                <p>
                    Pick the pencil with <Keys keys={["P"]} /> and drag. Pen, pencil and highlighter sit in the bar above the dock, with size, ink, pressure and
                    steadying in the width menu. A pen or stylus that reports pressure draws thicker as you press harder.
                </p>
                <p>
                    <strong>Shape Assist</strong>, under More, turns a rough stroke into a clean shape once you finish drawing it.
                </p>
            </Section>

            <Section id="shapes" title="Shapes">
                <p>
                    Press <Keys keys={["R"]} /> for a rectangle or <Keys keys={["O"]} /> for an ellipse. The bar above the dock switches between rectangles,
                    circles, diamonds, stars, hexagons, databases, clouds, documents, callouts, block arrows and more. Drag to draw one, or click for a default
                    size.
                </p>
                <ul>
                    <li>
                        <Keys keys={["Shift"]} /> keeps a shape square or a circle round.
                    </li>
                    <li>
                        <Keys keys={["Alt"]} /> draws it out from the middle.
                    </li>
                    <li>Double-click any closed shape to write inside it.</li>
                </ul>
            </Section>

            <Section id="erase-and-fill" title="Erasing and filling">
                <p>
                    The eraser, <Keys keys={["E"]} />, removes whole objects it passes over, and you can undo that like anything else. The fill bucket,{" "}
                    <Keys keys={["B"]} />, colours the inside of the shape you click.
                </p>
            </Section>

            <Section id="lasso" title="Lasso selection">
                <p>
                    The lasso, <Keys keys={["Q"]} />, selects everything inside a loop you draw, which suits loose clusters that a rectangle would cut through.
                    Holding <Keys keys={["Alt"]} /> while you drag from empty board does the same with the select tool.
                </p>
            </Section>

            <Section id="undo" title="Undo and redo">
                <p>
                    <Keys keys={["Ctrl", "Z"]} /> undoes your own last action, never a collaborator&apos;s, and <Keys keys={["Ctrl", "Shift", "Z"]} /> brings it
                    back. A slider or a held key records one step, not one per tiny change.
                </p>
            </Section>
        </>
    );
}

function TextAndNotes() {
    return (
        <>
            <Section id="text" title="Text">
                <p>
                    Press <Keys keys={["T"]} /> and click to start typing, or drag to set the width first. Double-clicking empty board starts text where you
                    clicked. A text box you leave empty disappears on its own.
                </p>
                <p>
                    Text is rich: bold, italics, underline, strikethrough, lists, links and font size all apply to the words you select. Two people can type in
                    the same box at once and both keep their words, because text merges character by character rather than overwriting.
                </p>
            </Section>

            <Section id="sticky-notes" title="Sticky notes">
                <p>
                    Press <Keys keys={["S"]} /> and click to drop a note. Notes come in six colours, and the text shrinks to fit as you write more.
                </p>
            </Section>

            <Section id="tables" title="Tables">
                <p>
                    Insert a table from <strong>Insert</strong> on the dock. Double-click a cell to type in it; <Keys keys={["Tab"]} /> moves to the next cell.
                    Pasting cells copied from a spreadsheet makes a table of them. The toolbar above a selected table adds or removes rows and columns, turns
                    the first row into a header, and switches between four looks: <strong>Grid</strong>, <strong>Striped rows</strong>,{" "}
                    <strong>Lines only</strong> and <strong>Bold header</strong>.
                </p>
            </Section>

            <Section id="find" title="Find on the board">
                <p>
                    <Keys keys={["Ctrl", "F"]} /> searches the words on the current board, including text in shapes, notes and tables, and steps through each
                    match. To search across all your boards, use the search on your home page.
                </p>
            </Section>
        </>
    );
}

function ConnectorsAndFrames() {
    return (
        <>
            <Section id="connectors" title="Connectors">
                <p>
                    Arrows and lines, <Keys keys={["A"]} /> and <Keys keys={["L"]} />, attach to whatever you start and end them on, and they follow those
                    shapes when they move. A connector can be straight, curved or an elbow, with a choice of heads at either end, and it can carry a label:
                    double-click the line to write one.
                </p>
                <Callout tone="tip">
                    Select a shape and drag one of the dots on its sides to draw an arrow that is already attached. With a shape selected,{" "}
                    <Keys keys={["Ctrl", "Arrow keys"]} /> adds a connected shape in that direction, and <Keys keys={["Tab"]} /> changes its kind.
                </Callout>
            </Section>

            <Section id="frames" title="Frames">
                <p>
                    A frame, <Keys keys={["F"]} />, marks out a region. Anything inside moves with it, it carries a name, and it can be exported or embedded on
                    its own.
                </p>
            </Section>

            <Section id="tidy" title="Tidying a diagram">
                <p>
                    Select a diagram you drew by hand and choose <strong>Tidy up</strong> to lay it out again cleanly with every connection kept. The{" "}
                    <DocLink slug="assistant">assistant</DocLink> can also restyle it or rearrange it on request.
                </p>
            </Section>
        </>
    );
}

function Styling() {
    return (
        <>
            <Section id="selection-toolbar" title="The selection toolbar">
                <p>
                    Select anything and a small toolbar appears above it with colour, size, text style and arrangement. It only shows what applies to your
                    selection.
                </p>
            </Section>

            <Section id="colour" title="Colour">
                <p>
                    The colour picker has a palette, a colour wheel, a hex field, an eyedropper for any colour on screen, and your recent colours. Board colours
                    adapt to light and dark themes, so a board stays readable in either.
                </p>
            </Section>

            <Section id="fonts" title="Fonts">
                <p>The font menu includes a set of Google Fonts, and you can add any font by its name, a link to a font file, or a file from your computer.</p>
            </Section>

            <Section id="arranging" title="Arranging">
                <ul>
                    <li>Align and distribute several objects from the toolbar, and watch for guides that snap things into line as you drag.</li>
                    <li>
                        Group with <Keys keys={["Ctrl", "G"]} /> and ungroup with <Keys keys={["Ctrl", "Shift", "G"]} />. Double-click a group to step into it.
                    </li>
                    <li>
                        Lock with <Keys keys={["Ctrl", "Shift", "L"]} /> so nothing moves by accident.
                    </li>
                    <li>
                        Bring to front or send to back with <Keys keys={["Ctrl", "Shift", "]"]} /> and <Keys keys={["Ctrl", "Shift", "["]} />.
                    </li>
                    <li>
                        Copy a style with <Keys keys={["Ctrl", "Alt", "C"]} /> and paste it onto other objects with <Keys keys={["Ctrl", "Alt", "V"]} />.
                    </li>
                </ul>
            </Section>
        </>
    );
}

function ImagesAndPieces() {
    return (
        <>
            <Section id="images" title="Images">
                <p>
                    Paste a picture, drop a file onto the board, or use <strong>Insert</strong> on the dock. Images can be cropped, resized and rotated like any
                    other object.
                </p>
            </Section>

            <Section id="embeds" title="Live web pages">
                <p>
                    <strong>Insert</strong> can also place a live web page, such as a video or a document, as an object on the board. Click it to interact with
                    it, and click away to go back to the board.
                </p>
            </Section>

            <Section id="icons" title="Icons">
                <p>
                    The icon search finds line icons and brand logos by name and places them as shapes you can colour and resize. Diagrams use the same icons
                    for their nodes.
                </p>
            </Section>

            <Section id="pieces" title="Piece kits">
                <p>
                    A piece is a reusable group of shapes, such as a user card, a server stack or a sprint lane. Open the pieces library with{" "}
                    <Keys keys={["Shift", "P"]} />, drag a piece onto the board, or save your own selection as one.
                </p>
                <Steps>
                    <li>Select the shapes you want to reuse.</li>
                    <li>Open the pieces library and save the selection as a piece, with a name.</li>
                    <li>Find it again in the library on any board.</li>
                </Steps>
                <p>
                    Pieces live in sets. A set can be shared by link or listed in the public <Link href="/pieces">pieces gallery</Link>, where anyone can add a
                    copy, and the library imports Excalidraw libraries as well as Mosaic piece files.
                </p>
            </Section>
        </>
    );
}

export const ON_THE_BOARD_ARTICLES = {
    drawing: Drawing,
    "text-and-notes": TextAndNotes,
    "connectors-and-frames": ConnectorsAndFrames,
    styling: Styling,
    "images-and-pieces": ImagesAndPieces,
};
