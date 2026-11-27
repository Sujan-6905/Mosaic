import { Callout, DocLink, Keys, Section, Steps } from "./primitives";

function Embeds() {
    return (
        <>
            <Section id="embed" title="Embed a board on another site">
                <p>
                    <strong>Share and embed</strong>, in the board menu, gives you a snippet to paste into any web page. The embed is live: it updates as people
                    work on the board.
                </p>
                <ul>
                    <li>Show the whole board, a single frame, or one of its branches.</li>
                    <li>Keep it on the latest state, or pin it to a saved version.</li>
                    <li>
                        The owner lists the sites allowed to show it. A page that isn&apos;t on the list gets nothing, so an embed can&apos;t be copied onto a
                        site you didn&apos;t choose.
                    </li>
                    <li>Embeds are read-only, and visitors to the host page can read comments on the board.</li>
                </ul>
                <p>
                    The host page can talk to the embed: send <code>mosaic:goToFrame</code> to move to a frame, and listen for <code>mosaic:changed</code> to
                    hear which elements changed.
                </p>
            </Section>

            <Section id="link-previews" title="Link previews">
                <p>
                    Mosaic answers oEmbed requests, so tools that understand oEmbed turn a board link into a preview. A Slack workspace can add the Mosaic app
                    to unfurl links with a picture of the board, for boards anyone with the link may view.
                </p>
            </Section>

            <Section id="cover-letters" title="Cover letters">
                <p>
                    A board owner can <strong>Write a cover letter</strong> from the board menu: a public, view-only link where the board draws itself as it
                    opens, replayed from its own history. It suits a job application, a pitch, or any board you want someone to watch come together.
                </p>
            </Section>
        </>
    );
}

function ExportAndImport() {
    return (
        <>
            <Section id="formats" title="Formats">
                <table>
                    <thead>
                        <tr>
                            <th>Format</th>
                            <th>Best for</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>PNG</td>
                            <td>An image to paste anywhere.</td>
                        </tr>
                        <tr>
                            <td>SVG</td>
                            <td>Sharp vectors for documents and slides.</td>
                        </tr>
                        <tr>
                            <td>PDF</td>
                            <td>A page to print or attach.</td>
                        </tr>
                        <tr>
                            <td>.mosaic</td>
                            <td>A lossless copy that imports back with everything still editable.</td>
                        </tr>
                        <tr>
                            <td>Time-lapse</td>
                            <td>A video of the board being made, played from its history.</td>
                        </tr>
                        <tr>
                            <td>Stone</td>
                            <td>The board laid as a real mosaic of hand-cut tiles, made to be posted.</td>
                        </tr>
                    </tbody>
                </table>
                <p>
                    Export the whole board, only the selection, or a single frame, and the preview shows exactly what you will get.{" "}
                    <Keys keys={["Shift", "Alt", "C"]} /> copies the selection to the clipboard as a PNG.
                </p>
            </Section>

            <Section id="import" title="Import">
                <Steps>
                    <li>
                        Choose <strong>Import a scene file</strong> from the board menu, or Import on your home page.
                    </li>
                    <li>Drop a .mosaic file, or a .json scene exported from Mosaic.</li>
                    <li>
                        Choose <strong>Import into new board</strong> for a separate board, or <strong>Merge into this board</strong> to add its contents to the
                        one you have open.
                    </li>
                </Steps>
                <Callout>
                    Images and PDFs don&apos;t import as boards. To add a picture, use Insert on the dock. Diagrams written in Mermaid have their own import:
                    see{" "}
                    <DocLink slug="diagrams" hash="mermaid">
                        Diagrams
                    </DocLink>
                    .
                </Callout>
            </Section>
        </>
    );
}

function Account() {
    return (
        <>
            <Section id="signing-in" title="Signing in">
                <p>
                    An account is a username and a password, or Google or GitHub, where the hosted instance has them turned on. Your username is how people
                    invite you and how you appear on boards.
                </p>
                <p>Changing your password ends every other sign-in and revokes your personal access tokens, so a lost device is shut out at once.</p>
            </Section>

            <Section id="your-boards" title="Your boards">
                <ul>
                    <li>Your home page lays your boards out like a board of their own. Drag them into the order you like.</li>
                    <li>
                        <strong>All boards</strong> lists everything you own and everything shared with you, with categories and starring.
                    </li>
                    <li>Search finds a board by what is written on it, not only by its title.</li>
                    <li>
                        A deleted board waits under <strong>Recently deleted</strong> for 30 days, where it can be put back, before it is gone for good.
                    </li>
                </ul>
            </Section>

            <Section id="notifications" title="Notifications">
                <p>
                    The bell collects mentions, replies and access requests. Turn on <strong>Mention notifications</strong> in Profile to hear about mentions
                    from your browser while Mosaic isn&apos;t open.
                </p>
            </Section>

            <Section id="tokens" title="Personal access tokens">
                <p>
                    Profile can create tokens for scripts and agent apps that can&apos;t sign in through a browser. A token can be read-only, limited to chosen
                    boards, and revoked at any time. See <DocLink slug="agents">Connect an agent</DocLink>.
                </p>
            </Section>

            <Section id="appearance" title="Theme and calm mode">
                <p>
                    Mosaic has light and dark themes, and your choice follows you to other devices. <strong>Calm mode</strong>, in Profile, swaps every flourish
                    for a plain fade, and Mosaic follows your system&apos;s reduced motion setting either way.
                </p>
            </Section>
        </>
    );
}

export const BEYOND_ARTICLES = { embeds: Embeds, "export-and-import": ExportAndImport, account: Account };
