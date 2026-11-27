import http from "node:http";
import { addCollaborator, authorizedRequest, rectangle, updateBoardSettings, writeElements } from "../support/backend.js";
import { chooseFromShareMenu, elementCount, openBoard } from "../support/board.js";
import { expect, test } from "../support/fixtures.js";

const RED_BOX = rectangle({ x: 100, y: 100, width: 300, height: 200, fillColor: "#ef4444" });

const inbox = async (request, account) => (await (await authorizedRequest(request, account, "get", "/api/notifications")).json()).notifications;

test("someone without access asks for it, and the owner lets them in from the inbox", async ({
    signedInPage: owner,
    otherAccount,
    otherContext,
    account,
    board,
    request,
}) => {
    const asker = await otherContext.newPage();
    await asker.goto(`/?shareId=${board.shareId}`);
    await expect(asker.getByRole("heading", { name: "You don't have access to this board" })).toBeVisible({ timeout: 20_000 });
    await asker.getByRole("button", { name: "Request access" }).click();
    await expect(asker.getByRole("button", { name: "Request sent" })).toBeDisabled();
    await expect.poll(async () => (await inbox(request, account)).map((notice) => notice.kind)).toContain("accessRequest");

    await owner.goto("/dashboard");
    await owner.getByRole("button", { name: /^Notifications, \d+ unread$/ }).click();
    await expect(owner.getByText(`@${otherAccount.username} asked to open ${board.title}`)).toBeVisible();
    await owner.getByRole("button", { name: "Let them view" }).click();
    await expect(owner.getByText("They can view it now")).toBeVisible();

    const shared = (await inbox(request, otherAccount)).find((notice) => notice.kind === "shared");
    expect(shared).toMatchObject({ shareId: board.shareId, boardTitle: board.title, actorName: account.username });
});

test("anyone with the link sees the board live, with no account", async ({ page, account, board, request }) => {
    await updateBoardSettings(request, account, board, { linkAccess: "viewer" });
    await page.goto(`/?shareId=${board.shareId}`);
    await expect(page.getByRole("heading", { name: board.title })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("View only")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

    const centre = () =>
        page.evaluate(() => {
            const canvas = document.querySelector("main canvas");
            const [r, g] = canvas.getContext("2d").getImageData(Math.round(canvas.width / 2), Math.round(canvas.height / 2), 1, 1).data;
            return r > 200 && g < 120;
        });
    await expect(page.locator("main canvas")).toBeVisible();
    await writeElements(account, board, [{ elementId: "live", element: RED_BOX }]);
    // A newly arrived board is fitted to the screen, so its red box covers the middle.
    await expect.poll(centre, { timeout: 15_000 }).toBe(true);
});

test("a private board asks a signed-out visitor to sign in", async ({ page, board }) => {
    await page.goto(`/?shareId=${board.shareId}`);
    await expect(page.getByRole("heading", { name: "This board is private" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("dialog")).toBeVisible();
});

test("a role raised from the Share dialog applies to the collaborator's open board without a refresh", async ({
    boardPage: owner,
    otherAccount,
    otherContext,
    account,
    board,
    request,
}) => {
    await addCollaborator(request, account, board, otherAccount, "viewer");
    const collaborator = await otherContext.newPage();
    await openBoard(collaborator, board);
    await expect(collaborator.getByText("View only")).toBeVisible();
    await expect(collaborator.locator('[aria-label="Pencil"]')).toHaveCount(0);

    await chooseFromShareMenu(owner, "People with access");
    const roleSaved = owner.waitForResponse(
        (response) => response.url().includes(`/collaborators/${board.shareId}/role`) && response.request().method() === "PATCH",
    );
    await owner.getByRole("button", { name: new RegExp(`^Role for ${otherAccount.username}:`) }).click();
    await owner.getByRole("menuitem", { name: "Editor" }).click();
    expect((await roleSaved).ok()).toBe(true);
    await owner.locator('[aria-label="Close"]').click();

    await expect(collaborator.getByText("Your access changed")).toBeVisible({ timeout: 15_000 });
    await expect(collaborator.getByText("View only")).toHaveCount(0);
    // The new role arrives through a rejoin after the toast, so the stroke is retried until it lands.
    await expect
        .poll(
            async () => {
                await collaborator.locator('[aria-label="Pencil"]').click();
                await collaborator.mouse.move(300, 200);
                await collaborator.mouse.down();
                await collaborator.mouse.move(340, 240, { steps: 5 });
                await collaborator.mouse.up();
                return elementCount(owner);
            },
            { timeout: 15_000 },
        )
        .toBeGreaterThan(0);
});

test("a cover letter greets its reader by company, and stops opening once revoked", async ({ page, account, board, request }) => {
    const written = await authorizedRequest(request, account, "post", `/api/letters/board/${board.shareId}`, {
        company: "Acme Robotics",
        note: "Built this to learn real-time sync.",
    });
    expect(written.status()).toBe(201);
    const { letter } = await written.json();

    await page.goto(`/letter/${letter.token}`);
    await expect(page).toHaveTitle(/For Acme Robotics/);
    await expect(page.getByText(/no history to play yet|drawn on Mosaic/)).toBeVisible({ timeout: 15_000 });

    expect((await authorizedRequest(request, account, "delete", `/api/letters/${letter.token}`)).ok()).toBe(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "This letter isn't here any more." })).toBeVisible({ timeout: 15_000 });
});

test.describe("an embedded board", () => {
    // Real local servers rather than routed pages: Chromium won't let a page it considers
    // outside the local network frame the local app.
    const ALLOWED = "http://localhost:4710";
    const OTHER = "http://localhost:4720";
    let hosts = [];

    // A page on another site that frames the board and records every message the embed sends it.
    const startHost = (origin) =>
        new Promise((resolve) => {
            const server = http.createServer((req, res) => {
                const src = (new URL(req.url, origin).searchParams.get("src") ?? "").replace(/"/g, "");
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(
                    `<!doctype html><iframe id="board" src="${src}" width="800" height="480"></iframe><script>window.heard = []; addEventListener("message", (event) => window.heard.push(event.data));</script>`,
                );
            });
            server.listen(Number(new URL(origin).port), () => resolve(server));
        });

    const heard = (page) => page.evaluate(() => window.heard);

    test.beforeAll(async () => {
        hosts = await Promise.all([startHost(ALLOWED), startHost(OTHER)]);
    });

    test.afterAll(() => Promise.all(hosts.map((server) => new Promise((resolve) => server.close(resolve)))));

    test.beforeEach(async ({ account, board, request }) => {
        await writeElements(account, board, [{ elementId: "first", element: rectangle() }]);
        await updateBoardSettings(request, account, board, { linkAccess: "viewer", embed: { enabled: true, sites: [ALLOWED] } });
    });

    const framedBy = (host, board, baseURL) => `${host}/guide?src=${encodeURIComponent(`${baseURL}/embed/${board.shareId}`)}`;

    test("on an allowed site shows the live board and tells the page about changes", async ({ page, account, board, baseURL }) => {
        await page.goto(framedBy(ALLOWED, board, baseURL));
        await expect.poll(async () => (await heard(page)).map((message) => message.type), { timeout: 20_000 }).toContain("mosaic:ready");
        await expect(page.frameLocator("#board").getByRole("link", { name: "Open in Mosaic" })).toBeVisible();

        await writeElements(account, board, [{ elementId: "second", element: rectangle({ x: 400 }) }]);
        await expect
            .poll(async () => (await heard(page)).filter((message) => message.type === "mosaic:changed").flatMap((message) => message.elementIds), {
                timeout: 10_000,
            })
            .toContain("second");

        await page.evaluate((origin) => document.getElementById("board").contentWindow.postMessage({ type: "mosaic:zoomIn" }, origin), baseURL);
        await expect.poll(async () => (await heard(page)).some((message) => message.type === "mosaic:camera")).toBe(true);
    });

    test("can't be framed by a site the owner didn't list", async ({ page, board, baseURL }) => {
        const refusals = [];
        page.on("console", (message) => /frame-ancestors/.test(message.text()) && refusals.push(message.text()));
        await page.goto(framedBy(OTHER, board, baseURL));
        await expect.poll(() => refusals.length, { timeout: 20_000 }).toBeGreaterThan(0);
        expect(await heard(page)).toHaveLength(0);
    });

    test("of a board shared only with collaborators asks the visitor to sign in", async ({ page, account, board, baseURL, request }) => {
        await updateBoardSettings(request, account, board, { linkAccess: "none" });
        await page.goto(`${baseURL}/embed/${board.shareId}`);
        await expect(page.getByRole("button", { name: "Sign in to Mosaic" })).toBeVisible({ timeout: 20_000 });
    });
});
