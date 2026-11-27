# Rendering performance

A benchmark run by hand before and after a change to the render, camera or culling
path. It isn't a CI gate: shared runners have no GPU and their frame times swing
with contention, so a hard assertion would be flaky by construction.

The target is a p95 frame under 16.7 ms (60 fps) on integrated graphics at a
high-density display, because that is where this board is most used.

## Running

It needs a backend and a production frontend, because a development build's own
overhead swamps what is measured. It uses the same addresses as the e2e suite, a
backend on 5100 (`PORT=5100 CORS_ORIGINS=http://localhost:3100 node src/index.js`) and:

```
NEXT_DIST_DIR=.next-e2e NEXT_PUBLIC_API_URL=http://localhost:5100 npx next build
NEXT_DIST_DIR=.next-e2e NEXTAUTH_URL=http://localhost:3100 npx next start -p 3100
npm run perf                                   # compare against results/with-tiles.json
npm run perf -- --compare before-tiles         # or against any other saved run
npm run perf -- --save my-change               # keep this run as results/my-change.json
```

`E2E_BASE_URL` and `E2E_BACKEND_URL` point it at another pair. To measure real
graphics hardware rather than headless software rendering, start a browser with
`--remote-debugging-port=9333` and set `PERF_CDP_URL=http://127.0.0.1:9333`.
`PERF_COUNTS`, `PERF_CPU_THROTTLE`, `PERF_WIDTH`, `PERF_HEIGHT`, `PERF_DPR` and
`PERF_SCENARIO_MS` change what is measured.

Boards load through `window.__mosaicPerf`, which the board exposes only with
`?perf=1`, so nothing reaches the database and 50,000 elements stay cheap to set up.
`boardScene.mjs` builds them.

## How these were measured

- **Hardware:** Intel Iris Xe (i9-13900H) through Windows Chrome over the
  DevTools protocol, GPU rendering confirmed from `chrome://gpu`.
- **Viewport:** 1440 x 810 at device pixel ratio 2, so 4.7 million canvas pixels.
- **Board:** 60% freehand strokes, 25% shapes (a fifth with a connector), 10% text,
  5% stickies, at about 150 elements per 1,000 x 1,000 world units.
- **Driving:** one camera change or one remote edit every animation frame, from
  inside the page. Frame rate limiting was off, so these frame times show
  headroom; a real display still caps at its refresh rate.
- **Interactions:** panning at 100%, panning zoomed out to the whole board, a zoom
  gesture, and a live edit from a collaborator every frame.

## Results: p95 frame time

"Before" is the previous renderer, which drew every visible element on every
repaint (`results/before-tiles.json`); "after" is `results/with-tiles.json`.

| Elements | Pan at 100%  | Pan zoomed out       | Zoom gesture | Live edit each frame |
| -------- | ------------ | -------------------- | ------------ | -------------------- |
| 1,000    | 51 → 3.0 ms  | 116 → 3.2 ms         | 62 → 4.4 ms  | 61 → 12.7 ms         |
| 5,000    | 59 → 2.7 ms  | 631 → 4.3 ms         | 63 → 4.4 ms  | 84 → 13.8 ms         |
| 9,000    | 75 → 2.9 ms  | 1,071 → 6.2 ms       | 103 → 4.5 ms | 110 → 15.8 ms        |
| 20,000   | 119 → 3.2 ms | about 6,300 → 8.7 ms | 149 → 4.6 ms | 161 → 28.7 ms        |

The target holds for every interaction up to 9,000 elements, and for panning and
zooming up to 20,000. A live edit misses it above that, because each change copies
the whole element map and re-renders the board component.

### Large boards

The same build and method at 10,000, 20,000 and 50,000 elements
(`results/with-tiles-large-boards.json`).

| Elements | Pan at 100%      | Pan zoomed out   | Zoom gesture     | Live edit each frame | Jump to whole board |
| -------- | ---------------- | ---------------- | ---------------- | -------------------- | ------------------- |
| 10,000   | 3.5 ms (286 fps) | 5.4 ms (185 fps) | 5.1 ms (196 fps) | 23.8 ms (42 fps)     | 210 ms              |
| 20,000   | 3.4 ms (294 fps) | 8.5 ms (118 fps) | 6.8 ms (147 fps) | 27.7 ms (36 fps)     | 1.1 s               |
| 50,000   | 3.3 ms (303 fps) | 16.0 ms (63 fps) | 5.2 ms (192 fps) | 70.7 ms (14 fps)     | 1.1 s               |

The fps figures are the p95 time inverted, so they show headroom rather than what a
display would show. A live edit every single frame is far beyond real use: it is
the worst case, not the normal one. Jumping to the whole board fills tiles in over
several frames rather than stalling on one; the worst single frame on the way was
516 ms at 20,000 elements and 220 ms at 50,000.

### On a dedicated GPU (estimated, not measured)

Every number above comes from integrated graphics. A rough expectation for a
mid-range dedicated GPU (an RTX 4060 laptop part or similar, with its own GDDR6
memory) on the same CPU, from which costs are GPU-bound and which are not:

| Interaction                     | Bound by                                       | Iris Xe, measured | Dedicated GPU, estimate |
| ------------------------------- | ---------------------------------------------- | ----------------- | ----------------------- |
| Pan at 100%, zoom gesture       | Compositing cached tiles                       | 3-7 ms            | 2-4 ms                  |
| Pan zoomed out, 20,000 / 50,000 | Filling new tiles                              | 8.5 / 16.0 ms     | 4-6 / 7-10 ms           |
| Jump to whole board             | Filling new tiles                              | 0.2-1.1 s         | 0.1-0.6 s               |
| Live edit each frame            | JavaScript: copying the board and re-rendering | 24-71 ms          | about the same          |

Tile filling gains the most: Chrome's canvas rasterises paths on the GPU, and a
dedicated part has several times the fill rate and memory bandwidth, though path
setup still runs on the CPU, so the gain is smaller than the raw hardware gap.
Panning a cached view is already near the browser's own per-frame overhead, so
it barely moves. Live edits are CPU work, so a faster GPU leaves them where they
are; only not copying the whole element map on each edit would help there.

## What made the difference

JavaScript was the first bottleneck, and GPU fill the second.

| Cost                                                 | Fix                                                                                 |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Each repaint re-ran perfect-freehand on every stroke | `getStrokePaths` builds a `Path2D` once per element and detail level                |
| Each repaint re-measured wrapped text                | `getWrappedLines` keeps each element's lines                                        |
| Each repaint sorted the whole board                  | `paintOrder.js` sorts what's visible, or reuses a sort while the board is unchanged |
| A pan re-rendered the whole board component          | `cameraStore.js` updates only the screen-space layers, once per frame               |
| Each socket message copied the whole board           | Remote changes share one copy per frame                                             |
| Thousands of tiny paths filled at full detail        | Simplification scales with zoom, and sub-2-pixel elements draw as a rectangle       |
| The GPU filled every path again on every frame       | `tileRenderer.js` composites cached bitmap tiles                                    |

The JavaScript fixes alone took pan at 9,000 elements to 24.5 ms p95, but zoomed-out
panning stayed at about 5 fps, which is what justified tiles.

## Tiles

Each zoom level has a grid of 512 x 512 device-pixel tiles. A tile is drawn once,
then composited at whole device pixels, so text stays as crisp as a direct draw.

- **Edits** redraw only the tiles under what changed. An element landing on top is
  drawn straight onto its tiles with no redraw.
- **Busy views** fill in at up to 600 elements a frame, centre first, showing another
  zoom level's tiles until each one is ready.
- **Zoom** stretches existing tiles while the gesture moves, so it stays smooth but
  soft, and sharpens about 150 ms after it stops.
- **Memory** is capped at 192 tiles, about 192 MB of canvas at most. An empty tile
  allocates nothing.

## Why not WebGL or Rust/WASM

Rust/WASM speeds up JavaScript arithmetic, and paint JavaScript is already under
1 ms a frame for panning at every size. The remaining cost was GPU fill, which
tiles remove without rewriting how every element type draws.

A spike compared the options on the same hardware, forcing the GPU to finish each
frame with a readback, which itself adds a few milliseconds:

| 9,000 elements  | Direct canvas | Tiles  | WebGL2 |
| --------------- | ------------- | ------ | ------ |
| Close view, p50 | 20.7 ms       | 3.6 ms | 5.2 ms |
| Zoomed out, p50 | 257 ms        | 3.3 ms | 5.7 ms |

At 50,000 elements, tiles held at 3.4-3.7 ms and WebGL took 10.8-13.8 ms. The WebGL
spike drew strokes as plain lines, with no text, fills or pressure outlines, so it
is a best case for WebGL, and it still didn't beat tiles for panning. WebGL would
only win where tiles can't help: redrawing large parts of a very large board on
every frame.
