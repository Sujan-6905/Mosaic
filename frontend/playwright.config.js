import { defineConfig, devices } from "@playwright/test";
import { BACKEND_URL, FRONTEND_URL } from "./e2e/support/backend.js";

const portOf = (url) => new URL(url).port;

// A production build on its own ports and build folder, so a run never touches a dev server.
// Needs a live backend database (backend/.env, or the CI secrets).
export default defineConfig({
    testDir: "./e2e",
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: "line",
    use: {
        baseURL: FRONTEND_URL,
        trace: "on-first-retry",
    },
    projects: [
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                // WebGL only drives the landing page's 3D, which has a fallback; software rendering it starves every animation frame.
                launchOptions: { args: ["--disable-3d-apis"] },
            },
        },
    ],
    webServer: [
        {
            command: "node src/index.js",
            cwd: "../backend",
            url: `${BACKEND_URL}/api/config`,
            // Every test signs in from one address, which the production limit of 10 a minute would throttle.
            env: { PORT: portOf(BACKEND_URL), CORS_ORIGINS: FRONTEND_URL, AUTH_RATE_LIMIT_PER_MINUTE: "200" },
            reuseExistingServer: !process.env.CI,
            timeout: 60_000,
        },
        {
            command: `npx next build && npx next start -p ${portOf(FRONTEND_URL)}`,
            url: FRONTEND_URL,
            env: { NEXT_DIST_DIR: ".next-e2e", NEXT_PUBLIC_API_URL: BACKEND_URL, NEXT_PUBLIC_SITE_URL: FRONTEND_URL, NEXTAUTH_URL: FRONTEND_URL },
            reuseExistingServer: !process.env.CI,
            timeout: 600_000,
        },
    ],
});
