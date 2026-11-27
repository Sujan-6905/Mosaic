import { createBoard, deleteBoard } from "./support/backend.js";
import { expect, test } from "./support/fixtures.js";

const deleteFromDashboard = async (page, board) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: `Actions for ${board.title}` }).click();
    await page.getByRole("menuitem", { name: "Delete board" }).click();
};

test("a deleted board breaks apart and can be put back straight away", async ({ signedInPage: page, board }) => {
    await deleteFromDashboard(page, board);
    await page.getByRole("button", { name: `Put ${board.title} back` }).click();
    await expect(page.getByRole("link", { name: `Open ${board.title}` })).toBeVisible({ timeout: 8_000 });
});

test("a board left deleted waits under Recently deleted, and comes back from there", async ({ signedInPage: page, board }) => {
    await deleteFromDashboard(page, board);
    // The undo moment waits while the pointer rests on the card.
    await page.mouse.move(2, 2);
    await expect(page.getByRole("button", { name: /Recently deleted 1/ })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /Recently deleted/ }).click();
    await expect(page.getByText(/Gone for good in 30 days/)).toBeVisible();
    await page.getByRole("button", { name: `Put ${board.title} back` }).click();
    await page.getByRole("button", { name: /My boards/ }).click();
    await expect(page.getByRole("link", { name: `Open ${board.title}` })).toBeVisible();
});

test("starring a board gilds its corner tile", async ({ signedInPage: page, board }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: `Star ${board.title}` }).click();
    const starred = page.getByRole("button", { name: `Remove ${board.title} from starred` });
    await expect(starred).toHaveAttribute("aria-pressed", "true");
    await starred.click();
});

// The board fixture is the first of the two tiles.
test("a home page tile drags to a new place without opening it", async ({ signedInPage: page, board, account, request }) => {
    const second = await createBoard(request, account, "Second board");
    try {
        await page.goto("/");
        const tiles = page.locator('a[aria-label*="edited"]');
        await expect(tiles).toHaveCount(2);
        const firstLabel = await tiles.nth(0).getAttribute("aria-label");
        const from = await tiles.nth(0).boundingBox();
        const to = await tiles.nth(1).boundingBox();
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
        await page.mouse.up();
        await expect(tiles.nth(1)).toHaveAttribute("aria-label", firstLabel);
        await expect(page).toHaveURL(/\/$/);
    } finally {
        await deleteBoard(request, account, second);
    }
});
