import { readElements } from "../support/backend.js";
import { RED, boardOrigin, clickAt, drag, drawSelectedBox, elementCount, isColorAt, pasteText, pressCombo, selectionBox, undo } from "../support/board.js";
import { expect, test } from "../support/fixtures.js";

test("Ctrl+D duplicates as one undo step, and after an Alt-drag copy repeats that same step", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await drawSelectedBox(page, origin, { x: 200, y: 300 }, { x: 260, y: 360 });
    await pressCombo(page, ["Control", "d"]);
    await expect.poll(() => elementCount(page)).toBe(2);
    await undo(page);
    await expect.poll(() => elementCount(page)).toBe(1);

    await clickAt(page, origin, { x: 230, y: 330 });
    await page.keyboard.down("Alt");
    await drag(page, origin, { x: 230, y: 330 }, { x: 330, y: 330 }, 6);
    await page.keyboard.up("Alt");
    await pressCombo(page, ["Control", "d"]);
    await expect.poll(() => elementCount(page)).toBe(3);
    await expect.poll(() => isColorAt(page, origin, { x: 430, y: 330 }, RED)).toBe(true);
});

test("Ctrl+V pastes a copy, and Ctrl+Shift+V pastes it exactly in place", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await drawSelectedBox(page, origin, { x: 300, y: 300 }, { x: 350, y: 350 });
    await pressCombo(page, ["Control", "c"]);
    await pressCombo(page, ["Control", "v"]);
    await expect.poll(() => elementCount(page)).toBe(2);

    await pressCombo(page, ["Control", "Shift", "v"]);
    await expect.poll(() => elementCount(page)).toBe(3);
    const pasted = await selectionBox(page);
    expect(Math.abs(pasted.x - (origin.left + 300))).toBeLessThan(10);
});

test("Shift+Alt+C puts the selection on the clipboard as a PNG", async ({ boardPage: page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await drawSelectedBox(page, await boardOrigin(page));
    await page.keyboard.press("Shift+Alt+C");
    await expect(page.getByText("The selection is on your clipboard as a picture")).toBeVisible();
    const types = await page.evaluate(async () => (await navigator.clipboard.read()).flatMap((item) => item.types));
    expect(types).toContain("image/png");
});

test("words, a link, spreadsheet cells and Mermaid pasted from outside each land on the board as what they are", async ({
    boardPage: page,
    account,
    board,
}) => {
    const origin = await boardOrigin(page);
    const pasteAt = async (point, text) => {
        await page.mouse.move(origin.left + point.x, origin.top + point.y);
        await pasteText(page, text);
    };

    await pasteAt({ x: 300, y: 200 }, "Plain words from somewhere");
    await expect.poll(() => elementCount(page)).toBe(1);
    await pasteAt({ x: 300, y: 320 }, "https://example.com/page");
    await expect.poll(() => elementCount(page)).toBe(2);

    await pasteAt({ x: 700, y: 200 }, "Ada\tEngineer\nBen\tDesigner\n");
    await expect.poll(async () => Object.values(await readElements(account, board)).map((element) => element.type)).toContain("table");

    // Mermaid is parsed first and then placed where the board is clicked.
    await pasteAt({ x: 600, y: 420 }, "sequenceDiagram\n  Alice->>Bob: Hi\n  Bob-->>Alice: Hello");
    await page.waitForTimeout(1500);
    await clickAt(page, origin, { x: 600, y: 420 });
    await expect.poll(() => elementCount(page)).toBe(9);
});
