import { deleteBoard, findBoard } from "../support/backend.js";
import { boardOrigin, chooseFromBoardMenu, drawRectangle, elementCount, runCommand } from "../support/board.js";
import { expect, test } from "../support/fixtures.js";

test("a .mosaic file exported from one board imports into a new board with everything on it", async ({ boardPage: page, account, board, request }) => {
    const origin = await boardOrigin(page);
    await drawRectangle(page, origin, { x: 100, y: 100 }, { x: 220, y: 200 });
    await expect.poll(() => elementCount(page)).toBe(1);

    await chooseFromBoardMenu(page, "Export");
    await page.getByRole("radio", { name: ".mosaic" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Export \.mosaic/ }).click()]);

    await chooseFromBoardMenu(page, "Import a scene file");
    // The import dialog's own input; the board has a second, hidden one for images.
    await page.locator('input[class*="fileInput"]').setInputFiles(await download.path());
    await expect(page.getByPlaceholder("Board title")).not.toHaveValue("");
    await page.getByRole("button", { name: "Import into new board" }).click();
    await page.waitForURL((url) => url.searchParams.get("shareId") !== board.shareId, { timeout: 10_000 });
    await expect.poll(() => elementCount(page)).toBe(1);

    const imported = await findBoard(request, account, new URL(page.url()).searchParams.get("shareId"));
    await deleteBoard(request, account, { drawingId: imported._id });
});

test("the board exports in stone as a framed, signed mosaic picture", async ({ boardPage: page }) => {
    await drawRectangle(page, await boardOrigin(page), { x: 200, y: 200 }, { x: 400, y: 320 });
    await expect.poll(() => elementCount(page)).toBe(1);
    await runCommand(page, "Export");
    await page.getByRole("radio", { name: "Stone" }).click();
    await expect(page.getByText(/About [\d,]+ stones/)).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export Stone" }).click()]);
    expect(download.suggestedFilename()).toMatch(/ in stone\.png$/);
});
