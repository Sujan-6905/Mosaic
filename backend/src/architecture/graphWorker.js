// Runs as its own process: parsing untrusted files with WebAssembly grammars can
// fail in ways V8 treats as fatal, and that must never reach the server itself.
import { buildModuleGraph, isModuleSource } from "./moduleGraph.js";
import { parseAllImports } from "./parseImports.js";

process.once("message", async ({ files, options, useGrammars }) => {
    const entries = files instanceof Map ? [...files] : Object.entries(files);
    const importsByFile = useGrammars ? await parseAllImports(entries.filter(([filePath]) => isModuleSource(filePath))) : null;
    process.send(buildModuleGraph(files, { ...options, importsByFile }), () => process.exit(0));
});
