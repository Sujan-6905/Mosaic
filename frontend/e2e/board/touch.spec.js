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
        await phone.locator('[aria-label="AI assistant"]').first().tap();
        const message = phone.getByRole("textbox", { name: "Message" });
        await message.fill("draw a square");
        await message.press("Enter");
        await phone.getByRole("button", { name: "Place on board" }).tap();
        await expect(phone.getByRole("status").getByText("where it should go")).toBeVisible();
        await phone.waitForTimeout(300);
        await phone.touchscreen.tap(195, 400);
        await expect(phone.locator("[data-element-count]")).not.toHaveAttribute("data-element-count", "0");
    });
});
