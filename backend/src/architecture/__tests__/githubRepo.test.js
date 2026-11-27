import { describe, it, expect, vi, afterEach } from "vitest";
import { Readable } from "stream";
import { parseRepositoryUrl, readTarStream, resolveCommit, RepositoryError } from "../githubRepo.js";

const tarHeader = (name, size, type = "0", prefix = "") => {
    const header = Buffer.alloc(512);
    header.write(name, 0, 100);
    header.write(size.toString(8).padStart(11, "0"), 124);
    header.write(type, 156);
    if (prefix) header.write(prefix, 345, 155);
    return header;
};

const paddedBody = (text) => {
    const body = Buffer.from(text);
    return Buffer.concat([body, Buffer.alloc(Math.ceil(body.length / 512) * 512 - body.length)]);
};

const tarOf = (entries) =>
    Buffer.concat([
        ...entries.flatMap(({ name, text = "", type, prefix }) => [tarHeader(name, Buffer.byteLength(text), type, prefix), paddedBody(text)]),
        Buffer.alloc(1024),
    ]);

const collect = async (tar, wants = () => true, chunkSize = 700) => {
    const files = {};
    const chunks = [];
    for (let i = 0; i < tar.length; i += chunkSize) chunks.push(tar.subarray(i, i + chunkSize));
    await readTarStream(Readable.from(chunks), wants, (name, body) => {
        files[name] = body.toString("utf8");
    });
    return files;
};

describe("parseRepositoryUrl", () => {
    it("reads the usual forms of a repository link", () => {
        expect(parseRepositoryUrl("https://github.com/acme/web")).toMatchObject({ owner: "acme", repo: "web", ref: null, pull: null });
        expect(parseRepositoryUrl("github.com/acme/web.git")).toMatchObject({ owner: "acme", repo: "web" });
        expect(parseRepositoryUrl("https://www.github.com/acme/web/")).toMatchObject({ owner: "acme", repo: "web" });
    });

    it("reads a branch and a pull request", () => {
        expect(parseRepositoryUrl("https://github.com/acme/web/tree/feature/x").ref).toBe("feature/x");
        expect(parseRepositoryUrl("https://github.com/acme/web/pull/12/files").pull).toBe("12");
    });

    it.each([
        "https://evil.example/acme/web",
        "https://github.com/acme",
        "github.com/../../etc",
        "https://github.com/acme/we b",
        "https://github.com.evil.example/acme/web",
        "http://localhost:5000/admin",
        "",
    ])("refuses %s", (input) => {
        expect(() => parseRepositoryUrl(input)).toThrow(RepositoryError);
    });
});

describe("readTarStream", () => {
    it("reads files across chunk boundaries and drops the top-level folder", async () => {
        const text = "x".repeat(1500);
        const files = await collect(
            tarOf([
                { name: "acme-web-abc/src/a.js", text },
                { name: "acme-web-abc/b.js", text: "b" },
            ]),
        );
        expect(files).toEqual({ "src/a.js": text, "b.js": "b" });
    });

    it("skips what isn't wanted without keeping it", async () => {
        const files = await collect(
            tarOf([
                { name: "r/big.bin", text: "y".repeat(5000) },
                { name: "r/a.js", text: "keep" },
            ]),
            (name) => name.endsWith(".js"),
        );
        expect(files).toEqual({ "a.js": "keep" });
    });

    it("reads a long path from its extended header", async () => {
        const longPath = `r/${"deep/".repeat(40)}a.js`;
        const pax = `${longPath.length + 9} path=${longPath}\n`;
        const files = await collect(
            tarOf([
                { name: "pax", text: pax, type: "x" },
                { name: "truncated", text: "body" },
            ]),
        );
        expect(files[longPath.slice(2)]).toBe("body");
    });

    it("skips an oversized metadata header rather than holding it", async () => {
        const oversized = "9".repeat(70 * 1024);
        const files = await collect(
            tarOf([
                { name: "pax", text: oversized, type: "x" },
                { name: "r/a.js", text: "kept" },
            ]),
        );
        expect(files).toEqual({ "a.js": "kept" });
    });

    it("joins the ustar prefix to the name", async () => {
        const files = await collect(tarOf([{ name: "a.js", text: "z", prefix: "r/src" }]));
        expect(files["src/a.js"]).toBe("z");
    });

    it("never accepts a path that climbs out or a link", async () => {
        const files = await collect(
            tarOf([
                { name: "r/../../etc/passwd", text: "no" },
                { name: "r/link", text: "", type: "2" },
                { name: "r/ok.js", text: "yes" },
            ]),
        );
        expect(Object.keys(files)).toEqual(["ok.js"]);
    });
});

describe("resolveCommit", () => {
    const githubKnows = (branches) =>
        vi.stubGlobal(
            "fetch",
            vi.fn(async (url) => {
                const reference = decodeURIComponent(url.split("/commits/")[1]);
                return branches[reference]
                    ? { ok: true, status: 200, json: async () => ({ sha: branches[reference] }) }
                    : { ok: false, status: 422, json: async () => ({}) };
            }),
        );

    afterEach(() => vi.unstubAllGlobals());

    it("finds the branch in a link to a folder inside it", async () => {
        githubKnows({ main: "abc123" });
        expect(await resolveCommit({ owner: "pallets", repo: "flask", ref: "main/src/flask" })).toEqual({ ref: "main", sha: "abc123" });
    });

    it("keeps a branch whose name has a slash", async () => {
        githubKnows({ "feature/x": "def456" });
        expect(await resolveCommit({ owner: "acme", repo: "web", ref: "feature/x/src" })).toEqual({ ref: "feature/x", sha: "def456" });
    });

    it("says the branch doesn't exist rather than blaming GitHub", async () => {
        githubKnows({});
        await expect(resolveCommit({ owner: "acme", repo: "web", ref: "nope" })).rejects.toMatchObject({ status: 404 });
    });
});
