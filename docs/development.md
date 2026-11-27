# Development

## Running locally

Follow [self-hosting](self-hosting.md) steps 1 and 2, then run `npm run dev` in `backend/` (port 5000) and in
`frontend/` (port 3000). The MCP server has its own [setup](../mcp-server/README.md).

## Tests

| Suite      | Command                           | Covers                                                                                                                                              | Needs                                                    |
| ---------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Backend    | `cd backend && npm test`          | REST, sockets (a real Socket.io server and clients), the assistant, grounding, and the tests in `shared/`, `mcp-server/` and the benchmark's grader | Nothing: models, persistence and the provider are mocked |
| Frontend   | `cd frontend && npm test`         | Board modules (camera, rendering, selection, text, diagrams, history, export) and helpers                                                           | Backend dependencies installed (`npm ci` in `backend/`)  |
| End to end | `cd frontend && npm run test:e2e` | Accounts, the site, the dashboard, every board tool, collaboration and sharing, on a production build                                               | A real database in `backend/.env`                        |

The end-to-end suite builds into `.next-e2e` and serves on ports 3100 and 5100, so it never touches a running
dev server. It creates throwaway accounts and deletes them; `npm run cleanup:test-accounts` in `backend/`
removes any a crashed run left behind.

## Quality checks

```bash
cd frontend && npm run lint      # ESLint, Next.js rules
npx prettier --check .           # one formatting config for the whole repository (.prettierrc.json)
```

CI (`.github/workflows/ci.yml`) runs lint and the backend and frontend suites on every push and pull request,
and the end-to-end suite when the repository's database secrets are set.

## Measuring

| What               | Command                                                       | Notes                                                                             |
| ------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Rendering          | `cd frontend && npm run perf`                                 | Against a production build; see [`frontend/perf`](../frontend/perf/README.md)     |
| Edit benchmark     | `cd backend && node ../benchmark/runBenchmark.js`             | Resolution only without `GROQ_API_KEY`; see [`benchmark`](../benchmark/README.md) |
| Grounding ablation | `cd backend && node ../benchmark/runAblation.js`              | No model needed                                                                   |
| Storage benchmark  | `node benchmark/runStorageBenchmark.js`                       | Couchbase against MongoDB; needs `MONGODB_URI`                                    |
| Model benchmark    | `node benchmark/runModelBenchmark.js --plan`                  | Free-tier plan, then a run across providers                                       |
| Assistant evals    | `cd backend && npm run eval:ai`, `npm run eval:conversations` | Spend API quota                                                                   |

## Conventions

Every change keeps to these.

- **Layout.** Next.js routes in `frontend/src/pages/` only pick which feature to render; each product area has one
  folder under `frontend/src/features/`. Backend routes only wire paths to handlers, controllers handle requests,
  and services, realtime handlers and background work never import from controllers.
- **Files stay under 500 lines.** Split by responsibility before a file crosses it. Vendored code and licensed data
  are the only exceptions.
- **One implementation per rule.** Anything the frontend, backend and MCP server must agree on (geometry, element
  limits, text metrics, z-order, file formats, diffs) lives in `shared/` and is imported from the module that
  defines it. Nothing in `shared/` imports a package; dependencies are passed in (see `provideDagre`).
- **Names say what something is.** No `data`, `handler`, `manager`, `utils` or `helpers` as the distinguishing
  word, and nothing named after its history (`legacy`, `old`, `v2`).
- **Comments are rare and short,** explaining a reason the code can't show. No dead code, unused exports or debug
  logs.
- **Imports.** Relative paths inside a feature or folder, `@/` across frontend folders, and `shared/` always by
  relative path.
- **Formatting.** Prettier with the root `.prettierrc.json` (4 spaces, 160 columns, double quotes).
- **Tests stay hermetic.** Backend tests mock the provider, persistence and models, and pass with no
  `backend/.env`. Only the end-to-end suite uses a real database.
- **Security boundaries hold.** Every mutation is re-authorised where it happens, every REST body and socket event
  has a Zod schema, identity comes only from the verified token, and secrets never reach the browser.
- **Docs follow the code.** A change to routes, events, settings, commands or measured numbers updates `docs/`,
  the package README and `.env.example` in the same change.
- **Copy.** No em dashes and no emojis, in code, docs or the product.
