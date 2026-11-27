import { readElements, rectangle, writeElements } from "../support/backend.js";
import {
    boardOrigin,
    chooseFromBoardMenu,
    chooseFromInsertMenu,
    clickAt,
    drawSelectedBox,
    elementCount,
    fulfillJson,
    openBoard,
    pressCombo,
    selectionBox,
    undo,
} from "../support/board.js";
import { expect, test } from "../support/fixtures.js";

test("boxes drawn by hand restyle into a structure, repaint in a look, and undo in one step", async ({ signedInPage: page, account, board }) => {
    await writeElements(account, board, [
        { elementId: "a", element: rectangle({ x: 100, y: 200, height: 70, text: "Plan" }) },
        { elementId: "b", element: rectangle({ x: 400, y: 200, height: 70, text: "Build" }) },
        {
            elementId: "link",
            element: {
                type: "connector",
                startX: 180,
                startY: 235,
                endX: 480,
                endY: 235,
                startElementId: "a",
                endElementId: "b",
                color: "#000000",
                size: 2,
                opacity: 100,
                arrowStart: false,
                arrowEnd: true,
                zIndex: 2,
                rotation: 0,
            },
        },
    ]);
    const withRecipe = async (key, value) => Object.values(await readElements(account, board)).filter((element) => element.diagram?.recipe?.[key] === value);
    await openBoard(page, board);
    await page
        .locator("canvas")
        .first()
        .click({ position: { x: 20, y: 20 } });
    await pressCombo(page, ["Control", "a"]);
    await page.getByRole("button", { name: "Restyle as another structure or look" }).click();
    const panel = page.getByRole("complementary", { name: "Restyle diagram" });

    await panel.getByRole("button", { name: "Pipeline", exact: true }).click();
    await expect.poll(async () => (await withRecipe("structure", "pipeline")).length).toBe(2);

    await panel.getByRole("tab", { name: "Look" }).click();
    await panel.getByRole("button", { name: /^3\. Blueprint$/ }).click();
    await expect.poll(async () => (await withRecipe("look", "blueprint")).length).toBe(2);
    const labels = (await withRecipe("look", "blueprint")).filter((element) => element.diagram.role === "node").map((element) => element.text);
    expect(labels.sort()).toEqual(["BUILD", "PLAN"]);

    await undo(page);
    await expect.poll(async () => (await withRecipe("look", "blueprint")).length).toBe(0);
});

test("Mermaid from the Insert menu becomes editable shapes that survive a reload", async ({ boardPage: page, board }) => {
    const origin = await boardOrigin(page);
    await chooseFromInsertMenu(page, /Mermaid diagram/);
    await page
        .getByLabel("Mermaid code")
        .fill("flowchart LR\n  subgraph Client\n    A[Browser] --> B{Signed in?}\n  end\n  B -- Yes --> C[Board]\n  B -.->|No| D([Sign in])");
    await expect(page.getByText("4 shapes, 3 arrows, 1 frames")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Place on board" }).click();
    await clickAt(page, origin, { x: 600, y: 380 });
    await expect.poll(() => elementCount(page)).toBe(8);
    await openBoard(page, board);
    await expect.poll(() => elementCount(page)).toBe(8);
});

test("a flowchart grows from the keyboard and is walked with Tab and Alt+arrows", async ({ boardPage: page }) => {
    const origin = await boardOrigin(page);
    await drawSelectedBox(page, origin, { x: 200, y: 300 }, { x: 320, y: 380 });
    await page.keyboard.press("Control+ArrowRight");
    await expect.poll(() => elementCount(page)).toBe(3);
    expect((await selectionBox(page)).x).toBeGreaterThan(origin.left + 330);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /^Shape: Diamond/ })).toHaveCount(0);
    await page.keyboard.press("Alt+ArrowLeft");
    await expect.poll(async () => (await selectionBox(page)).x).toBeLessThan(origin.left + 230);
});

test.describe("architecture from GitHub", () => {
    // GitHub and the model are stubbed; the extractor itself is covered by the backend's tests.
    const repoLink = { owner: "acme", repo: "web", ref: "main", sha: "abcdef1234567", linkedAt: "2026-01-01T00:00:00.000Z" };
    const GROUPS = [{ id: "group:app", label: "Application", kind: "backend" }];
    const moduleNode = (id, label = id, layer = 0) => ({
        id,
        label,
        kind: "module",
        fileCount: 3,
        title: label,
        subtitle: "detail",
        group: "group:app",
        layer,
    });
    const redis = {
        id: "service:Redis",
        label: "Redis",
        kind: "service",
        serviceKind: "data",
        fileCount: 0,
        title: "Redis",
        subtitle: "Data store",
        group: "group:data",
        layer: 0,
    };
    const graph = {
        folders: ["src/auth", "src/db"],
        groups: GROUPS,
        nodes: [moduleNode("src/auth", "Sign in"), moduleNode("src/db", "Storage", 1), redis],
        edges: [
            { from: "src/auth", to: "src/db", weight: 3, primary: true },
            { from: "src/db", to: "service:Redis", weight: 1, primary: true },
        ],
    };

    const openArchitecturePanel = async (page, board) => {
        await openBoard(page, board);
        await chooseFromBoardMenu(page, "Architecture from GitHub");
        return page.getByRole("complementary", { name: "Repository architecture" });
    };

    test("draws a repository, keeps a moved box in place on sync, and marks what's gone", async ({ signedInPage: page, board }) => {
        let linked = null;
        await page.route("**/api/architecture/*/import", (route) => {
            linked = repoLink;
            return fulfillJson(route, { repoLink, graph, explained: true });
        });
        await page.route(/\/api\/architecture\/[^/]+$/, (route) => fulfillJson(route, { repoLink: linked }));
        await page.route("**/api/architecture/*/sync", (route) =>
            fulfillJson(route, {
                repoLink: { ...repoLink, sha: "1234567abcdef" },
                graph: {
                    folders: ["src/db", "src/queue"],
                    groups: GROUPS,
                    nodes: [moduleNode("src/db", "A newly generated name"), moduleNode("src/queue", "Job queue")],
                    edges: [{ from: "src/queue", to: "src/db", weight: 2 }],
                },
                explained: true,
                unchanged: false,
            }),
        );
        await page.route("**/api/architecture/*/compare", (route) =>
            fulfillJson(route, {
                label: "#7 Add caching",
                baseSha: "a",
                headSha: "b",
                diff: {
                    addedNodes: [moduleNode("src/cache", "src/cache")],
                    removedNodes: [],
                    changedNodes: [moduleNode("src/db")],
                    addedEdges: [],
                    removedEdges: [],
                },
            }),
        );

        const panel = await openArchitecturePanel(page, board);
        await panel.getByLabel("Public GitHub repository").fill("https://github.com/acme/web");
        await panel.getByRole("button", { name: "Draw the architecture" }).click();
        await expect(panel).toContainText("acme/web");
        await expect(panel).toContainText("main at abcdef1");

        await page.mouse.move(900, 400);
        await page.mouse.click(900, 400);
        // A group's frame, three boxes and their two links.
        await expect.poll(() => elementCount(page), { timeout: 10_000 }).toBeGreaterThanOrEqual(6);
        const placed = await elementCount(page);

        await panel.getByRole("button", { name: "Sync with latest code" }).click();
        await expect(panel).toContainText("1 new module added");
        await expect(panel).toContainText("marked in red");
        await expect(panel).toContainText("Your layout stayed as it was");
        await expect.poll(() => elementCount(page)).toBeGreaterThan(placed);

        const synced = await elementCount(page);
        await panel.getByRole("button", { name: /Remove the \d+ marked in red/ }).click();
        await expect.poll(() => elementCount(page)).toBeLessThan(synced);

        await panel.getByLabel(/Compare a pull request/).fill("#7");
        await panel.getByRole("button", { name: "Compare" }).click();
        await expect(panel).toContainText("#7 Add caching");
        await expect(panel.getByRole("button", { name: /Edited Storage/ })).toBeVisible();
        await expect(panel).toContainText("Not on the diagram yet");
    });

    test("explains why a link was refused instead of failing silently", async ({ signedInPage: page, board }) => {
        await page.route(/\/api\/architecture\/[^/]+$/, (route) => fulfillJson(route, { repoLink: null }));
        const panel = await openArchitecturePanel(page, board);
        await panel.getByLabel("Public GitHub repository").fill("https://example.com/not/github");
        await panel.getByRole("button", { name: "Draw the architecture" }).click();
        await expect(panel.getByRole("alert")).toContainText("public GitHub repository");
    });
});
