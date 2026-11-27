import { answerAssistantTurns, boardOrigin, clickAt, drawRectangle, elementCount, fulfillJson, openBoard, runCommand } from "../support/board.js";
import { expect, test } from "../support/fixtures.js";

// As long as a person holds a press. A zero-length click hides menus that open on the press and close on the click.
const PRESS_MS = 120;

test("the share modal's role menu stays open through a real press and picks a role", async ({ boardPage: page }) => {
    await page.getByRole("button", { name: "Share", exact: true }).click();
    const role = page.getByRole("button", { name: /Role for the new person/ });
    await role.click({ delay: PRESS_MS });
    await page.waitForTimeout(400);
    await expect(page.getByRole("menu")).toBeVisible();
    await page.getByRole("menuitem", { name: "Viewer" }).click({ delay: PRESS_MS });
    await expect(role).toContainText("Viewer");
});

test("a drawing gesture doesn't start from inside a modal", async ({ boardPage: page }) => {
    await page.keyboard.press("p");
    await page.getByRole("button", { name: "Share", exact: true }).click();
    const dialog = await page.getByRole("dialog").boundingBox();
    await page.mouse.move(dialog.x + 40, dialog.y + 12);
    await page.mouse.down();
    await page.mouse.move(dialog.x + 90, dialog.y + 12, { steps: 3 });
    await page.mouse.up();
    expect(await elementCount(page)).toBe(0);
});

test("a right click opens the board menu, whose properties count what's on the board", async ({ boardPage: page, board }) => {
    const origin = await boardOrigin(page);
    await drawRectangle(page, origin, { x: 300, y: 300 }, { x: 420, y: 400 });
    await page.keyboard.press("v");
    await clickAt(page, origin, { x: 900, y: 560 }, { button: "right" });
    await expect(page.getByRole("menu", { name: "Board menu" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Board properties" }).click();
    const properties = page.getByRole("dialog");
    await expect(properties.getByText(board.title)).toBeVisible();
    await expect(properties.getByText("Shapes", { exact: true }).first()).toBeVisible();
    await expect(properties.locator("strong").first()).toHaveText("1");
});

test("? opens the keyboard shortcuts, which list copying as a picture and the modifier gestures", async ({ boardPage: page }) => {
    await page.keyboard.press("Shift+Slash");
    await expect(page.getByRole("tab", { name: "Keyboard shortcuts" })).toHaveAttribute("aria-selected", "true");
    const shortcuts = page.getByRole("tabpanel");
    await expect(shortcuts.getByText("Copy as PNG")).toBeVisible();
    await expect(shortcuts.getByText("Drag out a copy")).toBeVisible();
    await expect(shortcuts.getByText("Step into a group or nested shapes")).toBeVisible();
    await expect(shortcuts.getByRole("heading", { name: "Move around the board" })).toBeVisible();
});

test("Help offers a tutorial for each feature", async ({ boardPage: page }) => {
    await runCommand(page, "Help and resources");
    const help = page.getByRole("dialog", { name: "Help and resources" });
    for (const name of [
        "Drawing basics",
        "Arrows and styling",
        "Catch me up",
        "Architecture from GitHub",
        "Working together",
        "AI assistant",
        "Version history",
        "Replay",
        "Branching",
        "Export and import",
        "Keyboard shortcuts",
    ]) {
        await expect(help.getByRole("button", { name: new RegExp(name) })).toBeVisible();
    }
});

test("the AI tutorial opens the assistant, and closes it when skipped", async ({ signedInPage: page, board }) => {
    await answerAssistantTurns(page, (route) => fulfillJson(route, { status: "reply", message: "Hello." }));
    await openBoard(page, board);
    await runCommand(page, "Replay tutorial: AI assistant");
    const assistant = page.getByRole("dialog", { name: "AI assistant" });
    await expect(assistant).toHaveCount(0);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(assistant).toBeVisible();
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(assistant).toHaveCount(0);
});

test("the export and import tutorial steps through both dialogs", async ({ boardPage: page }) => {
    await runCommand(page, "Replay tutorial: Export and import");
    await expect(page.getByRole("dialog", { name: "Export" })).toBeVisible();
    await expect(page.getByText("Choose a format")).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Import" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Export" })).toHaveCount(0);
});
