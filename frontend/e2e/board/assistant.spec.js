import { readElements } from "../support/backend.js";
import { answerAssistantTurns, elementCount, fulfillJson, openBoard } from "../support/board.js";
import { expect, test } from "../support/fixtures.js";

const reply = (body, status) => (route) => fulfillJson(route, { traceId: "abcd1234-trace", ...body }, status);

// Answers each turn with the next reply in order, repeating the last.
const replies = (...bodies) => {
    let turn = 0;
    return (route) => reply(bodies[Math.min(turn++, bodies.length - 1)])(route);
};

const openAssistant = async (page, board, handler) => {
    await answerAssistantTurns(page, handler);
    await openBoard(page, board);
    await page.locator('[aria-label="AI assistant"]').click();
    await expect(page.getByRole("dialog", { name: "AI assistant" })).toBeVisible();
};

const send = async (page, text) => {
    const message = page.getByRole("textbox", { name: "Message" });
    await message.fill(text);
    await message.press("Enter");
};

const SKETCH = {
    status: "sketch",
    message: "Here is a sketch.",
    parts: [
        {
            name: "roof",
            fill: null,
            strokes: [
                {
                    points: [
                        { x: 10, y: 50 },
                        { x: 50, y: 10 },
                        { x: 90, y: 50 },
                    ],
                    closed: true,
                    smooth: false,
                },
            ],
        },
        {
            name: "walls",
            fill: null,
            strokes: [
                {
                    points: [
                        { x: 20, y: 50 },
                        { x: 20, y: 90 },
                        { x: 80, y: 90 },
                        { x: 80, y: 50 },
                    ],
                    closed: false,
                    smooth: false,
                },
            ],
        },
    ],
};

const DIAGRAM = {
    status: "diagram",
    message: "Drew it.",
    nodes: [
        { id: "a", label: "Start", shape: "ellipse" },
        { id: "b", label: "End", shape: "ellipse" },
    ],
    edges: [{ from: "a", to: "b" }],
    replaces: [],
};

const placingPrompt = (page) => page.getByText("Click or tap where it should go");

test.describe("the assistant panel", () => {
    test("sends a question about using the whiteboard to Help and resources", async ({ signedInPage: page, board }) => {
        await openAssistant(page, board, reply({ status: "help", message: "Please go through the Help and resources section." }));
        await send(page, "how do I export this board?");
        await expect(page.getByText("Please go through the Help and resources section.")).toBeVisible();
        await page.getByRole("button", { name: "Open Help and resources" }).click();
        await expect(page.getByRole("dialog", { name: "Help and resources" })).toBeVisible();
    });

    test("shows a spoken answer without anything to place", async ({ signedInPage: page, board }) => {
        await openAssistant(page, board, reply({ status: "reply", message: "I can answer questions about this board." }));
        await send(page, "what can you help me with?");
        await expect(page.getByText("I can answer questions about this board.")).toBeVisible();
        await expect(page.getByRole("button", { name: /Place on board|Replace on board/ })).toHaveCount(0);
    });

    test("shows a failure's safe message with a reference to quote", async ({ signedInPage: page, board }) => {
        await openAssistant(
            page,
            board,
            reply({ message: "The assistant is at capacity right now. Try again in about 20 seconds.", code: "rate_limited" }, 429),
        );
        await send(page, "draw something");
        await expect(page.getByText("Try again in about 20 seconds.")).toBeVisible();
        await expect(page.getByText("Reference abcd1234")).toBeVisible();
    });

    test("places a diagram and then a sketch where each click lands, as separate elements", async ({ signedInPage: page, board }) => {
        await openAssistant(page, board, replies(DIAGRAM, SKETCH));
        await send(page, "a tiny flow");
        await page.getByRole("button", { name: "Place on board" }).click();
        await expect(placingPrompt(page)).toBeVisible();
        expect(await elementCount(page)).toBe(0);
        await page.mouse.click(420, 300);
        await expect(page.getByText("Added to the board")).toBeVisible();
        const afterDiagram = await elementCount(page);
        expect(afterDiagram).toBeGreaterThan(1);

        await send(page, "a house");
        await page.getByRole("button", { name: "Place on board" }).last().click();
        await page.mouse.click(700, 450);
        await expect(page.getByText("Added to the board")).toHaveCount(2);
        expect(await elementCount(page)).toBe(afterDiagram + SKETCH.parts.length);
    });

    test("Escape cancels placing and leaves the board alone", async ({ signedInPage: page, board }) => {
        await openAssistant(page, board, reply(SKETCH));
        await send(page, "a house");
        await page.getByRole("button", { name: "Place on board" }).click();
        await expect(placingPrompt(page)).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(placingPrompt(page)).toHaveCount(0);
        expect(await elementCount(page)).toBe(0);
        await expect(page.getByRole("button", { name: "Place on board" })).toBeVisible();
    });

    test("doesn't stream old replies again when the panel reopens", async ({ signedInPage: page, board }) => {
        await openAssistant(
            page,
            board,
            reply({ status: "reply", message: "A long enough reply to still be streaming when the panel gets closed part way through it." }),
        );
        await send(page, "hello");
        await expect(page.locator(".stream-caret.is-streaming")).toHaveCount(1);
        await page.getByRole("button", { name: "Close AI assistant" }).click();
        await expect(page.getByRole("dialog", { name: "AI assistant" })).toHaveCount(0);

        await page.locator('[aria-label="AI assistant"]').click();
        await expect(page.getByText("still be streaming when the panel")).toBeVisible();
        await expect(page.locator(".stream-caret.is-streaming")).toHaveCount(0);
    });

    test("highlights a candidate when picked, and only acts on Choose", async ({ signedInPage: page, board }) => {
        const candidates = [
            { ref: "obj_a", name: "first box", bounds: { minX: 100, minY: 100, maxX: 200, maxY: 160 } },
            { ref: "obj_b", name: "second box", bounds: { minX: 300, minY: 100, maxX: 400, maxY: 160 } },
        ];
        const sent = [];
        const answer = replies(
            { status: "ambiguous", question: "Which box do you mean?", message: "Which box do you mean?", candidates },
            { status: "reply", message: "Done." },
        );
        await openAssistant(page, board, (route) => {
            sent.push(route.request().postDataJSON());
            return answer(route);
        });

        await send(page, "make the box blue");
        await page.getByRole("button", { name: "2. second box" }).click();
        await expect(page.locator("[data-focus='true']")).toHaveCount(1);
        await page.waitForTimeout(800);
        expect(sent).toHaveLength(1);

        await page.getByRole("button", { name: "Choose" }).click();
        await expect(page.getByText("Done.", { exact: true })).toBeVisible();
        expect(sent[1].clarifiedRef).toBe("obj_b");
    });

    test("keeps the slash menu clear of the header and on top of the suggestions", async ({ signedInPage: page, board }) => {
        await openAssistant(page, board, reply({ status: "reply", message: "Hello." }));
        await page.getByRole("textbox", { name: "Message" }).fill("/");
        const menuRow = page.getByRole("button", { name: /\/summarize/ });
        await expect(menuRow).toBeVisible();

        const headerBottom = await page
            .getByRole("dialog", { name: "AI assistant" })
            .locator("header")
            .evaluate((header) => header.getBoundingClientRect().bottom);
        expect(await menuRow.evaluate((row) => row.getBoundingClientRect().top)).toBeGreaterThanOrEqual(headerBottom);
        const onTop = await menuRow.evaluate((row) => {
            const box = row.getBoundingClientRect();
            const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
            return row === top || row.contains(top);
        });
        expect(onTop).toBe(true);
    });

    test("asks which style fits when it can't decide, and draws the one picked", async ({ signedInPage: page, account, board }) => {
        await openAssistant(
            page,
            board,
            reply({
                status: "diagram",
                message: "Drew your release flow.",
                nodes: [
                    { id: "a", label: "Plan" },
                    { id: "b", label: "Build" },
                    { id: "c", label: "Ship" },
                ],
                edges: [
                    { from: "a", to: "b" },
                    { from: "b", to: "c" },
                ],
                groups: [],
                replaces: [],
                style: {
                    structure: "pipeline",
                    look: "ink",
                    certain: false,
                    choices: [
                        { structure: "pipeline", look: "ink", why: "Reads as a workflow." },
                        { structure: "numbered-steps", look: "soft-cards", why: "Friendlier for newcomers." },
                    ],
                },
            }),
        );
        await send(page, "how we ship a release");
        await expect(page.getByText("Which style fits best?")).toBeVisible();
        await page.getByRole("button", { name: "Alternatives" }).click();
        await page.getByRole("button", { name: /Numbered steps in Soft cards/ }).click();
        await page.getByRole("button", { name: "Use this style" }).click();
        await expect(page.getByText("Which style fits best?")).toHaveCount(0);

        await page.getByRole("button", { name: "Place on board" }).click();
        await page.mouse.click(420, 360);
        await expect(page.getByText("Added to the board")).toBeVisible();
        const styled = async () =>
            Object.values(await readElements(account, board)).filter(
                ({ diagram }) => diagram?.recipe?.structure === "numbered-steps" && diagram.recipe.look === "soft-cards",
            );
        await expect.poll(async () => (await styled()).length).toBe(3);
    });
});

test("a new chat started while earlier chats are still loading stays new", async ({ signedInPage: page, board }) => {
    const earlier = { id: "earlier-chat", title: "Earlier chat", updatedAt: new Date().toISOString() };
    await page.route("**/api/ai/*/conversations", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await fulfillJson(route, { conversations: [earlier] });
    });
    await page.route("**/api/ai/*/conversations/earlier-chat", (route) =>
        fulfillJson(route, { conversation: { ...earlier, messages: [{ role: "assistant", content: "An answer from the earlier chat." }] } }),
    );
    await openAssistant(page, board, reply(SKETCH));
    await page.getByRole("button", { name: "New chat" }).click();
    await page.waitForResponse("**/api/ai/*/conversations");
    await page.waitForTimeout(500);
    await expect(page.getByText("An answer from the earlier chat.")).toBeHidden();
});

test.describe("reviewing a proposed edit", () => {
    const shape = (x) => ({
        type: "shape",
        shapeType: "Rectangle",
        startX: x,
        startY: 200,
        endX: x + 80,
        endY: 260,
        color: "#3b82f6",
        fillColor: "#3b82f6",
        size: 2,
        opacity: 100,
        zIndex: 1,
        rotation: 0,
        version: 1,
    });
    const PLANNED = {
        status: "planned",
        message: "Proposed an edit (2 changes). Review it below.",
        token: "proposal-1",
        diff: { added: [{ elementId: "preview-added", element: shape(600) }], removed: [], moved: [], modified: [] },
        opsPreview: [
            { index: 0, op: "add", summary: "Add a rectangle", elementIds: ["preview-added"] },
            { index: 1, op: "delete", summary: "Delete 1 object: Old box", elementIds: [] },
        ],
        autoRepairs: [],
        lints: [],
        skippedOps: ["Disconnect A from B"],
        tainted: true,
    };

    const answerEditRoute = (page, path, handler) => page.route(`**/api/ai/*/edit/${path}`, handler);
    const reviewCard = (page) => page.getByRole("region", { name: "Review this edit" });

    test("flags risk, leaves deletes unticked, applies only what's ticked, and can undo it", async ({ signedInPage: page, board }) => {
        let committed = null;
        let reverted = null;
        await answerEditRoute(page, "commit", (route) => {
            committed = route.request().postDataJSON();
            return fulfillJson(route, { status: "applied", message: "Applied the edit (1 element changed).", diff: PLANNED.diff, batchId: "batch-1" });
        });
        await answerEditRoute(page, "revert", (route) => {
            reverted = route.request().postDataJSON();
            return fulfillJson(route, { status: "reverted", message: "Undid the edit (1 element restored)." });
        });
        await openAssistant(page, board, reply(PLANNED));
        await send(page, "add a box and remove the old one");

        const card = reviewCard(page);
        await expect(card).toContainText("safety check flagged");
        await expect(card).toContainText("Disconnect A from B");
        await expect(card).toContainText("1 added");
        await expect(card.getByRole("checkbox", { name: "Add a rectangle" })).toBeChecked();
        await expect(card.getByRole("checkbox", { name: "Delete 1 object: Old box" })).not.toBeChecked();

        await card.getByRole("button", { name: "Apply" }).click();
        await expect(page.getByText("Applied the edit (1 element changed).")).toBeVisible();
        expect(committed.acceptedIndexes).toEqual([0]);
        await expect(card).toBeHidden();

        await page.getByRole("button", { name: "Undo this edit" }).click();
        await expect(page.getByText("Undone", { exact: true })).toBeVisible();
        expect(reverted.batchId).toBe("batch-1");
    });

    test("keeps the proposal open on a conflict and updates it without asking the model again", async ({ signedInPage: page, board }) => {
        let turns = 0;
        await answerEditRoute(page, "commit", (route) =>
            fulfillJson(
                route,
                {
                    message: "Old box changed after I proposed this. Update the proposal to redo it against the board as it is now.",
                    conflicts: ["Old box"],
                    stillOpen: true,
                },
                409,
            ),
        );
        await answerEditRoute(page, "rebase", (route) =>
            fulfillJson(route, { ...PLANNED, token: "proposal-2", opsPreview: [PLANNED.opsPreview[0]], tainted: false, skippedOps: [] }),
        );
        await openAssistant(page, board, (route) => {
            turns += 1;
            return reply(PLANNED)(route);
        });
        await send(page, "add a box");

        const card = reviewCard(page);
        await card.getByRole("button", { name: "Apply" }).click();
        await expect(card).toContainText("Old box changed");
        await expect(card.getByRole("button", { name: "Apply" })).toBeDisabled();
        await card.getByRole("button", { name: "Update proposal" }).click();
        await expect(card.getByRole("button", { name: "Update proposal" })).toBeHidden();
        await expect(card.getByRole("button", { name: "Apply" })).toBeEnabled();
        await expect(card.getByRole("checkbox", { name: "Delete 1 object: Old box" })).toBeHidden();
        expect(turns).toBe(1);
    });

    test("draws the proposal on the board and hides it while held to compare", async ({ signedInPage: page, board }) => {
        await openAssistant(page, board, reply(PLANNED));
        await send(page, "add a box");
        await expect(reviewCard(page)).toBeVisible();
        await expect(page.locator('canvas[class*="overlay"]').last()).toBeVisible();

        const hold = reviewCard(page).getByRole("button", { name: "Hold to see the board before this edit" });
        const box = await hold.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await expect(hold).toHaveAttribute("aria-pressed", "true");
        await page.mouse.up();
        await expect(hold).toHaveAttribute("aria-pressed", "false");
    });
});
