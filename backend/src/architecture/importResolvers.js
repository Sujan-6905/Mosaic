// Turns what an import says into a file in this repository, language by language.
// Anything that resolves to nothing is treated as an outside package.
import path from "path";
import { languageOf } from "./languages.js";

const JS_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue", ".svelte"];
const JS_SUFFIXES = ["", ...JS_EXTENSIONS, ...JS_EXTENSIONS.map((extension) => `/index${extension}`)];

const stripJsonComments = (text) =>
    text
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:"])\/\/.*$/gm, "$1")
        .replace(/,(\s*[}\]])/g, "$1");

const parseJsonLoosely = (text) => {
    try {
        return JSON.parse(stripJsonComments(text));
    } catch {
        return null;
    }
};

// What the manifests say about how this repository's packages import each other.
export const readProjectIndex = (fileEntries, sourcePaths) => {
    const sourceFiles = new Set(sourcePaths);
    const index = {
        sourceFiles,
        jsAliases: [],
        jsPackages: [],
        goModules: [],
        rustCrates: [],
        dartPackages: [],
        phpPrefixes: [],
        sourceRoots: new Set([""]),
        bySuffix: new Map(),
        byDirectory: new Map(),
        byDirectorySuffix: new Map(),
    };
    for (const [filePath, text] of fileEntries) {
        const directory = path.posix.dirname(filePath);
        const scope = directory === "." ? "" : directory;
        const name = path.posix.basename(filePath);
        if (name === "tsconfig.json" || name === "jsconfig.json") {
            const options = parseJsonLoosely(text)?.compilerOptions;
            const base = path.posix.join(directory, options?.baseUrl ?? ".");
            for (const [alias, targets] of Object.entries(options?.paths ?? {})) {
                if (targets[0])
                    index.jsAliases.push({ scope: directory, prefix: alias.replace(/\*$/, ""), target: path.posix.join(base, targets[0].replace(/\*$/, "")) });
            }
        } else if (name === "package.json" && filePath !== "package.json") {
            const packageName = parseJsonLoosely(text)?.name;
            if (packageName) index.jsPackages.push({ name: packageName, directory });
        } else if (name === "go.mod") {
            const modulePath = text.match(/^module\s+(\S+)/m)?.[1];
            if (modulePath) index.goModules.push({ path: modulePath, directory: scope });
        } else if (name === "Cargo.toml") {
            const crate = text.match(/^\s*name\s*=\s*"([^"]+)"/m)?.[1];
            if (crate) index.rustCrates.push({ name: crate.replace(/-/g, "_"), directory: scope });
        } else if (name === "pubspec.yaml") {
            const packageName = text.match(/^name:\s*(\S+)/m)?.[1];
            if (packageName) index.dartPackages.push({ name: packageName, directory: scope });
        } else if (name === "composer.json") {
            const autoload = parseJsonLoosely(text)?.autoload?.["psr-4"] ?? {};
            for (const [prefix, target] of Object.entries(autoload)) {
                const folder = Array.isArray(target) ? target[0] : target;
                index.phpPrefixes.push({ prefix: prefix.replace(/\\+$/, ""), directory: path.posix.join(directory, folder ?? "") });
            }
        } else if (name === "pyproject.toml" || name === "setup.py") {
            index.sourceRoots.add(scope);
            index.sourceRoots.add(scope ? `${scope}/src` : "src");
        }
    }
    for (const filePath of sourcePaths) {
        const parts = filePath.split("/");
        // Longest-first lookup from any tail of the path: a package path rarely
        // starts at the repository root.
        for (let start = 0; start < parts.length; start += 1) {
            const suffix = parts.slice(start).join("/");
            if (!index.bySuffix.has(suffix)) index.bySuffix.set(suffix, filePath);
        }
        const directory = path.posix.dirname(filePath);
        for (let current = directory; ; current = path.posix.dirname(current)) {
            if (!index.byDirectory.has(current)) index.byDirectory.set(current, filePath);
            if (current === "." || current === "/") break;
        }
        const directoryParts = directory === "." ? [] : directory.split("/");
        for (let start = 0; start < directoryParts.length; start += 1) {
            const tail = directoryParts.slice(start).join("/");
            if (!index.byDirectorySuffix.has(tail)) index.byDirectorySuffix.set(tail, filePath);
        }
    }
    return index;
};

const firstExisting = (candidates, index) => candidates.find((candidate) => index.sourceFiles.has(candidate)) ?? null;

const anyFileInDirectory = (directory, index) => index.byDirectory.get(directory || ".") ?? null;

const relativeTo = (importer, specifier) => path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier));

const withSuffixes = (candidate, index) => JS_SUFFIXES.map((suffix) => `${candidate}${suffix}`).find((resolved) => index.sourceFiles.has(resolved)) ?? null;

const resolveJs = (specifier, importer, index) => {
    if (specifier.startsWith(".")) return withSuffixes(relativeTo(importer, specifier), index);
    const owner = index.jsPackages.find(({ name }) => specifier === name || specifier.startsWith(`${name}/`));
    if (owner) {
        const rest = specifier.slice(owner.name.length + 1);
        const inside = (root) => (rest ? path.posix.join(root, rest) : `${root}/index`);
        const direct = withSuffixes(inside(owner.directory), index) ?? withSuffixes(inside(`${owner.directory}/src`), index);
        // A package's entry can be named anything, but the import still lands in that package.
        return direct ?? anyFileInDirectory(owner.directory, index);
    }
    for (const { scope, prefix, target } of index.jsAliases) {
        if ((scope === "." || importer.startsWith(`${scope}/`)) && specifier.startsWith(prefix)) {
            const resolved = withSuffixes(path.posix.join(target, specifier.slice(prefix.length)), index);
            if (resolved) return resolved;
        }
    }
    return null;
};

const resolvePython = (specifier, importer, index) => {
    const leadingDots = specifier.match(/^\.+/)?.[0].length ?? 0;
    const dotted = specifier.slice(leadingDots).replace(/\./g, "/");
    const packageFiles = (base) => [`${base}.py`, `${base}.pyi`, `${base}/__init__.py`];
    if (leadingDots > 0) {
        let directory = path.posix.dirname(importer);
        for (let up = 1; up < leadingDots; up += 1) directory = path.posix.dirname(directory);
        const base = dotted ? path.posix.join(directory, dotted) : directory;
        return firstExisting(packageFiles(base === "." ? "" : base), index) ?? anyFileInDirectory(base, index);
    }
    // Beside the importer first, then each source root, then any tail of the
    // repository, since a package can sit a few folders down without a manifest.
    const roots = [path.posix.dirname(importer) === "." ? "" : path.posix.dirname(importer), ...index.sourceRoots];
    for (const root of roots) {
        const base = root ? `${root}/${dotted}` : dotted;
        const found = firstExisting(packageFiles(base), index);
        if (found) return found;
        if (dotted.includes("/")) {
            const parentFound = firstExisting(packageFiles(base.slice(0, base.lastIndexOf("/"))), index);
            if (parentFound) return parentFound;
        }
    }
    return index.bySuffix.get(`${dotted}.py`) ?? index.bySuffix.get(`${dotted}/__init__.py`) ?? null;
};

const resolveGo = (specifier, _importer, index) => {
    const owner = index.goModules
        .filter(({ path: modulePath }) => specifier === modulePath || specifier.startsWith(`${modulePath}/`))
        .sort((a, b) => b.path.length - a.path.length)[0];
    if (!owner) return null;
    const rest = specifier.slice(owner.path.length + 1);
    return anyFileInDirectory(path.posix.join(owner.directory, rest) || ".", index);
};

// com.foo.bar.Baz: the file for that class, or failing that its package's folder.
const resolveDotted = (extensions) => (specifier, _importer, index) => {
    const parts = specifier.replace(/\.\*$/, "").split(".");
    const asPath = parts.join("/");
    for (const extension of extensions) {
        const found = index.bySuffix.get(`${asPath}${extension}`);
        if (found) return found;
    }
    const parent = parts.slice(0, -1).join("/");
    for (const extension of extensions) {
        const found = parent && index.bySuffix.get(`${parent}${extension}`);
        if (found) return found;
    }
    return index.byDirectorySuffix.get(asPath) ?? index.byDirectorySuffix.get(parent) ?? null;
};

const resolveCsharp = (specifier, _importer, index) => {
    const asPath = specifier.replace(/\./g, "/");
    // A namespace's folder usually drops the assembly name at its front, so each
    // shorter tail of the namespace gets a try.
    const parts = asPath.split("/");
    for (let start = 0; start < parts.length; start += 1) {
        const tail = parts.slice(start).join("/");
        const found = index.bySuffix.get(`${tail}.cs`) ?? index.byDirectorySuffix.get(tail);
        if (found) return found;
    }
    return null;
};

const resolveInclude = (specifier, importer, index) =>
    index.sourceFiles.has(relativeTo(importer, specifier)) ? relativeTo(importer, specifier) : (index.bySuffix.get(specifier) ?? null);

const rustCandidates = (base) => [`${base}.rs`, `${base}/mod.rs`];

const resolveRust = (specifier, importer, index) => {
    const parts = specifier.split("::").filter((part) => !part.includes("{") && part !== "*");
    const crate = index.rustCrates
        .filter(({ directory }) => !directory || importer.startsWith(`${directory}/`))
        .sort((a, b) => b.directory.length - a.directory.length)[0];
    const source = crate?.directory ? `${crate.directory}/src` : "src";
    const importerDirectory = path.posix.dirname(importer);
    const moduleFolder = /\/(mod|lib|main)\.rs$/.test(importer) ? importerDirectory : importer.replace(/\.rs$/, "");
    let root;
    let rest;
    if (parts[0] === "crate") [root, rest] = [source, parts.slice(1)];
    else if (parts[0] === "self") [root, rest] = [moduleFolder, parts.slice(1)];
    else if (parts[0] === "super") [root, rest] = [path.posix.dirname(moduleFolder), parts.slice(1)];
    else {
        const other = index.rustCrates.find(({ name }) => name === parts[0]);
        if (!other) return null;
        [root, rest] = [other.directory ? `${other.directory}/src` : "src", parts.slice(1)];
    }
    // The last parts may name items inside a file, so longer paths are tried first.
    for (let length = rest.length; length > 0; length -= 1) {
        const found = firstExisting(rustCandidates(path.posix.join(root, ...rest.slice(0, length))), index);
        if (found) return found;
    }
    return firstExisting([`${root}/lib.rs`, `${root}/main.rs`], index);
};

const resolveRuby = (specifier, importer, index) => {
    const relative = `${relativeTo(importer, specifier)}.rb`;
    if (index.sourceFiles.has(relative)) return relative;
    return index.bySuffix.get(`${specifier}.rb`) ?? null;
};

const resolvePhp = (specifier, importer, index) => {
    if (/\.php$/.test(specifier)) return resolveInclude(specifier, importer, index);
    const asPath = specifier.replace(/\\/g, "/");
    for (const { prefix, directory } of index.phpPrefixes) {
        const prefixPath = prefix.replace(/\\/g, "/");
        if (asPath.startsWith(`${prefixPath}/`)) {
            const candidate = path.posix.join(directory, `${asPath.slice(prefixPath.length + 1)}.php`);
            if (index.sourceFiles.has(candidate)) return candidate;
        }
    }
    const parts = asPath.split("/");
    for (let start = 0; start < parts.length - 1; start += 1) {
        const found = index.bySuffix.get(`${parts.slice(start).join("/")}.php`);
        if (found) return found;
    }
    return null;
};

const resolveSwift = (specifier, _importer, index) => anyFileInDirectory(`Sources/${specifier}`, index);

const resolveDart = (specifier, importer, index) => {
    const packageImport = specifier.match(/^package:([^/]+)\/(.+)$/);
    if (packageImport) {
        const owner = index.dartPackages.find(({ name }) => name === packageImport[1]);
        if (!owner) return null;
        const candidate = path.posix.join(owner.directory, "lib", packageImport[2]);
        return index.sourceFiles.has(candidate) ? candidate : null;
    }
    const candidate = relativeTo(importer, specifier);
    return index.sourceFiles.has(candidate) ? candidate : null;
};

const snakeCase = (word) => word.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

const resolveElixir = (specifier, _importer, index) => {
    const asPath = specifier.split(".").map(snakeCase).join("/");
    return index.bySuffix.get(`${asPath}.ex`) ?? index.bySuffix.get(`${asPath}.exs`) ?? null;
};

const resolveByPath =
    (extension, separator = ".") =>
    (specifier, importer, index) => {
        const asPath = specifier.split(separator).join("/");
        const relative = relativeTo(importer, `${asPath}${extension}`);
        if (index.sourceFiles.has(relative)) return relative;
        return index.bySuffix.get(`${asPath}${extension}`) ?? null;
    };

const resolveRelativeFile = (specifier, importer, index) => {
    const relative = relativeTo(importer, specifier);
    if (index.sourceFiles.has(relative)) return relative;
    return index.bySuffix.get(specifier.replace(/^\.\//, "")) ?? null;
};

const RESOLVERS = {
    javascript: resolveJs,
    typescript: resolveJs,
    tsx: resolveJs,
    vue: resolveJs,
    python: resolvePython,
    go: resolveGo,
    java: resolveDotted([".java", ".kt"]),
    kotlin: resolveDotted([".kt", ".java"]),
    scala: resolveDotted([".scala", ".java"]),
    groovy: resolveDotted([".groovy", ".java"]),
    csharp: resolveCsharp,
    fsharp: resolveDotted([".fs"]),
    vbnet: resolveDotted([".vb"]),
    c: resolveInclude,
    cpp: resolveInclude,
    objc: resolveInclude,
    rust: resolveRust,
    ruby: resolveRuby,
    php: resolvePhp,
    swift: resolveSwift,
    dart: resolveDart,
    elixir: resolveElixir,
    lua: resolveByPath(".lua"),
    haskell: resolveByPath(".hs"),
    elm: resolveByPath(".elm"),
    ocaml: resolveByPath(".ml"),
    perl: resolveByPath(".pm", "::"),
    clojure: resolveByPath(".clj"),
    julia: resolveRelativeFile,
    r: resolveRelativeFile,
    zig: resolveRelativeFile,
    nim: resolveByPath(".nim", "/"),
    crystal: resolveRelativeFile,
    solidity: resolveRelativeFile,
    shell: resolveRelativeFile,
    erlang: resolveInclude,
    terraform: (specifier, importer, index) => anyFileInDirectory(relativeTo(importer, specifier), index),
};

export const resolveImport = (specifier, importer, index) => RESOLVERS[languageOf(importer)]?.(specifier, importer, index) ?? null;
