import { test as base, devices } from "@playwright/test";
import { FRONTEND_URL, createBoard, deleteAccount, deleteBoard, keepTokenFresh, registerAccount, signIn } from "./backend.js";
import { openBoard } from "./board.js";

export { expect } from "@playwright/test";

// Signs in as a returning person: tools stay picked between shapes, and the first-run tour is done.
export const openSignedInContext = async (browser, account, options = {}) => {
    const context = await browser.newContext({ ...devices["Desktop Chrome"], baseURL: FRONTEND_URL, ...options });
    await context.addInitScript((userId) => {
        window.localStorage.setItem("mosaic:toolLock", "1");
        window.localStorage.setItem(`mosaic:completedTours:${userId}`, JSON.stringify(["basics"]));
    }, account.userId);
    await signIn(context, account);
    return context;
};

// One account and one signed-in context serve the whole run: the backend allows
// ten sign-ins a minute from one address, and every test gets its own board.
export const test = base.extend({
    account: [
        async ({ playwright }, use) => {
            const request = await playwright.request.newContext();
            const account = await registerAccount(request);
            await use(account);
            await keepTokenFresh(request, account);
            await deleteAccount(request, account);
            await request.dispose();
        },
        { scope: "worker" },
    ],

    signedInContext: [
        async ({ browser, account }, use) => {
            const context = await openSignedInContext(browser, account);
            await use(context);
            await context.close();
        },
        { scope: "worker" },
    ],

    board: async ({ request, account }, use) => {
        await keepTokenFresh(request, account);
        const board = await createBoard(request, account);
        await use(board);
        await deleteBoard(request, account, board);
    },

    signedInPage: async ({ signedInContext }, use) => {
        const page = await signedInContext.newPage();
        await use(page);
        await page.close();
    },

    boardPage: async ({ signedInPage, board }, use) => {
        await openBoard(signedInPage, board);
        await use(signedInPage);
    },

    // A second person, for anything that needs someone other than the board's owner.
    otherAccount: async ({ request }, use) => {
        const account = await registerAccount(request, "e2e_other");
        await use(account);
        await deleteAccount(request, account);
    },

    otherContext: async ({ browser, otherAccount }, use) => {
        const context = await openSignedInContext(browser, otherAccount);
        await use(context);
        await context.close();
    },
});
