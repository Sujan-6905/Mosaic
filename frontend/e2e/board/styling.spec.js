import fs from "node:fs";
import path from "node:path";
import { authorizedRequest, readElements } from "../support/backend.js";
import { boardOrigin, clickAt, drawRectangle, drawSelectedBox, isColorAt, openBoard, undo } from "../support/board.js";
import { expect, test } from "../support/fixtures.js";

const onlyElement = async (account, board) => Object.values(await readElements(account, board))[0];

const selectionBar = (page) => page.getByRole("toolbar", { name: "Selection" });

const openColourPicker = async (page) => {
    await page
        .getByRole("toolbar")
        .getByRole("button", { name: /^Colour/ })
        .click();
    await expect(page.getByLabel("Hex")).toBeVisible();
};

const pickHex = async (page, value) => {
    await page.getByLabel("Hex").fill(value);
    await page.getByLabel("Hex").press("Enter");
};

test("a custom hex colour fills the selected shape", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await drawRectangle(page, origin, { x: 600, y: 400 }, { x: 700, y: 480 });
    await page.keyboard.press("v");
    await clickAt(page, origin, { x: 650, y: 440 });
    await openColourPicker(page);
    await page.getByRole("tab", { name: "Fill" }).click();
    await pickHex(page, "2dd4bf");
    await expect.poll(() => isColorAt(page, origin, { x: 650, y: 440 }, { r: 45, g: 212, b: 191 })).toBe(true);
});

test("recent colours keep their order until the picker is reopened", async ({ boardPage: page }) => {
    await page.keyboard.press("r");
    await openColourPicker(page);
    await pickHex(page, "#112233");
    await pickHex(page, "#445566");
    await page.keyboard.press("Escape");

    const swatches = page.locator('[class*="recentSwatch"]');
    const recentTitles = async () => {
        await expect(swatches.first()).toBeVisible();
        return (await swatches.evaluateAll((nodes) => nodes.map((node) => node.title))).slice(0, 2);
    };
    await openColourPicker(page);
    expect(await recentTitles()).toEqual(["#445566", "#112233"]);
    await page.locator('[class*="recentSwatch"][title="#112233"]').click();
    expect(await recentTitles()).toEqual(["#445566", "#112233"]);
    await page.keyboard.press("Escape");
    await openColourPicker(page);
    expect(await recentTitles()).toEqual(["#112233", "#445566"]);
});

test("font and size are the app's own separate controls", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await page.keyboard.press("s");
    await clickAt(page, origin, { x: 400, y: 300 });
    await page.keyboard.type("Hello");
    await page.keyboard.press("Control+Enter");

    await expect(selectionBar(page).getByRole("group", { name: "Font size" })).toBeVisible();
    await selectionBar(page)
        .getByRole("button", { name: /^Font: / })
        .click();
    await expect(page.locator("select")).toHaveCount(0);
    await expect(page.getByRole("radiogroup", { name: "Common font sizes" })).toHaveCount(0);
    await page.getByRole("radiogroup", { name: "Font" }).getByRole("radio", { name: "Georgia" }).click();
    await expect(selectionBar(page).getByRole("button", { name: /^Font: Georgia/ })).toBeVisible();

    await page.keyboard.press("Escape");
    await selectionBar(page).getByRole("button", { name: "Common font sizes" }).click();
    await page.getByRole("radiogroup", { name: "Common font sizes" }).getByRole("radio", { name: "32" }).click();
    await expect(selectionBar(page).getByRole("group", { name: "Font size" }).locator("input")).toHaveValue("32");
});

test("a font file link is copied into the app's uploads and comes back after a reload", async ({ signedInPage: page, account, board, request }) => {
    const fontUrl = "https://fonts.mosaic-e2e.test/Brand.woff2";
    const fontFile = fs.readFileSync(path.resolve("node_modules/katex/dist/fonts/KaTeX_Script-Regular.woff2"));
    // The backend only accepts fonts in the app's own Cloudinary account, so the copy lands there.
    const signed = await (await authorizedRequest(request, account, "get", "/api/upload/cloudinary-signature")).json();
    const hostedUrl = `https://res.cloudinary.com/${signed.cloudName}/raw/upload/v1/${signed.folder}/brand.woff2`;
    const serveFont = (route) => route.fulfill({ status: 200, contentType: "font/woff2", headers: { "Access-Control-Allow-Origin": "*" }, body: fontFile });
    await page.route(fontUrl, serveFont);
    await page.route(hostedUrl, serveFont);
    await page.route("https://api.cloudinary.com/**/raw/upload", (route) =>
        route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ secure_url: hostedUrl }),
        }),
    );
    await openBoard(page, board);

    const origin = await boardOrigin(page);
    await page.keyboard.press("t");
    await clickAt(page, origin, { x: 400, y: 300 });
    await page.keyboard.type("Brand words");
    await page.keyboard.press("Escape");
    await page.keyboard.press("v");
    await clickAt(page, origin, { x: 410, y: 310 });

    await page.getByRole("button", { name: /^Font: / }).click();
    const link = page.getByPlaceholder(/Google Fonts name or link/);
    await link.fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Only https links are supported")).toBeVisible();

    await link.fill(fontUrl);
    await page.getByLabel("Font name").fill("Brand Face");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect.poll(async () => (await onlyElement(account, board)).fontFamily).toBe("'Brand Face', sans-serif");
    expect((await onlyElement(account, board)).fontSource).toEqual({ kind: "file", url: hostedUrl });

    await openBoard(page, board);
    await expect
        .poll(() => page.evaluate(() => [...document.fonts].some((face) => face.family.replace(/"/g, "") === "Brand Face" && face.status === "loaded")))
        .toBe(true);
});

test("a link can be added to an element from the selection bar", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await drawSelectedBox(page, origin, { x: 300, y: 300 }, { x: 450, y: 400 });
    await selectionBar(page).getByRole("button", { name: "Add a link" }).click();
    await page.locator("#element-link").fill("mosaic.app");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(selectionBar(page).getByRole("button", { name: "Link: https://mosaic.app" })).toBeVisible();
    await page.mouse.move(origin.left + 375, origin.top + 350);
    await expect(page.getByRole("link", { name: /mosaic\.app/ })).toBeVisible();
});

test("dragging the stroke width slider slowly is one undo step", async ({ boardPage: page, account, board }) => {
    const origin = await boardOrigin(page);
    await drawSelectedBox(page, origin);
    const before = (await onlyElement(account, board)).size;
    await page.getByRole("button", { name: /^Stroke width/ }).click();
    const slider = await page.getByRole("slider", { name: "Stroke width" }).boundingBox();
    await page.mouse.move(slider.x + 2, slider.y + slider.height / 2);
    await page.mouse.down();
    await page.mouse.move(slider.x + slider.width - 2, slider.y + slider.height / 2, { steps: 25 });
    await page.mouse.up();
    await expect.poll(async () => (await onlyElement(account, board)).size).toBeGreaterThan(before + 5);

    await page.keyboard.press("Escape");
    await undo(page);
    await expect.poll(async () => (await onlyElement(account, board)).size).toBe(before);
});

test("holding G and drawing a crescent turns the board dark, and a sun turns it light again", async ({ boardPage: page }) => {
    const drawSky = async (points) => {
        await page.keyboard.down("g");
        await page.mouse.move(points[0].x, points[0].y);
        await page.mouse.down();
        for (const point of points.slice(1)) await page.mouse.move(point.x, point.y);
        await page.mouse.up();
        await page.keyboard.up("g");
    };
    const arc = (from, to, radius, steps = 36) =>
        Array.from({ length: steps + 1 }, (_unused, n) => {
            const angle = from + ((to - from) * n) / steps;
            return { x: 700 + Math.cos(angle) * radius, y: 380 + Math.sin(angle) * radius };
        });

    await drawSky(arc(Math.PI * 0.35, Math.PI * 1.65, 110));
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark", { timeout: 5_000 });
    await drawSky(arc(0, Math.PI * 2.05, 110));
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light", { timeout: 5_000 });
});
