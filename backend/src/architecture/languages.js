// Per language: its files, its tree-sitter import query where a grammar exists, and a regex
// fallback. Every regex gap is bounded, since crafted text could make an open one quadratic.

const JS_PATTERNS = [
    /\bimport\s[^'"`;]{0,800}?from\s{0,20}['"]([^'"\n]{1,300})['"]/g,
    /\bexport\s[^'"`;]{0,800}?from\s{0,20}['"]([^'"\n]{1,300})['"]/g,
    /\bimport\s{0,20}['"]([^'"\n]{1,300})['"]/g,
    /\bimport\s{0,20}\(\s{0,20}['"]([^'"\n]{1,300})['"]/g,
    /\brequire\s{0,20}\(\s{0,20}['"]([^'"\n]{1,300})['"]/g,
];

const JS_QUERY = `
    (import_statement source: (string) @import)
    (export_statement source: (string) @import)
    (call_expression function: (identifier) @_fn arguments: (arguments (string) @import) (#eq? @_fn "require"))
    (call_expression function: (import) arguments: (arguments (string) @import))
`;

export const LANGUAGES = {
    javascript: { extensions: [".js", ".jsx", ".mjs", ".cjs"], grammar: "tsx", query: JS_QUERY, patterns: JS_PATTERNS },
    typescript: { extensions: [".ts", ".mts", ".cts"], grammar: "typescript", query: JS_QUERY, patterns: JS_PATTERNS },
    tsx: { extensions: [".tsx"], grammar: "tsx", query: JS_QUERY, patterns: JS_PATTERNS },
    vue: { extensions: [".vue", ".svelte", ".astro"], patterns: JS_PATTERNS },
    python: {
        extensions: [".py", ".pyi"],
        grammar: "python",
        query: "(import_statement name: (dotted_name) @import) (import_statement name: (aliased_import name: (dotted_name) @import)) (import_from_statement module_name: (_) @import)",
        patterns: [/^\s{0,40}from\s{1,10}([.\w]{1,200})\s{1,10}import\b/gm, /^\s{0,40}import\s{1,10}([\w.]{1,200})/gm],
    },
    go: {
        extensions: [".go"],
        grammar: "go",
        query: "(import_spec path: (interpreted_string_literal) @import)",
        patterns: [/^\s{0,40}import\s{1,10}"([^"\n]{1,300})"/gm, /^\s{0,40}(?:[\w.]{1,40}\s{1,10})?"([^"\n]{1,300})"\s{0,10}$/gm],
    },
    java: {
        extensions: [".java"],
        grammar: "java",
        query: "(import_declaration (scoped_identifier) @import)",
        patterns: [/^\s{0,40}import\s{1,10}(?:static\s{1,10})?([\w.]{1,300})(?:\.\*)?\s{0,10};/gm],
    },
    kotlin: {
        extensions: [".kt", ".kts"],
        grammar: "kotlin",
        query: "(import_header (identifier) @import)",
        patterns: [/^\s{0,40}import\s{1,10}([\w.]{1,300})/gm],
    },
    scala: {
        extensions: [".scala", ".sc"],
        grammar: "scala",
        query: "(import_declaration path: (_) @import)",
        patterns: [/^\s{0,40}import\s{1,10}([\w.]{1,300})/gm],
    },
    groovy: { extensions: [".groovy", ".gradle"], patterns: [/^\s{0,40}import\s{1,10}(?:static\s{1,10})?([\w.]{1,300})/gm] },
    csharp: {
        extensions: [".cs"],
        grammar: "c_sharp",
        query: "(using_directive (qualified_name) @import) (using_directive (identifier) @import)",
        patterns: [/^\s{0,40}(?:global\s{1,10})?using\s{1,10}(?:static\s{1,10})?([\w.]{1,300})\s{0,10};/gm],
    },
    fsharp: { extensions: [".fs", ".fsi", ".fsx"], patterns: [/^\s{0,40}open\s{1,10}([\w.]{1,300})/gm] },
    vbnet: { extensions: [".vb"], patterns: [/^\s{0,40}Imports\s{1,10}([\w.]{1,300})/gim] },
    c: {
        extensions: [".c", ".h"],
        grammar: "c",
        query: "(preproc_include path: (_) @import)",
        patterns: [/^\s{0,40}#\s{0,10}include\s{0,10}[<"]([^>"\n]{1,300})[>"]/gm],
    },
    cpp: {
        extensions: [".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx", ".ipp"],
        grammar: "cpp",
        query: "(preproc_include path: (_) @import)",
        patterns: [/^\s{0,40}#\s{0,10}include\s{0,10}[<"]([^>"\n]{1,300})[>"]/gm],
    },
    objc: {
        extensions: [".m", ".mm"],
        grammar: "objc",
        query: "(preproc_include path: (_) @import)",
        patterns: [/^\s{0,40}#\s{0,10}(?:import|include)\s{0,10}[<"]([^>"\n]{1,300})[>"]/gm],
    },
    rust: {
        extensions: [".rs"],
        grammar: "rust",
        query: "(use_declaration argument: (_) @import) (mod_item name: (identifier) @module)",
        patterns: [/^\s{0,40}(?:pub\s{1,10})?use\s{1,10}([\w:]{1,300})/gm, /^\s{0,40}(?:pub\s{1,10})?mod\s{1,10}(\w{1,100})\s{0,10};/gm],
    },
    ruby: {
        extensions: [".rb", ".rake"],
        grammar: "ruby",
        query: '(call method: (identifier) @_fn arguments: (argument_list (string (string_content) @import)) (#match? @_fn "^(require|require_relative|load|autoload)$"))',
        patterns: [/^\s{0,40}require(?:_relative)?\s{0,10}\(?\s{0,10}['"]([^'"\n]{1,300})['"]/gm],
    },
    php: {
        extensions: [".php"],
        grammar: "php",
        query: "(namespace_use_clause (qualified_name) @import) (namespace_use_clause (name) @import)",
        patterns: [/^\s{0,40}use\s{1,10}([\w\\]{1,300})/gm, /\b(?:require|include)(?:_once)?\s{0,10}\(?\s{0,10}['"]([^'"\n]{1,300})['"]/g],
    },
    swift: {
        extensions: [".swift"],
        grammar: "swift",
        query: "(import_declaration (identifier) @import)",
        patterns: [/^\s{0,40}(?:@\w{1,40}\s{1,10})?import\s{1,10}(?:\w{1,20}\s{1,10})?([\w.]{1,200})/gm],
    },
    dart: {
        extensions: [".dart"],
        patterns: [/^\s{0,40}(?:import|export|part)\s{1,10}['"]([^'"\n]{1,300})['"]/gm],
    },
    elixir: {
        extensions: [".ex", ".exs"],
        patterns: [/^\s{0,40}(?:alias|import|use|require)\s{1,10}([A-Z][\w.]{0,200})/gm],
    },
    erlang: { extensions: [".erl", ".hrl"], patterns: [/^-include(?:_lib)?\("([^"\n]{1,300})"\)/gm] },
    lua: {
        extensions: [".lua"],
        grammar: "lua",
        query: '(function_call name: (identifier) @_fn arguments: (arguments (string content: (string_content) @import)) (#eq? @_fn "require"))',
        patterns: [/\brequire\s{0,10}\(?\s{0,10}['"]([^'"\n]{1,300})['"]/g],
    },
    haskell: { extensions: [".hs", ".lhs"], patterns: [/^\s{0,40}import\s{1,10}(?:qualified\s{1,10})?([A-Z][\w.]{0,200})/gm] },
    ocaml: { extensions: [".ml", ".mli"], patterns: [/^\s{0,40}open\s{1,10}([A-Z][\w.]{0,200})/gm] },
    elm: { extensions: [".elm"], patterns: [/^\s{0,40}import\s{1,10}([A-Z][\w.]{0,200})/gm] },
    clojure: { extensions: [".clj", ".cljs", ".cljc"], patterns: [/\(:require\s{0,10}\[([\w.-]{1,200})/g, /\[([\w.-]{1,200})\s{1,10}:as\b/g] },
    perl: { extensions: [".pl", ".pm"], patterns: [/^\s{0,40}(?:use|require)\s{1,10}([A-Z][\w:]{0,200})/gm] },
    r: {
        extensions: [".r", ".R"],
        patterns: [/\bsource\s{0,10}\(\s{0,10}['"]([^'"\n]{1,300})['"]/g, /\b(?:library|require)\s{0,10}\(\s{0,10}['"]?([\w.]{1,100})/g],
    },
    julia: { extensions: [".jl"], patterns: [/\binclude\s{0,10}\(\s{0,10}"([^"\n]{1,300})"/g, /^\s{0,40}(?:using|import)\s{1,10}([\w.]{1,200})/gm] },
    zig: { extensions: [".zig"], grammar: "zig", patterns: [/@import\s{0,10}\(\s{0,10}"([^"\n]{1,300})"/g] },
    nim: { extensions: [".nim"], patterns: [/^\s{0,40}(?:import|include)\s{1,10}([\w/.]{1,200})/gm] },
    crystal: { extensions: [".cr"], patterns: [/^\s{0,40}require\s{1,10}"([^"\n]{1,300})"/gm] },
    solidity: {
        extensions: [".sol"],
        grammar: "solidity",
        query: "(import_directive source: (string) @import)",
        patterns: [/\bimport\s[^'"\n;]{0,200}['"]([^'"\n]{1,300})['"]/g],
    },
    shell: { extensions: [".sh", ".bash", ".zsh"], patterns: [/^\s{0,40}(?:source|\.)\s{1,10}["']?([\w./-]{1,300})/gm] },
    powershell: { extensions: [".ps1", ".psm1"], patterns: [/^\s{0,40}Import-Module\s{1,10}["']?([\w./\\-]{1,300})/gim] },
    terraform: { extensions: [".tf"], patterns: [/\bsource\s{0,10}=\s{0,10}"(\.[^"\n]{1,300})"/g] },
    sql: { extensions: [".sql"], patterns: [] },
};

const LANGUAGE_BY_EXTENSION = new Map(Object.entries(LANGUAGES).flatMap(([name, language]) => language.extensions.map((extension) => [extension, name])));

export const languageOf = (filePath) => {
    const dot = filePath.lastIndexOf(".");
    const slash = filePath.lastIndexOf("/");
    if (dot <= slash) return null;
    return LANGUAGE_BY_EXTENSION.get(filePath.slice(dot)) ?? LANGUAGE_BY_EXTENSION.get(filePath.slice(dot).toLowerCase()) ?? null;
};

export const isKnownSourceFile = (filePath) => languageOf(filePath) !== null;

// Files that describe a project rather than being part of its code: they name its
// packages, its module paths and its deployment.
export const MANIFEST_FILE =
    /(^|\/)(package\.json|tsconfig\.json|jsconfig\.json|go\.mod|Cargo\.toml|pyproject\.toml|setup\.py|requirements[^/]*\.txt|Pipfile|Gemfile|composer\.json|pom\.xml|build\.gradle(\.kts)?|settings\.gradle(\.kts)?|pubspec\.yaml|Package\.swift|mix\.exs|\w+\.csproj|\w+\.sln|(docker-)?compose[^/]*\.ya?ml|Dockerfile[^/]*|vercel\.json|render\.ya?ml|netlify\.toml|fly\.toml|Procfile|serverless\.ya?ml|app\.ya?ml|Chart\.yaml|README(\.\w+)?)$/i;

export const stripQuotes = (text) => text.replace(/^["'`<]|["'`>]$/g, "");
