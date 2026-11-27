import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        setupFiles: ["./test/setup.js"],
        exclude: ["node_modules/**"],
        // shared/, mcp-server/ and benchmark/ tests run here too, against the backend's own dependencies.
        include: ["**/*.test.js", "../shared/**/*.test.js", "../mcp-server/src/**/*.test.js", "../benchmark/**/*.test.js"],
    },
});
