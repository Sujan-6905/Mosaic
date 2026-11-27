import { AGENT_SETUPS } from "@/features/board/sharing/agentSetups";
import { absoluteUrl } from "@/features/site/seo/siteMetadata";
import { Callout, CodeBlock, Section, Steps } from "./primitives";

const MCP_TOOLS = [
    ["Boards", "list_boards, create_board, get_board_state, get_element, show_board"],
    ["Understanding", "describe_board, resolve"],
    ["Editing", "edit_board, update_element, delete_element, set_background, clear_board"],
    ["Drawing", "add_shape, add_text, add_sticky_note, add_frame, add_connector, add_path, add_image"],
    ["Diagrams", "mermaid_to_board, list_diagram_styles, draw_styled_diagram, restyle_diagram"],
    ["Pieces and icons", "list_piece_sets, place_piece, save_piece, search_icons, place_icon"],
    ["People", "list_comments, add_comment, reply_to_comment, resolve_comment, delete_comment, who_is_here, point_at"],
    ["History", "list_versions, preview_version, save_version, restore_version, branch_board, list_branches, preview_merge, apply_merge"],
    ["Agent activity", "list_agent_activity, undo_agent_turn"],
];

function ConnectAgent() {
    const mcpUrl = absoluteUrl("/mcp");
    return (
        <>
            <p>
                Mosaic speaks the Model Context Protocol, so an AI agent can join a board the way a colleague does: with its own cursor, its name in the top
                bar, and every change arriving live. Everyone on the board sees what it does, and any one of its turns can be undone.
            </p>

            <Section id="connect" title="Connect in three steps">
                <Steps>
                    <li>
                        Add the Mosaic server to your agent app with the address <code>{mcpUrl}</code>, using the setup for your app below.
                    </li>
                    <li>Sign in to Mosaic when the app asks. You choose whether the agent may only read or also edit, and which boards it may use.</li>
                    <li>Ask it something: &quot;list my Mosaic boards&quot;, or &quot;draw our login flow on the Roadmap board&quot;.</li>
                </Steps>
                <Callout tone="tip">
                    On any board, <strong>Connect an agent</strong> in the Share menu shows these snippets with that board&apos;s id ready to use.
                </Callout>
            </Section>

            <Section id="setups" title="Setup for each app">
                {AGENT_SETUPS.map((setup) => (
                    <CodeBlock key={setup.id} label={setup.label} code={setup.snippet(mcpUrl)} />
                ))}
                <p>
                    Codex reads a personal access token from <code>MOSAIC_TOKEN</code>. Create one in <strong>Profile</strong> under Personal access tokens; the
                    others sign in through the browser.
                </p>
            </Section>

            <Section id="permissions" title="Who decides what an agent can do">
                <ul>
                    <li>You choose read-only or read-and-edit when you sign the agent in, and can limit it to chosen boards.</li>
                    <li>
                        Each board&apos;s owner decides in <strong>Share and embed</strong> whether agents may edit, only comment, only read, or not join at
                        all.
                    </li>
                    <li>An agent can never do more than the person it works for is allowed to.</li>
                    <li>Sign-ins and tokens are listed in Profile and can be revoked at any time.</li>
                </ul>
            </Section>

            <Section id="activity" title="Watching and undoing">
                <p>
                    On the board an agent appears as &quot;agent for person&quot;, with a hollow tile instead of a filled one. <strong>Connect an agent</strong>{" "}
                    has an <strong>Activity</strong> tab listing each of its turns with what it added, changed and removed, and an undo for each.
                </p>
            </Section>
        </>
    );
}

function McpTools() {
    return (
        <>
            <p>The server offers tools in these areas. An agent app lists them for the model on its own, so you only ever talk to it in plain language.</p>

            <Section id="tools" title="Tools">
                <table>
                    <thead>
                        <tr>
                            <th>Area</th>
                            <th>Tools</th>
                        </tr>
                    </thead>
                    <tbody>
                        {MCP_TOOLS.map(([area, tools]) => (
                            <tr key={area}>
                                <td>{area}</td>
                                <td>
                                    <code>{tools}</code>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Section>

            <Section id="prompts-and-resources" title="Prompts and resources">
                <p>
                    Ready-made prompts: <code>diagram-repository</code>, <code>notes-to-story-map</code>, <code>explain-board</code> and{" "}
                    <code>review-board</code>. Boards are also readable as resources at <code>mosaic://boards</code> and <code>mosaic://boards/&lt;id&gt;</code>
                    , and an app subscribed to a board is told when it changes.
                </p>
            </Section>

            <Section id="safety" title="Safety rails">
                <ul>
                    <li>
                        An agent joins over the same live connection as a person, so its changes pass the same role checks and validation, and a bad call fails
                        with a message naming the field.
                    </li>
                    <li>
                        <code>edit_board</code> asks for review instead of applying a large or destructive change, since no person is watching it.
                    </li>
                    <li>Each sign-in gets 60 tool calls a minute.</li>
                </ul>
            </Section>

            <Section id="local" title="Running it locally">
                <p>
                    The same server runs on your own machine over stdio, using a personal access token. The steps are in <code>mcp-server/README.md</code> in
                    the source.
                </p>
            </Section>
        </>
    );
}

export const AGENT_ARTICLES = { agents: ConnectAgent, "mcp-tools": McpTools };
