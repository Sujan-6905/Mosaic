# Development

## Running locally

Follow [self-hosting](self-hosting.md) steps 1 and 2, then run `npm run dev` in `backend/` (port 5000) and in
`frontend/` (port 3000). The MCP server has its own [setup](../mcp-server/README.md).

## Tests

| Suite      | Command                           | Covers                                                                                                                                              | Needs                                                    |
| ---------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Backend    | `cd backend && npm test`          | REST, sockets (a real Socket.io server and clients), the assistant, grounding, and the tests in `shared/`, `mcp-server/` and the benchmark's grader | Nothing: models, persistence and the provider are mocked |
| Frontend   | `cd frontend && npm test`         | Board modules (camera, rendering, selection, text, diagrams, history, export) and helpers                                                           | Nothing                                                  |
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

Code layout, naming, comments, file size and the other rules every change follows are in
[`CLAUDE.md`](../CLAUDE.md) at the repository root.
