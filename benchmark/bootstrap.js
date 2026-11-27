// Imported first: a standalone run has no database, so the backend's fallback warnings are noise.
process.env.LOG_LEVEL ??= "error";

// flags.js reads GROUNDING_DISABLED_LAYERS once at import, so --flags must be applied before it loads.
const flagIndex = process.argv.indexOf("--flags");
if (flagIndex !== -1) {
    process.env.GROUNDING_DISABLED_LAYERS = process.argv[flagIndex + 1] ?? "";
}
