import {
    RED,
    answerAssistantTurns,
    boardOrigin,
    drawRectangle,
    elementCount,
    fulfillJson,
    isColorAt,
    isEmptyAt,
    nextFrames,
    openBoard,
    touch,
    zoomPercent,
} from "../support/board.js";
import { rectangle, writeElements } from "../support/backend.js";
import { expect, openSignedInContext, test } from "../support/fixtures.js";

const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

const pinchStart = async (page) => {
    await touch(page, "pointerdown", 1, 540, 450);
    await touch(page, "pointerdown", 2, 740, 450);
};

test("a pinch zooms and stays zoomed on release, and a single finger draws again afterwards", async ({ boardPage: page }) => {
    expect(await zoomPercent(page)).toBe(100);
    await pinchStart(page);
    for (let step = 1; step <= 10; step++) {
        await touch(page, "pointermove", 1, 640 - (100 + step * 20), 450);
        await touch(page, "pointermove", 2, 640 + (100 + step * 20), 450);
    }
    await nextFrames(page);
    const zoomed = await zoomPercent(page);
    expect(zoomed).toBeGreaterThan(100);
    await touch(page, "pointerup", 1, 240, 450);
    await touch(page, "pointerup", 2, 1040, 450);
    expect(await zoomPercent(page)).toBe(zoomed);

    await page.locator('[aria-label="Pencil"]').click();
    await touch(page, "pointerdown", 3, 300, 300);
    await touch(page, "pointermove", 3, 320, 320);
    await touch(page, "pointermove", 3, 340, 340);
    await touch(page, "pointerup", 3, 340, 340);
    await expect.poll(() => elementCount(page)).toBe(1);
});

test("a two-finger drag pans the board without changing zoom", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await drawRectangle(page, origin, { x: 350, y: 250 }, { x: 450, y: 350 }, { fill: "#ef4444" });
    await page.keyboard.press("v");
    await expect.poll(() => isColorAt(page, origin, { x: 400, y: 300 }, RED)).toBe(true);

    await pinchStart(page);
    for (let step = 1; step <= 10; step++) {
        await touch(page, "pointermove", 1, 540 + 15 * step, 450);
        await touch(page, "pointermove", 2, 740 + 15 * step, 450);
    }
    await touch(page, "pointerup", 1, 690, 450);
    await touch(page, "pointerup", 2, 890, 450);

    await expect.poll(() => zoomPercent(page)).toBe(100);
    await expect.poll(() => isEmptyAt(page, origin, { x: 400, y: 300 })).toBe(true);
});

test("a resting palm's third touch neither draws nor disturbs a pinch", async ({ boardPage: page }) => {
    await pinchStart(page);
    await touch(page, "pointermove", 1, 500, 450);
    await touch(page, "pointermove", 2, 780, 450);
    await nextFrames(page);
    const zoomBeforePalm = await zoomPercent(page);

    await touch(page, "pointerdown", 3, 300, 650);
    await touch(page, "pointermove", 3, 310, 660);
    await nextFrames(page);
    expect(await zoomPercent(page)).toBe(zoomBeforePalm);

    await touch(page, "pointerup", 3, 310, 660);
    await touch(page, "pointerup", 1, 500, 450);
    await touch(page, "pointerup", 2, 780, 450);
    expect(await elementCount(page)).toBe(0);
});

test.describe("on a phone", () => {
    let phone;

    test.beforeEach(async ({ browser, account, board }) => {
        phone = await (await openSignedInContext(browser, account, PHONE)).newPage();
        await answerAssistantTurns(phone, (route) =>
            fulfillJson(route, {
                status: "sketch",
                message: "Here is a sketch.",
                parts: [
                    {
                        name: "square",
                        fill: null,
                        strokes: [
                            {
                                points: [
                                    { x: 10, y: 10 },
                                    { x: 90, y: 10 },
                                    { x: 90, y: 90 },
                                    { x: 10, y: 90 },
                                ],
                                closed: true,
                                smooth: false,
                            },
                        ],
                    },
                ],
            }),
        );
        await openBoard(phone, board);
    });

    test.afterEach(() => phone.context().close());

    test("the tour can be followed to its end with every button on screen", async () => {
        await phone.getByRole("button", { name: /Take the tour/ }).tap();
        const next = phone.getByRole("button", { name: /^(Next|Done)$/ });
        await expect(next).toBeVisible();
        let steps = 0;
        while ((await next.count()) > 0 && steps < 15) {
            const onScreen = await next.evaluate((button) => {
                const { left, right, top, bottom } = button.getBoundingClientRect();
                return left >= 0 && top >= 0 && right <= innerWidth && bottom <= innerHeight;
            });
            expect(onScreen, `step ${steps} keeps its button on screen`).toBe(true);
            await next.tap();
            await phone.waitForTimeout(450);
            steps += 1;
        }
        expect(steps).toBeGreaterThan(3);
    });

    test("a tap places a sketch from the assistant", async () => {
        await phone.getByRole("button", { name: "All tools" }).tap();
        await phone.getByRole("button", { name: "AI assistant" }).tap();
        const message = phone.getByRole("textbox", { name: "Message" });
        await message.fill("draw a square");
        await message.press("Enter");
        await phone.getByRole("button", { name: "Place on board" }).tap();
        await expect(phone.getByRole("status").getByText("where it should go")).toBeVisible();
        await phone.waitForTimeout(300);
        await phone.touchscreen.tap(195, 400);
        await expect(phone.locator("[data-element-count]")).not.toHaveAttribute("data-element-count", "0");
    });

    test("the dock fits the screen, and every other tool and board feature is one sheet away", async () => {
        const dock = await phone.getByRole("navigation", { name: "Tools" }).boundingBox();
        expect(dock.x).toBeGreaterThanOrEqual(0);
        expect(dock.x + dock.width).toBeLessThanOrEqual(390);
        await expect(phone.getByRole("button", { name: "Insert" })).toHaveCount(0);

        await phone.getByRole("button", { name: "All tools" }).tap();
        const tools = phone.getByRole("dialog", { name: "All tools" });
        await tools.getByRole("button", { name: "Lasso", exact: true }).tap();
        await expect(tools).toHaveCount(0);
        await expect(phone.getByRole("button", { name: "All tools" })).toHaveAttribute("aria-pressed", "true");

        await phone.getByRole("button", { name: "Board menu" }).tap();
        const sheet = phone.getByRole("dialog", { name: /E2E board|Board/ });
        for (const name of ["Version history", "Replay", "Catch me up", "People with access", "Timer", "Export"]) {
            await expect(sheet.getByRole("button", { name, exact: true })).toBeVisible();
        }
        await sheet.getByRole("button", { name: "Version history", exact: true }).tap();
        await expect(phone.getByText("Version history").first()).toBeVisible();
    });

    test("one finger on empty board moves it, and a phone opens a board on all of its content", async ({ account, board }) => {
        await writeElements(account, board, [
            { elementId: "near", element: rectangle({ x: 40, y: 40, width: 120, height: 120, fillColor: "#ef4444", zIndex: 1 }) },
            { elementId: "far", element: rectangle({ x: 1400, y: 1600, width: 120, height: 120, fillColor: "#3b82f6", zIndex: 2 }) },
        ]);
        await openBoard(phone, board);
        const redCentre = () =>
            phone.evaluate(() => {
                const canvas = document.querySelector('canvas[class*="whiteboardCanvas"]');
                const { data, width, height } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
                let sumX = 0;
                let count = 0;
                for (let y = 0; y < height; y += 4) {
                    for (let x = 0; x < width; x += 4) {
                        const i = (y * width + x) * 4;
                        if (data[i] > 200 && data[i + 1] < 110 && data[i + 2] < 110 && data[i + 3] > 200) {
                            sumX += x;
                            count += 1;
                        }
                    }
                }
                return count ? sumX / count / (window.devicePixelRatio || 1) : null;
            });
        const blueVisible = () =>
            phone.evaluate(() => {
                const canvas = document.querySelector('canvas[class*="whiteboardCanvas"]');
                const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
                for (let i = 0; i < data.length; i += 16) if (data[i + 2] > 200 && data[i] < 100 && data[i + 3] > 200) return true;
                return false;
            });
        await expect.poll(blueVisible).toBe(true);
        const before = await redCentre();
        expect(before).not.toBeNull();

        await touch(phone, "pointerdown", 7, 200, 760);
        for (let step = 1; step <= 8; step++) await touch(phone, "pointermove", 7, 200 - step * 10, 760);
        await touch(phone, "pointerup", 7, 120, 760);
        await expect.poll(async () => before - (await redCentre())).toBeGreaterThan(60);
        expect(await elementCount(phone)).toBe(2);
    });
});
