import {
    BLUE,
    RED,
    boardOrigin,
    clickAt,
    drag,
    drawRectangle,
    drawSelectedBox,
    elementCount,
    isColorAt,
    pressCombo,
    selectionBox,
    undo,
} from "../support/board.js";
import { expect, test } from "../support/fixtures.js";

const EMPTY_SPOT = { x: 700, y: 560 };

const loop = async (page, origin, points) => {
    await page.mouse.move(origin.left + points[0][0], origin.top + points[0][1]);
    await page.mouse.down();
    for (const [x, y] of points.slice(1)) await page.mouse.move(origin.left + x, origin.top + y, { steps: 3 });
    await page.mouse.up();
};

test("a marquee selects everything it encloses, Delete clears it from the screen, and one undo brings it all back", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    for (const x of [300, 520, 740]) await drawRectangle(page, origin, { x, y: 300 }, { x: x + 120, y: 400 }, { fill: "#ef4444" });
    await expect.poll(() => isColorAt(page, origin, { x: 360, y: 350 }, RED)).toBe(true);

    await page.keyboard.press("v");
    await drag(page, origin, { x: 240, y: 240 }, { x: 920, y: 460 }, 6);
    await page.keyboard.press("Delete");
    await expect.poll(() => elementCount(page)).toBe(0);
    for (const x of [360, 580, 800]) await expect.poll(() => isColorAt(page, origin, { x, y: 350 }, RED)).toBe(false);

    await undo(page);
    await expect.poll(() => elementCount(page)).toBe(3);
});

test("clicking one member of a group selects the whole group, and ungrouping frees them again", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    const selectionWidth = async () => (await selectionBox(page))?.width ?? 0;
    const drawPair = async (y) => {
        await drawRectangle(page, origin, { x: 300, y }, { x: 350, y: y + 50 });
        await drawRectangle(page, origin, { x: 400, y }, { x: 450, y: y + 50 });
        await page.keyboard.press("v");
        await drag(page, origin, { x: 280, y: y - 20 }, { x: 470, y: y + 60 });
        await pressCombo(page, ["Control", "g"]);
    };

    await drawPair(250);
    await clickAt(page, origin, EMPTY_SPOT);
    await clickAt(page, origin, { x: 325, y: 275 });
    await expect.poll(selectionWidth).toBeGreaterThan(140);

    await drawPair(420);
    await pressCombo(page, ["Control", "Shift", "g"]);
    await clickAt(page, origin, EMPTY_SPOT);
    await clickAt(page, origin, { x: 325, y: 445 });
    await expect.poll(selectionWidth).toBeLessThan(60);
});

const drawFarApartBoxes = async (page, origin) => {
    await drawRectangle(page, origin, { x: 300, y: 300 }, { x: 360, y: 360 });
    await drawRectangle(page, origin, { x: 800, y: 300 }, { x: 860, y: 360 });
};

test("the lasso tool selects only what it loops around, then hands back to Select", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await drawFarApartBoxes(page, origin);
    await page.keyboard.press("q");
    await loop(page, origin, [
        [250, 250],
        [420, 250],
        [420, 420],
        [250, 420],
        [250, 250],
    ]);
    await expect.poll(async () => (await selectionBox(page))?.width ?? 0).toBeLessThan(100);
    await expect(page.locator('[aria-label="Select"]')).toHaveAttribute("aria-pressed", "true");
});

test("an Alt-drag with Select draws a lasso that selects everything inside it", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await drawFarApartBoxes(page, origin);
    await page.locator('[aria-label="Select"]').click();
    await page.keyboard.down("Alt");
    await loop(page, origin, [
        [250, 250],
        [900, 250],
        [900, 420],
        [250, 420],
        [250, 250],
    ]);
    await page.keyboard.up("Alt");
    await expect.poll(async () => (await selectionBox(page))?.width ?? 0).toBeGreaterThan(500);
    await page.keyboard.press("Delete");
    await expect.poll(() => elementCount(page)).toBe(0);
});

test("an Alt-drag straight after the lasso tool hands back to Select still lassoes", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await drawFarApartBoxes(page, origin);
    await page.keyboard.press("q");
    await loop(page, origin, [
        [250, 250],
        [420, 250],
        [420, 420],
        [250, 420],
        [250, 250],
    ]);
    await clickAt(page, origin, EMPTY_SPOT);
    await page.keyboard.down("Alt");
    await loop(page, origin, [
        [250, 250],
        [900, 250],
        [900, 420],
        [250, 420],
        [250, 250],
    ]);
    await page.keyboard.up("Alt");
    await expect.poll(async () => (await selectionBox(page))?.width ?? 0).toBeGreaterThan(500);
});

test("a locked selection can't be dragged until it is unlocked", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await drawSelectedBox(page, origin, { x: 300, y: 300 }, { x: 350, y: 350 });
    await page.locator('[aria-label="Lock selection"]').click();
    await expect(page.locator('[aria-label="Unlock selection"]')).toBeVisible();

    await drag(page, origin, { x: 325, y: 325 }, { x: 600, y: 325 });
    expect(await isColorAt(page, origin, { x: 600, y: 325 }, RED)).toBe(false);
    expect(await isColorAt(page, origin, { x: 325, y: 325 }, RED)).toBe(true);

    await page.locator('[aria-label="Unlock selection"]').click();
    await expect(page.locator('[aria-label="Lock selection"]')).toBeVisible();
    await drag(page, origin, { x: 325, y: 325 }, { x: 600, y: 325 });
    await expect.poll(() => isColorAt(page, origin, { x: 600, y: 325 }, RED)).toBe(true);
});

test("holding Shift while moving keeps a shape on one axis, and Shift-clicking it deselects it", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await drawSelectedBox(page, origin, { x: 300, y: 300 }, { x: 400, y: 380 });
    const before = await selectionBox(page);

    await page.keyboard.down("Shift");
    await drag(page, origin, { x: 350, y: 340 }, { x: 470, y: 365 }, 8);
    await page.keyboard.up("Shift");
    const after = await selectionBox(page);
    expect(after.x - before.x).toBeGreaterThan(100);
    expect(Math.abs(after.y - before.y)).toBeLessThan(2);

    await page.keyboard.down("Shift");
    await clickAt(page, origin, { x: 470, y: 340 });
    await page.keyboard.up("Shift");
    await expect(page.locator('[class*="boundingBox"]')).toHaveCount(0);
});

test("double-clicking empty board starts text, and on nested shapes steps in one at a time before editing", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await page.keyboard.press("v");
    await page.mouse.dblclick(origin.left + 1000, origin.top + 500);
    await expect(page.locator('textarea[aria-label="Text"]')).toBeVisible();
    await page.keyboard.press("Escape");

    await drawRectangle(page, origin, { x: 300, y: 150 }, { x: 800, y: 550 }, { fill: "#ef4444" });
    await drawRectangle(page, origin, { x: 400, y: 230 }, { x: 700, y: 470 });
    await drawRectangle(page, origin, { x: 480, y: 290 }, { x: 620, y: 410 });
    await page.keyboard.press("v");
    await drag(page, origin, { x: 240, y: 100 }, { x: 860, y: 600 }, 6);

    const point = { x: origin.left + 550, y: origin.top + 350 };
    for (const width of [50, 30, 14]) {
        await page.mouse.dblclick(point.x, point.y, { delay: 20 });
        await expect.poll(async () => Math.round((await selectionBox(page)).width / 10)).toBe(width);
        await page.waitForTimeout(550);
    }
    await page.mouse.dblclick(point.x, point.y, { delay: 20 });
    await expect(page.locator('textarea[aria-label="Text"]')).toBeVisible();
    await page.keyboard.type("Inside");
    await page.keyboard.press("Escape");
});

test("bringing an element to front changes which overlapping fill is on top", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await drawRectangle(page, origin, { x: 300, y: 300 }, { x: 400, y: 380 }, { fill: "#ef4444" });
    await drawRectangle(page, origin, { x: 350, y: 330 }, { x: 450, y: 410 }, { fill: "#3b82f6" });
    const overlap = { x: 375, y: 355 };
    await expect.poll(() => isColorAt(page, origin, overlap, BLUE)).toBe(true);

    await page.keyboard.press("v");
    await clickAt(page, origin, { x: 320, y: 315 });
    await pressCombo(page, ["Control", "Shift", "]"]);
    await expect.poll(() => isColorAt(page, origin, overlap, RED)).toBe(true);
});
