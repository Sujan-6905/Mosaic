import { readElements } from "../support/backend.js";
import { RED, boardOrigin, chooseShape, clickAt, drag, drawRectangle, drawSelectedBox, isColorAt, pickSwatch, selectionBox, undo } from "../support/board.js";
import { expect, test } from "../support/fixtures.js";

const rotateHandle = (page) => page.locator('[title^="Drag to rotate"]');

const handleCentre = async (page) => {
    const box = await rotateHandle(page).boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const drawRedTriangle = async (page, origin, from, to) => {
    await chooseShape(page, "Triangle");
    await pickSwatch(page, "Fill", "#ef4444");
    await drag(page, origin, from, to);
    await page.keyboard.press("v");
};

test("a rotate gesture always ends with the element back on the canvas, however it's pressed or cancelled", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await drawSelectedBox(page, origin, { x: 500, y: 300 }, { x: 640, y: 400 });
    const centre = { x: origin.left + 570, y: origin.top + 350 };
    const stillShown = async () => expect(await isColorAt(page, origin, { x: 570, y: 350 }, RED)).toBe(true);

    for (let turn = 0; turn < 12; turn += 1) {
        const handle = await handleCentre(page);
        await page.mouse.move(handle.x, handle.y);
        await page.mouse.down();
        const angle = (turn * 37 * Math.PI) / 180;
        const steps = [0, 1, 2, 5][turn % 4];
        if (steps) await page.mouse.move(centre.x + 110 * Math.sin(angle), centre.y - 110 * Math.cos(angle), { steps });
        await page.mouse.up();
        // The board layer takes the element back on the next animation frame.
        for (const wait of [40, 200]) {
            await page.waitForTimeout(wait);
            await stillShown();
        }
    }

    const handle = await handleCentre(page);
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(centre.x + 80, centre.y - 40, { steps: 3 });
    await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1, bubbles: true })));
    await page.mouse.up();
    await page.mouse.move(centre.x + 200, centre.y + 200);
    await page.waitForTimeout(200);
    await stillShown();
});

test("rotating visibly turns a shape, which can still be resized from its handles", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    // Inside the triangle near its base, and outside it once turned half way round its centre.
    const nearBase = { x: 530, y: 370 };
    await drawRedTriangle(page, origin, { x: 500, y: 300 }, { x: 600, y: 380 });
    await expect.poll(() => isColorAt(page, origin, nearBase, RED)).toBe(true);
    await clickAt(page, origin, { x: 550, y: 325 });

    const centre = { x: origin.left + 550, y: origin.top + 340 };
    const handle = await handleCentre(page);
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(handle.x, 2 * centre.y - handle.y, { steps: 10 });
    await page.mouse.up();
    await expect.poll(() => isColorAt(page, origin, nearBase, RED)).toBe(false);

    const handles = page.locator('[class*="handle"][data-selection-handle="true"]:not([class*="rotate"]):not([class*="quick"])');
    await expect(handles).toHaveCount(8);
    const before = await selectionBox(page);
    // Straight out from the middle, which grows the box whichever way it's turned.
    const side = await handles.nth(4).boundingBox();
    const grip = { x: side.x + side.width / 2, y: side.y + side.height / 2 };
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    await page.mouse.move(grip.x + (grip.x - centre.x) * 0.4, grip.y + (grip.y - centre.y) * 0.4, { steps: 6 });
    await page.mouse.up();
    const after = await selectionBox(page);
    expect(after.width * after.height).toBeGreaterThan(before.width * before.height);
});

test("Shift+V flips the selection upside down", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await drawRedTriangle(page, origin, { x: 300, y: 300 }, { x: 500, y: 400 });
    await clickAt(page, origin, { x: 400, y: 380 });
    expect(await isColorAt(page, origin, { x: 320, y: 390 }, RED)).toBe(true);
    await page.keyboard.press("Shift+V");
    await expect.poll(() => isColorAt(page, origin, { x: 320, y: 390 }, RED)).toBe(false);
    expect(await isColorAt(page, origin, { x: 320, y: 310 }, RED)).toBe(true);
});

test("Align left moves every selected element's left edge to the leftmost one", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await drawRectangle(page, origin, { x: 300, y: 300 }, { x: 350, y: 350 }, { fill: "#ef4444" });
    await drawRectangle(page, origin, { x: 450, y: 400 }, { x: 500, y: 450 }, { fill: "#ef4444" });
    expect(await isColorAt(page, origin, { x: 320, y: 420 }, RED)).toBe(false);

    await page.keyboard.press("v");
    await drag(page, origin, { x: 280, y: 280 }, { x: 520, y: 470 });
    await page.locator('[aria-label="Align and distribute"]').click();
    await page.getByRole("menuitem", { name: "Align left" }).click();
    await expect.poll(() => isColorAt(page, origin, { x: 320, y: 420 }, RED)).toBe(true);
});

test("Shift+arrow nudges ten at a time with each press undone on its own, while a held arrow key is one undo step", async ({
    boardPage: page,
    account,
    board,
}) => {
    const origin = await boardOrigin(page);
    await drawSelectedBox(page, origin);
    const startX = async () => Object.values(await readElements(account, board))[0].startX;
    const start = await startX();

    for (let press = 0; press < 5; press += 1) await page.keyboard.press("Shift+ArrowRight");
    await expect.poll(startX).toBe(start + 50);
    for (let press = 0; press < 5; press += 1) await undo(page);
    await expect.poll(startX).toBe(start);

    // Key repeat arrives about every 30 ms, so the board renders between steps.
    await page.evaluate(async () => {
        for (let repeat = 0; repeat < 12; repeat += 1) {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", code: "ArrowRight", repeat: repeat > 0, bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 30));
        }
        window.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", code: "ArrowRight", bubbles: true }));
    });
    await expect.poll(startX).toBe(start + 12);
    await undo(page);
    await expect.poll(startX).toBe(start);
});
