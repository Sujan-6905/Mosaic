import { authorizedRequest, deleteBoard, findBoard, readElements, rectangle, writeElements } from "../support/backend.js";
import { boardOrigin, chooseFromHistoryMenu, drawRectangle, elementCount, openBoard, runCommand, undo } from "../support/board.js";
import { expect, test } from "../support/fixtures.js";

// As long as a person holds a press, which is what closed these menus before they were fixed.
const PRESS_MS = 120;

test("a named version restores as one undoable change", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await drawRectangle(page, origin, { x: 100, y: 100 }, { x: 200, y: 180 });
    await expect.poll(() => elementCount(page)).toBe(1);

    await chooseFromHistoryMenu(page, "Version history");
    await page.getByPlaceholder("Name this moment").fill("One rectangle");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Named version")).toBeVisible({ timeout: 10_000 });

    // Clear of the open history panel, so the drag lands on the board.
    await drawRectangle(page, origin, { x: 600, y: 400 }, { x: 700, y: 480 });
    await expect.poll(() => elementCount(page)).toBe(2);

    await page.getByRole("button", { name: "One rectangle" }).click();
    await expect(page.getByRole("button", { name: "Back to live board" })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByText("Restored", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => elementCount(page)).toBe(1);

    await undo(page);
    await expect.poll(() => elementCount(page)).toBe(2);
});

test("replay opens on unsaved changes, scrubs back to the first, plays to the end, and its menus stay open", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    for (const x of [100, 300, 500]) await drawRectangle(page, origin, { x, y: 120 }, { x: x + 90, y: 200 });
    await runCommand(page, "Replay board history");

    const scene = page.getByRole("img", { name: /^Replay: change \d+ of \d+$/ });
    await expect(scene).toBeVisible({ timeout: 10_000 });
    const latest = Number((await scene.getAttribute("aria-label")).match(/of (\d+)$/)[1]);
    expect(latest).toBeGreaterThanOrEqual(3);
    await expect(scene).toHaveAttribute("aria-label", `Replay: change ${latest} of ${latest}`);

    await page.getByLabel("Replay position").fill("1");
    await expect(scene).toHaveAttribute("aria-label", `Replay: change 1 of ${latest}`, { timeout: 10_000 });

    const speed = page.getByRole("button", { name: /Playback speed/ });
    await speed.click({ delay: PRESS_MS });
    await page.waitForTimeout(400);
    await page.getByRole("menuitem", { name: "4x" }).click({ delay: PRESS_MS });
    await expect(speed).toContainText("4x");
    await page.getByRole("button", { name: /Show changes by/ }).click({ delay: PRESS_MS });
    await page.waitForTimeout(400);
    await expect(page.getByRole("menuitem", { name: "Everyone" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Play replay" }).click();
    await expect(scene).toHaveAttribute("aria-label", `Replay: change ${latest} of ${latest}`, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Play replay" })).toBeVisible();
});

test.describe("a branch", () => {
    let branch;

    // The board and its branch both change box a's colour; only the branch adds c, only the board labels b.
    test.beforeEach(async ({ account, board, request }) => {
        await writeElements(account, board, [
            { elementId: "a", element: rectangle({ x: 100 }) },
            { elementId: "b", element: rectangle({ x: 400 }) },
        ]);
        const forked = await authorizedRequest(request, account, "post", `/api/drawing/${board.shareId}/fork`, {});
        expect(forked.ok()).toBe(true);
        branch = (await forked.json()).data;
        await writeElements(account, { shareId: branch.shareId }, [
            { elementId: "a", operation: "update", element: rectangle({ x: 100, color: "#ef4444" }) },
            { elementId: "c", element: rectangle({ x: 700, text: "From the branch" }) },
        ]);
        await writeElements(account, board, [
            { elementId: "a", operation: "update", element: rectangle({ x: 100, color: "#3b82f6" }) },
            { elementId: "b", operation: "update", element: rectangle({ x: 400, text: "Main's words" }) },
        ]);
    });

    test.afterEach(async ({ account, request }) => {
        const saved = await findBoard(request, account, branch.shareId);
        if (saved) await deleteBoard(request, account, { drawingId: saved._id });
    });

    const openParentMerge = async (page, action) => {
        await openBoard(page, branch);
        await runCommand(page, "Branches");
        await page.getByRole("button", { name: "Parent board" }).click();
        await page.getByRole("button", { name: action }).click();
    };

    test("merges into its parent with the clash chosen, after which a second merge has nothing left", async ({ signedInPage: page, account, board }) => {
        await openParentMerge(page, "Merge this board into the parent");
        const dialog = page.getByRole("dialog", { name: new RegExp(`Merge ".*" into "${board.title}"`) });
        await expect(dialog.getByText("1 to choose")).toBeVisible();
        await expect(dialog.getByText("1 added")).toBeVisible();
        await expect(dialog.getByText(/Changed on both boards: colour/)).toBeVisible();
        await dialog.getByRole("radio", { name: /^Use / }).click();
        await dialog.getByRole("button", { name: /^Merge \d+ change/ }).click();
        await expect(page.getByText(new RegExp(`went into "${board.title}"`))).toBeVisible();

        const merged = await readElements(account, board);
        expect(merged.a.color).toBe("#ef4444");
        expect(merged.b.text).toBe("Main's words");
        expect(merged.c.text).toBe("From the branch");

        await page.getByRole("button", { name: "Parent board" }).click();
        await page.getByRole("button", { name: "Merge this board into the parent" }).click();
        await expect(page.getByText("Nothing to bring across. Both boards already agree.")).toBeVisible();
    });

    test("takes in the parent's changes, keeping its own where they clash", async ({ signedInPage: page, account, board }) => {
        await openParentMerge(page, "Bring the parent's changes here");
        const dialog = page.getByRole("dialog", { name: new RegExp(`Merge "${board.title}" into`) });
        await expect(dialog.getByText("1 to choose")).toBeVisible();
        await dialog.getByRole("button", { name: /^Merge \d+ change/ }).click();
        await expect(page.getByText(/went into/)).toBeVisible();

        const merged = await readElements(account, branch);
        expect(merged.a.color).toBe("#ef4444");
        expect(merged.b.text).toBe("Main's words");
    });
});
