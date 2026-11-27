# Design decisions

The calls that shaped Mosaic, each with the reason and the trade it accepts.

## Real-time editing

**Last-write-wins for elements, a CRDT for text.** Whiteboard elements are independent objects, so per-element
last-write-wins is enough: the server stamps a rising version on every accepted change, never trusting one
from a client, and each client applies only what outranks what it holds. Two people dragging one shape converge
on whichever write reached the server last. Text is different: two people typing in one note edit overlapping
ranges of one string, so its content runs a Yjs document and both keep their words. Position, colour and
existence stay last-write-wins even for text elements.

**Fractional indexing for z-order.** A new position is a key that sorts between its neighbours, so "bring to
front" changes one element instead of renumbering and re-broadcasting the rest.

**Undo is per person.** Each tab keeps its own stack of the operations it performed, capped at 100. Ctrl+Z never
reverts a collaborator's work; undoing an insert someone else already deleted does nothing.

**Write-behind persistence, with a stated loss bound.** A live room is authoritative in memory or Redis and is
saved every 15 seconds and when the last person leaves; a graceful shutdown flushes every room. A hard crash can
lose at most the last 15 seconds of one room's edits, where saving on every pointer move would need a database
write per frame.

**Rooms behind one storage interface.** `liveRooms/` has an in-memory store and a Redis store behind the same
async interface, and both pass one shared contract test suite. Setting `REDIS_URL` is the only difference
between one instance and many; with Redis nothing about a room lives in a process, so instances need no sticky
sessions.

## Canvas

**Infinite, priced by the viewport.** The camera is a pure coordinate transform with no bound, and a spatial
index answers what is visible without scanning the board. Committed elements paint into cached tiles, so a pan
composites finished bitmaps. WebGL and Rust/WASM were measured and rejected: paint JavaScript is under 1 ms a
frame, and the remaining cost was GPU fill, which tiles remove (see `frontend/perf/README.md`).

**Colour is a token wherever a theme could change it.** Components read names like `--color-accent`, and the light
and dark themes each redefine the same names. A new theme is a set of values, never a code change.

## The assistant

**The model never places anything.** Diagrams come back as nodes and edges and a deterministic layout engine
positions them; edits name refs and relations. Spatial reasoning is one of the weakest things a language model
does, and layout is a solved problem.

**Hosted, not bring-your-own-key.** Anyone trying the app sees the assistant work without an API key. The backend
talks to an OpenAI-compatible API, so the provider is a URL and model name, and the key never reaches a browser.

**Shape recognition is geometry, not a model.** Turning a wobbly rectangle into a clean one is a closed problem
with a small feature space, so it runs in the browser from corner counts and curvature, with no network call
and no chance of a hallucinated shape. Open-ended diagrams need language; recognising four corners doesn't.

**An object is a group of elements.** Twelve pencil strokes read to a person as "a box with an arrow". Grouping
merges them by explicit groups, labels, containment, adjacency and drawing order, never across two authors, and
keeps a group's ref while most of its members stay, so "it" still means the same thing next turn.

**Ambiguity asks instead of guessing.** The resolver returns resolved, ambiguous with a shortlist, or none. A
confident top match with a real margin resolves; a close call asks, as a person would.

**Edits run against a copy first.** A bad diagram only looks wrong; a bad edit can break something a collaborator
relied on. Edits go through a shadow scene, a linter and deterministic repairs, then a preview, then the same
mutation path as a person's edit, with the caller's role checked again at commit.

**Repository diagrams are parsed, not read by a model.** Mosaic's own source is about 694,000 tokens; its module
graph is about 1,000. Imports are parsed with tree-sitter in a separate process, which is exact, repeatable and
free, and the model only names what the parser found. The result is drawn by the same style engine as the
assistant's diagrams, so it restyles like one.

## Security and reliability

**Every mutation is checked where it happens.** The role check runs in REST middleware and again in every
mutating socket handler, always from the server's own record of the board, never a client claim.

**Every socket event has a schema.** A valid token proves who is talking, not that the message is well formed.
Each event's Zod schema bounds ids, element shapes, point counts and sizes, and is the second boundary every
AI-generated element also crosses.

**Identity comes only from the token.** Handlers act on the user id from a verified JWT; a request body can carry
data, never an identity.

**A handler error never takes down a room.** Every socket handler runs inside `safeHandler`, so a bug drops one
operation and is logged and counted rather than ending the process and every live board.

**The backend replaces its own database connection.** After a network drop the Couchbase SDK can keep writing to
a key-value socket the far side has forgotten for about 16 minutes, while queries still work. A watchdog checks
both paths every 20 seconds and, after three failures, connects a new cluster and points the models at it, so
live rooms are untouched. A timeout is never read as "not found", and a failed load never seeds an empty room
that autosave would write over the real board.

**`/healthz` pings the database.** A probe that always says "ok" hides the one failure that matters: the server is
up but can't reach its data.

**Tests mock at named boundaries.** The model provider, board persistence and the operation log are mocked by
module, so the backend suite runs the real Socket.io server, version stamping and validation with no database
or secrets. The Playwright suite is the deliberate exception and runs against a real backend and database.

## Storage

**Couchbase Capella.** Memory-first documents cover much of what a separate cache would, SQL++ handles the
queries an aggregation pipeline would, and Couchbase creates no indexes on its own, so every access pattern
(owner, the array index behind "shared with me", share id, email) is declared in the schema. The schema provisions
itself on boot.

**Measured against MongoDB.** `benchmark/runStorageBenchmark.js` runs Mosaic's eight storage paths on both with
the same data, each store taking turns to go first, and compares the time each adds on top of its own network
round trip. Couchbase wins the path a live board leans on: with 20 people writing to one board, its slowest 5% of
edits took 73 ms against MongoDB's 861 ms, because MongoDB serialises writes to one document. MongoDB answers the
query-shaped paths (share link, dashboard, history scrubber, replay) faster. Results are in
[`benchmark/results/storage-benchmark.md`](../benchmark/results/storage-benchmark.md).
