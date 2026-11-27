# Layer ablation study

Generated 2026-11-22 by `node benchmark/runAblation.js`. Resolution accuracy is symbolic,
so the study needs no model and reproduces exactly from a clean checkout.

## Resolution accuracy@1, by grounding-layer configuration

```
baseline (no grouping, no relations) #######################----------------- 58.7%
+ structural grouping            ###############################--------- 78.3%
+ temporal grouping signal       ###############################--------- 78.3%
+ relations (full stack)         ###############################--------- 78.3%
```

| Configuration                        | n   | res@1 | res@3 |
| ------------------------------------ | --- | ----- | ----- |
| baseline (no grouping, no relations) | 54  | 58.7% | 84.8% |
| + structural grouping                | 54  | 78.3% | 97.8% |
| + temporal grouping signal           | 54  | 78.3% | 97.8% |
| + relations (full stack)             | 54  | 78.3% | 97.8% |

## Temporal grouping signal, on its own (grouping harness, F1 over same-object pairs)

```
proximity-only                   ######################################-- F1=0.952
structural-only                  ######################################## F1=1.000
structural-plus-temporal         ######################################## F1=1.000
```

| Configuration            | Precision | Recall | F1    |
| ------------------------ | --------- | ------ | ----- |
| proximity-only           | 0.909     | 1.000  | 0.952 |
| structural-only          | 1.000     | 1.000  | 1.000 |
| structural-plus-temporal | 1.000     | 1.000  | 1.000 |

## What it shows

- **Structural grouping is the whole measured effect.** It lifts top-1 resolution from the baseline to
  the full-stack figure; the temporal signal and relations add nothing on these four small boards.
- **Temporal grouping is redundant while stroke order follows drawing order.** Structural grouping
  already merges consecutive nearby strokes by z-order, which is drawing order unless strokes were
  reordered, so the burst signal only adds merges on reordered boards. The harness's F1 of 1.0 for
  structural-only is that ceiling, not a missing fixture.
- **Relations would show on denser boards**, where identical objects are told apart only by what
  sits next to them; none of these boards need that.
- **Not ablated here:** the repair loop and the resolver switch. Repair changes edit validity, which
  needs a live model, and the resolver switch sits in the HTTP handler this harness bypasses.
