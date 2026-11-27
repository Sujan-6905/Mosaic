// Folders and key files as boxes, imports as links, plus the services it talks to. Nothing
// from the repository is ever executed.
import { createHash } from "crypto";
import path from "path";
import { describeArchitecture } from "./architectureModel.js";
import { isKnownSourceFile, languageOf } from "./languages.js";
import { readProjectIndex, resolveImport } from "./importResolvers.js";
import { importsByPattern } from "./parseImports.js";
import { serviceForImport, servicesInCompose } from "./serviceSignatures.js";

const IGNORED_SEGMENTS = new Set([
    "node_modules",
    "dist",
    "build",
    "out",
    "coverage",
    "vendor",
    "test",
    "tests",
    "testdata",
    "spec",
    "specs",
    "e2e",
    "fixtures",
    "public",
    "static",
    "docs",
    "dev-docs",
    "benchmarks",
    "benches",
    "fuzz",
    "scripts",
    "target",
    "bin",
    "obj",
    "venv",
    "env",
    "Pods",
    "third_party",
    "migrations",
    "alembic",
    "generated",
    "assets",
    "locales",
    "i18n",
]);
// Only near the top of a repository: deep in a package path, as in Java's
// org/acme/samples/shop, these are just names.
const IGNORED_NEAR_ROOT = new Set(["examples", "example", "example-apps", "demo", "demos", "samples"]);
const NEAR_ROOT_DEPTH = 2;
const TEST_FILE =
    /\.(test|spec|stories)\.[a-z]+$|_test\.\w+$|(^|\/)test_[^/]+$|(^|\/)conftest\.py$|(^|\/)setupTests\.\w+$|Tests?\.(java|kt|cs|scala|swift)$|_spec\.rb$/;
const CONFIG_FILE =
    /(^|\/)[^/]*\.config\.[a-z]+$|(^|\/)(setup\.py|manage\.py|gradlew|next-env\.d\.ts|\.eslintrc\.\w+|build\.gradle(\.kts)?|settings\.gradle(\.kts)?|build\.rs)$/;
const SUPPORT_LANGUAGES = new Set(["shell", "powershell", "sql", "terraform"]);
const TARGET_MODULE_COUNT = 18;
const MAX_MODULES = 24;
const MAX_SAMPLE_FILES = 6;
const MAX_SPLIT_FILES = 5;
const MIN_FILE_NODE_LINKS = 1;
const MAX_SIBLINGS = 5;

export const isModuleSource = (filePath) => {
    if (!isKnownSourceFile(filePath)) return false;
    if (TEST_FILE.test(filePath) || CONFIG_FILE.test(filePath) || filePath.endsWith(".d.ts")) return false;
    return !filePath
        .split("/")
        .some(
            (segment, depth) =>
                IGNORED_SEGMENTS.has(segment) ||
                (depth < NEAR_ROOT_DEPTH && IGNORED_NEAR_ROOT.has(segment)) ||
                segment.startsWith(".") ||
                segment.startsWith("__"),
        );
};

const directoryOf = (filePath) => {
    const directory = path.posix.dirname(filePath);
    return directory === "." ? "" : directory;
};

// Opens the biggest folder repeatedly until there are enough boxes to say something.
export const chooseModuleFolders = (sourcePaths) => {
    const filesUnder = new Map();
    for (const filePath of sourcePaths) {
        const parts = directoryOf(filePath).split("/").filter(Boolean);
        for (let depth = 0; depth <= parts.length; depth += 1) {
            const folder = parts.slice(0, depth).join("/");
            filesUnder.set(folder, (filesUnder.get(folder) ?? 0) + 1);
        }
    }

    const childrenByFolder = new Map();
    for (const candidate of filesUnder.keys()) {
        if (candidate === "") continue;
        const parent = directoryOf(candidate);
        if (!childrenByFolder.has(parent)) childrenByFolder.set(parent, []);
        childrenByFolder.get(parent).push(candidate);
    }
    const childrenOf = (folder) => childrenByFolder.get(folder) ?? [];

    const folders = new Set([""]);
    const opened = new Set();
    for (;;) {
        const expandable = [...folders]
            .filter((folder) => !opened.has(folder) && childrenOf(folder).length > 0)
            .sort((a, b) => filesUnder.get(b) - filesUnder.get(a));
        const next = expandable[0];
        if (next === undefined || folders.size >= TARGET_MODULE_COUNT) break;
        opened.add(next);
        // A folder of many children shows its biggest few, and the rest stay in it.
        const children = childrenOf(next).sort((a, b) => filesUnder.get(b) - filesUnder.get(a));
        const shown = children.slice(0, MAX_SIBLINGS);
        const keepsParent = shown.length < children.length || filesUnder.get(next) > children.reduce((sum, child) => sum + filesUnder.get(child), 0);
        const countAfter = folders.size - (keepsParent ? 0 : 1) + shown.length;
        if (countAfter > MAX_MODULES) continue;
        if (!keepsParent) folders.delete(next);
        shown.forEach((child) => folders.add(child));
    }
    return [...folders];
};

// A file or the nearest chosen folder above it. A chosen entry can itself be a
// single file, for a small folder whose files each do a distinct job.
const moduleOfFile = (filePath, chosen) => {
    if (chosen.has(filePath)) return filePath;
    let folder = directoryOf(filePath);
    for (;;) {
        if (chosen.has(folder)) return folder;
        if (folder === "") return null;
        folder = directoryOf(folder);
    }
};

// A folder with subfolders and a few files of its own: those files become boxes too.
const splitMixedFolders = (folders, sourcePaths, connectedFiles) => {
    const chosen = new Set(folders);
    const direct = new Map();
    for (const filePath of sourcePaths) {
        const folder = directoryOf(filePath);
        if (!chosen.has(folder)) continue;
        if (!direct.has(folder)) direct.set(folder, []);
        direct.get(folder).push(filePath);
    }
    for (const [folder, files] of direct) {
        const hasSubfolders = folders.some((other) => other !== folder && (folder === "" || other.startsWith(`${folder}/`)));
        if (!hasSubfolders || files.length > MAX_SPLIT_FILES) continue;
        const worthABox = files.filter((filePath) => (connectedFiles.get(filePath) ?? 0) >= MIN_FILE_NODE_LINKS);
        if (worthABox.length === 0) continue;
        if (worthABox.length === files.length) chosen.delete(folder);
        if (chosen.size + worthABox.length > MAX_MODULES) continue;
        worthABox.forEach((filePath) => chosen.add(filePath));
    }
    return [...chosen];
};

// Twelve component folders side by side say less than the five that matter plus
// one box for the rest: the quieter siblings fold back into their parent folder.
const limitSiblings = (modules, connectedFiles, sourcePaths) => {
    const chosen = new Set(modules);
    const linksUnder = new Map();
    for (const filePath of sourcePaths) {
        const links = connectedFiles.get(filePath) ?? 0;
        for (const module of modules) {
            if (filePath === module || filePath.startsWith(`${module}/`)) linksUnder.set(module, (linksUnder.get(module) ?? 0) + links);
        }
    }
    const byParent = new Map();
    for (const module of modules) {
        if (module === "" || /\.\w+$/.test(module)) continue;
        const parent = directoryOf(module);
        if (!byParent.has(parent)) byParent.set(parent, []);
        byParent.get(parent).push(module);
    }
    for (const [parent, siblings] of byParent) {
        if (siblings.length <= MAX_SIBLINGS + 1) continue;
        const ranked = [...siblings].sort((a, b) => (linksUnder.get(b) ?? 0) - (linksUnder.get(a) ?? 0));
        ranked.slice(MAX_SIBLINGS).forEach((module) => chosen.delete(module));
        chosen.add(parent);
    }
    return [...chosen];
};

const moduleLabel = (moduleId) => moduleId || "root";

const serviceNodeId = (service) => `service:${service}`;

// What sits directly inside a folder module, subfolders first, since those say
// more about it than individual file names do.
const partsOfModule = (id, moduleFiles) => {
    const prefix = id === "." ? "" : `${id}/`;
    const folders = new Set();
    const loose = [];
    for (const filePath of moduleFiles) {
        const rest = filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath;
        if (rest.includes("/")) folders.add(rest.split("/")[0]);
        else loose.push(rest.replace(/\.[^.]+$/, ""));
    }
    return [...folders, ...loose].filter((part) => !/^(index|__init__|mod|main|src|lib)$/.test(part)).slice(0, MAX_SAMPLE_FILES);
};

// `folders` fixes the boxes when comparing two commits. Files missing from `importsByFile`
// fall back to patterns.
export const buildModuleGraph = (files, { folders: requestedFolders = null, importsByFile = null } = {}) => {
    const fileEntries = files instanceof Map ? [...files] : Object.entries(files);
    let sourceEntries = fileEntries.filter(([filePath]) => isModuleSource(filePath));
    const hasProgramCode = sourceEntries.some(([filePath]) => !SUPPORT_LANGUAGES.has(languageOf(filePath)));
    if (hasProgramCode) sourceEntries = sourceEntries.filter(([filePath]) => !SUPPORT_LANGUAGES.has(languageOf(filePath)));
    const sourcePaths = sourceEntries.map(([filePath]) => filePath);
    const index = readProjectIndex(fileEntries, sourcePaths);

    const importsOf = (filePath, source) => importsByFile?.get?.(filePath) ?? importsByPattern(languageOf(filePath), source);

    // Which file reaches which, before deciding what the boxes are.
    const resolved = [];
    const connectedFiles = new Map();
    for (const [filePath, source] of sourceEntries) {
        for (const specifier of importsOf(filePath, source)) {
            const target = resolveImport(specifier, filePath, index);
            if (target && target !== filePath) {
                connectedFiles.set(filePath, (connectedFiles.get(filePath) ?? 0) + 1);
                connectedFiles.set(target, (connectedFiles.get(target) ?? 0) + 1);
            }
            resolved.push({ filePath, specifier, target });
        }
    }

    const chosen = new Set(
        requestedFolders ?? limitSiblings(splitMixedFolders(chooseModuleFolders(sourcePaths), sourcePaths, connectedFiles), connectedFiles, sourcePaths),
    );

    const modules = new Map();
    const links = new Map();
    const services = new Map();
    const externalsByModule = new Map();
    const addService = ({ name, kind }) => {
        if (!services.has(name)) services.set(name, { id: serviceNodeId(name), label: name, kind: "service", serviceKind: kind, fileCount: 0 });
    };
    servicesInCompose(fileEntries).forEach(addService);

    const nodeId = (moduleId) => moduleId || ".";
    for (const [filePath, source] of sourceEntries) {
        const moduleId = moduleOfFile(filePath, chosen);
        if (moduleId === null) continue;
        if (!modules.has(moduleId))
            modules.set(moduleId, { id: nodeId(moduleId), label: moduleLabel(moduleId), kind: "module", files: [], hash: createHash("sha1") });
        const module = modules.get(moduleId);
        module.files.push(filePath);
        module.hash.update(filePath).update(source);
        if (/\bfetch\s{0,4}\(/.test(source)) {
            if (!externalsByModule.has(nodeId(moduleId))) externalsByModule.set(nodeId(moduleId), new Set());
            externalsByModule.get(nodeId(moduleId)).add("node-fetch");
        }
    }

    for (const { filePath, specifier, target } of resolved) {
        const moduleId = moduleOfFile(filePath, chosen);
        if (moduleId === null) continue;
        if (target) {
            const targetModule = moduleOfFile(target, chosen);
            if (targetModule !== null && targetModule !== moduleId) {
                const key = `${nodeId(moduleId)}->${nodeId(targetModule)}`;
                links.set(key, { from: nodeId(moduleId), to: nodeId(targetModule), weight: (links.get(key)?.weight ?? 0) + 1 });
            }
            continue;
        }
        if (!externalsByModule.has(nodeId(moduleId))) externalsByModule.set(nodeId(moduleId), new Set());
        externalsByModule.get(nodeId(moduleId)).add(specifier);
        const service = serviceForImport(specifier);
        if (service) {
            addService(service);
            const key = `${nodeId(moduleId)}->${serviceNodeId(service.name)}`;
            links.set(key, { from: nodeId(moduleId), to: serviceNodeId(service.name), weight: (links.get(key)?.weight ?? 0) + 1 });
        }
    }

    const moduleNodes = [...modules.values()].map(({ id, label, kind, files: moduleFiles, hash }) => ({
        id,
        label,
        kind,
        fileCount: moduleFiles.length,
        sampleFiles: moduleFiles.slice(0, MAX_SAMPLE_FILES).map((filePath) => path.posix.basename(filePath)),
        parts: partsOfModule(id, moduleFiles),
        contentHash: hash.digest("hex"),
    }));
    moduleNodes.sort((a, b) => a.id.localeCompare(b.id));

    return describeArchitecture(
        {
            folders: [...chosen],
            nodes: [...moduleNodes, ...[...services.values()].sort((a, b) => a.id.localeCompare(b.id))],
            edges: [...links.values()].sort((a, b) => `${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`)),
        },
        { externalsByModule, filePaths: fileEntries.map(([filePath]) => filePath) },
    );
};

const edgeKey = (edge) => `${edge.from}->${edge.to}`;

// What a change does to the structure. Needs no model: both graphs are facts.
export const diffModuleGraphs = (base, head) => {
    const baseNodes = new Map(base.nodes.map((node) => [node.id, node]));
    const headNodes = new Map(head.nodes.map((node) => [node.id, node]));
    const baseEdges = new Set(base.edges.map(edgeKey));
    const headEdges = new Set(head.edges.map(edgeKey));
    return {
        addedNodes: head.nodes.filter((node) => !baseNodes.has(node.id)),
        removedNodes: base.nodes.filter((node) => !headNodes.has(node.id)),
        changedNodes: head.nodes.filter((node) => baseNodes.has(node.id) && node.contentHash && baseNodes.get(node.id).contentHash !== node.contentHash),
        addedEdges: head.edges.filter((edge) => !baseEdges.has(edgeKey(edge))),
        removedEdges: base.edges.filter((edge) => !headEdges.has(edgeKey(edge))),
    };
};
