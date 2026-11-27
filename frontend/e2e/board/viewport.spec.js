import { findBoard, rectangle, writeElements } from "../support/backend.js";
import { boardOrigin, drag, elementCount, openBoard, pressCombo, undo, zoomPercent } from "../support/board.js";
import { expect, test } from "../support/fixtures.js";
import { cameraToFit } from "../../src/features/board/camera/viewport.js";
import { worldToScreen } from "../../src/features/board/camera/camera.js";

const VIEWPORT = { width: 1280, height: 800 };

// A squiggle rather than a straight drag: shape assist would turn a clean line into an update,
// whose server echo repaints the board anyway and hides a missing local insert.
const drawSquiggle = async (page, origin, start) => {
    await page.keyboard.press("p");
    await page.mouse.move(origin.left + start.x, origin.top + start.y);
    await page.mouse.down();
    for (let step = 1; step <= 20; step++)
        await page.mouse.move(origin.left + start.x + step * 10, origin.top + start.y + Math.sin(step / 2) * 40, { steps: 2 });
    await page.mouse.up();
};

// How many pixels in a vertical band hold ink; the canvas bitmap is transparent wherever nothing is drawn.
const inkInBand = (page, pageX, pageY, half) =>
    page.evaluate(
        ({ x, y, half: halfHeight }) => {
            const canvas = document.querySelector('canvas[class*="whiteboardCanvas"]');
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const { data } = canvas
                .getContext("2d")
                .getImageData(Math.round((x - rect.left) * dpr), Math.round((y - halfHeight - rect.top) * dpr), 1, Math.round(halfHeight * 2 * dpr));
            let inked = 0;
            for (let alpha = 3; alpha < data.length; alpha += 4) if (data[alpha] > 0) inked += 1;
            return inked;
        },
        { x: pageX, y: pageY, half },
    );

test("the board zooms out far enough to see a large drawing", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await page.mouse.move(origin.left + 150, origin.top + 200);
    for (let tick = 0; tick < 30; tick += 1) await page.mouse.wheel(0, 120);
    await expect.poll(() => zoomPercent(page)).toBeLessThan(20);
});

test("an element millions of units from the origin is saved, loads back, and zoom to fit reaches it", async ({
    signedInPage: page,
    account,
    board,
    request,
}) => {
    const far = rectangle({ x: 4_000_000, y: -2_500_000, width: 400, height: 400 });
    await writeElements(account, board, [{ elementId: "far", element: far }]);
    // Opened only once the room has flushed to the database, so the board really loads from storage.
    await expect.poll(async () => Object.keys((await findBoard(request, account, board.shareId)).elements ?? {})).toContain("far");

    await page.setViewportSize(VIEWPORT);
    await openBoard(page, board);
    await expect.poll(() => elementCount(page)).toBe(1);
    await page.locator('[aria-label="Zoom to fit"]').click();

    const bounds = { minX: far.startX, minY: far.startY, maxX: far.endX, maxY: far.endY };
    const centre = worldToScreen(cameraToFit(bounds, VIEWPORT.width, VIEWPORT.height), (bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
    const origin = await boardOrigin(page);
    await page.locator('[aria-label="Select"]').click();
    await page.mouse.click(centre.x + origin.left, centre.y + origin.top);
    await expect(page.locator('[data-selection-handle="true"]').first()).toBeVisible({ timeout: 5_000 });
});

test("a freshly drawn stroke survives the pan that forces the next full repaint", async ({ boardPage: page }) => {
    await page.setViewportSize(VIEWPORT);
    const origin = await boardOrigin(page);
    const start = { x: 400, y: 300 };
    await drawSquiggle(page, origin, start);
    await expect.poll(() => elementCount(page)).toBe(1);
    const sample = { x: origin.left + start.x + 100, y: origin.top + start.y };
    await expect.poll(() => inkInBand(page, sample.x, sample.y, 60), { message: "the stroke never reached the board layer" }).toBeGreaterThan(0);

    await page.locator('[aria-label="Hand"]').click();
    await drag(page, origin, { x: 300, y: 550 }, { x: 440, y: 640 }, 10);
    await expect.poll(() => inkInBand(page, sample.x + 140, sample.y + 90, 60), { message: "the repaint after the pan erased the stroke" }).toBeGreaterThan(0);
});

test("undo and redo reach the board's cached tiles, through a pan and a zoom round trip", async ({ boardPage: page }) => {
    await page.setViewportSize(VIEWPORT);
    const origin = await boardOrigin(page);
    const start = { x: 400, y: 500 };
    const inkAtStroke = () => inkInBand(page, origin.left + start.x + 100, origin.top + start.y, 45);
    await drawSquiggle(page, origin, start);
    await expect.poll(() => elementCount(page)).toBe(1);
    await expect.poll(inkAtStroke).toBeGreaterThan(0);

    await page.locator('[aria-label="Hand"]').click();
    await page.mouse.move(origin.left + 300, origin.top + 300);
    await page.mouse.down();
    await page.mouse.move(origin.left + 700, origin.top + 300, { steps: 8 });
    await page.mouse.move(origin.left + 300, origin.top + 300, { steps: 8 });
    await page.mouse.up();
    await expect.poll(inkAtStroke).toBeGreaterThan(0);

    await undo(page);
    await expect.poll(inkAtStroke, { message: "the removed stroke stayed on a cached tile" }).toBe(0);
    await pressCombo(page, ["Control", "Shift", "z"]);
    await expect.poll(inkAtStroke, { message: "the restored stroke never reached the tiles" }).toBeGreaterThan(0);

    await page.locator('[aria-label="Zoom in"]').click();
    await page.waitForTimeout(400);
    await page.locator('[aria-label="Zoom out"]').click();
    await expect.poll(inkAtStroke).toBeGreaterThan(0);
    await undo(page);
    await expect.poll(inkAtStroke, { message: "a zoom level drawn before the zoom kept the removed stroke" }).toBe(0);
});
