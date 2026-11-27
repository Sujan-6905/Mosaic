import { boardOrigin, chooseFromBoardMenu, clickAt, elementCount } from "../support/board.js";
import { expect, test } from "../support/fixtures.js";

test("a stamp drops wherever the board is clicked", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await page.locator('[aria-label="Insert"]').click();
    await page.getByRole("menuitemradio", { name: "Agree stamp" }).click();
    await clickAt(page, origin, { x: 520, y: 400 });
    await clickAt(page, origin, { x: 580, y: 400 });
    await expect.poll(() => elementCount(page)).toBe(2);
});

test("a timer counts down for the board and can be paused and stopped", async ({ boardPage: page }) => {
    await chooseFromBoardMenu(page, "Timer");
    await page.getByRole("radio", { name: "3m" }).click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    const timer = page.getByRole("timer");
    await expect(timer).toHaveAttribute("aria-label", /^(3:00|2:5\d) left$/);
    await page.getByRole("button", { name: "Pause the timer" }).click();
    await expect(page.getByRole("button", { name: "Resume the timer" })).toBeVisible();
    await page.getByRole("button", { name: "Stop the timer" }).click();
    await expect(timer).toHaveCount(0);
});

test("a dot vote takes clicks as votes and reveals the count", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    const note = { x: 300, y: 260 };
    await page.keyboard.press("s");
    await clickAt(page, origin, note);
    await page.keyboard.type("Login page");
    await page.keyboard.press("Escape");
    await expect.poll(() => elementCount(page)).toBe(1);

    await chooseFromBoardMenu(page, "Dot vote");
    await page.getByRole("button", { name: "Start vote" }).click();
    const progress = page.getByRole("status", { name: "Dot vote in progress" });
    await expect(progress).toContainText("Click to vote: 3 left");
    await clickAt(page, origin, note);
    await expect(page.getByRole("button", { name: /^Your vote here/ })).toBeVisible();
    await expect(progress).toContainText("Click to vote: 2 left");

    await page.getByRole("button", { name: "Reveal" }).click();
    const results = page.getByRole("group", { name: "Vote results" });
    await expect(results).toContainText("Login page");
    await expect(page.getByLabel("1 vote", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close the results" }).click();
    await expect(results).toHaveCount(0);
});
