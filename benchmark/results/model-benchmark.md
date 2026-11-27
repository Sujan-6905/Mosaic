# Assistant model benchmark

Each model runs every task twice: through the first version of the assistant (one prompt asking for raw
coordinates on a fixed grid) and through Mosaic today (typed intents, the diagram style engine and named
sketch parts). Same model, same words; the difference is the code around it.

Drawn: produced something to place. Valid: elements the board accepts as they are. Coverage: the labels a
faithful diagram must carry. Overlaps: labelled boxes covering each other, per diagram. Arrows: connections drawn, per diagram. Tokens and the model's own
time per task, without the pauses that keep a run inside the free allowance.

Antigravity rows are Gemini models called through Google's Antigravity CLI on a Gemini subscription, not the Gemini API. The CLI wraps every call in its own agent instructions, about 10,000 tokens a call, so their token counts are not comparable with the other rows.

| Model | Version | Tasks | Drawn | Valid | Coverage | Overlaps | Arrows | Tokens | Time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| antigravity:gemini-3.8-flash-medium (Antigravity) | First version (raw coordinates) | 10 | 100% | 100% | 100% | 0.0 | 6.6 | 13759 | 35.5s |
|  | Mosaic today (intents, layout engine, sketch parts) | 10 | 100% | 100% | 100% | 0.0 | 6.8 | 43544 | 143.0s |
| claude:haiku | First version (raw coordinates) | 10 | 100% | 100% | 100% | 0.0 | 7.4 | 8176 | 12.8s |
|  | Mosaic today (intents, layout engine, sketch parts) | 10 | 100% | 100% | 100% | 0.0 | 8.4 | 31752 | 16.1s |
| claude:opus | First version (raw coordinates) | 10 | 100% | 100% | 100% | 0.0 | 6.4 | 5486 | 13.1s |
|  | Mosaic today (intents, layout engine, sketch parts) | 10 | 100% | 100% | 100% | 0.0 | 8.0 | 26005 | 16.3s |
| claude:sonnet | First version (raw coordinates) | 10 | 100% | 100% | 100% | 0.0 | 6.8 | 4915 | 6.6s |
|  | Mosaic today (intents, layout engine, sketch parts) | 10 | 100% | 100% | 97% | 0.0 | 8.8 | 25895 | 12.4s |
| gemini:gemini-3.5-flash-lite | First version (raw coordinates) | 10 | 100% | 100% | 97% | 0.0 | 6.6 | 801 | 2.0s |
|  | Mosaic today (intents, layout engine, sketch parts) | 10 | 100% | 100% | 100% | 0.0 | 6.8 | 7214 | 5.6s |
| groq:openai/gpt-oss-120b | First version (raw coordinates) | 10 | 100% | 98% | 100% | 0.0 | 6.6 | 1509 | 3.5s |
|  | Mosaic today (intents, layout engine, sketch parts) | 10 | 100% | 100% | 97% | 0.0 | 7.8 | 9890 | 6.7s |
| groq:openai/gpt-oss-20b | First version (raw coordinates) | 10 | 90% | 91% | 86% | 0.2 | 4.2 | 1631 | 2.1s |
|  | Mosaic today (intents, layout engine, sketch parts) | 10 | 90% | 100% | 77% | 0.0 | 6.8 | 8934 | 7.2s |
| groq:qwen/qwen3.8-27b | First version (raw coordinates) | 10 | 90% | 100% | 97% | 0.2 | 4.6 | 1082 | 2.0s |
|  | Mosaic today (intents, layout engine, sketch parts) | 10 | 100% | 100% | 100% | 0.0 | 7.2 | 6305 | 2.4s |
| nvidia:mistralai/mistral-large-4-1t-a52b | First version (raw coordinates) | 10 | 100% | 100% | 100% | 0.0 | 6.2 | 3456 | 202.9s |
|  | Mosaic today (intents, layout engine, sketch parts) | 10 | 100% | 100% | 100% | 0.0 | 7.2 | 13608 | 330.8s |
| nvidia:nvidia/nemotron-3-ultra-550b-a55b | First version (raw coordinates) | 10 | 100% | 100% | 100% | 0.0 | 6.0 | 1913 | 13.4s |
|  | Mosaic today (intents, layout engine, sketch parts) | 10 | 90% | 100% | 100% | 0.0 | 8.0 | 14305 | 67.4s |
| openrouter:baidu/ernie-5.5-flash-preview:free | First version (raw coordinates) | 10 | 100% | 100% | 100% | 0.0 | 6.6 | 7357 | 31.5s |
|  | Mosaic today (intents, layout engine, sketch parts) | 10 | 100% | 100% | 97% | 0.0 | 8.2 | 11643 | 16.2s |

## Side by side

### Draw the architecture of a URL shortener: a web client, an API gateway, a shortening service, a Redis cache, PostgreSQL, and an analytics worker that reads click events from a Kafka queue.

| Model | First version (raw coordinates) | Mosaic today (intents, layout engine, sketch parts) |
| --- | --- | --- |
| antigravity:gemini-3.8-flash-medium (Antigravity) | ![baseline](models/antigravity-gemini-3.8-flash-medium/url-shortener.baseline.svg) | ![mosaic](models/antigravity-gemini-3.8-flash-medium/url-shortener.mosaic.svg) |
| claude:haiku | ![baseline](models/claude-haiku/url-shortener.baseline.svg) | ![mosaic](models/claude-haiku/url-shortener.mosaic.svg) |
| claude:opus | ![baseline](models/claude-opus/url-shortener.baseline.svg) | ![mosaic](models/claude-opus/url-shortener.mosaic.svg) |
| claude:sonnet | ![baseline](models/claude-sonnet/url-shortener.baseline.svg) | ![mosaic](models/claude-sonnet/url-shortener.mosaic.svg) |
| gemini:gemini-3.5-flash-lite | ![baseline](models/gemini-gemini-3.5-flash-lite/url-shortener.baseline.svg) | ![mosaic](models/gemini-gemini-3.5-flash-lite/url-shortener.mosaic.svg) |
| groq:openai/gpt-oss-120b | ![baseline](models/groq-openai-gpt-oss-120b/url-shortener.baseline.svg) | ![mosaic](models/groq-openai-gpt-oss-120b/url-shortener.mosaic.svg) |
| groq:openai/gpt-oss-20b | ![baseline](models/groq-openai-gpt-oss-20b/url-shortener.baseline.svg) | ![mosaic](models/groq-openai-gpt-oss-20b/url-shortener.mosaic.svg) |
| groq:qwen/qwen3.8-27b | ![baseline](models/groq-qwen-qwen3.8-27b/url-shortener.baseline.svg) | ![mosaic](models/groq-qwen-qwen3.8-27b/url-shortener.mosaic.svg) |
| nvidia:mistralai/mistral-large-4-1t-a52b | ![baseline](models/nvidia-mistralai-mistral-large-4-1t-a52b/url-shortener.baseline.svg) | ![mosaic](models/nvidia-mistralai-mistral-large-4-1t-a52b/url-shortener.mosaic.svg) |
| nvidia:nvidia/nemotron-3-ultra-550b-a55b | ![baseline](models/nvidia-nvidia-nemotron-3-ultra-550b-a55b/url-shortener.baseline.svg) | ![mosaic](models/nvidia-nvidia-nemotron-3-ultra-550b-a55b/url-shortener.mosaic.svg) |
| openrouter:baidu/ernie-5.5-flash-preview:free | ![baseline](models/openrouter-baidu-ernie-5.5-flash-preview-free/url-shortener.baseline.svg) | ![mosaic](models/openrouter-baidu-ernie-5.5-flash-preview-free/url-shortener.mosaic.svg) |

### Flowchart of a password reset: the user requests a reset link, we email it, they click it, and if the token is invalid or expired they see an error, otherwise they set a new password and are signed in.

| Model | First version (raw coordinates) | Mosaic today (intents, layout engine, sketch parts) |
| --- | --- | --- |
| antigravity:gemini-3.8-flash-medium (Antigravity) | ![baseline](models/antigravity-gemini-3.8-flash-medium/password-reset.baseline.svg) | ![mosaic](models/antigravity-gemini-3.8-flash-medium/password-reset.mosaic.svg) |
| claude:haiku | ![baseline](models/claude-haiku/password-reset.baseline.svg) | ![mosaic](models/claude-haiku/password-reset.mosaic.svg) |
| claude:opus | ![baseline](models/claude-opus/password-reset.baseline.svg) | ![mosaic](models/claude-opus/password-reset.mosaic.svg) |
| claude:sonnet | ![baseline](models/claude-sonnet/password-reset.baseline.svg) | ![mosaic](models/claude-sonnet/password-reset.mosaic.svg) |
| gemini:gemini-3.5-flash-lite | ![baseline](models/gemini-gemini-3.5-flash-lite/password-reset.baseline.svg) | ![mosaic](models/gemini-gemini-3.5-flash-lite/password-reset.mosaic.svg) |
| groq:openai/gpt-oss-120b | ![baseline](models/groq-openai-gpt-oss-120b/password-reset.baseline.svg) | ![mosaic](models/groq-openai-gpt-oss-120b/password-reset.mosaic.svg) |
| groq:openai/gpt-oss-20b | ![baseline](models/groq-openai-gpt-oss-20b/password-reset.baseline.svg) | ![mosaic](models/groq-openai-gpt-oss-20b/password-reset.mosaic.svg) |
| groq:qwen/qwen3.8-27b | ![baseline](models/groq-qwen-qwen3.8-27b/password-reset.baseline.svg) | ![mosaic](models/groq-qwen-qwen3.8-27b/password-reset.mosaic.svg) |
| nvidia:mistralai/mistral-large-4-1t-a52b | ![baseline](models/nvidia-mistralai-mistral-large-4-1t-a52b/password-reset.baseline.svg) | ![mosaic](models/nvidia-mistralai-mistral-large-4-1t-a52b/password-reset.mosaic.svg) |
| nvidia:nvidia/nemotron-3-ultra-550b-a55b | ![baseline](models/nvidia-nvidia-nemotron-3-ultra-550b-a55b/password-reset.baseline.svg) | ![mosaic](models/nvidia-nvidia-nemotron-3-ultra-550b-a55b/password-reset.mosaic.svg) |
| openrouter:baidu/ernie-5.5-flash-preview:free | ![baseline](models/openrouter-baidu-ernie-5.5-flash-preview-free/password-reset.baseline.svg) | ![mosaic](models/openrouter-baidu-ernie-5.5-flash-preview-free/password-reset.mosaic.svg) |

### System architecture of a ride-hailing app: rider app, driver app, API gateway, matching service, pricing service, trip service, payments through Stripe, PostgreSQL, Redis for live driver locations, and push notifications.

| Model | First version (raw coordinates) | Mosaic today (intents, layout engine, sketch parts) |
| --- | --- | --- |
| antigravity:gemini-3.8-flash-medium (Antigravity) | ![baseline](models/antigravity-gemini-3.8-flash-medium/ride-hailing.baseline.svg) | ![mosaic](models/antigravity-gemini-3.8-flash-medium/ride-hailing.mosaic.svg) |
| claude:haiku | ![baseline](models/claude-haiku/ride-hailing.baseline.svg) | ![mosaic](models/claude-haiku/ride-hailing.mosaic.svg) |
| claude:opus | ![baseline](models/claude-opus/ride-hailing.baseline.svg) | ![mosaic](models/claude-opus/ride-hailing.mosaic.svg) |
| claude:sonnet | ![baseline](models/claude-sonnet/ride-hailing.baseline.svg) | ![mosaic](models/claude-sonnet/ride-hailing.mosaic.svg) |
| gemini:gemini-3.5-flash-lite | ![baseline](models/gemini-gemini-3.5-flash-lite/ride-hailing.baseline.svg) | ![mosaic](models/gemini-gemini-3.5-flash-lite/ride-hailing.mosaic.svg) |
| groq:openai/gpt-oss-120b | ![baseline](models/groq-openai-gpt-oss-120b/ride-hailing.baseline.svg) | ![mosaic](models/groq-openai-gpt-oss-120b/ride-hailing.mosaic.svg) |
| groq:openai/gpt-oss-20b | ![baseline](models/groq-openai-gpt-oss-20b/ride-hailing.baseline.svg) | _invalid_ |
| groq:qwen/qwen3.8-27b | ![baseline](models/groq-qwen-qwen3.8-27b/ride-hailing.baseline.svg) | ![mosaic](models/groq-qwen-qwen3.8-27b/ride-hailing.mosaic.svg) |
| nvidia:mistralai/mistral-large-4-1t-a52b | ![baseline](models/nvidia-mistralai-mistral-large-4-1t-a52b/ride-hailing.baseline.svg) | ![mosaic](models/nvidia-mistralai-mistral-large-4-1t-a52b/ride-hailing.mosaic.svg) |
| nvidia:nvidia/nemotron-3-ultra-550b-a55b | ![baseline](models/nvidia-nvidia-nemotron-3-ultra-550b-a55b/ride-hailing.baseline.svg) | ![mosaic](models/nvidia-nvidia-nemotron-3-ultra-550b-a55b/ride-hailing.mosaic.svg) |
| openrouter:baidu/ernie-5.5-flash-preview:free | ![baseline](models/openrouter-baidu-ernie-5.5-flash-preview-free/ride-hailing.baseline.svg) | ![mosaic](models/openrouter-baidu-ernie-5.5-flash-preview-free/ride-hailing.mosaic.svg) |

### An org chart: the CTO, CFO and COO report to the CEO, and two engineering managers, Asha and Ben, report to the CTO.

| Model | First version (raw coordinates) | Mosaic today (intents, layout engine, sketch parts) |
| --- | --- | --- |
| antigravity:gemini-3.8-flash-medium (Antigravity) | ![baseline](models/antigravity-gemini-3.8-flash-medium/org-chart.baseline.svg) | ![mosaic](models/antigravity-gemini-3.8-flash-medium/org-chart.mosaic.svg) |
| claude:haiku | ![baseline](models/claude-haiku/org-chart.baseline.svg) | ![mosaic](models/claude-haiku/org-chart.mosaic.svg) |
| claude:opus | ![baseline](models/claude-opus/org-chart.baseline.svg) | ![mosaic](models/claude-opus/org-chart.mosaic.svg) |
| claude:sonnet | ![baseline](models/claude-sonnet/org-chart.baseline.svg) | ![mosaic](models/claude-sonnet/org-chart.mosaic.svg) |
| gemini:gemini-3.5-flash-lite | ![baseline](models/gemini-gemini-3.5-flash-lite/org-chart.baseline.svg) | ![mosaic](models/gemini-gemini-3.5-flash-lite/org-chart.mosaic.svg) |
| groq:openai/gpt-oss-120b | ![baseline](models/groq-openai-gpt-oss-120b/org-chart.baseline.svg) | ![mosaic](models/groq-openai-gpt-oss-120b/org-chart.mosaic.svg) |
| groq:openai/gpt-oss-20b | ![baseline](models/groq-openai-gpt-oss-20b/org-chart.baseline.svg) | ![mosaic](models/groq-openai-gpt-oss-20b/org-chart.mosaic.svg) |
| groq:qwen/qwen3.8-27b | ![baseline](models/groq-qwen-qwen3.8-27b/org-chart.baseline.svg) | ![mosaic](models/groq-qwen-qwen3.8-27b/org-chart.mosaic.svg) |
| nvidia:mistralai/mistral-large-4-1t-a52b | ![baseline](models/nvidia-mistralai-mistral-large-4-1t-a52b/org-chart.baseline.svg) | ![mosaic](models/nvidia-mistralai-mistral-large-4-1t-a52b/org-chart.mosaic.svg) |
| nvidia:nvidia/nemotron-3-ultra-550b-a55b | ![baseline](models/nvidia-nvidia-nemotron-3-ultra-550b-a55b/org-chart.baseline.svg) | ![mosaic](models/nvidia-nvidia-nemotron-3-ultra-550b-a55b/org-chart.mosaic.svg) |
| openrouter:baidu/ernie-5.5-flash-preview:free | ![baseline](models/openrouter-baidu-ernie-5.5-flash-preview-free/org-chart.baseline.svg) | ![mosaic](models/openrouter-baidu-ernie-5.5-flash-preview-free/org-chart.mosaic.svg) |

### A product launch roadmap as a timeline: research in January, design in February, build from March to May, a beta in June and the launch in July.

| Model | First version (raw coordinates) | Mosaic today (intents, layout engine, sketch parts) |
| --- | --- | --- |
| antigravity:gemini-3.8-flash-medium (Antigravity) | ![baseline](models/antigravity-gemini-3.8-flash-medium/launch-timeline.baseline.svg) | ![mosaic](models/antigravity-gemini-3.8-flash-medium/launch-timeline.mosaic.svg) |
| claude:haiku | ![baseline](models/claude-haiku/launch-timeline.baseline.svg) | ![mosaic](models/claude-haiku/launch-timeline.mosaic.svg) |
| claude:opus | ![baseline](models/claude-opus/launch-timeline.baseline.svg) | ![mosaic](models/claude-opus/launch-timeline.mosaic.svg) |
| claude:sonnet | ![baseline](models/claude-sonnet/launch-timeline.baseline.svg) | ![mosaic](models/claude-sonnet/launch-timeline.mosaic.svg) |
| gemini:gemini-3.5-flash-lite | ![baseline](models/gemini-gemini-3.5-flash-lite/launch-timeline.baseline.svg) | ![mosaic](models/gemini-gemini-3.5-flash-lite/launch-timeline.mosaic.svg) |
| groq:openai/gpt-oss-120b | ![baseline](models/groq-openai-gpt-oss-120b/launch-timeline.baseline.svg) | ![mosaic](models/groq-openai-gpt-oss-120b/launch-timeline.mosaic.svg) |
| groq:openai/gpt-oss-20b | ![baseline](models/groq-openai-gpt-oss-20b/launch-timeline.baseline.svg) | ![mosaic](models/groq-openai-gpt-oss-20b/launch-timeline.mosaic.svg) |
| groq:qwen/qwen3.8-27b | ![baseline](models/groq-qwen-qwen3.8-27b/launch-timeline.baseline.svg) | ![mosaic](models/groq-qwen-qwen3.8-27b/launch-timeline.mosaic.svg) |
| nvidia:mistralai/mistral-large-4-1t-a52b | ![baseline](models/nvidia-mistralai-mistral-large-4-1t-a52b/launch-timeline.baseline.svg) | ![mosaic](models/nvidia-mistralai-mistral-large-4-1t-a52b/launch-timeline.mosaic.svg) |
| nvidia:nvidia/nemotron-3-ultra-550b-a55b | ![baseline](models/nvidia-nvidia-nemotron-3-ultra-550b-a55b/launch-timeline.baseline.svg) | ![mosaic](models/nvidia-nvidia-nemotron-3-ultra-550b-a55b/launch-timeline.mosaic.svg) |
| openrouter:baidu/ernie-5.5-flash-preview:free | ![baseline](models/openrouter-baidu-ernie-5.5-flash-preview-free/launch-timeline.baseline.svg) | ![mosaic](models/openrouter-baidu-ernie-5.5-flash-preview-free/launch-timeline.mosaic.svg) |

### Draw a house with a door, two windows and a chimney.

| Model | First version (raw coordinates) | Mosaic today (intents, layout engine, sketch parts) |
| --- | --- | --- |
| antigravity:gemini-3.8-flash-medium (Antigravity) | ![baseline](models/antigravity-gemini-3.8-flash-medium/house.baseline.svg) | ![mosaic](models/antigravity-gemini-3.8-flash-medium/house.mosaic.svg) |
| claude:haiku | ![baseline](models/claude-haiku/house.baseline.svg) | ![mosaic](models/claude-haiku/house.mosaic.svg) |
| claude:opus | ![baseline](models/claude-opus/house.baseline.svg) | ![mosaic](models/claude-opus/house.mosaic.svg) |
| claude:sonnet | ![baseline](models/claude-sonnet/house.baseline.svg) | ![mosaic](models/claude-sonnet/house.mosaic.svg) |
| gemini:gemini-3.5-flash-lite | ![baseline](models/gemini-gemini-3.5-flash-lite/house.baseline.svg) | ![mosaic](models/gemini-gemini-3.5-flash-lite/house.mosaic.svg) |
| groq:openai/gpt-oss-120b | ![baseline](models/groq-openai-gpt-oss-120b/house.baseline.svg) | ![mosaic](models/groq-openai-gpt-oss-120b/house.mosaic.svg) |
| groq:openai/gpt-oss-20b | _error_ | ![mosaic](models/groq-openai-gpt-oss-20b/house.mosaic.svg) |
| groq:qwen/qwen3.8-27b | ![baseline](models/groq-qwen-qwen3.8-27b/house.baseline.svg) | ![mosaic](models/groq-qwen-qwen3.8-27b/house.mosaic.svg) |
| nvidia:mistralai/mistral-large-4-1t-a52b | ![baseline](models/nvidia-mistralai-mistral-large-4-1t-a52b/house.baseline.svg) | ![mosaic](models/nvidia-mistralai-mistral-large-4-1t-a52b/house.mosaic.svg) |
| nvidia:nvidia/nemotron-3-ultra-550b-a55b | ![baseline](models/nvidia-nvidia-nemotron-3-ultra-550b-a55b/house.baseline.svg) | ![mosaic](models/nvidia-nvidia-nemotron-3-ultra-550b-a55b/house.mosaic.svg) |
| openrouter:baidu/ernie-5.5-flash-preview:free | ![baseline](models/openrouter-baidu-ernie-5.5-flash-preview-free/house.baseline.svg) | ![mosaic](models/openrouter-baidu-ernie-5.5-flash-preview-free/house.mosaic.svg) |

### Draw a cat sitting down.

| Model | First version (raw coordinates) | Mosaic today (intents, layout engine, sketch parts) |
| --- | --- | --- |
| antigravity:gemini-3.8-flash-medium (Antigravity) | ![baseline](models/antigravity-gemini-3.8-flash-medium/cat.baseline.svg) | ![mosaic](models/antigravity-gemini-3.8-flash-medium/cat.mosaic.svg) |
| claude:haiku | ![baseline](models/claude-haiku/cat.baseline.svg) | ![mosaic](models/claude-haiku/cat.mosaic.svg) |
| claude:opus | ![baseline](models/claude-opus/cat.baseline.svg) | ![mosaic](models/claude-opus/cat.mosaic.svg) |
| claude:sonnet | ![baseline](models/claude-sonnet/cat.baseline.svg) | ![mosaic](models/claude-sonnet/cat.mosaic.svg) |
| gemini:gemini-3.5-flash-lite | ![baseline](models/gemini-gemini-3.5-flash-lite/cat.baseline.svg) | ![mosaic](models/gemini-gemini-3.5-flash-lite/cat.mosaic.svg) |
| groq:openai/gpt-oss-120b | ![baseline](models/groq-openai-gpt-oss-120b/cat.baseline.svg) | ![mosaic](models/groq-openai-gpt-oss-120b/cat.mosaic.svg) |
| groq:openai/gpt-oss-20b | ![baseline](models/groq-openai-gpt-oss-20b/cat.baseline.svg) | ![mosaic](models/groq-openai-gpt-oss-20b/cat.mosaic.svg) |
| groq:qwen/qwen3.8-27b | _error_ | ![mosaic](models/groq-qwen-qwen3.8-27b/cat.mosaic.svg) |
| nvidia:mistralai/mistral-large-4-1t-a52b | ![baseline](models/nvidia-mistralai-mistral-large-4-1t-a52b/cat.baseline.svg) | ![mosaic](models/nvidia-mistralai-mistral-large-4-1t-a52b/cat.mosaic.svg) |
| nvidia:nvidia/nemotron-3-ultra-550b-a55b | ![baseline](models/nvidia-nvidia-nemotron-3-ultra-550b-a55b/cat.baseline.svg) | ![mosaic](models/nvidia-nvidia-nemotron-3-ultra-550b-a55b/cat.mosaic.svg) |
| openrouter:baidu/ernie-5.5-flash-preview:free | ![baseline](models/openrouter-baidu-ernie-5.5-flash-preview-free/cat.baseline.svg) | ![mosaic](models/openrouter-baidu-ernie-5.5-flash-preview-free/cat.mosaic.svg) |

### Draw a bicycle.

| Model | First version (raw coordinates) | Mosaic today (intents, layout engine, sketch parts) |
| --- | --- | --- |
| antigravity:gemini-3.8-flash-medium (Antigravity) | ![baseline](models/antigravity-gemini-3.8-flash-medium/bicycle.baseline.svg) | ![mosaic](models/antigravity-gemini-3.8-flash-medium/bicycle.mosaic.svg) |
| claude:haiku | ![baseline](models/claude-haiku/bicycle.baseline.svg) | ![mosaic](models/claude-haiku/bicycle.mosaic.svg) |
| claude:opus | ![baseline](models/claude-opus/bicycle.baseline.svg) | ![mosaic](models/claude-opus/bicycle.mosaic.svg) |
| claude:sonnet | ![baseline](models/claude-sonnet/bicycle.baseline.svg) | ![mosaic](models/claude-sonnet/bicycle.mosaic.svg) |
| gemini:gemini-3.5-flash-lite | ![baseline](models/gemini-gemini-3.5-flash-lite/bicycle.baseline.svg) | ![mosaic](models/gemini-gemini-3.5-flash-lite/bicycle.mosaic.svg) |
| groq:openai/gpt-oss-120b | ![baseline](models/groq-openai-gpt-oss-120b/bicycle.baseline.svg) | ![mosaic](models/groq-openai-gpt-oss-120b/bicycle.mosaic.svg) |
| groq:openai/gpt-oss-20b | ![baseline](models/groq-openai-gpt-oss-20b/bicycle.baseline.svg) | ![mosaic](models/groq-openai-gpt-oss-20b/bicycle.mosaic.svg) |
| groq:qwen/qwen3.8-27b | ![baseline](models/groq-qwen-qwen3.8-27b/bicycle.baseline.svg) | ![mosaic](models/groq-qwen-qwen3.8-27b/bicycle.mosaic.svg) |
| nvidia:mistralai/mistral-large-4-1t-a52b | ![baseline](models/nvidia-mistralai-mistral-large-4-1t-a52b/bicycle.baseline.svg) | ![mosaic](models/nvidia-mistralai-mistral-large-4-1t-a52b/bicycle.mosaic.svg) |
| nvidia:nvidia/nemotron-3-ultra-550b-a55b | ![baseline](models/nvidia-nvidia-nemotron-3-ultra-550b-a55b/bicycle.baseline.svg) | _invalid_ |
| openrouter:baidu/ernie-5.5-flash-preview:free | ![baseline](models/openrouter-baidu-ernie-5.5-flash-preview-free/bicycle.baseline.svg) | ![mosaic](models/openrouter-baidu-ernie-5.5-flash-preview-free/bicycle.mosaic.svg) |

### Draw a rocket lifting off.

| Model | First version (raw coordinates) | Mosaic today (intents, layout engine, sketch parts) |
| --- | --- | --- |
| antigravity:gemini-3.8-flash-medium (Antigravity) | ![baseline](models/antigravity-gemini-3.8-flash-medium/rocket.baseline.svg) | ![mosaic](models/antigravity-gemini-3.8-flash-medium/rocket.mosaic.svg) |
| claude:haiku | ![baseline](models/claude-haiku/rocket.baseline.svg) | ![mosaic](models/claude-haiku/rocket.mosaic.svg) |
| claude:opus | ![baseline](models/claude-opus/rocket.baseline.svg) | ![mosaic](models/claude-opus/rocket.mosaic.svg) |
| claude:sonnet | ![baseline](models/claude-sonnet/rocket.baseline.svg) | ![mosaic](models/claude-sonnet/rocket.mosaic.svg) |
| gemini:gemini-3.5-flash-lite | ![baseline](models/gemini-gemini-3.5-flash-lite/rocket.baseline.svg) | ![mosaic](models/gemini-gemini-3.5-flash-lite/rocket.mosaic.svg) |
| groq:openai/gpt-oss-120b | ![baseline](models/groq-openai-gpt-oss-120b/rocket.baseline.svg) | ![mosaic](models/groq-openai-gpt-oss-120b/rocket.mosaic.svg) |
| groq:openai/gpt-oss-20b | ![baseline](models/groq-openai-gpt-oss-20b/rocket.baseline.svg) | ![mosaic](models/groq-openai-gpt-oss-20b/rocket.mosaic.svg) |
| groq:qwen/qwen3.8-27b | ![baseline](models/groq-qwen-qwen3.8-27b/rocket.baseline.svg) | ![mosaic](models/groq-qwen-qwen3.8-27b/rocket.mosaic.svg) |
| nvidia:mistralai/mistral-large-4-1t-a52b | ![baseline](models/nvidia-mistralai-mistral-large-4-1t-a52b/rocket.baseline.svg) | ![mosaic](models/nvidia-mistralai-mistral-large-4-1t-a52b/rocket.mosaic.svg) |
| nvidia:nvidia/nemotron-3-ultra-550b-a55b | ![baseline](models/nvidia-nvidia-nemotron-3-ultra-550b-a55b/rocket.baseline.svg) | ![mosaic](models/nvidia-nvidia-nemotron-3-ultra-550b-a55b/rocket.mosaic.svg) |
| openrouter:baidu/ernie-5.5-flash-preview:free | ![baseline](models/openrouter-baidu-ernie-5.5-flash-preview-free/rocket.baseline.svg) | ![mosaic](models/openrouter-baidu-ernie-5.5-flash-preview-free/rocket.mosaic.svg) |

### Draw a tree beside a small lake.

| Model | First version (raw coordinates) | Mosaic today (intents, layout engine, sketch parts) |
| --- | --- | --- |
| antigravity:gemini-3.8-flash-medium (Antigravity) | ![baseline](models/antigravity-gemini-3.8-flash-medium/tree-and-lake.baseline.svg) | ![mosaic](models/antigravity-gemini-3.8-flash-medium/tree-and-lake.mosaic.svg) |
| claude:haiku | ![baseline](models/claude-haiku/tree-and-lake.baseline.svg) | ![mosaic](models/claude-haiku/tree-and-lake.mosaic.svg) |
| claude:opus | ![baseline](models/claude-opus/tree-and-lake.baseline.svg) | ![mosaic](models/claude-opus/tree-and-lake.mosaic.svg) |
| claude:sonnet | ![baseline](models/claude-sonnet/tree-and-lake.baseline.svg) | ![mosaic](models/claude-sonnet/tree-and-lake.mosaic.svg) |
| gemini:gemini-3.5-flash-lite | ![baseline](models/gemini-gemini-3.5-flash-lite/tree-and-lake.baseline.svg) | ![mosaic](models/gemini-gemini-3.5-flash-lite/tree-and-lake.mosaic.svg) |
| groq:openai/gpt-oss-120b | ![baseline](models/groq-openai-gpt-oss-120b/tree-and-lake.baseline.svg) | ![mosaic](models/groq-openai-gpt-oss-120b/tree-and-lake.mosaic.svg) |
| groq:openai/gpt-oss-20b | ![baseline](models/groq-openai-gpt-oss-20b/tree-and-lake.baseline.svg) | ![mosaic](models/groq-openai-gpt-oss-20b/tree-and-lake.mosaic.svg) |
| groq:qwen/qwen3.8-27b | ![baseline](models/groq-qwen-qwen3.8-27b/tree-and-lake.baseline.svg) | ![mosaic](models/groq-qwen-qwen3.8-27b/tree-and-lake.mosaic.svg) |
| nvidia:mistralai/mistral-large-4-1t-a52b | ![baseline](models/nvidia-mistralai-mistral-large-4-1t-a52b/tree-and-lake.baseline.svg) | ![mosaic](models/nvidia-mistralai-mistral-large-4-1t-a52b/tree-and-lake.mosaic.svg) |
| nvidia:nvidia/nemotron-3-ultra-550b-a55b | ![baseline](models/nvidia-nvidia-nemotron-3-ultra-550b-a55b/tree-and-lake.baseline.svg) | ![mosaic](models/nvidia-nvidia-nemotron-3-ultra-550b-a55b/tree-and-lake.mosaic.svg) |
| openrouter:baidu/ernie-5.5-flash-preview:free | ![baseline](models/openrouter-baidu-ernie-5.5-flash-preview-free/tree-and-lake.baseline.svg) | ![mosaic](models/openrouter-baidu-ernie-5.5-flash-preview-free/tree-and-lake.mosaic.svg) |

