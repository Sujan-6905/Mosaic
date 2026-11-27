import { DOC_SECTIONS } from "../docsNavigation";
import { Callout, DocLink, Keys, PageCards, Section, Steps } from "./primitives";
import ShortcutFinder from "./ShortcutFinder";

const firstPageOf = (title) => DOC_SECTIONS.find((section) => section.title === title).pages;

function Introduction() {
    return (
        <>
            <p>
                Mosaic is a whiteboard for drawing things out with other people. A board has no edges, everyone on it moves at once, and every change is kept,
                so you can watch how a board came together or go back to any moment of it. An assistant can draw and edit for you, and AI agents can join a
                board the same way a colleague would.
            </p>
            <p>It runs in any modern browser with nothing to install, and it is free to use.</p>

            <Section id="where-to-start" title="Where to start">
                <PageCards pages={firstPageOf("Getting started").slice(1)} />
            </Section>

            <Section id="what-you-can-do" title="What you can do">
                <ul>
                    <li>
                        <strong>Draw and diagram</strong> with freehand ink, a shape library, sticky notes, tables, connectors that stay attached, and frames.
                    </li>
                    <li>
                        <strong>Work together live</strong>: cursors, comments with mentions, roles, presenting, and workshop tools such as a timer and dot
                        voting.
                    </li>
                    <li>
                        <strong>Use the history</strong>: replay a board, restore or fork any version, branch it to try an idea, and merge it back.
                    </li>
                    <li>
                        <strong>Ask in words</strong>: the assistant drafts diagrams, edits what is there and catches you up, and every change waits for your
                        review.
                    </li>
                    <li>
                        <strong>Bring agents in</strong>: Claude, Cursor, Codex and other MCP clients sign in and work on a board beside you.
                    </li>
                </ul>
            </Section>

            <Section id="explore" title="Explore by topic">
                <PageCards pages={[...firstPageOf("AI"), ...firstPageOf("Agents").slice(0, 1), ...firstPageOf("History")]} />
            </Section>
        </>
    );
}

function QuickStart() {
    return (
        <>
            <p>This walks through a first board: making it, drawing on it, inviting someone and sharing it.</p>

            <Section id="make-a-board" title="Make a board">
                <Steps>
                    <li>Create an account with a username and password, or continue with Google or GitHub.</li>
                    <li>
                        On your home page, choose <strong>New board</strong>. It opens straight away, empty, with the tool dock along the bottom.
                    </li>
                    <li>
                        A short tour offers itself on your first board. Take it, or skip it and open it again later from <strong>Help</strong>.
                    </li>
                </Steps>
            </Section>

            <Section id="draw-something" title="Draw something">
                <Steps>
                    <li>
                        Press <Keys keys={["R"]} /> and drag to draw a rectangle, then type to put words inside it.
                    </li>
                    <li>
                        Press <Keys keys={["S"]} /> and click to drop a sticky note.
                    </li>
                    <li>
                        Press <Keys keys={["A"]} /> and drag from one shape to another. The arrow attaches to both and follows them when they move.
                    </li>
                    <li>
                        Press <Keys keys={["V"]} /> to go back to selecting. Drag to move, and drag a corner to resize.
                    </li>
                </Steps>
                <Callout tone="tip">
                    Press <Keys keys={["Ctrl", "K"]} /> at any time and type what you want to do. The command palette can run everything on the board by name.
                </Callout>
            </Section>

            <Section id="invite-someone" title="Invite someone">
                <Steps>
                    <li>
                        Choose <strong>Share</strong> in the top right corner.
                    </li>
                    <li>Type their username, pick a role, and invite them.</li>
                    <li>
                        Copy the board link and send it. Only people you invited can open it, unless you open link access to everyone. See{" "}
                        <DocLink slug="sharing-and-roles">Sharing and roles</DocLink>.
                    </li>
                </Steps>
            </Section>

            <Section id="next" title="Where to go next">
                <PageCards pages={firstPageOf("On the board").slice(0, 3)} />
            </Section>
        </>
    );
}

function Shortcuts() {
    return (
        <>
            <p>
                Every tool has a one-letter key, and the pointer does more with a modifier held. This list is built from the same data the board uses, so it is
                always current. Press any key and every row that uses it lights up.
            </p>
            <Callout tone="tip">
                On a board, <Keys keys={["Ctrl", "K"]} /> opens the command palette, which lists every command with its shortcut, including ones that have no
                key at all, such as Replay and Export. On a Mac, use <Keys keys={["Cmd"]} /> wherever this page says Ctrl.
            </Callout>
            <ShortcutFinder />
        </>
    );
}

export const GETTING_STARTED_ARTICLES = { "": Introduction, "quick-start": QuickStart, shortcuts: Shortcuts };
