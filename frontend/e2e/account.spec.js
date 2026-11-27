import { BACKEND_URL, randomUsername } from "./support/backend.js";
import { expect, openSignedInContext, test } from "./support/fixtures.js";

const STRONG_PASSWORD = "laid-by-hand-in-79!";
const NEW_PASSWORD = "harbor-lights-42";

const openSignInModal = async (page) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^sign in$/i }).click();
};

const signInThroughForm = async (page, username, password) => {
    await page.locator('input[name="username"]').fill(username);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
};

test("a new person signs up, recovers a forgotten password with a code from Profile, and can delete the account", async ({ page, request }) => {
    test.setTimeout(90_000);
    const username = randomUsername("e2e_journey");
    const guardian = page.locator("[data-gilded]");

    await openSignInModal(page);
    await page.getByRole("button", { name: "Create an account" }).click();
    await expect(guardian).toHaveText(/nothing laid yet/i);
    await page.locator('input[name="username"]').fill(username);
    await page.locator('input[name="password"]').fill("tile");
    await expect(guardian).toHaveText(/loose stones/i);
    await page.locator('input[name="password"]').fill(STRONG_PASSWORD);
    await expect(guardian).toHaveText(/cave canem/i);
    await expect(guardian).toHaveAttribute("data-gilded", "true");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Account created")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.goto("/profile");
    await page.getByLabel("Your password").fill(STRONG_PASSWORD);
    await page.getByRole("button", { name: "Make codes" }).click();
    const codes = page.getByRole("list", { name: "Your recovery codes" }).getByRole("listitem");
    await expect(codes).toHaveCount(10, { timeout: 10_000 });
    const [firstCode] = await codes.allTextContents();

    await page.context().clearCookies();
    await openSignInModal(page);
    await signInThroughForm(page, username, "not-the-password-1");
    await expect(guardian).toHaveText(/shaken loose/i, { timeout: 10_000 });

    await page.getByRole("button", { name: "Forgot password?" }).click();
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Recovery code").fill(firstCode);
    await page.getByLabel("New password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByText("Password changed. Sign in with it now.")).toBeVisible();
    await page.locator('input[type="password"]').fill(NEW_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText("Welcome back!")).toBeVisible({ timeout: 15_000 });

    await page.goto("/profile");
    await page.getByRole("button", { name: "Delete my account" }).click();
    const confirm = page.getByRole("dialog", { name: "Delete your account?" });
    await confirm.getByLabel(/to confirm/).fill(username);
    await confirm.getByLabel("Your password").fill(NEW_PASSWORD);
    await confirm.getByRole("button", { name: "Delete everything" }).click();
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible({ timeout: 15_000 });
    const { available } = await (await request.get(`${BACKEND_URL}/api/auth/username-available/${username}`)).json();
    expect(available).toBe(true);
});

test.describe("an expired access token", () => {
    // Refuses the board list `times` times, recording the tokens it was sent and how often next-auth renewed.
    const refuseBoardList = async (page, times) => {
        const seen = { tokens: [], renewals: 0 };
        let refused = 0;
        page.on("request", (sent) => {
            if (sent.method() === "POST" && new URL(sent.url()).pathname === "/api/auth/session") seen.renewals += 1;
        });
        await page.route(`${BACKEND_URL}/api/drawing/get`, async (route) => {
            seen.tokens.push(route.request().headers().authorization);
            if (refused >= times) return route.continue();
            refused += 1;
            return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Token expired" }) });
        });
        return seen;
    };

    test("is renewed and the request retried, without signing out", async ({ signedInPage: page, board }) => {
        const seen = await refuseBoardList(page, 1);
        await page.goto("/");
        await expect(page.getByText(board.title).first()).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText("Session expired")).toHaveCount(0);
        expect(seen.renewals).toBe(1);
        expect(new Set(seen.tokens).size).toBe(2);
    });

    test("refused again right after renewal signs out instead of renewing twice", async ({ browser, account }) => {
        const context = await openSignedInContext(browser, account);
        const page = await context.newPage();
        const seen = await refuseBoardList(page, Infinity);
        await page.goto("/");
        await expect(page.getByText("Session expired")).toBeVisible({ timeout: 15_000 });
        expect(seen.renewals).toBe(1);
        await context.close();
    });
});

test.describe("Profile", () => {
    // Headless Chromium has no push service, so the browser's permission and push manager are stood in for.
    const standInForPush = (page) =>
        page.addInitScript(() => {
            let current = null;
            const subscription = {
                endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${Date.now()}`,
                toJSON() {
                    return {
                        endpoint: this.endpoint,
                        keys: {
                            p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
                            auth: "tBHItJI5svbpez7KI4CCXg",
                        },
                    };
                },
                unsubscribe: async () => {
                    current = null;
                    return true;
                },
            };
            Object.defineProperty(Notification, "permission", { get: () => "granted" });
            Notification.requestPermission = async () => "granted";
            PushManager.prototype.subscribe = async () => (current = subscription);
            PushManager.prototype.getSubscription = async () => current;
        });

    const mentionSettings = (page) => page.getByRole("region", { name: "Mention notifications" });

    test("turns mention notifications on and off for this browser", async ({ signedInPage: page }) => {
        await standInForPush(page);
        await page.goto("/profile");
        const toggle = mentionSettings(page).getByRole("switch", { name: /Notify me in this browser/ });
        await expect(toggle).toHaveAttribute("aria-checked", "false");

        const subscribed = page.waitForResponse((response) => response.url().endsWith("/api/push/subscriptions") && response.request().method() === "POST");
        await toggle.click();
        expect((await subscribed).status()).toBe(201);
        await expect(toggle).toHaveAttribute("aria-checked", "true");
        expect(await page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration("/push-sw.js")))).toBe(true);

        const unsubscribed = page.waitForResponse((response) => response.url().endsWith("/api/push/subscriptions") && response.request().method() === "DELETE");
        await toggle.click();
        expect((await unsubscribed).status()).toBe(204);
        await expect(toggle).toHaveAttribute("aria-checked", "false");
    });

    test("says how to allow notifications where the browser blocks them", async ({ signedInPage: page }) => {
        await page.addInitScript(() => Object.defineProperty(Notification, "permission", { get: () => "denied" }));
        await page.goto("/profile");
        await expect(mentionSettings(page).getByRole("note")).toContainText("blocked");
    });

    // Asking for the board fixture gives the account its first board.
    test("lays the year as a wall with an inlay for each first", async ({ signedInPage: page, board }) => {
        await page.goto("/profile");
        const firsts = page.getByRole("list", { name: "Firsts" });
        await expect(firsts.getByRole("listitem")).toHaveCount(7, { timeout: 15_000 });
        await expect(firsts.getByRole("listitem").filter({ hasText: /^First board\d/ })).not.toContainText("Not yet");
    });
});
