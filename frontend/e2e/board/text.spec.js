import { boardOrigin, chooseFromInsertMenu, clickAt, drag, elementCount, isColorAt, pixelAt, selectionBox } from "../support/board.js";
import { expect, test } from "../support/fixtures.js";

const STICKY_YELLOW = { r: 254, g: 240, b: 138 };

const editor = (page, label = "Text") => page.locator(`textarea[aria-label="${label}"]`);

const findOnBoard = async (page, origin, words) => {
    await clickAt(page, origin, { x: 1100, y: 560 });
    await page.keyboard.press("Control+f");
    const input = page.getByRole("searchbox", { name: "Find text on this board" });
    await expect(input).toBeFocused();
    await input.fill(words);
    return page.getByRole("search", { name: "Find on board" });
};

test("empty text disappears, a dragged text box wraps at its width, and double-clicking it reopens its words", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await page.keyboard.press("t");
    await clickAt(page, origin, { x: 300, y: 200 });
    await expect(editor(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(editor(page)).toBeHidden();
    expect(await elementCount(page)).toBe(0);

    await page.keyboard.press("t");
    await drag(page, origin, { x: 300, y: 300 }, { x: 500, y: 360 });
    expect((await editor(page).boundingBox()).width).toBeCloseTo(200, -1);
    await editor(page).fill("Some words in a box");
    await page.keyboard.press("Control+Enter");
    await expect.poll(() => elementCount(page)).toBe(1);

    await page.keyboard.press("v");
    // Inside the words: the box's exact corner is its resize handle.
    await page.mouse.dblclick(origin.left + 320, origin.top + 312);
    await expect(editor(page)).toHaveValue("Some words in a box");
    await page.keyboard.press("Escape");
});

test("a sticky stays on show while typing, shrinks its text and then grows, and wraps a word longer than itself", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await page.keyboard.press("s");
    await clickAt(page, origin, { x: 300, y: 200 });
    await expect(editor(page)).toBeVisible();
    await expect.poll(() => isColorAt(page, origin, { x: 310, y: 210 }, STICKY_YELLOW, 40)).toBe(true);

    const fontSize = () => editor(page).evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
    const startSize = await fontSize();
    await page.keyboard.type("words ".repeat(40));
    expect(await fontSize()).toBeLessThan(startSize);

    await page.keyboard.insertText("more words and more ".repeat(60));
    // Every key refits the text, and typing into a long note still has to keep up.
    const started = Date.now();
    await page.keyboard.type("abcdefghij");
    expect((Date.now() - started) / 10).toBeLessThan(60);
    await page.keyboard.press("Control+Enter");
    await expect.poll(async () => (await selectionBox(page)).height).toBeGreaterThan(300);
    await page.keyboard.press("Enter");
    await expect(editor(page)).toBeVisible();
    await page.keyboard.press("Escape");

    await page.keyboard.press("s");
    await clickAt(page, origin, { x: 650, y: 150 });
    await page.keyboard.type("f".repeat(120));
    await page.keyboard.press("Control+Enter");
    await expect.poll(() => elementCount(page)).toBe(2);
    const box = await selectionBox(page);
    const beside = await pixelAt(page, box.x + box.width + 24, box.y + box.height / 2);
    const farAway = await pixelAt(page, box.x + box.width + 150, box.y + box.height / 2);
    expect(beside).toEqual(farAway);
});

test("Ctrl+F finds a note by its words and brings it into view", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await page.keyboard.press("s");
    await clickAt(page, origin, { x: 300, y: 260 });
    await page.keyboard.type("Login page");
    await page.keyboard.press("Escape");
    await expect.poll(() => elementCount(page)).toBe(1);

    const find = await findOnBoard(page, origin, "login");
    await expect(find).toContainText("1 of 1");
    await expect(page.locator('[class*="boundingBox"]')).toHaveCount(1);
    await page.getByRole("searchbox", { name: "Find text on this board" }).fill("checkout");
    await expect(find).toContainText("No matches");
    await page.getByRole("button", { name: "Close find" }).click();
    await expect(find).toHaveCount(0);
});

test("Ctrl+B bolds only the selected words, and Enter continues a list", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await page.keyboard.press("t");
    await clickAt(page, origin, { x: 300, y: 300 });
    await page.keyboard.type("make this bold");
    await page.keyboard.press("Shift+Control+ArrowLeft");
    await page.keyboard.press("Control+b");
    await expect(editor(page)).toHaveValue("make this **bold**");

    await page.keyboard.press("End");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("- first");
    await page.keyboard.press("Enter");
    await expect(editor(page)).toHaveValue("make this **bold**\n- first\n- ");
    await page.keyboard.press("Escape");
    await expect.poll(() => elementCount(page)).toBe(1);
});

test("a table takes words cell by cell with Tab, and Find reads its cells", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await chooseFromInsertMenu(page, /^Table/);
    await clickAt(page, origin, { x: 500, y: 260 });
    await expect(editor(page, "Row 1, column 1")).toBeFocused();
    await page.keyboard.type("Name");
    await page.keyboard.press("Tab");
    await expect(editor(page, "Row 1, column 2")).toBeFocused();
    await page.keyboard.type("Role");
    await page.keyboard.press("Escape");
    await expect.poll(() => elementCount(page)).toBe(1);

    await expect(await findOnBoard(page, origin, "role")).toContainText("1 of 1");
});

test("a table switches to the bold header style from its toolbar", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await chooseFromInsertMenu(page, /^Table/);
    await clickAt(page, origin, { x: 500, y: 260 });
    await page.keyboard.press("Escape");
    const styleButton = page.getByRole("button", { name: "Table style" });
    await expect(styleButton).toBeVisible();
    const box = await selectionBox(page);
    const emptyHeaderCell = { x: box.x + box.width * 0.83, y: box.y + 14 };
    const headerShade = async () => {
        const { r, g, b } = await pixelAt(page, emptyHeaderCell.x, emptyHeaderCell.y);
        return r + g + b;
    };
    const tinted = await headerShade();

    await styleButton.click();
    await page.getByRole("menuitemradio", { name: "Bold header" }).click();
    await clickAt(page, origin, { x: 1100, y: 560 });

    await expect.poll(headerShade).toBeLessThan(tinted - 200);
});
