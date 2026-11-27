// Tree-sitter ignores imports in comments and strings; patterns cover languages without a
// grammar and files that ran out of time.
import { createRequire } from "module";
import { LANGUAGES, languageOf, stripQuotes } from "./languages.js";

const require = createRequire(import.meta.url);

const MAX_PARSED_BYTES = 256 * 1024;
const PARSE_BUDGET_MS = 14_000;

let treeSitter = null;
const loadedGrammars = new Map();

const loadTreeSitter = async () => {
    if (treeSitter) return treeSitter;
    const module = await import("web-tree-sitter");
    await module.Parser.init();
    treeSitter = module;
    return treeSitter;
};

// Grammars are large, so only the ones a repository needs are loaded.
const grammarFor = async (language) => {
    if (loadedGrammars.has(language.grammar)) return loadedGrammars.get(language.grammar);
    const { Language, Parser, Query } = await loadTreeSitter();
    let entry = null;
    try {
        const grammar = await Language.load(require.resolve(`tree-sitter-wasms/out/tree-sitter-${language.grammar}.wasm`));
        const parser = new Parser();
        parser.setLanguage(grammar);
        entry = { parser, query: new Query(grammar, language.query) };
    } catch {
        // A grammar that won't load or a query it rejects only costs precision.
        entry = null;
    }
    loadedGrammars.set(language.grammar, entry);
    return entry;
};

export const importsByPattern = (languageName, source) => {
    const specifiers = new Set();
    for (const pattern of LANGUAGES[languageName]?.patterns ?? []) {
        for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
    }
    return specifiers;
};

const importsByGrammar = (entry, source) => {
    const tree = entry.parser.parse(source);
    const specifiers = new Set();
    try {
        for (const { name, node } of entry.query.captures(tree.rootNode)) {
            if (name === "import") specifiers.add(stripQuotes(node.text));
            // `mod x;` declares a child file of the same folder.
            else if (name === "module") specifiers.add(`self::${node.text}`);
        }
    } finally {
        tree.delete();
    }
    return specifiers;
};

// Path to its imports, and to whether anything was read at all.
export const parseAllImports = async (sourceEntries, { budgetMs = PARSE_BUDGET_MS, now = Date.now } = {}) => {
    const startedAt = now();
    const importsByFile = new Map();
    for (const [filePath, source] of sourceEntries) {
        const languageName = languageOf(filePath);
        const language = LANGUAGES[languageName];
        if (!language) continue;
        let specifiers = null;
        if (language.grammar && language.query && source.length <= MAX_PARSED_BYTES && now() - startedAt < budgetMs) {
            const entry = await grammarFor(language);
            if (entry) {
                try {
                    specifiers = importsByGrammar(entry, source);
                } catch {
                    specifiers = null;
                }
            }
        }
        // A grammar finding nothing in a file with obvious imports means its query
        // didn't fit this variant of the language.
        if (!specifiers || specifiers.size === 0) specifiers = importsByPattern(languageName, source);
        importsByFile.set(filePath, specifiers);
    }
    return importsByFile;
};
