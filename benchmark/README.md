# Benchmarks

Three measurements, each run against the real code rather than a copy of it:

| Benchmark                                      | Question                                                                  | Entry point              |
| ---------------------------------------------- | ------------------------------------------------------------------------- | ------------------------ |
| [Canvas edit](#canvas-edit-benchmark)          | Does a plain-language edit find and change the right shapes?              | `runBenchmark.js`        |
| [Storage](#storage-benchmark)                  | Is Couchbase Capella faster than MongoDB on the app's own storage paths?  | `runStorageBenchmark.js` |
| [Assistant models](#assistant-model-benchmark) | How much do Mosaic's prompts, contracts and layout engine add, per model? | `runModelBenchmark.js`   |

They use the packages the backend and MCP server already install (`packageResolution.js`) and read keys from
`backend/.env` (`backendEnv.js`), so install those two first.

## Canvas edit benchmark

Benchmarks exist for GUI grounding, SVG editing and spatial question answering, but not for editing a mixed
freehand and structured canvas from plain language. This one does that: 54 instructions against four
hand-built boards, each with the end state a person would expect, run through Mosaic's real grounding and
edit pipeline and graded structurally.

Latest results: [`results/edit-benchmark.md`](results/edit-benchmark.md) (78.3% top-1 resolution, 97.8%
top-3, 100% of refusals correct) and the layer ablation in [`results/ablation.md`](results/ablation.md).

## What it measures

| Measure                     | Question                                                                                                                                                 | Needs a model |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Resolution accuracy @1 / @3 | Does the resolver rank the intended target first, or in its top three?                                                                                   | No            |
| Edit validity               | After validation, sanitising, the shadow scene and auto-repair, did the edit touch exactly the expected elements? A refusal passes when nothing changes. | Yes           |
| Geometric regression        | Did the edit add an overlap or break an alignment that held before? Uses the assistant's own linter.                                                     | Yes           |

Ask rate, model calls per instruction and latency are reported alongside. Every measure is rolled up per
category, so a weak category isn't averaged away.

| Category  | Cases | What the target looks like                                             |
| --------- | ----- | ---------------------------------------------------------------------- |
| named     | 14    | Named in words: "the login box"                                        |
| spatial   | 10    | Identical objects told apart by position: "the box on the left"        |
| freehand  | 8     | Hand-drawn strokes with no text, found by position or shape            |
| group     | 8     | A cluster or frame referred to as one thing: "the task cluster"        |
| multistep | 6     | Two operations in one instruction, graded on everything either touches |
| refusal   | 8     | Something not on the board; the only right answer is to change nothing |

## Running it

From `backend/`, so the backend's dependencies resolve:

```bash
node ../benchmark/runBenchmark.js                                  # resolution accuracy only, no key needed
GROQ_API_KEY=... node ../benchmark/runBenchmark.js --delay-ms 25000  # the full run, about 30 minutes
node ../benchmark/runAblation.js                                   # rewrites results/ablation.md
npx vitest run ../benchmark                                        # the grader's own tests
```

| Flag             | Effect                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `--delay-ms <n>` | Pause between cases (default 3000); 25000 stays inside Groq's free 8,000 tokens a minute |
| `--category a,b` | Run only these categories                                                                |
| `--flags a,b`    | Disable grounding layers (`grouping`, `temporal-grouping`, `relations`) for an ablation  |
| `--out <file>`   | Also write the summary to a file                                                         |

A case whose model call still fails after retries is reported as an error and left out of edit validity,
rather than ending the run.

## Design

- **Hermetic.** `editBenchmark/pipeline.js` repeats `planAgentEdit` from the same validation, sanitising,
  executor and repair modules, because the production version imports database models that connect on
  import.
- **Deterministic grading.** `grade.js` and `metrics.js` are pure and unit tested. The model's answers are
  not deterministic, so single cases can flip between runs; category figures are what reproduce.
- **Resolution is model-free.** It scores the symbolic resolver directly, so it and the ablation reproduce
  exactly from a clean checkout.

## Limits

- The benchmark was written by the person who built the system it measures.
- `duplicate` and `connect` are not graded: they create elements whose ids can't be known in advance.
- Refusals are graded on whether anything changed, not on whether the stated reason was right.
- The four boards are small, which is why relation-based grounding shows no effect here (see the ablation).

## Files

| File                                   | Holds                                                   |
| -------------------------------------- | ------------------------------------------------------- |
| `editBenchmark/boards.js`              | The four board fixtures                                 |
| `editBenchmark/dataset.js`             | The 54 instructions and their expected changes          |
| `editBenchmark/pipeline.js`            | The hermetic edit pipeline                              |
| `editBenchmark/grade.js`, `metrics.js` | Grading and the summary table                           |
| `runBenchmark.js`, `runAblation.js`    | The two entry points                                    |
| `bootstrap.js`                         | Applies `--flags` before the grounding layer reads them |

## Storage benchmark

Mosaic started on MongoDB and moved to Couchbase Capella. This times the same eight storage paths on both, with
identical seeded data, from one machine: opening a board by key and by share id, an autosave of one element,
twenty people writing different elements of one board at once (and whether every write survived), a burst of
operation-log appends, reading the operations after a version, finding the latest version at or before a point,
and listing a person's boards. Each store gets its own throwaway namespace (a `bench` scope in the bucket, a
`mosaic_bench` database) that is dropped afterwards.

```bash
node benchmark/runStorageBenchmark.js                          # both stores, 200 timed calls per workload
node benchmark/runStorageBenchmark.js --stores couchbase --only boardByKey,opBurst --iterations 500
```

Needs `CB_*` (already set for the app) and `MONGODB_URI`, plus `MONGODB_DB` if the database should not be
`mosaic_bench`, in `backend/.env`. Flags: `--stores`, `--only`, `--iterations`, `--concurrency` (default 4),
`--warmup`, `--runs` (default 3) and `--keep` (leave the data for inspection). Results go to `results/storage-benchmark.md` and `.json`.

Every call crosses the internet, so a cluster in a nearer region wins every row by about its round trip, and that
round trip drifts over minutes. Each workload is therefore preceded by its own round-trip measurement, and the stores
are compared on what each adds on top of it. Both stores run each workload back to back, taking turns to go first, and
every figure is the median of several such passes, so a quiet or busy minute on the network lands on both. Both free tiers have small quotas (Capella's bucket holds 100 MB,
Atlas M0 512 MB); the dataset is about 5 MB.

## Assistant model benchmark

The assistant's first version asked a model for raw coordinates on a fixed grid. Today it asks for typed intents
under a strict schema, lays diagrams out with the style engine, and draws sketches from named parts. This runs ten
tasks (five architecture and flow diagrams, five drawings) on several models through both versions, so the gain
from the code can be told apart from the gain from the model.

```bash
node benchmark/runModelBenchmark.js --plan                     # what a run costs against each free allowance
node benchmark/runModelBenchmark.js --models groq,claude:haiku # every Groq model, and Claude Haiku
node benchmark/runModelBenchmark.js --models gemini:gemini-3.5-flash --tasks diagram
```

| Provider      | Key in `backend/.env`                           | Models by default                                   | Free allowance it paces to                                           |
| ------------- | ----------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------- |
| Groq          | `GROQ_API_KEY`                                  | qwen3.8-27b, gpt-oss-120b, gpt-oss-20b              | 30 a minute, 8k tokens a minute, 200k a day                          |
| Google Gemini | `GEMINI_API_KEY`                                | gemini-3.5-flash-lite                               | 15 a minute, 500 a day; Flash models 5 and 20, from midnight Pacific |
| NVIDIA NIM    | `NVIDIA_API_KEY`                                | mistral-large-4-1t-a52b, nemotron-3-ultra-550b-a55b | 40 a minute                                                          |
| OpenRouter    | `OPENROUTER_API_KEY`                            | ernie-5.5-flash-preview:free                        | 20 a minute, 50 a day                                                |
| Claude        | none: the `claude` CLI on your own subscription | haiku, sonnet, opus                                 | 4 a minute                                                           |
| Antigravity   | none: the `agy` CLI on a Gemini subscription    | gemini-3.8-flash-medium                             | 4 a minute                                                           |

The Antigravity rows are Gemini models reached through Google's Antigravity CLI rather than the Gemini API, used
when the free API was too overloaded to finish. The CLI wraps every call in its own agent instructions (about 10,000
tokens), so the report labels those rows and their token counts are not comparable with the others.

Free allowances change, so check each provider's limits page and override with `--limits gemini:rpd=100`. Any
model can be named directly: `--models nvidia:qwen/qwen3-coder-480b-a35b-instruct`.

**Staying inside the free tier.** Every call waits for room in the provider's per-minute window before it is sent,
and a rate limit is waited out rather than counted against the model; a task the provider never answers, or answers
after the call deadline, is left for the next run. Daily use is kept in `results/models/ledger.json` (not
committed); when a day's allowance runs out the run stops, and the next run skips every finished task and carries
on. `--fresh` reruns finished tasks.

**What is graded.** Whether something was drawn, the share of elements the board accepts as they are, the
labels a faithful diagram must carry, labelled boxes covering each other, arrows drawn, tokens, and the model's
own time. Each task's board is written as an SVG under `results/models/`, and `results/model-benchmark.md` puts
the two versions side by side for every model and task, which is how the drawings are judged.

`node benchmark/renderModelGallery.js` turns the saved SVGs into one image per task, every model in a row with
both versions beside each other, under `results/gallery/`, shown in `results/model-gallery.md`. It needs the
frontend's Playwright browser (`npx playwright install chromium` in `frontend/`).

**Answer limits.** A model that reasons before it answers, or writes out every empty field, can run into the
assistant's answer limit on a large diagram. A cut-off answer is asked for once more with more room, as in the
product; one cut off again counts as not drawn.

**How it runs the real assistant.** `models/transport.js` stands in for the network: the assistant's calls go to
the model under test instead of Groq, providers without strict schemas get JSON mode with the schema in the
prompt, and Claude is driven through `claude -p`. The assistant's own deadlines are raised for the run, because
free-tier pacing waits inside a turn: 4 minutes a call and 30 a turn, or a provider's own `deadlines` in
`models/providers.js`. NVIDIA's free tier generates Mistral Large 4 at about two tokens a second, so it allows 45
minutes a call and 3 hours a turn. `AI_CALL_TIMEOUT_MS` and `AI_TURN_DEADLINE_MS` in the environment override both.

| File                                                      | Holds                                                |
| --------------------------------------------------------- | ---------------------------------------------------- |
| `storage/fixtures.js`, `workloads.js`                     | The seeded dataset and the eight timed paths         |
| `storage/couchbaseStore.js`, `mongoStore.js`              | The same operations on each store                    |
| `storage/measure.js`, `report.js`                         | Percentiles and the results table                    |
| `models/providers.js`, `allowance.js`, `transport.js`     | Providers, free-tier pacing and call routing         |
| `models/tasks.js`, `variants.js`, `grade.js`, `report.js` | The ten tasks, both versions, grading and the report |
| `renderModelGallery.js`                                   | One comparison image per task from the saved results |
