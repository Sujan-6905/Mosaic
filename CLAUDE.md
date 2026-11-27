# Mosaic

A real-time collaborative whiteboard: Next.js frontend, Express and Socket.io backend, an MCP server for AI
agents, and `shared/`, the board model all three import. Read `docs/architecture.md` before a structural change.

## Layout

| Path                                                                                           | Holds                                                                                                                                        |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/pages/`                                                                          | Next.js routes; each only picks which feature to render                                                                                      |
| `frontend/src/features/<area>/`                                                                | One folder per product area (board, dashboard, home, account, profile, pieces, sharing, embed, publicBoard, notifications, tour, site, docs) |
| `frontend/src/components/`                                                                     | UI shared across features; `components/vendor/` is third-party code kept as shipped                                                          |
| `frontend/src/{store,lib,hooks,theme,styles}/`                                                 | Redux slices, browser helpers, shared hooks, themes and tokens                                                                               |
| `backend/src/http/`                                                                            | `routes/` (wiring only), `controllers/` (request handlers), `middlewares/`, `app.js`, `origins.js`                                           |
| `backend/src/services/`                                                                        | Board persistence, the operation log, comments, merges and other work shared by HTTP, sockets and jobs                                       |
| `backend/src/{realtime,liveRooms}/`                                                            | Socket.io handlers; live room state in memory or Redis                                                                                       |
| `backend/src/ai/`                                                                              | `model/` (provider, retries, budget, traces), `turn/`, `edits/` (with `executor/`), `safety/`, `eval/`                                       |
| `backend/src/{grounding,architecture,catchup,search,auth,models,db,validation,observability}/` | One concern each                                                                                                                             |
| `shared/canvas/`, `shared/rules/`                                                              | The board model; product rules client and server must agree on                                                                               |
| `mcp-server/src/`                                                                              | `tools/`, `connection/`, `elements/`, `boardView/`                                                                                           |

## Rules for every change

New code and fixes keep to these.

- **Files stay under 500 lines.** Split by responsibility before a file crosses it. The only exceptions are
  vendored code and licensed data (the Lucide glyph table).
- **Comments are rare and short.** Default to none. When the reason for code isn't obvious, one or two lines
  that explain the code itself. Never mention tasks, plans, checklists, sessions, tickets or fixes, never describe
  an edit ("added", "now", "previously"), and no emojis.
- **No em dashes** anywhere, including copy, docs and commit messages. Use a colon, comma, parentheses or two
  sentences. A spaced hyphen used as a dash counts too.
- **Names say what something is.** A file's name and folder should tell a reader what it holds without opening
  it. No `data`, `handler`, `manager`, `utils` or `helpers` as the distinguishing word, and nothing named after
  its history (`legacy`, `old`, `new`, `v2`). `frontend/src/lib/utils.ts` is the one exception: the vendored
  components import `cn` from that path.
- **One implementation per rule.** Before writing a helper, search `shared/` and the package for one. Anything
  the frontend, backend or MCP server must agree on (geometry, element limits, text metrics, z-order, file
  formats, diffs) lives in `shared/` and is imported from the module that defines it, never re-exported.
- **No dead code.** No unused exports, imports, files, dependencies or debug logs. Export only what another
  module imports.
- **Layering.** Routes only wire paths to handlers. Controllers handle requests. Services, realtime handlers and
  background work never import from controllers. Nothing in `shared/` imports a package; dependencies are
  passed in (see `provideDagre`, `parseMermaidWith`).
- **Imports.** Inside one feature or folder, relative paths. Across frontend folders, `@/`. `shared/` is always
  imported by relative path. CSS `@import` and Tailwind `@source` paths stay relative.
- **Formatting.** Prettier with the root `.prettierrc.json` (4 spaces, 160 columns, double quotes) on every
  file touched.
- **Tests stay hermetic.** Backend tests mock the provider, persistence (`services/boards.js`,
  `services/operationLog.js`) and models; the suite must pass with no `backend/.env`
  (`DOTENV_CONFIG_PATH=/nonexistent npx vitest run`). Only the Playwright suite uses a real database.
- **Security boundaries hold.** Every mutation is re-authorised where it happens; every REST body and socket
  event has a Zod schema; identity comes only from the verified token; secrets never reach the browser.
- **Docs follow the code.** A change to routes, events, settings, commands or measured numbers updates
  `docs/`, the package README and `.env.example` in the same change.

## Commands

| Task                                                                | Command                                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Backend tests (includes `shared/`, `mcp-server/`, benchmark grader) | `cd backend && npx vitest run`                                                        |
| Frontend tests and lint                                             | `cd frontend && npx vitest run && npm run lint`                                       |
| End to end                                                          | `cd frontend && npx playwright test` (production build on ports 3100 and 5100)        |
| Format                                                              | `npx prettier --write <files>`                                                        |
| Rendering benchmark                                                 | `cd frontend && npm run perf`                                                         |
| Edit benchmark, resolution only                                     | `cd backend && node ../benchmark/runBenchmark.js`                                     |
| Storage and assistant model benchmarks                              | `node benchmark/runStorageBenchmark.js`, `node benchmark/runModelBenchmark.js --plan` |

Run the full suites once after a piece of work is complete, not after each edit; re-run only what a fix touched.

## Traps

- The board model has bounds: numbers in elements are limited to plus or minus 1e8 (`boardNumber`), so ids, times
  and z-indexes must never be raw timestamps.
- Development runs React StrictMode, which mounts every effect twice. An effect that skips work because a ref says
  it is done must clear that ref in its cleanup; e2e runs a production build and never sees the bug.
- `NEXT_PUBLIC_*` values are inlined at build time; `NEXT_PUBLIC_SITE_URL` drives canonical links, the sitemap,
  `robots.txt`, `llms.txt` and embed links.
- A wrong Tailwind `@source` path silently drops vendor utility classes; check the built CSS after moving vendor
  code.
- Shader code lives in template strings that no linter or build checks; a broken shader fails silently.
- Moving a file: rewrite imports by resolution, including `vi.mock` paths and `new URL(..., import.meta.url)`.
