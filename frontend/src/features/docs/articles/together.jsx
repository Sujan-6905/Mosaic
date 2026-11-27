import { Callout, DocLink, Keys, Section, Steps } from "./primitives";

function SharingAndRoles() {
    return (
        <>
            <p>A board is private until you invite someone. The owner decides who can open it and what each person can do.</p>

            <Section id="roles" title="Roles">
                <table>
                    <thead>
                        <tr>
                            <th>Role</th>
                            <th>Can</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Owner</td>
                            <td>Everything, including inviting people, changing roles, link access, and deleting the board.</td>
                        </tr>
                        <tr>
                            <td>Editor</td>
                            <td>Change the board and comment on it.</td>
                        </tr>
                        <tr>
                            <td>Commenter</td>
                            <td>Read the board and leave comments.</td>
                        </tr>
                        <tr>
                            <td>Viewer</td>
                            <td>Look and follow along, without changing anything.</td>
                        </tr>
                    </tbody>
                </table>
                <p>A role change reaches the person straight away: their toolbar changes on the board they have open, with a note saying why.</p>
            </Section>

            <Section id="invite" title="Invite people">
                <Steps>
                    <li>
                        Choose <strong>Share</strong> and start typing a username. Matching accounts appear as you type.
                    </li>
                    <li>Pick a role and invite them.</li>
                    <li>Copy the board link and send it.</li>
                </Steps>
            </Section>

            <Section id="link-access" title="Link access">
                <p>
                    By default the link only opens for people you invited. Anyone else who opens it is asked to sign in and can request access, which reaches
                    the owner in their notifications. From <strong>Share and embed</strong> in the board menu, the owner can open the link wider:
                </p>
                <ul>
                    <li>
                        <strong>Can view</strong>: anyone with the link can look, signed in or not.
                    </li>
                    <li>
                        <strong>Can comment</strong>: anyone signed in can comment; signed-out visitors can look.
                    </li>
                    <li>
                        <strong>Can edit</strong>: anyone signed in can edit; signed-out visitors can look.
                    </li>
                </ul>
                <Callout>Invited people keep the role you gave them. Link access only decides what everyone else gets.</Callout>
            </Section>
        </>
    );
}

function Comments() {
    return (
        <>
            <Section id="start-a-thread" title="Start a thread">
                <p>
                    Press <Keys keys={["M"]} /> and click anywhere on the board, or on a shape, to pin a thread there. A thread on a shape moves with it.
                    Commenters can comment even though they can&apos;t edit.
                </p>
            </Section>

            <Section id="mentions" title="Mentions">
                <p>
                    Type <Keys keys={["@"]} /> and a name to mention someone with access to the board. They get a notification in Mosaic, and a browser
                    notification too if they turned those on.
                </p>
            </Section>

            <Section id="threads-panel" title="Every thread in one place">
                <p>
                    The comments panel lists every thread on the board, with unread ones marked. Click one to jump to it, reply in place, and resolve it when
                    it&apos;s done. Resolved threads stay in the panel and can be reopened.
                </p>
            </Section>
        </>
    );
}

function Presenting() {
    return (
        <>
            <Section id="presence" title="Live cursors">
                <p>
                    Everyone on a board appears as a cursor with their name and an avatar in the top bar. Each person carries their own tile, a small pattern
                    made from their username, so the same person looks the same everywhere. AI agents appear too, marked as agents.
                </p>
            </Section>

            <Section id="follow" title="Follow someone">
                <p>Click an avatar to follow that person&apos;s view as they move around. Moving the board yourself stops following.</p>
            </Section>

            <Section id="present" title="Present">
                <p>
                    <strong>Present</strong> invites everyone on the board to follow your view. They can step away at any time and rejoin from the banner at the
                    top.
                </p>
            </Section>

            <Section id="laser" title="Laser pointer">
                <p>
                    Press <Keys keys={["K"]} /> and draw to point at things. The trail fades on its own, is seen by everyone on the board, and never changes it.
                </p>
            </Section>
        </>
    );
}

function Workshops() {
    return (
        <>
            <p>
                For a retrospective, a brainstorm or a class, three tools keep a group in step. Start the first two from the board menu or{" "}
                <Keys keys={["Ctrl", "K"]} />.
            </p>

            <Section id="timer" title="A timer for everyone">
                <p>
                    <strong>Start a timer for everyone</strong> puts the same countdown on every screen on the board, drawn as an hourglass of tiles that drains
                    as time runs out.
                </p>
            </Section>

            <Section id="dot-voting" title="Dot voting">
                <Steps>
                    <li>
                        Choose <strong>Start a dot vote</strong> and set how many votes each person gets.
                    </li>
                    <li>While the vote is open, clicking a shape or a note votes for it. Votes stay hidden, so nobody follows the crowd.</li>
                    <li>When it closes, the counts turn over from fewest to most and the winner is gilded.</li>
                </Steps>
            </Section>

            <Section id="stamps" title="Stamps">
                <p>
                    Stamps, from <strong>Insert</strong> on the dock, press a mark into the board: agree, love it, star, question or idea. They suit quick
                    reactions where a comment would be too much.
                </p>
                <Callout tone="tip">
                    Comments and votes work for commenters as well, so a workshop can run with most people on the{" "}
                    <DocLink slug="sharing-and-roles">Commenter</DocLink> role.
                </Callout>
            </Section>
        </>
    );
}

export const TOGETHER_ARTICLES = { "sharing-and-roles": SharingAndRoles, comments: Comments, presenting: Presenting, workshops: Workshops };
