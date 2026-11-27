# API

The backend serves REST under `/api`, Socket.io on the same origin, and the hosted MCP endpoint at `/mcp`.
Authenticated routes take `Authorization: Bearer <token>`: a 15-minute access token from sign-in, or a personal
access token (`mosaic_pat_...`). Every request body is validated with Zod and errors come back as
`{ "message": "..." }`, sometimes with a `code`.

## Accounts and sessions

| Method            | Path                                                | Does                                                         |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------ |
| POST              | `/api/auth/register`                                | Create an account                                            |
| POST              | `/api/auth/login`                                   | Sign in with a username and password                         |
| POST              | `/api/auth/recover`                                 | Reset a password with a recovery code                        |
| GET               | `/api/auth/username-available/:username`            | Check a username                                             |
| GET               | `/api/auth/me`                                      | The signed-in account                                        |
| PUT               | `/api/auth/password`, `/api/auth/theme`             | Change the password or saved theme                           |
| POST              | `/api/auth/recovery-codes`                          | Issue new recovery codes                                     |
| DELETE            | `/api/auth/account`                                 | Delete the account and its boards                            |
| POST              | `/api/auth/oauth-login`, `/api/auth/oauth-complete` | Social sign-in; only the Next.js server may call these       |
| POST              | `/api/auth/session/refresh`, `/end`, `/end-others`  | Rotate the refresh token, sign out, sign out everywhere else |
| GET, POST, DELETE | `/api/auth/tokens`, `/api/auth/tokens/:tokenId`     | Personal access tokens                                       |
| GET, DELETE       | `/api/auth/agents`, `/api/auth/agents/:grantId`     | Agent apps signed in over OAuth                              |

## Boards

| Method                  | Path                                                             | Does                                            |
| ----------------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| POST                    | `/api/drawing/create`                                            | Create a board                                  |
| GET                     | `/api/drawing/get`                                               | Boards you own or can open                      |
| GET                     | `/api/drawing/getById/:shareId`                                  | One board                                       |
| PUT                     | `/api/drawing/update/:drawingId`                                 | Rename                                          |
| DELETE, POST, DELETE    | `/api/drawing/delete/:id`, `/restore/:id`, `/purge/:id`          | Sweep to the bin, restore, delete for good      |
| GET, PUT, DELETE, PATCH | `/api/drawing/collaborators/:shareId` (`/search`, `/role`)       | Invite, remove, change a role                   |
| GET, PATCH              | `/api/drawing/:shareId/settings`                                 | Link sharing, agent access and embedding        |
| POST                    | `/api/drawing/import`                                            | Create a board from a `.mosaic` file            |
| GET                     | `/api/drawing/activity`, `/api/drawing/catch-up/:shareId?since=` | Recent activity, and what changed since a visit |

## History

| Method    | Path                                                        | Does                                                           |
| --------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| GET, POST | `/api/drawing/:shareId/versions`                            | List or name versions                                          |
| GET       | `/api/drawing/:shareId/versions/:seq/preview`               | The board at a version                                         |
| POST      | `/api/drawing/:shareId/fork`                                | Branch from a version                                          |
| GET       | `/api/drawing/:shareId/branches`, `/diff`                   | Related branches, and a diff (added, removed, moved, modified) |
| GET, POST | `/api/drawing/:shareId/merge`                               | Preview and apply a three-way merge                            |
| GET       | `/api/drawing/:shareId/replay/timeline`, `/window`, `/reel` | Replay's range, a window of changes, a time-lapse              |

## Assistant and grounding

| Method                   | Path                                                          | Does                                                                              |
| ------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| POST                     | `/api/ai/:shareId/turn`                                       | One turn: a reply, diagram, sketch, proposed or applied edit, question or refusal |
| POST                     | `/api/ai/:shareId/edit/commit`                                | Apply a proposal, or the ticked part of it; `409` when the board moved under it   |
| POST                     | `/api/ai/:shareId/edit/rebase`                                | Redo a proposal against the current board, with no model call                     |
| POST                     | `/api/ai/:shareId/edit/revert`                                | Undo an applied edit, leaving later changes alone                                 |
| DELETE                   | `/api/ai/:shareId/edit/preview/:token`                        | Discard a proposal                                                                |
| POST                     | `/api/ai/:shareId/edit/cancel/:turnId`                        | Stop a turn in progress                                                           |
| GET, POST, PATCH, DELETE | `/api/ai/:shareId/conversations[/:conversationId]`            | Your chat threads on a board                                                      |
| POST                     | `/api/ai/:shareId/catch-up/summary`                           | A written summary of changes since a visit                                        |
| POST                     | `/api/grounding/:shareId/context`                             | The board as named objects and relations, within a character budget               |
| POST                     | `/api/grounding/:shareId/resolve`                             | A description to the object it means                                              |
| GET, POST                | `/api/architecture/:shareId` (`/import`, `/sync`, `/compare`) | Draw and follow a public GitHub repository                                        |

## Everything else

| Method                   | Path                                                              | Does                                                    |
| ------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------- |
| GET                      | `/api/search?q=`                                                  | Search every board you can open, by what is drawn on it |
| GET                      | `/api/upload/cloudinary-signature`                                | Sign a direct browser upload                            |
| GET, POST, PATCH, DELETE | `/api/pieces`, `/api/pieces/gallery`, `/api/pieces/shared/:setId` | Piece sets, the public gallery, installing a shared set |
| GET                      | `/api/icons/sets`, `/search`, `/:set/:name`                       | Icons and logos as path data                            |
| GET, PUT, ...            | `/api/organization/categories`, `/boards/:shareId`                | Dashboard categories                                    |
| GET, POST                | `/api/notifications`, `/read`, `/access-request/:shareId`         | Mentions and access requests                            |
| GET, POST, DELETE        | `/api/push/key`, `/api/push/subscriptions`                        | Browser notifications                                   |
| GET, POST                | `/api/embed/:shareId/policy`, `/scene`, `/session`; `/oembed`     | Embeds and oEmbed                                       |
| GET, POST, DELETE        | `/api/letters/board/:shareId`, `/api/letters/:token`              | Shareable replay letters                                |
| GET                      | `/api/activity/wall`                                              | Your year of work, for Profile                          |
| GET, POST                | `/api/wall`, `/api/wall/stones`                                   | The landing page's shared wall                          |
| POST                     | `/api/client-errors`                                              | Frontend exception reports                              |
| POST                     | `/api/slack/events`                                               | Slack link unfurling                                    |

## Operations

| Path                          | Does                                                             |
| ----------------------------- | ---------------------------------------------------------------- |
| `GET /api/config`             | Which optional features this deployment has (assistant, uploads) |
| `GET /healthz`                | Couchbase, and Redis when set; `200` healthy, `503` degraded     |
| `GET /metrics`                | Counters: errors, rooms, sockets, save latency, AI usage, memory |
| `GET /admin/dashboard?token=` | A live operations page; `404` unless `DASHBOARD_TOKEN` is set    |

## MCP and OAuth

| Path                                                                               | Does                                                            |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `/mcp`                                                                             | Streamable HTTP MCP endpoint ([setup](../mcp-server/README.md)) |
| `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server` | OAuth metadata for agent apps                                   |
| `/oauth/register`, `/oauth/token`, `/api/oauth/authorize`                          | Dynamic client registration, token exchange, consent            |

## Socket.io

Join with `client:joinRoom` after the board exists. Every mutating event is checked against the caller's role
and its own schema.

| Client sends                                                                                                                                   | Purpose                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `client:joinRoom`                                                                                                                              | Join a board's room                                                                                                                         |
| `client:updateCanvas`                                                                                                                          | Insert, update or delete elements                                                                                                           |
| `client:textSync`                                                                                                                              | Yjs updates for text being co-edited; an editor opening a note asks for its state (`wantsState`) and editors answer with theirs (`isState`) |
| `client:cursorMove`, `client:cameraMove`, `client:laserPoint`                                                                                  | Presence, throttled to about 30 a second                                                                                                    |
| `client:addComment`, `client:addCommentReply`, `client:moveComment`, `client:resolveComment`, `client:deleteComment`, `client:markCommentRead` | Comments                                                                                                                                    |
| `client:restoreVersion`, `client:clearBoard`, `client:updateBackground`                                                                        | Board-wide changes                                                                                                                          |
| `client:followUpdate`, `client:presentationUpdate`                                                                                             | Follow and present                                                                                                                          |
| `client:timer`, `client:voteStart`, `client:vote`, `client:voting`                                                                             | Workshop tools                                                                                                                              |

| Server sends                                                                                                               | Purpose                                |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `server:joinedRoom`                                                                                                        | The board's state on joining           |
| `server:addNewElement`, `server:updateElement`, `server:deleteElement`, `server:elementRejected`                           | Element changes, each with its version |
| `server:presenceUpdate`, `server:roleChanged`, `server:accessRevoked`                                                      | Who is here and what they may do       |
| `server:canvasFull`, `server:canvasNotFound`, `server:canvasAccessDenied`, `server:boardDeleted`, `server:boardLoadFailed` | Why a board can't be opened            |
| `server:saved`                                                                                                             | An autosave finished                   |
| `server:agentActivity`, `server:agentEditApplied`, `server:agentEditReverted`                                              | Assistant and agent progress           |
| `server:commentAdded`, `server:commentUpdated`, `server:commentDeleted`, `server:mentioned`, `server:notification`         | Comments and mentions                  |
