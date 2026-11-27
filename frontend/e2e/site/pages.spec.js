import { expect, test } from "@playwright/test";

test.describe("How it works", () => {
    test("gives each section with a fixed story exactly one screen", async ({ page }) => {
        await page.goto("/about");
        for (const id of ["decisions", "numbers"]) {
            const box = await page.locator(`#${id}`).boundingBox();
            expect(Math.round(box.height)).toBe(page.viewportSize().height);
        }
    });

    test("runs two screens racing one note through the server until both agree", async ({ page }) => {
        await page.goto("/about#two-rooms");
        await page.getByLabel(/Two screens share one sticky note through a server/).scrollIntoViewIfNeeded();
        // With nobody touching it, a demo hand moves both notes and the server's version climbs.
        await expect(page.getByRole("status").filter({ hasText: /Both screens agree on v(4[2-9]|[5-9]\d|\d{3,})\./ })).toBeVisible({ timeout: 15_000 });
    });

    test("draws every diagram as a live board", async ({ page }) => {
        await page.goto("/about#decisions");
        await expect(page.getByRole("img", { name: /drawn as a Mosaic board/ })).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole("button", { name: "Sign in to open as a board" })).toBeVisible();
    });
});

test("the 404's missing tile can be dragged home", async ({ page }) => {
    await page.goto("/no-such-page-here");
    const stray = page.getByRole("button", { name: "Put the missing tile back" });
    const from = await stray.boundingBox();
    const gap = await page.evaluate(() => {
        const rect = [...document.querySelectorAll("span")].find((span) => getComputedStyle(span).borderStyle === "dashed").getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    for (let step = 1; step <= 10; step += 1) await page.mouse.move(from.x + (gap.x - from.x) * (step / 10), from.y + (gap.y - from.y) * (step / 10));
    await page.mouse.up();
    await expect(page.getByRole("heading", { name: /this tile is home/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "The missing tile is back in place" })).toBeVisible();
});

test("the pieces gallery shows the built-in kits", async ({ page }) => {
    await page.goto("/pieces");
    await expect(page.getByRole("heading", { name: "Ready-made parts for any board." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Built into every board" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "BPMN" })).toBeVisible();
});

test("the pieces gallery orders by installs or by newest, and filters by search", async ({ page }) => {
    await page.goto("/pieces");
    const mostInstalled = page.getByRole("button", { name: "Most installed" });
    const newest = page.getByRole("button", { name: "Newest" });
    await expect(mostInstalled).toHaveAttribute("aria-pressed", "true");

    const newestRequest = page.waitForRequest((request) => request.url().includes("/api/pieces/gallery") && request.url().includes("sort=new"));
    await newest.click();
    await newestRequest;
    await expect(newest).toHaveAttribute("aria-pressed", "true");
    await expect(mostInstalled).toHaveAttribute("aria-pressed", "false");

    const searchRequest = page.waitForRequest((request) => request.url().includes("q=flow"));
    await page.getByRole("searchbox", { name: "Search sets" }).fill("flow");
    await searchRequest;
});
