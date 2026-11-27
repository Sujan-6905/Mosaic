import { boardOrigin, clickAt, drag, drawRectangle, elementCount, isColorAt, openBoard, pixelAt, pressCombo } from "../support/board.js";
import { expect, test } from "../support/fixtures.js";

const INK = { r: 24, g: 24, b: 27 };

// Two red boxes and a connector from one to the other, with the board left on Select.
const drawConnectedPair = async (page, origin) => {
    await drawRectangle(page, origin, { x: 200, y: 200 }, { x: 280, y: 280 }, { fill: "#ef4444" });
    await drawRectangle(page, origin, { x: 500, y: 200 }, { x: 580, y: 280 }, { fill: "#ef4444" });
    await page.keyboard.press("c");
    await drag(page, origin, { x: 240, y: 240 }, { x: 540, y: 240 });
    await page.keyboard.press("v");
    await expect.poll(() => elementCount(page)).toBe(3);
};

test("an arrow attaches to shapes, follows them, and can attach to another arrow", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await drawRectangle(page, origin, { x: 200, y: 200 }, { x: 300, y: 280 });
    await drawRectangle(page, origin, { x: 600, y: 200 }, { x: 700, y: 280 });
    await page.keyboard.press("a");
    await drag(page, origin, { x: 250, y: 240 }, { x: 650, y: 240 });
    await expect.poll(() => elementCount(page)).toBe(3);
    const midline = async () => (await pixelAt(page, origin.left + 450, origin.top + 240)).a;
    await expect.poll(midline).toBeGreaterThan(0);

    await page.keyboard.press("v");
    await clickAt(page, origin, { x: 650, y: 240 });
    await drag(page, origin, { x: 650, y: 240 }, { x: 650, y: 520 });
    await expect.poll(midline).toBe(0);

    await page.keyboard.press("a");
    await drag(page, origin, { x: 400, y: 330 }, { x: 400, y: 600 });
    await expect.poll(() => elementCount(page)).toBe(4);
});

test("a selected arrow's bar switches its path and its heads", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await page.keyboard.press("a");
    await drag(page, origin, { x: 300, y: 300 }, { x: 600, y: 420 });
    await expect.poll(() => elementCount(page)).toBe(1);
    await page.keyboard.press("v");
    await clickAt(page, origin, { x: 450, y: 360 });
    const bar = page.getByRole("toolbar", { name: "Selection" });
    await bar.getByRole("radio", { name: "Elbow line" }).click();
    await bar.getByRole("button", { name: /^End of line/ }).click();
    await page.getByRole("radiogroup", { name: "Line end" }).getByRole("radio", { name: "Diamond", exact: true }).click();
    await expect(page.getByRole("button", { name: /^End of line: Diamond/ })).toBeVisible();
    await expect(page.locator('[aria-label^="Arrow start"]')).toBeVisible();
    await expect(page.locator('[aria-label^="Arrow end"]')).toBeVisible();
});

test("an arrow's label can be dragged and stays where it's put", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    const label = page.locator('textarea[aria-label="Arrow label"]');
    await page.keyboard.press("a");
    await drag(page, origin, { x: 300, y: 400 }, { x: 800, y: 400 });
    await page.keyboard.press("v");
    await page.mouse.dblclick(origin.left + 550, origin.top + 400);
    await label.fill("REST");
    await page.keyboard.press("Enter");
    await clickAt(page, origin, { x: 60, y: 600 });

    await drag(page, origin, { x: 550, y: 400 }, { x: 650, y: 300 }, 8);
    await clickAt(page, origin, { x: 60, y: 600 });
    await clickAt(page, origin, { x: 650, y: 300 });
    await expect(page.getByRole("toolbar", { name: "Selection" })).toBeVisible();
    await page.mouse.dblclick(origin.left + 650, origin.top + 300);
    await expect(label).toHaveValue("REST");
});

test("duplicating two shapes and their connector joins the copied connector to the copied shapes", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await drawConnectedPair(page, origin);
    await drag(page, origin, { x: 150, y: 150 }, { x: 640, y: 330 }, 6);
    await pressCombo(page, ["Control", "d"]);
    await expect.poll(() => elementCount(page)).toBe(6);

    // Moving the copies must carry their own connector, not stretch the original.
    await drag(page, origin, { x: 270, y: 270 }, { x: 270, y: 500 }, 6);
    await expect.poll(() => isColorAt(page, origin, { x: 390, y: 240 }, INK, 70)).toBe(true);
});

test("deleting everything leaves no connector behind, even after a reload", async ({ boardPage: page, board }) => {
    const origin = await boardOrigin(page);
    await drawConnectedPair(page, origin);
    await clickAt(page, origin, { x: 60, y: 560 });
    await pressCombo(page, ["Control", "a"]);
    await page.keyboard.press("Delete");
    await expect.poll(() => elementCount(page)).toBe(0);

    await openBoard(page, board);
    await page.waitForTimeout(500);
    expect(await elementCount(page)).toBe(0);
});
