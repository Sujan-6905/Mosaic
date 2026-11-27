import AxeBuilder from "@axe-core/playwright";
import { openBoard } from "../support/board.js";
import { expect, test } from "../support/fixtures.js";

// WCAG 2 A and AA are the bar the app targets; axe's best-practice-only rules are left out.
const scan = (page) => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();

const SCREEN_SIZES = [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 820, height: 1180 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
];
const THEMES = ["dark", "light"];

// Sideways overflow isn't an axe rule, but it's what breaks a page on a phone or at 400% zoom.
const problemsAcrossScreens = async (page, surface) => {
    const problems = [];
    for (const size of SCREEN_SIZES) {
        await page.setViewportSize(size);
        for (const theme of THEMES) {
            await page.evaluate((next) => document.documentElement.setAttribute("data-theme", next), theme);
            await page.waitForTimeout(150);
            const where = `${surface} ${size.width}x${size.height} ${theme}`;
            const { violations } = await scan(page);
            violations.forEach(({ id, nodes }) => problems.push(`${where}: ${id} (${nodes.length}) ${nodes[0].target.join(" ")}`));
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
            if (overflow > 0) problems.push(`${where}: overflows sideways by ${overflow}px`);
        }
    }
    return problems;
};

// Text partway through a fade reads as low contrast, so every scan runs with reduced motion.
for (const path of ["/", "/about", "/help", "/docs", "/docs/agents", "/pieces"]) {
    test(`${path} is accessible at every screen size in both themes`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(path);
        await expect(page.locator("[class*='Preloader_']")).toHaveCount(0, { timeout: 15_000 });
        expect(await problemsAcrossScreens(page, path)).toEqual([]);
    });
}

test("the signed-in pages are accessible at every screen size in both themes", async ({ signedInPage: page, account, board }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "My boards" })).toBeVisible();
    const problems = await problemsAcrossScreens(page, "dashboard");

    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: `@${account.username}` })).toBeVisible();
    problems.push(...(await problemsAcrossScreens(page, "profile")));

    await openBoard(page, board);
    problems.push(...(await problemsAcrossScreens(page, "board")));

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.keyboard.press("Control+k");
    await expect(page.getByPlaceholder("Search commands or boards…")).toBeVisible();
    const { violations } = await scan(page);
    problems.push(...violations.map(({ id }) => `board with the command palette open: ${id}`));

    expect(problems).toEqual([]);
});
