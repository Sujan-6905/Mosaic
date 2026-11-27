# Mosaic MCP server

Connect Claude, Cursor, VS Code, Codex or any MCP client to a Mosaic whiteboard. An agent can list and create
boards, read what is on them, draw every element type, edit existing content from a plain-language
instruction, comment, and work with versions and branches. It joins the board as a visible collaborator, so
people see its edits live and can undo any one of its tool calls.

## Quick start: the hosted server (nothing to install)

The Mosaic backend serves this server over Streamable HTTP at `/mcp` on the app's address. The public instance
is `https://mosaic-collab.vercel.app/mcp`; a self-hosted Mosaic serves it at its own address.

1. Add the server to your agent app:

    ```bash
    claude mcp add --transport http mosaic https://mosaic-collab.vercel.app/mcp
    ```

    In Claude, Cursor, VS Code or another app, add a remote MCP server with the same URL. On any board, the
    board menu's **Connect an agent** shows the exact setup for each app.

2. Sign in to Mosaic when the app asks. It uses OAuth 2.1 with PKCE, and you choose read-only or read-and-edit
   and, optionally, which boards it may use.
3. Ask: _"List my Mosaic boards"_, _"Draw our login flow on the Roadmap board"_.

An app that can't sign in through a browser can send a personal access token instead (Profile > Personal access
tokens): `Authorization: Bearer mosaic_pat_...`.

## Quick start: run it locally (stdio)

1. Install, from a checkout of this repository with the backend's dependencies installed:

    ```bash
    cd mcp-server && npm install
    ```

2. Create a personal access token in Mosaic (Profile > Personal access tokens).
3. Add the server to your MCP client's configuration:

    ```json
    {
        "mcpServers": {
            "mosaic": {
                "command": "node",
                "args": ["/absolute/path/to/mosaic/mcp-server/src/index.js"],
                "env": {
                    "MOSAIC_API_URL": "https://<your Mosaic backend>",
                    "MOSAIC_APP_URL": "https://<your Mosaic address>",
                    "MOSAIC_TOKEN": "mosaic_pat_..."
                }
            }
        }
    }
    ```

The same settings can live in `mcp-server/.env` (see `.env.example`). Instead of a token, `MOSAIC_USERNAME` and
`MOSAIC_PASSWORD` sign in as an account and keep the session renewed while the server runs.

## Tools

| Area             | Tools                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Boards           | `list_boards`, `create_board`, `get_board_state`, `get_element`, `show_board` (a live view inside apps that support MCP Apps)               |
| Understanding    | `describe_board` (objects as refs, with relations such as above, inside, connected to), `resolve` (a description to the element it means)   |
| Editing          | `edit_board` (a plain-language edit, checked and repaired server-side), `update_element`, `delete_element`, `set_background`, `clear_board` |
| Drawing          | `add_shape`, `add_text`, `add_sticky_note`, `add_frame`, `add_connector`, `add_path`, `add_image`                                           |
| Diagrams         | `mermaid_to_board`, `list_diagram_styles`, `draw_styled_diagram`, `restyle_diagram`                                                         |
| Pieces and icons | `list_piece_sets`, `place_piece`, `save_piece`, `search_icons`, `place_icon`                                                                |
| People           | `list_comments`, `add_comment`, `reply_to_comment`, `resolve_comment`, `delete_comment`, `who_is_here`, `point_at`                          |
| History          | `list_versions`, `preview_version`, `save_version`, `restore_version`, `branch_board`, `list_branches`, `preview_merge`, `apply_merge`      |
| Agent activity   | `list_agent_activity`, `undo_agent_turn`                                                                                                    |

The drawing, diagram, piece and icon tools move the agent's live cursor to each box as they draw it, so people on the
board see where it is working; `point_at` moves it anywhere else.

Prompts: `diagram-repository`, `notes-to-story-map`, `explain-board`, `review-board`. Resources:
`mosaic://boards` and `mosaic://boards/{shareId}`; subscribing to a board sends an update after each burst of
changes.

## Permissions and limits

- A token or sign-in can be read-only or read-and-edit, limited to chosen boards, and revoked in Profile at any
  time. Tokens last 90 days by default and a year at most.
- Each board's owner decides in **Share and embed** whether agents may edit, only comment, only read, or not
  join at all.
- Each credential gets 60 tool calls a minute; tools that call the model share the assistant's model quota,
  which a free model key spends by the day.
- On a board an agent appears as "<agent> for <person>", and **Connect an agent > Activity** lists its changes
  per tool call, each with an undo.
- `edit_board` returns `needs-review` instead of applying a large or destructive change, since no person is
  reviewing it.

## MCP Registry

`server.json` lists the public instance in the [MCP Registry](https://registry.modelcontextprotocol.io) as
`io.github.Sujan-6905/mosaic`, a remote server with nothing to install. To publish a new version, raise `version`
in `server.json` and `package.json` together, then from this folder:

```bash
mcp-publisher login github
mcp-publisher publish
```

## How it works

Each board a tool touches is joined once over a real Socket.io connection, authenticated like the web app, so
an agent's edits pass the same role checks and schemas as a person's and appear live. Element writes are
validated against the backend's own Zod schemas before they are sent, so a bad call fails with a message naming
the field. The hosted server runs inside the backend and calls it back over loopback with the agent's own token.

```
src/
  index.js, hosted.js   stdio and Streamable HTTP entry points
  server.js, config.js  one MCP server per agent, and local settings
  tools/                the tools, by area
  connection/           the REST client, board sessions and public downloads
  elements/             element defaults and validation, summaries, the Mermaid runtime
  boardView/            the MCP Apps view of a board
  prompts.js, resources.js
```

With several backend instances, a hosted MCP session lives in one process, so `/mcp` needs sticky routing to
the instance that opened it.
