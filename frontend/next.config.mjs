import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Lets a production build run beside `next dev`, which owns .next.
    distDir: process.env.NEXT_DIST_DIR || ".next",
    output: "standalone",
    // Components import ../shared by relative path; tracing from the repo root keeps it in the standalone image.
    outputFileTracingRoot: path.join(__dirname, ".."),
    // Base UI imports `use-sync-external-store/shim` as a bare directory, which Node rejects during server rendering.
    transpilePackages: ["@base-ui/react", "@base-ui/utils"],
    // An assistant edit proxied to the backend through /mcp can run past the default 30 seconds.
    experimental: { proxyTimeout: 120_000 },
    // The dev indicator's full-viewport portal swallows pointer events meant for the board.
    devIndicators: false,
    // Only embed pages may be framed elsewhere, and each sets the sites its owner allowed.
    async headers() {
        return [
            { source: "/((?!embed/).*)", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }] },
            {
                source: "/:path*",
                headers: [
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                ],
            },
        ];
    },
    // Hosted MCP, its OAuth endpoints and oEmbed answer from the frontend's address; the backend serves them.
    async rewrites() {
        const backend = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");
        const proxied = [
            "/mcp",
            "/.well-known/oauth-protected-resource",
            "/.well-known/oauth-protected-resource/mcp",
            "/.well-known/oauth-authorization-server",
            "/oauth/register",
            "/oauth/token",
        ];
        return [...proxied.map((source) => ({ source, destination: `${backend}${source}` })), { source: "/oembed", destination: `${backend}/api/oembed` }];
    },
};

export default nextConfig;
