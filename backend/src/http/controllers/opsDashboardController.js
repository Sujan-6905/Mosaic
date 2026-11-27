import { getRecentAiTraces } from "../../ai/model/turnTrace.js";

const PAGE = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Mosaic operations</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; background: #0b0d12; color: #e6e8ec; font: 14px/1.5 -apple-system, system-ui, sans-serif; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #8b93a1; margin: 0 0 24px; font-size: 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .card { background: #12151c; border: 1px solid #232733; border-radius: 8px; padding: 14px 16px; }
  .card .label { color: #8b93a1; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
  .card .value { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .card .value.bad { color: #f87171; }
  .card .value.ok { color: #4ade80; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #232733; }
  th { color: #8b93a1; font-weight: 500; font-size: 11px; text-transform: uppercase; }
  .status-ok { color: #4ade80; } .status-bad { color: #f87171; }
  #err { color: #f87171; }
</style>
</head>
<body>
  <h1>Mosaic operations</h1>
  <p class="sub">Refreshes every 5s. Client-side only: reads /healthz and the gated metrics.</p>
  <p id="err"></p>
  <div class="grid" id="cards"></div>
  <table>
    <thead><tr><th>Room</th><th>Occupancy</th><th>Ops/sec</th><th>Presence events/sec</th></tr></thead>
    <tbody id="rooms"></tbody>
  </table>
  <table>
    <thead><tr><th>AI turn</th><th>Outcome</th><th>Duration</th><th>Tokens in / out</th><th>Spans</th></tr></thead>
    <tbody id="aiTraces"></tbody>
  </table>
<script>
  const card = (label, value, cls) =>
    '<div class="card"><div class="label">' + label + '</div><div class="value' + (cls ? ' ' + cls : '') + '">' + value + '</div></div>';

  const fmtBytes = (n) => n == null ? 'n/a' : (n / 1024 / 1024).toFixed(1) + ' MB';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function refresh() {
    try {
      const [metrics, health] = await Promise.all([
        fetch('/admin/dashboard/metrics' + location.search).then((r) => r.json()),
        fetch('/healthz').then((r) => r.json()),
      ]);
      document.getElementById('err').textContent = '';

      const cards = [
        card('Sockets', metrics.sockets),
        card('Active rooms', metrics.rooms),
        card('Room occupancy', metrics.roomOccupancy),
        card('Ops/sec', metrics.opsPerSec),
        card('Errors', metrics.errors, metrics.errors > 0 ? 'bad' : 'ok'),
        card('Client errors', metrics.clientErrors, metrics.clientErrors > 0 ? 'bad' : 'ok'),
        card('Save failures', metrics.saveFailures, metrics.saveFailures > 0 ? 'bad' : 'ok'),
        card('Save latency p95', metrics.saveLatencyMs.p95 + ' ms'),
        card('AI generations today', metrics.ai.generationsToday),
        card('AI model calls today', metrics.ai.modelCallsToday),
        card('AI tokens (approx) today', metrics.ai.tokensApproxToday),
        card('AI failures today', metrics.ai.failuresToday, metrics.ai.failuresToday > 0 ? 'bad' : 'ok'),
        card('AI turn latency p50 / p95', (metrics.ai.turns.latencyP50Ms ?? 'n/a') + ' / ' + (metrics.ai.turns.latencyP95Ms ?? 'n/a') + ' ms'),
        card('AI tokens in / out', metrics.ai.turns.inputTokens + ' / ' + metrics.ai.turns.outputTokens),
        card('AI turns flagged by guards', metrics.ai.turns.flaggedByGuards),
        card('AI fallback model used', metrics.ai.turns.fallbackModelUsed, metrics.ai.turns.fallbackModelUsed > 0 ? 'bad' : 'ok'),
        card('AI outcomes', esc(JSON.stringify(metrics.ai.turns.byOutcome))),
        card('Resolution: resolved / ambiguous / none', metrics.grounding.resolutionResolvedToday + ' / ' + metrics.grounding.resolutionAmbiguousToday + ' / ' + metrics.grounding.resolutionNoneToday),
        card('Sanitization drops today', metrics.grounding.sanitizationDropsToday),
        card('Lint blocks today', metrics.grounding.lintBlocksToday),
        card('Process RSS', fmtBytes(metrics.resourceUsage.rssBytes)),
        card('Redis memory', fmtBytes(metrics.resourceUsage.redisMemoryBytes)),
        card('Database', health.db.healthy ? 'healthy' : 'DEGRADED', health.db.healthy ? 'ok' : 'bad'),
        card('Redis', health.redis ? (health.redis.healthy ? 'healthy' : 'DEGRADED') : 'not configured', health.redis && !health.redis.healthy ? 'bad' : 'ok'),
      ];
      document.getElementById('cards').innerHTML = cards.join('');

      document.getElementById('rooms').innerHTML = metrics.activeRooms
        .map((r) => '<tr><td>' + esc(r.shareId) + '</td><td>' + r.occupancy + '</td><td>' + r.opsPerSec + '</td><td>' + r.presenceEventsPerSec + '</td></tr>')
        .join('') || '<tr><td colspan="4">No active rooms.</td></tr>';

      const { traces } = await fetch('/admin/dashboard/ai-traces' + location.search).then((r) => r.json());
      document.getElementById('aiTraces').innerHTML = traces.slice(0, 25)
        .map((t) => '<tr><td>' + esc(t.traceId.slice(0, 8)) + '</td><td>' + esc(t.outcome) + (t.errorType ? ' (' + esc(t.errorType) + ')' : '') + '</td><td>' + t.durationMs + ' ms</td><td>' + t.inputTokens + ' / ' + t.outputTokens + '</td><td>' + esc(t.spans.map((s) => s.name).join(' > ')) + '</td></tr>')
        .join('') || '<tr><td colspan="5">No assistant turns yet.</td></tr>';
    } catch (error) {
      document.getElementById('err').textContent = 'Failed to load metrics: ' + error.message;
    }
  }

  refresh();
  setInterval(refresh, 5000);
</script>
</body>
</html>`;

export const showDashboard = (req, res) => res.type("html").send(PAGE);

export const listAiTraces = (req, res) => res.status(200).json({ traces: getRecentAiTraces() });

export const reportMetrics = (collectMetrics) => async (req, res) => res.status(200).json(await collectMetrics());
