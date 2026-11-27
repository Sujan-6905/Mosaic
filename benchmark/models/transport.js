import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { estimateRequestTokens } from "./allowance.js";
import { requireFromMcpServer } from "../packageResolution.js";

// Node's fetch gives up on a response after five minutes, and a slow free endpoint can take longer than that
// to start answering; the assistant's own deadline still applies.
const { Agent } = requireFromMcpServer("undici");
const patientAgent = new Agent({ headersTimeout: 0, bodyTimeout: 0 });

const PIPELINE_HOST = "https://api.groq.com/";
const MAX_RATE_LIMIT_RETRIES = 5;
const DEFAULT_RETRY_MS = 60_000;
const CLI_TIMEOUT_MS = 240_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const jsonResponse = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Providers without strict schemas still get JSON mode, with the schema spelled out where the model can read it.
const withoutStrictSchema = (request) => {
    if (request.response_format?.type !== "json_schema") return request;
    const schema = JSON.stringify(request.response_format.json_schema.schema);
    return {
        ...request,
        response_format: { type: "json_object" },
        messages: [...request.messages, { role: "system", content: `Reply with one JSON object that matches this JSON Schema:\n${schema}` }],
    };
};

const withOneSystemMessage = (request) => {
    const system = request.messages.filter((message) => message.role === "system");
    if (system.length < 2) return request;
    const rest = request.messages.filter((message) => message.role !== "system");
    return { ...request, messages: [{ role: "system", content: system.map((message) => message.content).join("\n\n") }, ...rest] };
};

// The CLI counts prompt tokens served from its cache apart from the rest; all of them were read.
const promptTokensOf = (usage = {}) => (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);

const transcriptOf = (messages) =>
    messages
        .filter((message) => message.role !== "system")
        .map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`)
        .join("\n\n");

const systemOf = (messages) =>
    messages
        .filter((message) => message.role === "system")
        .map((message) => message.content)
        .join("\n\n");

const schemaOf = (request) => (request.response_format?.type === "json_schema" ? request.response_format.json_schema.schema : null);

const parsedOrNull = (text) => {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
};

// A subscription CLI answering as a chat-completions endpoint would: `read` turns its JSON output into
// the reply's content and token counts, or null when the CLI reports a failure.
const cliCompletion = ({ command, args, stdin = "", cwd, request, read }) =>
    new Promise((resolve) => {
        const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"], ...(cwd ? { cwd } : {}) });
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => child.kill("SIGTERM"), CLI_TIMEOUT_MS);
        child.stdout.on("data", (chunk) => (stdout += chunk));
        child.stderr.on("data", (chunk) => (stderr += chunk));
        child.on("close", (code) => {
            clearTimeout(timer);
            const parsed = parsedOrNull(stdout);
            const answer = code === 0 && parsed ? read(parsed) : null;
            if (!answer) {
                const said = `${stderr} ${parsed?.result ?? parsed?.response ?? ""}`;
                const limited = /limit|quota|overloaded|exhausted/i.test(said);
                resolve(jsonResponse(limited ? 429 : 503, { error: { code: limited ? "rate_limited" : "cli_failed", message: said.trim().slice(0, 300) } }));
                return;
            }
            resolve(
                jsonResponse(200, {
                    model: request.model,
                    choices: [{ message: { role: "assistant", content: answer.content }, finish_reason: "stop" }],
                    usage: { prompt_tokens: answer.promptTokens, completion_tokens: answer.completionTokens },
                }),
            );
        });
        child.stdin.end(stdin);
    });

// The Claude Code CLI on the person's own subscription, with the assistant's system prompt in place of its own.
const claudeCliCompletion = (request) => {
    const schema = schemaOf(request);
    const system = systemOf(request.messages);
    return cliCompletion({
        command: "claude",
        args: [
            "-p",
            "--model",
            request.model,
            "--output-format",
            "json",
            "--system-prompt",
            schema ? system : `${system}\n\nReply with JSON only.`,
            "--tools",
            "",
            "--no-session-persistence",
            "--strict-mcp-config",
            "--disable-slash-commands",
            "--setting-sources",
            "",
            ...(schema ? ["--json-schema", JSON.stringify(schema)] : []),
        ],
        stdin: transcriptOf(request.messages),
        request,
        read: (output) =>
            output.is_error
                ? null
                : {
                      content: output.structured_output ? JSON.stringify(output.structured_output) : output.result,
                      promptTokens: promptTokensOf(output.usage),
                      completionTokens: output.usage?.output_tokens ?? 0,
                  },
    });
};

// Google's Antigravity CLI on a Gemini subscription. It has no way to replace its own agent instructions,
// so the assistant's system prompt leads the prompt, and it runs in an empty folder with nothing to act on.
let antigravityFolder = null;
const antigravityCliCompletion = (request) => {
    antigravityFolder ??= mkdtempSync(join(tmpdir(), "mosaic-antigravity-"));
    const schema = schemaOf(request);
    const prompt = `${systemOf(request.messages)}${schema ? "" : "\n\nReply with JSON only."}\n\n${transcriptOf(request.messages)}`;
    return cliCompletion({
        command: "agy",
        args: [
            "--model",
            request.model,
            "--output-format",
            "json",
            "--disable-slash-commands",
            ...(schema ? ["--json-schema", JSON.stringify(schema)] : []),
            `--print=${prompt}`,
        ],
        cwd: antigravityFolder,
        request,
        read: (output) =>
            output.status !== "SUCCESS"
                ? null
                : {
                      content: output.structured_output ? JSON.stringify(output.structured_output) : output.response,
                      promptTokens: output.usage?.input_tokens ?? 0,
                      completionTokens: output.usage?.output_tokens ?? 0,
                  },
    });
};

const CLI_COMPLETIONS = { "claude-cli": claudeCliCompletion, "antigravity-cli": antigravityCliCompletion };

const retryAfterMs = (response) => {
    const seconds = Number(response.headers.get("retry-after"));
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DEFAULT_RETRY_MS;
};

// Routes the assistant's model calls to the model under test, inside its free allowance. A rate limit is
// waited out here, so the pipeline only ever sees an answer or a real failure.
export const installTransport = ({ provider, model, allowance, apiKey, usage }) => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
        if (!String(url).startsWith(PIPELINE_HOST)) return realFetch(url, init);
        const asked = { ...JSON.parse(init.body), model };
        const schemaReady = provider.jsonSchema === false ? withoutStrictSchema(asked) : asked;
        const request = provider.singleSystemMessage ? withOneSystemMessage(schemaReady) : schemaReady;
        for (let attempt = 0; ; attempt += 1) {
            const settle = await allowance.take(estimateRequestTokens(request)).catch((error) => {
                usage.allowanceUsed = error.message;
                throw error;
            });
            const startedAt = Date.now();
            const response = CLI_COMPLETIONS[provider.transport]
                ? await CLI_COMPLETIONS[provider.transport](request)
                : await realFetch(provider.url, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                      body: JSON.stringify(request),
                      signal: init.signal,
                      dispatcher: patientAgent,
                  });
            if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
                settle(estimateRequestTokens(request));
                usage.rateLimitWaits += 1;
                await sleep(retryAfterMs(response));
                continue;
            }
            const body = await response
                .clone()
                .json()
                .catch(() => null);
            const tokens = (body?.usage?.prompt_tokens ?? 0) + (body?.usage?.completion_tokens ?? 0);
            settle(tokens || estimateRequestTokens(request));
            usage.calls += 1;
            usage.inputTokens += body?.usage?.prompt_tokens ?? 0;
            usage.outputTokens += body?.usage?.completion_tokens ?? 0;
            usage.modelMs += Date.now() - startedAt;
            return response;
        }
    };
    return () => {
        globalThis.fetch = realFetch;
    };
};
