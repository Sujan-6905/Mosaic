import { createBoard, readElements } from "../support/backend.js";
import { boardOrigin, clickAt, drag, drawRectangle, elementCount, openBoard, pressCombo } from "../support/board.js";
import { expect, test } from "../support/fixtures.js";

const piecesPanel = (page) => page.getByRole("complementary", { name: "Pieces" });

test("every starter piece places and survives a reload", async ({ boardPage: page, board }) => {
    const origin = await boardOrigin(page);
    await page.keyboard.press("Shift+P");
    const tiles = piecesPanel(page).getByRole("button", { name: /^Place / });
    const count = await tiles.count();
    expect(count).toBeGreaterThan(20);
    let placed = 0;
    for (let index = 0; index < count; index += 1) {
        const before = await elementCount(page);
        await tiles.nth(index).click();
        await clickAt(page, origin, { x: 700 + (index % 5) * 10, y: 380 });
        await expect.poll(() => elementCount(page)).toBeGreaterThan(before);
        placed += (await elementCount(page)) - before;
    }
    await openBoard(page, board);
    await expect.poll(() => elementCount(page), { timeout: 10_000 }).toBe(placed);
});

test("a piece from a kit and an icon from the library both place", async ({ boardPage: page, account, board }) => {
    const elements = async () => Object.values(await readElements(account, board));
    await page.keyboard.press("Shift+P");
    const panel = piecesPanel(page);
    await panel.getByRole("button", { name: /^BPMN/ }).click();
    await panel.getByRole("button", { name: "Place Exclusive gateway" }).click();
    await page.mouse.click(500, 400);
    await expect.poll(async () => (await elements()).some((element) => element.shapeType === "Diamond" && element.text === "X")).toBe(true);

    if (!(await panel.isVisible())) await page.keyboard.press("Shift+P");
    await panel.getByRole("tab", { name: "Icons and logos" }).click();
    await panel.getByRole("searchbox", { name: "Search icons and logos" }).fill("database");
    await panel.getByRole("button", { name: "Place Database" }).first().click();
    await page.mouse.click(700, 420);
    await expect.poll(async () => (await elements()).some((element) => element.shapeType === "Icon" && element.icon?.paths?.length > 0)).toBe(true);
});

test("a selection saved as a piece can be shared by link, installed by someone else and placed", async ({
    boardPage: page,
    otherAccount,
    otherContext,
    request,
}) => {
    test.setTimeout(120_000);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    const origin = await boardOrigin(page);
    await drawRectangle(page, origin, { x: 200, y: 200 }, { x: 300, y: 260 }, { fill: "#ef4444" });
    await drawRectangle(page, origin, { x: 420, y: 200 }, { x: 520, y: 260 }, { fill: "#ef4444" });
    await page.keyboard.press("c");
    await drag(page, origin, { x: 250, y: 230 }, { x: 470, y: 230 });
    await page.keyboard.press("v");
    await clickAt(page, origin, { x: 60, y: 560 });
    await pressCombo(page, ["Control", "a"]);
    await clickAt(page, origin, { x: 250, y: 230 }, { button: "right" });
    await page.getByRole("menuitem", { name: "Save as a piece" }).click();
    await page.getByLabel("Piece name").fill("Two boxes");
    await page.getByRole("button", { name: "Save piece" }).click();
    const panel = piecesPanel(page);
    await expect(panel.getByRole("button", { name: "Place Two boxes" })).toBeVisible();

    await panel.getByRole("button", { name: "My pieces options" }).click();
    await panel.getByRole("menuitem", { name: "Share by link" }).click();
    await expect(panel.getByText("Shared", { exact: true })).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/\/pieces\/[\w-]+$/);

    const otherBoard = await createBoard(request, otherAccount);
    const other = await otherContext.newPage();
    await other.goto(link);
    await other.getByRole("button", { name: "Add 1 pieces to my library" }).click();
    await expect(other.getByText("Added to your pieces")).toBeVisible();
    await openBoard(other, otherBoard);
    await other.keyboard.press("Shift+P");
    await other.getByRole("button", { name: "Place Two boxes" }).click();
    await clickAt(other, await boardOrigin(other), { x: 600, y: 400 });
    await expect.poll(() => elementCount(other)).toBe(3);
});

test("a set of your own can be listed in the gallery and taken out again", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await drawRectangle(page, origin, { x: 200, y: 200 }, { x: 300, y: 260 }, { fill: "#ef4444" });
    await page.keyboard.press("v");
    await clickAt(page, origin, { x: 60, y: 560 });
    await pressCombo(page, ["Control", "a"]);
    await clickAt(page, origin, { x: 250, y: 230 }, { button: "right" });
    await page.getByRole("menuitem", { name: "Save as a piece" }).click();
    const panel = piecesPanel(page);
    await panel.getByLabel("Piece name").fill("One box");
    await panel.getByRole("button", { name: "Save piece" }).click();
    await expect(panel.getByRole("button", { name: "Place One box" })).toBeVisible();

    await panel.getByRole("button", { name: "My pieces options" }).click();
    await panel.getByRole("menuitem", { name: "List in the gallery" }).click();
    await panel.getByLabel("Tags").fill("boxes");
    await panel.getByRole("button", { name: "List it" }).click();
    await expect(panel.getByText("In gallery", { exact: true })).toBeVisible();

    await panel.getByRole("button", { name: "My pieces options" }).click();
    await panel.getByRole("menuitem", { name: "Take out of the gallery" }).click();
    await expect(panel.getByText("In gallery", { exact: true })).toBeHidden();
});
