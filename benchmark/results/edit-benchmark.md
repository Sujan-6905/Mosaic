# Canvas edit benchmark results

## Latest full run

2026-10-29, `qwen/qwen3.8-27b` (the reasoning role's default), via
`GROQ_API_KEY=... node benchmark/runBenchmark.js --delay-ms 25000`. The pacing keeps a run inside the free
tier's 8,000 tokens a minute; a full run takes about half an hour.

```
category   n   res@1   res@3   edit-valid  geo-regression  ask-rate  calls/instr  avg ms
overall    54  78.3%   97.8%   75.5%       3.0%            1.9%      1.00         476
freehand   8   87.5%   100.0%  75.0%       0.0%            0.0%      1.00         462
group      8   62.5%   100.0%  50.0%       0.0%            0.0%      1.00         524
multistep  6   100.0%  100.0%  100.0%      0.0%            0.0%      1.00         720
named      14  85.7%   100.0%  71.4%       9.1%            0.0%      1.00         412
refusal    8   n/a     n/a     100.0%      n/a             0.0%      1.00         484
spatial    10  60.0%   90.0%   70.0%       0.0%            10.0%     1.00         382
```

After that run, a lone group in `align`, `distribute` or `tidy` started acting on its members. The group and
multistep categories were re-run (`--category group,multistep`):

```
category   n   res@1   res@3   edit-valid  geo-regression  ask-rate  calls/instr  avg ms
overall    14  78.6%   100.0%  92.9%       23.1%           7.1%      1.00         540
group      8   62.5%   100.0%  87.5%       28.6%           12.5%     1.00         482
multistep  6   100.0%  100.0%  100.0%      16.7%           0.0%      1.00         618
```

Resolution accuracy was re-checked on 2026-11-22 against the current grounding layer with no model
(78.3% top-1, 97.8% top-3, unchanged). Edit validity needs a live model and has not been re-run since the
assistant became one guarded turn on 2026-10-30.

## How it got here

| Run        | Model                                 | res@1 / @3    | Edit validity | Refusals passed | Geometric regression |
| ---------- | ------------------------------------- | ------------- | ------------- | --------------- | -------------------- |
| 2026-08-14 | llama-3.3-70b-versatile               | 71.7% / 97.8% | 77.8%         | 62.5%           | 6.5%                 |
| 2026-10-28 | qwen3.8-27b                           | 71.7% / 97.8% | 76.9%         | 100.0%          | 0.0%                 |
| 2026-10-29 | qwen3.8-27b, groups named by contents | 78.3% / 97.8% | 75.5%         | 100.0%          | 3.0%                 |

## What the numbers mean

- **Refusals are solved.** Since the prompt gained an explicit "that isn't on the board" answer, no
  instruction about a missing object edits anything; the older model edited an unrelated object in three
  of eight.
- **Groups were the weak spot, and naming fixed resolution.** A group now reaches the model named by what it
  holds ("group of 4 sticky notes", members listed), which lifted group top-1 resolution from 37.5% to
  62.5% and multistep from 83.3% to 100%.
- **The edit engine fixed the rest.** Group edit validity went from 50% to 87.5% once a lone group in an
  arrangement acts on its members. The geometric regressions that appeared are what was asked for:
  left-aligning a 2x2 sticky grid stacks the stickies.
- **Asking counts as a miss.** An `ambiguous` reply with a shortlist is graded as a failure even where a
  person would call the question fair.
- Single cases can flip between runs, since the model samples; the category pattern is what reproduces.
