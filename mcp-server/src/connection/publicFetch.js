import { lookup } from "node:dns";
import https from "node:https";
import { BlockList, isIP } from "node:net";

// Fetching a link an agent or a stranger supplied: public hosts only, checked
// at connection time, no redirects, a size cap and a timeout.

const PRIVATE_RANGES = new BlockList();
[
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
].forEach(([address, prefix]) => PRIVATE_RANGES.addSubnet(address, prefix, "ipv4"));
[
    ["::", 128],
    ["::1", 128],
    ["64:ff9b::", 96],
    ["2002::", 16],
    ["fc00::", 7],
    ["fe80::", 10],
    ["ff00::", 8],
].forEach(([address, prefix]) => PRIVATE_RANGES.addSubnet(address, prefix, "ipv6"));

// An IPv4-mapped IPv6 address is judged as the IPv4 address it carries.
const isPrivateAddress = (address, family) => {
    const mapped = String(address).match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (mapped) return PRIVATE_RANGES.check(mapped[1], "ipv4");
    return PRIVATE_RANGES.check(address, family === 6 || family === "IPv6" ? "ipv6" : "ipv4");
};

const NOT_PUBLIC = "Links must point to a public website";

// Resolves for the connection itself, so the address checked is the address
// used; a name that later resolves somewhere private can't slip past.
const publicOnlyLookup = (hostname, options, callback) => {
    lookup(hostname, { ...options, all: true }, (error, addresses) => {
        if (error) return callback(error);
        const allowed = addresses.filter(({ address, family }) => !isPrivateAddress(address, family));
        if (allowed.length === 0 || allowed.length !== addresses.length) return callback(new Error(NOT_PUBLIC));
        return options.all ? callback(null, allowed) : callback(null, allowed[0].address, allowed[0].family);
    });
};

export const downloadPublic = (link, { maxBytes, timeoutMs = 15000, tooBig = "That file is too large", accept } = {}) =>
    new Promise((resolve, reject) => {
        const url = new URL(link);
        if (url.protocol !== "https:") return reject(new Error("Links must use https"));
        // A literal address never goes through the lookup, so it is checked here.
        const host = url.hostname.replace(/^\[|\]$/g, "");
        if (isIP(host) && isPrivateAddress(host, isIP(host))) return reject(new Error(NOT_PUBLIC));
        const request = https.get(link, { lookup: publicOnlyLookup, timeout: timeoutMs, headers: accept ? { Accept: accept } : {} }, (response) => {
            if (response.statusCode !== 200) {
                response.resume();
                return reject(new Error(`That link answered ${response.statusCode}`));
            }
            const chunks = [];
            let size = 0;
            response.on("data", (chunk) => {
                size += chunk.length;
                if (size > maxBytes) {
                    request.destroy();
                    reject(new Error(tooBig));
                } else {
                    chunks.push(chunk);
                }
            });
            response.on("end", () => resolve(Buffer.concat(chunks)));
            response.on("error", reject);
        });
        request.on("timeout", () => request.destroy(new Error("The link took too long to answer")));
        request.on("error", reject);
    });
