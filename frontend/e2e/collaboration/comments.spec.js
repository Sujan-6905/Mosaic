import { addCollaborator } from "../support/backend.js";
import { boardOrigin, clickAt, drawRectangle, openBoard } from "../support/board.js";
import { expect, test } from "../support/fixtures.js";

const comment = async (page, origin, point, text) => {
    await page.keyboard.press("m");
    await clickAt(page, origin, point);
    await page.getByPlaceholder("Add a comment…").fill(text);
    await page.keyboard.press("Enter");
};

test("a mentioned collaborator sees the comment live and resolves it, which keeps it rather than deleting it", async ({
    boardPage: owner,
    otherAccount,
    otherContext,
    account,
    board,
    request,
}) => {
    await addCollaborator(request, account, board, otherAccount, "editor");
    const collaborator = await otherContext.newPage();
    await openBoard(collaborator, board);

    await comment(owner, await boardOrigin(owner), { x: 400, y: 300 }, `hey @${otherAccount.username} check this out`);
    const pin = collaborator.locator("[data-comment-pin]");
    await expect(pin).toBeVisible({ timeout: 10_000 });
    await expect(collaborator.getByText("mentioned you")).toBeVisible({ timeout: 10_000 });
    await pin.click();
    await collaborator.locator('[aria-label="Resolve thread"]').click();

    await owner.locator('[aria-label^="Comments"]').click();
    await owner.getByRole("tab", { name: "Resolved" }).click();
    await expect(owner.getByText("check this out")).toBeVisible({ timeout: 10_000 });
});

test("a moved comment pin lands exactly where it was dropped", async ({ boardPage: page }) => {
    await comment(page, await boardOrigin(page), { x: 500, y: 400 }, "Look here");
    const pin = page.locator("[data-comment-pin]");
    const before = await pin.boundingBox();
    const grip = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    await page.mouse.move(grip.x + 200, grip.y + 120, { steps: 8 });
    const dragging = await pin.boundingBox();
    await page.mouse.up();
    await page.waitForTimeout(100);
    const after = await pin.boundingBox();
    // Allows for the pin's small hover scale settling after release.
    expect(Math.abs(after.x - dragging.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(after.y - dragging.y)).toBeLessThanOrEqual(2);
});

test("someone returning is caught up on what changed while they were away, and not the second time", async ({
    boardPage: owner,
    otherAccount,
    otherContext,
    account,
    board,
    request,
}) => {
    test.setTimeout(90_000);
    await addCollaborator(request, account, board, otherAccount, "editor");
    const reader = await otherContext.newPage();
    const panel = reader.getByRole("complementary", { name: "Catch me up" });
    const leave = async () => {
        await reader.goto("about:blank");
        await reader.waitForTimeout(1500);
    };

    // A first visit has nothing to compare against.
    await openBoard(reader, board);
    await expect(panel).toBeHidden();
    await leave();

    const origin = await boardOrigin(owner);
    await drawRectangle(owner, origin, { x: 400, y: 300 }, { x: 520, y: 380 });
    await comment(owner, origin, { x: 700, y: 300 }, `hey @${otherAccount.username} look at this`);
    await owner.waitForTimeout(1000);

    await openBoard(reader, board);
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(panel).toContainText(`${account.username} made 1 change`);
    await expect(panel).toContainText("1 mentioning you");
    await expect(panel.getByRole("button", { name: /mentioned you/ })).toBeVisible();
    const change = panel.getByRole("button", { name: /^Added/ });
    await change.click();
    await expect(change).toHaveAttribute("aria-current", "true");

    await panel.getByRole("button", { name: "Close catch up" }).click();
    await expect(panel).toBeHidden();
    await reader.getByRole("button", { name: "Catch me up" }).click();
    await expect(panel).toContainText("made 1 change");
    await panel.getByRole("radio", { name: "24 hours" }).click();
    await expect(panel).toContainText("made 1 change");

    await leave();
    await openBoard(reader, board);
    await reader.waitForTimeout(2000);
    await expect(panel).toBeHidden();
});
