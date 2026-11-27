import {
    BLUE,
    boardOrigin,
    chooseFromInsertMenu,
    chooseShape,
    clickAt,
    drag,
    drawRectangle,
    elementCount,
    isColorAt,
    pixelAt,
    selectionBox,
} from "../support/board.js";
import { expect, test } from "../support/fixtures.js";

test("the Frame tool drag-draws a container with a visible border", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await chooseFromInsertMenu(page, /^Frame/);
    await drag(page, origin, { x: 300, y: 200 }, { x: 600, y: 450 });
    await expect.poll(() => elementCount(page)).toBe(1);
    // A frame has no theme colour token, so its top edge is plain grey.
    await expect.poll(() => isColorAt(page, origin, { x: 450, y: 200 }, { r: 0x80, g: 0x80, b: 0x80 }, 60)).toBe(true);
});

test("the selection box fits a circle instead of sitting inside it", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await page.keyboard.press("o");
    await drag(page, origin, { x: 300, y: 200 }, { x: 460, y: 360 });
    await page.keyboard.press("v");
    await clickAt(page, origin, { x: 380, y: 280 });
    const box = await selectionBox(page);
    expect(box.width).toBeCloseTo(160, -1);
    // The circle touches each side of its box and draws nothing past it.
    expect((await pixelAt(page, box.x + box.width / 2, box.y - 8)).a).toBe(0);
    expect((await pixelAt(page, box.x - 8, box.y + box.height / 2)).a).toBe(0);
});

test("a sticky note can be dragged out to the size wanted", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await page.keyboard.press("s");
    await drag(page, origin, { x: 300, y: 200 }, { x: 620, y: 300 });
    await page.keyboard.press("Escape");
    await expect.poll(() => elementCount(page)).toBe(1);
    await clickAt(page, origin, { x: 450, y: 250 });
    const box = await selectionBox(page);
    expect(box.width).toBeCloseTo(320, -1);
    expect(box.height).toBeCloseTo(100, -1);
});

test("the fill bucket fills a shape, and a space closed in by separate lines", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await drawRectangle(page, origin, { x: 200, y: 200 }, { x: 320, y: 300 });
    await page.keyboard.press("l");
    for (const [from, to] of [
        [
            [500, 200],
            [700, 200],
        ],
        [
            [700, 200],
            [700, 340],
        ],
        [
            [700, 340],
            [500, 340],
        ],
        [
            [500, 340],
            [500, 200],
        ],
    ]) {
        await drag(page, origin, { x: from[0], y: from[1] }, { x: to[0], y: to[1] });
    }
    await expect.poll(() => elementCount(page)).toBe(5);

    await page.keyboard.press("b");
    await clickAt(page, origin, { x: 260, y: 250 });
    await expect.poll(() => isColorAt(page, origin, { x: 260, y: 250 }, BLUE)).toBe(true);

    await clickAt(page, origin, { x: 600, y: 270 });
    await expect.poll(() => elementCount(page)).toBe(6);
    await expect.poll(() => isColorAt(page, origin, { x: 600, y: 270 }, BLUE)).toBe(true);
});

test("shapes offer curved edges and a hand, and pens offer pressure and steadying", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await chooseShape(page, "Triangle");
    await page.getByRole("button", { name: /^Stroke width/ }).click();
    await expect(page.getByRole("slider", { name: "Curved edges" })).toBeVisible();
    await page.getByRole("radiogroup", { name: "Hand" }).getByRole("radio", { name: "Wild" }).click();
    await page.keyboard.press("Escape");
    await drag(page, origin, { x: 300, y: 200 }, { x: 600, y: 500 });
    await expect.poll(() => elementCount(page)).toBe(1);

    await page.keyboard.press("p");
    await expect(page.getByRole("radiogroup", { name: "Pen type" })).toBeVisible();
    await page.getByRole("button", { name: /^Stroke width/ }).click();
    await expect(page.getByRole("radiogroup", { name: "Pressure" })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Steadying" })).toBeVisible();
});

test("an embedded web page waits for the viewer's say-so and stays selectable", async ({ boardPage: page }) => {
    await chooseFromInsertMenu(page, /Web embed/);
    await page.getByLabel("Web address").fill("https://example.com/page");
    await page.getByRole("button", { name: "Embed", exact: true }).click();
    await expect.poll(() => elementCount(page)).toBe(1);
    const load = page.getByRole("button", { name: "Load page" });
    await expect(load).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);

    await page.keyboard.press("Escape");
    const box = await load.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y - 40);
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.locator('[data-selection-handle="true"]').first()).toBeVisible({ timeout: 5_000 });
});
