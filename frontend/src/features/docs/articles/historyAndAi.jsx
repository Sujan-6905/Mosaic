import { STRUCTURES, STRUCTURE_GROUPS, LOOKS } from "../../../../../shared/canvas/diagramStyles/catalog.js";
import { Callout, DocLink, Keys, Section, Steps } from "./primitives";

function VersionsAndReplay() {
    return (
        <>
            <p>Every change to a board is kept in order, so the past is always there to look at, return to, or start again from.</p>

            <Section id="versions" title="Versions">
                <p>
                    Mosaic saves versions on its own as you work, so nothing needs saving by hand. Open <strong>Version history</strong> from the clock in the
                    top bar.
                </p>
                <Steps>
                    <li>Before a big change, name the current state, such as &quot;Before the redesign&quot;. Named versions stand out in the list.</li>
                    <li>Click any version to see it full size, read only. Nobody else is affected while you look.</li>
                    <li>
                        <strong>Restore</strong> brings the board back to that version, and <Keys keys={["Ctrl", "Z"]} /> still undoes the restore.{" "}
                        <strong>Fork from here</strong> makes a new board from that moment instead.
                    </li>
                </Steps>
            </Section>

            <Section id="replay" title="Replay">
                <p>
                    <strong>Replay</strong>, in the board menu, plays back every change ever made to the board in order. It is a read-only view and never alters
                    the board.
                </p>
                <ul>
                    <li>Long idle gaps are skipped, so a week of work doesn&apos;t take a week to watch.</li>
                    <li>Drag along the timeline to jump to any change.</li>
                    <li>Choose one person to see only their changes, and play at up to eight times the speed.</li>
                    <li>Notable moments, such as a large paste or a restore, appear as chips under the timeline to jump to.</li>
                </ul>
            </Section>

            <Section id="catch-up" title="Catch me up">
                <p>
                    <strong>Catch me up</strong> answers &quot;what changed since I was last here?&quot;. Mentions of you come first, and every change is marked
                    on the board so you can see where it happened.
                </p>
            </Section>
        </>
    );
}

function BranchesAndMerge() {
    return (
        <>
            <p>A branch is a full copy of a board that remembers where it came from. Change it freely: the original stays exactly as it was.</p>

            <Section id="make-a-branch" title="Make a branch">
                <p>
                    Open <strong>Branches and diff</strong> from the board menu and choose <strong>Branch this board</strong>. The copy opens in a new tab. Fork
                    from here in Version history does the same from any moment in the past.
                </p>
            </Section>

            <Section id="compare" title="Compare two boards">
                <p>
                    Pick the board to compare against: the parent or any of its branches. Both are drawn together with each change marked as added, removed,
                    moved or modified, and the changes are counted by person underneath.
                </p>
            </Section>

            <Section id="merge" title="Merge">
                <p>
                    Merge a branch back into its parent, or bring the parent&apos;s newer changes into the branch. Changes only one side made carry over on
                    their own. Where both sides changed the same thing, you choose which to keep, and the preview warns about shapes that would now overlap.
                </p>
                <Callout tone="tip">A merge is one step in the history like any other, so it can be undone, replayed and branched from.</Callout>
            </Section>
        </>
    );
}

function Assistant() {
    return (
        <>
            <p>
                The assistant is a chat that can read the board you have open and change it. Open it from <strong>AI</strong> on the dock. It only ever works on
                that board.
            </p>

            <Section id="ask" title="Ask in plain language">
                <ul>
                    <li>Ask what is on the board, or for a summary of it.</li>
                    <li>Describe a diagram: &quot;a sign-up flow with email verification&quot;.</li>
                    <li>Ask for a drawing: &quot;a house with a small cat by the door&quot;.</li>
                    <li>
                        Select something and say &quot;this&quot;: &quot;align these&quot;, &quot;add colours to this&quot;, &quot;turn this into a clean
                        flowchart&quot;. Or name what you mean: &quot;make the login box blue&quot;.
                    </li>
                </ul>
                <p>
                    It remembers the conversation, so &quot;add a step&quot; and &quot;now make it blue&quot; work as follow-ups. Type <Keys keys={["/"]} /> for
                    shortcuts such as <code>/flowchart</code>, <code>/mindmap</code>, <code>/summarize</code> and <code>/cleanup</code>.
                </p>
            </Section>

            <Section id="review" title="Nothing lands without you">
                <p>
                    New drawings appear as a preview first. Press <strong>Place on board</strong> and the drawing follows your pointer as one piece, then click
                    to set it down. Changes to what is already there are shown on the board as a draft, with what will be added, moved or removed, and apply
                    only when you accept them. Each change can be ticked or left out, and press and hold <strong>Hold to compare</strong> to see the board as it
                    was.
                </p>
                <p>
                    If it isn&apos;t sure which object you mean, it asks, and picking an option highlights that object so you can check before you confirm. In
                    its settings you can let small, safe edits apply without the review step.
                </p>
            </Section>

            <Section id="limits" title="What it won't do">
                <p>
                    It sticks to the board: it won&apos;t browse the web, write code or answer general questions. Requests are paced per person, and a hosted
                    instance can switch the assistant off entirely, in which case the AI button is hidden.
                </p>
                <Callout>
                    Your chats are private to you and stay with the board. The model never places anything by coordinates: it describes what to draw, and Mosaic
                    lays it out, which is why a draft always lines up.{" "}
                    <DocLink slug="architecture" hash="assistant">
                        How that works
                    </DocLink>
                    .
                </Callout>
            </Section>
        </>
    );
}

function Diagrams() {
    return (
        <>
            <p>
                A diagram in Mosaic is made of ordinary shapes and connectors, so you can edit any part of it by hand. What makes it a diagram is that it knows
                its structure and its look, and either can be changed in one step.
            </p>

            <Section id="structures-and-looks" title="Structures and looks">
                <p>
                    There are {STRUCTURES.length} structures in {STRUCTURE_GROUPS.length} groups, from flowcharts and org charts to timelines, swimlanes and
                    system maps, and {LOOKS.length} looks that restyle any of them. Ask the assistant for one by name, or select a diagram and choose{" "}
                    <strong>Restyle</strong> to try another structure or look on the same content.
                </p>
                <ul>
                    {STRUCTURE_GROUPS.map((group) => (
                        <li key={group}>
                            <strong>{group}</strong>:{" "}
                            {STRUCTURES.filter((structure) => structure.group === group)
                                .map((structure) => structure.name)
                                .join(", ")}
                        </li>
                    ))}
                </ul>
            </Section>

            <Section id="mermaid" title="From Mermaid">
                <p>
                    <strong>Mermaid diagram to board</strong>, under Insert or in <Keys keys={["Ctrl", "K"]} />, turns Mermaid text into editable shapes. Paste
                    a flowchart, sequence, state, class, entity relationship or mind map diagram and it is laid out on the board.
                </p>
            </Section>

            <Section id="github" title="From a GitHub repository">
                <p>
                    <strong>Architecture from GitHub</strong> maps a public repository into a layered diagram of its modules and how they depend on each other.
                    It works without the assistant, keeps in sync with the repository, and can show what a pull request changes.
                </p>
            </Section>

            <Section id="tidy-up" title="Tidy up">
                <p>
                    For a diagram drawn by hand, the tidy-up commands in <Keys keys={["Ctrl", "K"]} /> lay out the selection top to bottom, left to right or
                    radially, keeping every connection.
                </p>
            </Section>
        </>
    );
}

export const HISTORY_ARTICLES = { "versions-and-replay": VersionsAndReplay, "branches-and-merge": BranchesAndMerge };
export const AI_ARTICLES = { assistant: Assistant, diagrams: Diagrams };
