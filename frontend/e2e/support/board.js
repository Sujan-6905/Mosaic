import { expect } from "@playwright/test";

export const RED = { r: 239, g: 68, b: 68 };
export const BLUE = { r: 59, g: 130, b: 246 };

export const openBoard = async (page, board) => {
    await page.goto(`/?shareId=${board.shareId}`);
    await expect(page.locator('[data-room-joined="true"]')).toBeVisible({ timeout: 15_000 });
};

export const elementCount = async (page) => Number(await page.locator("[data-element-count]").getAttribute("data-element-count"));

// Pointer positions in specs are relative to the board container, which the app measures from too.
export const boardOrigin = (page) =>
    page.evaluate(() => {
        const { left, top } = document.querySelector('[class*="whiteboardContainer"]').getBoundingClientRect();
        return { left, top };
    });

export const drag = async (page, origin, from, to, steps = 5) => {
    await page.mouse.move(origin.left + from.x, origin.top + from.y);
    await page.mouse.down();
    await page.mouse.move(origin.left + to.x, origin.top + to.y, { steps });
    await page.mouse.up();
};

export const clickAt = (page, origin, point, options) => page.mouse.click(origin.left + point.x, origin.top + point.y, options);

export const pixelAt = (page, pageX, pageY) =>
    page.evaluate(
        ({ x, y }) => {
            const canvas = document.querySelector('canvas[class*="whiteboardCanvas"]');
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const [r, g, b, a] = canvas.getContext("2d").getImageData(Math.round((x - rect.left) * dpr), Math.round((y - rect.top) * dpr), 1, 1).data;
            return { r, g, b, a };
        },
        { x: pageX, y: pageY },
    );

const colorsClose = (a, b, tolerance = 30) => Math.abs(a.r - b.r) <= tolerance && Math.abs(a.g - b.g) <= tolerance && Math.abs(a.b - b.b) <= tolerance;

export const isColorAt = async (page, origin, point, color, tolerance) =>
    colorsClose(await pixelAt(page, origin.left + point.x, origin.top + point.y), color, tolerance);

export const isEmptyAt = async (page, origin, point) => (await pixelAt(page, origin.left + point.x, origin.top + point.y)).a === 0;

// Separate down and up per key: a combo string can leave a modifier held, turning the next click into a pan.
export const pressCombo = async (page, keys) => {
    for (const key of keys) await page.keyboard.down(key);
    for (const key of [...keys].reverse()) await page.keyboard.up(key);
};

export const undo = (page) => pressCombo(page, ["Control", "z"]);

export const selectionBox = (page) => page.locator('[class*="boundingBox"]').boundingBox();

export const chooseShape = async (page, label) => {
    await page.keyboard.press("r");
    await page.getByRole("button", { name: /^Shape: / }).click();
    await page.getByRole("radiogroup", { name: "Change shape" }).getByRole("radio", { name: label, exact: true }).click();
};

export const pickSwatch = async (page, target, hex) => {
    await page
        .getByRole("toolbar")
        .getByRole("button", { name: /^Colour/ })
        .click();
    await page.getByRole("tab", { name: target }).click();
    await page.locator(`[aria-label="Palette"] [aria-label="${hex}"]`).click();
    await page.keyboard.press("Escape");
};

export const drawRectangle = async (page, origin, from, to, { fill } = {}) => {
    await page.keyboard.press("r");
    if (fill) await pickSwatch(page, "Fill", fill);
    await drag(page, origin, from, to);
};

// Draws a red rectangle, switches to Select and clicks it, leaving it selected.
export const drawSelectedBox = async (page, origin, from = { x: 300, y: 300 }, to = { x: 420, y: 400 }) => {
    await drawRectangle(page, origin, from, to, { fill: "#ef4444" });
    await page.keyboard.press("v");
    await clickAt(page, origin, { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
    await expect.poll(() => selectionBox(page)).not.toBeNull();
};

export const runCommand = async (page, command) => {
    await page.keyboard.press("Control+k");
    await page.keyboard.type(command);
    await page.keyboard.press("Enter");
};

export const chooseFromBoardMenu = async (page, item) => {
    await page.getByRole("button", { name: "Board menu" }).click();
    await page.getByRole("menuitem", { name: item }).click();
};

export const chooseFromInsertMenu = async (page, item) => {
    await page.locator('[aria-label="Insert"]').click();
    await page.getByRole("menuitem", { name: item }).click();
};

export const pasteText = (page, text) =>
    page.evaluate((value) => {
        const data = new DataTransfer();
        data.setData("text/plain", value);
        window.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    }, text);

export const zoomPercent = async (page) => Number((await page.locator('[class*="zoomControls"]').first().textContent()).replace("%", ""));

// Playwright's touchscreen can't hold two points at once, so a pinch is dispatched as pointer events.
export const touch = (page, type, pointerId, x, y) =>
    page.evaluate(
        (event) => {
            const container = document.querySelector('[class*="whiteboardContainer"]');
            container.dispatchEvent(
                new PointerEvent(event.type, {
                    pointerId: event.pointerId,
                    pointerType: "touch",
                    clientX: event.x,
                    clientY: event.y,
                    bubbles: true,
                    cancelable: true,
                }),
            );
        },
        { type, pointerId, x, y },
    );

export const fulfillJson = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

// Turns are answered by the given handler, so these specs never depend on a model or its key.
// Set before the board opens, since the app reads whether the assistant is on as it loads.
export const answerAssistantTurns = async (page, handler) => {
    await page.route("**/api/config", async (route) => {
        const response = await route.fetch();
        await fulfillJson(route, { ...(await response.json()), aiEnabled: true });
    });
    await page.route("**/api/ai/*/turn", handler);
};

export const nextFrames = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
