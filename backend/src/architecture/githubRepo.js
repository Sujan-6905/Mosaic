// Reads a public GitHub repository without running anything from it: fetches a
// tarball through GitHub's API and keeps only text files small enough to scan.
import { createGunzip } from "zlib";
import { Readable } from "stream";
import path from "path";
import { MANIFEST_FILE, isKnownSourceFile } from "./languages.js";

const GITHUB_API = "https://api.github.com";
const ALLOWED_DOWNLOAD_HOSTS = new Set(["api.github.com", "codeload.github.com"]);
const MAX_UNCOMPRESSED_BYTES = 400 * 1024 * 1024;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_FILES = 8000;
const MAX_KEPT_BYTES = 50 * 1024 * 1024;
const MAX_TAR_METADATA_BYTES = 64 * 1024;
const MAX_CONCURRENT_READS = 2;
const REQUEST_TIMEOUT_MS = 30_000;
const isKeptFile = (filePath) => isKnownSourceFile(filePath) || MANIFEST_FILE.test(filePath);

export class RepositoryError extends Error {
    constructor(message, status = 422) {
        super(message);
        this.name = "RepositoryError";
        this.status = status;
    }
}

const NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

// Only ever yields an owner and name that pass this check, which is what stops
// a pasted link from steering the request anywhere else.
export const parseRepositoryUrl = (input) => {
    const text = String(input ?? "")
        .trim()
        .replace(/\.git$/, "")
        .replace(/\/+$/, "");
    const withoutScheme = text.replace(/^https?:\/\//, "").replace(/^www\./, "");
    const match = withoutScheme.match(/^github\.com\/([^/]+)\/([^/]+)(?:\/(tree|pull)\/(.+))?$/);
    if (!match || !NAME_PATTERN.test(match[1]) || !NAME_PATTERN.test(match[2])) {
        throw new RepositoryError("That doesn't look like a public GitHub repository link.");
    }
    return { owner: match[1], repo: match[2], ref: match[3] === "tree" ? match[4] : null, pull: match[3] === "pull" ? match[4].split("/")[0] : null };
};

const githubHeaders = () => ({
    Accept: "application/vnd.github+json",
    "User-Agent": "mosaic-whiteboard",
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
});

const githubJson = async (apiPath) => {
    const response = await fetch(`${GITHUB_API}${apiPath}`, { headers: githubHeaders(), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    // 422 is GitHub's answer for a ref that names no commit.
    if (response.status === 404 || response.status === 422)
        throw new RepositoryError("Couldn't find that on GitHub. It has to be a public repository, and the branch or pull request has to exist.", 404);
    if (response.status === 403 || response.status === 429)
        throw new RepositoryError("GitHub's rate limit for this server has been reached. Try again in a while.", 429);
    if (!response.ok) throw new RepositoryError("GitHub didn't answer properly just now. Try again in a moment.", 502);
    return response.json();
};

const MAX_REF_SEGMENTS = 6;

// Git can't hold both "a" and "a/b" as branches, so the shortest prefix naming a commit is the branch.
const refCandidates = (ref) => {
    const segments = ref.split("/").slice(0, MAX_REF_SEGMENTS);
    return segments.map((_, index) => segments.slice(0, index + 1).join("/"));
};

export const resolveCommit = async ({ owner, repo, ref }) => {
    const candidates = ref ? refCandidates(ref) : [(await githubJson(`/repos/${owner}/${repo}`)).default_branch];
    for (const [index, reference] of candidates.entries()) {
        try {
            const commit = await githubJson(`/repos/${owner}/${repo}/commits/${encodeURIComponent(reference)}`);
            return { ref: reference, sha: commit.sha };
        } catch (error) {
            if (error.status !== 404 || index === candidates.length - 1) throw error;
        }
    }
};

export const resolvePullRequest = async ({ owner, repo, pull }) => {
    if (!/^\d{1,10}$/.test(pull)) throw new RepositoryError("That isn't a pull request number.");
    const details = await githubJson(`/repos/${owner}/${repo}/pulls/${pull}`);
    return { number: Number(pull), title: details.title, baseSha: details.base.sha, headSha: details.head.sha };
};

const readString = (buffer, start, length) => {
    const end = buffer.indexOf(0, start);
    return buffer.toString("utf8", start, end === -1 || end > start + length ? start + length : end);
};

const readOctal = (buffer, start, length) => parseInt(readString(buffer, start, length).trim() || "0", 8);

const paxPathIn = (buffer) => {
    const match = buffer.toString("utf8").match(/\d+ path=([^\n]+)\n/);
    return match ? match[1] : null;
};

const BLOCK = 512;

// Skips unwanted files as they stream past, so memory follows what's kept. GitHub wraps everything
// in one top-level folder, which is dropped from paths.
export const readTarStream = async (stream, wants, onFile) => {
    let pending = Buffer.alloc(0);
    let received = 0;
    let overridePath = null;
    let entry = null; // { kind, name, size, keep, skipRemaining }

    const finishEntry = (body) => {
        if (entry.kind === "pax") overridePath = paxPathIn(body);
        else if (entry.kind === "longName") overridePath = body.toString("utf8").replace(/\0+$/, "");
        else if (entry.keep) onFile(entry.name, body);
        entry = null;
    };

    for await (const chunk of stream) {
        received += chunk.length;
        if (received > MAX_UNCOMPRESSED_BYTES) throw new RepositoryError("That repository is too large to map.", 413);
        pending = pending.length === 0 ? chunk : Buffer.concat([pending, chunk]);

        for (;;) {
            if (entry) {
                const padded = Math.ceil(entry.size / BLOCK) * BLOCK;
                if (entry.keep || entry.kind !== "file") {
                    if (pending.length < padded) break;
                    const body = pending.subarray(0, entry.size);
                    pending = pending.subarray(padded);
                    finishEntry(body);
                } else {
                    const skipped = Math.min(entry.skipRemaining, pending.length);
                    pending = pending.subarray(skipped);
                    entry.skipRemaining -= skipped;
                    if (entry.skipRemaining > 0) break;
                    entry = null;
                }
                continue;
            }

            if (pending.length < BLOCK) break;
            const header = pending.subarray(0, BLOCK);
            pending = pending.subarray(BLOCK);
            if (header[0] === 0) continue;

            const size = readOctal(header, 124, 12);
            const type = String.fromCharCode(header[156]);
            const padded = Math.ceil(size / BLOCK) * BLOCK;
            if ((type === "x" || type === "L") && size <= MAX_TAR_METADATA_BYTES) {
                entry = { kind: type === "x" ? "pax" : "longName", size, skipRemaining: padded };
                continue;
            }

            const prefix = readString(header, 345, 155);
            const fullName = overridePath ?? (prefix ? `${prefix}/${readString(header, 0, 100)}` : readString(header, 0, 100));
            overridePath = null;
            const relative = fullName.split("/").slice(1).join("/");
            const isSafeFile = (type === "0" || type === "\0") && relative && path.posix.normalize(relative) === relative && !relative.startsWith("..");
            entry = { kind: "file", name: relative, size, keep: Boolean(isSafeFile && wants(relative, size)), skipRemaining: padded };
        }
    }
};

let activeReads = 0;

// A read holds up to MAX_KEPT_BYTES, so how many run at once is what bounds the
// memory all of them can take together.
const withReadSlot = async (read) => {
    if (activeReads >= MAX_CONCURRENT_READS) throw new RepositoryError("Other repositories are being read right now. Try again in a moment.", 429);
    activeReads += 1;
    try {
        return await read();
    } finally {
        activeReads -= 1;
    }
};

const downloadRepositoryFiles = async ({ owner, repo, sha }) => {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/tarball/${sha}`, {
        headers: githubHeaders(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS * 2),
    });
    if (!ALLOWED_DOWNLOAD_HOSTS.has(new URL(response.url).hostname)) throw new RepositoryError("GitHub sent the download somewhere unexpected.", 502);
    if (!response.ok) throw new RepositoryError("Couldn't download that repository from GitHub.", 502);

    const files = new Map();
    let keptBytes = 0;
    const wants = (relative, size) => {
        if (files.size >= MAX_FILES || size > MAX_FILE_BYTES || !isKeptFile(relative)) return false;
        if (keptBytes + size > MAX_KEPT_BYTES) throw new RepositoryError("That repository is too large to map.", 413);
        keptBytes += size;
        return true;
    };
    try {
        await readTarStream(Readable.fromWeb(response.body).pipe(createGunzip()), wants, (relative, body) => files.set(relative, body.toString("utf8")));
    } catch (error) {
        if (error instanceof RepositoryError) throw error;
        throw new RepositoryError("The download from GitHub was interrupted or damaged. Try again.", 502);
    }
    return files;
};

export const readRepositoryFiles = (location) => withReadSlot(() => downloadRepositoryFiles(location));
