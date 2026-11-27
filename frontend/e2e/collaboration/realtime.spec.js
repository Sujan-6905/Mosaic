import { boardOrigin, elementCount, openBoard } from "../support/board.js";
import { expect, test } from "../support/fixtures.js";
import { panByScreenDelta, screenToWorld, worldToScreen, zoomAtScreenPoint } from "../../src/features/board/camera/camera.js";

const VIEWPORT = { width: 1280, height: 800 };
const ZOOM_STEP = 1.25;

const openSecondTab = async (signedInContext, board) => {
    const page = await signedInContext.newPage();
    await openBoard(page, board);
    return page;
};

// Replays the zoom buttons as camera maths, so every predicted position is exact rather than pixel-fuzzy.
const resetAndZoomIn = async (page, times) => {
    await page.locator('[aria-label^="Reset view"]').click();
    let camera = { x: 0, y: 0, zoom: 1 };
    for (let press = 0; press < times; press += 1) {
        await page.locator('[aria-label="Zoom in"]').click();
        camera = zoomAtScreenPoint(camera, VIEWPORT.width / 2, VIEWPORT.height / 2, camera.zoom * ZOOM_STEP);
    }
    return camera;
};

test("a shape drawn by one person arrives live for another, at the same place on the board under a different camera", async ({
    boardPage: drawer,
    signedInContext,
    board,
}) => {
    await drawer.setViewportSize(VIEWPORT);
    const viewer = await openSecondTab(signedInContext, board);
    await viewer.setViewportSize(VIEWPORT);

    const drawerOrigin = await boardOrigin(drawer);
    const drawerCamera = await resetAndZoomIn(drawer, 2);
    const from = { x: 500, y: 300 };
    const to = { x: 700, y: 450 };
    await drawer.keyboard.press("r");
    await drawer.mouse.move(from.x, from.y);
    await drawer.mouse.down();
    await drawer.mouse.move(to.x, to.y, { steps: 5 });
    await drawer.mouse.up();
    const worldFrom = screenToWorld(drawerCamera, from.x - drawerOrigin.left, from.y - drawerOrigin.top);
    const worldTo = screenToWorld(drawerCamera, to.x - drawerOrigin.left, to.y - drawerOrigin.top);

    await expect.poll(() => elementCount(viewer), { timeout: 10_000 }).toBe(1);
    const viewerOrigin = await boardOrigin(viewer);
    let viewerCamera = await resetAndZoomIn(viewer, 1);
    await viewer.locator('[aria-label="Hand"]').click();
    await viewer.mouse.move(300, 300);
    await viewer.mouse.down();
    await viewer.mouse.move(150, 380, { steps: 5 });
    await viewer.mouse.up();
    viewerCamera = panByScreenDelta(viewerCamera, -150, 80);

    const predicted = worldToScreen(viewerCamera, (worldFrom.x + worldTo.x) / 2, (worldFrom.y + worldTo.y) / 2);
    await viewer.locator('[aria-label="Select"]').click();
    await viewer.mouse.click(predicted.x + viewerOrigin.left, predicted.y + viewerOrigin.top);
    // Handles only render for a selected element, which is where the maths said the shape would be.
    await expect(viewer.locator('[data-selection-handle="true"]').first()).toBeVisible({ timeout: 5_000 });
    await viewer.close();
});

test("the board's background reaches someone who joins later, and changes live for someone already there", async ({
    boardPage: first,
    signedInContext,
    board,
}) => {
    const backgroundButton = (page, name) => page.getByRole("button", { name, exact: true });
    const isChosen = (page, name) => backgroundButton(page, name).evaluate((button) => button.className.includes("active"));

    await first.locator('[aria-label="Canvas background"]').click();
    await backgroundButton(first, "Dot grid").click();
    await expect.poll(() => isChosen(first, "Dot grid")).toBe(true);

    // The late joiner can only learn the background from what the server sends on joining.
    const late = await openSecondTab(signedInContext, board);
    await late.locator('[aria-label="Canvas background"]').click();
    await expect.poll(() => isChosen(late, "Dot grid")).toBe(true);

    await backgroundButton(first, "Isometric").click();
    await expect.poll(() => isChosen(late, "Isometric"), { timeout: 10_000 }).toBe(true);
    await late.close();
});

test("a slow join becomes the kiln, and strokes drawn while it warms are on the board when it opens", async ({ signedInPage: page, board }) => {
    // Holding the socket's first requests back stands in for a server waking from sleep.
    let held = true;
    await page.route("**/socket.io/**", async (route) => {
        if (held) await new Promise((resolve) => setTimeout(resolve, 4500));
        held = false;
        await route.continue();
    });
    await page.goto(`/?shareId=${board.shareId}`);

    await expect(page.getByRole("heading", { name: "The kiln is warming." })).toBeVisible({ timeout: 8_000 });
    const pad = await page.getByLabel("A drawing pad below a row of tiles that heat up as the server wakes").boundingBox();
    await page.mouse.move(pad.x + pad.width * 0.3, pad.y + pad.height * 0.6);
    await page.mouse.down();
    for (let step = 1; step <= 12; step += 1)
        await page.mouse.move(pad.x + pad.width * (0.3 + step * 0.03), pad.y + pad.height * (0.6 - Math.sin(step / 3) * 0.15));
    await page.mouse.up();

    await expect(page.locator('[data-room-joined="true"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Kept from the wait")).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => elementCount(page)).toBe(1);
});
