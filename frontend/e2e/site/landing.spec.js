import { expect, test } from "@playwright/test";

const LAPTOP = { width: 1366, height: 768 };

const waitForPreloader = async (page) => {
    await page.goto("/");
    await page.waitForSelector("[class*='Preloader_']", { state: "detached", timeout: 60_000 });
};

const readDock = (page) =>
    page.evaluate(() => {
        const body = document.querySelector("[data-launch-dock-body]").getBoundingClientRect();
        const hero = document.querySelector('[class*="Landing_hero"]').getBoundingClientRect();
        const icon = document.querySelector("[data-launch-icon]").getBoundingClientRect();
        return { top: body.top, bottom: body.bottom, heroBottom: hero.bottom, iconLift: body.top + 6 - icon.top };
    });

test.describe("the board window", () => {
    test("stays behind the hero before its scroll animation is set up", async ({ page }) => {
        await page.setViewportSize({ width: 1536, height: 700 });
        await page.goto("/", { waitUntil: "domcontentloaded" });
        const stack = await page.waitForFunction(() => {
            const win = document.querySelector("[data-window]");
            if (!win) return null;
            const bounds = win.getBoundingClientRect();
            const atWindowTop = document.elementsFromPoint(bounds.left + bounds.width / 2, bounds.top + 10);
            return {
                heroIndex: atWindowTop.findIndex((node) => node.matches('[class*="Landing_hero"]')),
                windowIndex: atWindowTop.findIndex((node) => win.contains(node)),
            };
        });
        const { heroIndex, windowIndex } = await stack.jsonValue();
        expect(heroIndex).toBeGreaterThanOrEqual(0);
        expect(heroIndex).toBeLessThan(windowIndex);
    });

    test("keeps the comment thread on a short laptop screen, with nothing clipped", async ({ page }) => {
        await page.setViewportSize({ width: 1366, height: 600 });
        await page.goto("/");
        await page.waitForSelector('[class*="PreviewSidePanels_assistant"]', { state: "attached" });
        const panels = await page.evaluate(() => {
            const assistant = document.querySelector('[class*="PreviewSidePanels_assistant"]');
            const comments = document.querySelector('[class*="PreviewSidePanels_comments"]');
            return {
                clipped: assistant.scrollHeight - assistant.clientHeight,
                commentsShown: getComputedStyle(comments).display !== "none",
                messagesShown: [...comments.querySelectorAll("p")].filter((message) => getComputedStyle(message).display !== "none").length,
            };
        });
        expect(panels).toEqual({ clipped: 0, commentsShown: true, messagesShown: 1 });
    });

    test.describe("scrolled to", () => {
        test.use({ viewport: LAPTOP });

        const expectFullyOpen = (page) =>
            expect.poll(() => page.locator("[data-window]").evaluate((win) => win.style.clipPath), { timeout: 15_000 }).toBe("none");

        test("opens fully after a fast scroll", async ({ page }) => {
            await waitForPreloader(page);
            for (let step = 0; step < 8; step += 1) {
                await page.mouse.wheel(0, 240);
                await page.waitForTimeout(90);
            }
            await expectFullyOpen(page);
        });

        test("opens fully from the hero's link", async ({ page }) => {
            await waitForPreloader(page);
            await page.getByRole("link", { name: "See it open" }).click();
            await expectFullyOpen(page);
        });
    });
});

test.describe("the dock", () => {
    test.use({ viewport: LAPTOP });

    test.beforeEach(async ({ page }) => {
        await waitForPreloader(page);
        await page.waitForTimeout(1500);
    });

    test("rises whole from below the screen, and its icon only bounces once it has landed", async ({ page }) => {
        await expect.poll(async () => (await readDock(page)).top, { timeout: 30_000 }).toBeGreaterThanOrEqual(LAPTOP.height);

        let restingTop = null;
        for (let step = 0; step < 40; step += 1) {
            await page.mouse.wheel(0, 12);
            await page.waitForTimeout(60);
            const dock = await readDock(page);
            if (dock.top < LAPTOP.height) expect(dock.top).toBeGreaterThanOrEqual(dock.heroBottom);
            if (dock.iconLift > 2) {
                restingTop ??= dock.top;
                expect(dock.bottom).toBeLessThanOrEqual(LAPTOP.height);
                expect(dock.top).toBeLessThanOrEqual(restingTop);
            }
        }
        expect(restingTop).not.toBeNull();
    });

    test("magnifies continuously with the pointer, and settles back when it leaves", async ({ page }) => {
        await page.mouse.wheel(0, 200);
        await page.waitForTimeout(1800);
        const box = await page.locator("[data-launch-dock-body]").boundingBox();
        const scales = () =>
            page.evaluate(() =>
                [...document.querySelectorAll("[data-launch-dock-body] > [data-name]")].map((app) => Number(app.style.getPropertyValue("--app-scale") || 1)),
            );

        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(500);
        const magnified = await scales();
        const peak = Math.max(...magnified);
        expect(peak).toBeGreaterThan(1.4);
        expect(magnified.filter((scale) => scale > 1.05 && scale < peak).length).toBeGreaterThan(0);

        await page.mouse.move(10, 200);
        await page.waitForTimeout(500);
        expect(Math.max(...(await scales()))).toBe(1);
    });
});

test("the one-minute tour drives the landing page and stops when asked", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Or take the one-minute tour" }).click();
    const tour = page.getByRole("region", { name: "One-minute tour" });
    await expect(tour).toContainText("whiteboard for people who build things together");
    await tour.getByRole("button", { name: "Next" }).click();
    await expect(tour).toContainText("One board:");
    await tour.getByRole("button", { name: "End the tour" }).click();
    await expect(tour).toHaveCount(0);
});
