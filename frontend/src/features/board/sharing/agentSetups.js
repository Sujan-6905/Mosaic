// Copy-paste setup per agent app. Apps that sign in through the browser need
// only the address; the rest take a personal access token from Profile.
export const AGENT_SETUPS = [
    { id: "claude-code", label: "Claude Code", snippet: (url) => `claude mcp add --transport http mosaic ${url}` },
    { id: "claude-desktop", label: "Claude", snippet: (url) => `Settings > Connectors > Add custom connector\nName: Mosaic\nURL: ${url}` },
    { id: "cursor", label: "Cursor", snippet: (url) => JSON.stringify({ mcpServers: { mosaic: { url } } }, null, 2) },
    { id: "vscode", label: "VS Code", snippet: (url) => JSON.stringify({ servers: { mosaic: { type: "http", url } } }, null, 2) },
    { id: "codex", label: "Codex", snippet: (url) => `[mcp_servers.mosaic]\nurl = "${url}"\nbearer_token_env_var = "MOSAIC_TOKEN"` },
];
