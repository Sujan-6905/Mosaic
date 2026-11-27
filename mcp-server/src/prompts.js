import { z } from "zod";

const board = (shareId) => (shareId ? `board ${shareId}` : "a new board (create_board)");

const userMessage = (text) => ({ messages: [{ role: "user", content: { type: "text", text } }] });

// Ready-made starting points an agent app lists for the person to pick.
export const registerPrompts = (server) => {
    server.registerPrompt(
        "diagram-repository",
        {
            title: "Diagram this repository",
            description: "Read the code in the current workspace and draw its architecture on a Mosaic board.",
            argsSchema: { focus: z.string().optional().describe("A part of the system to centre on"), shareId: z.string().optional() },
        },
        ({ focus, shareId }) =>
            userMessage(
                `Read this repository's entry points, modules and external services${focus ? `, centring on ${focus}` : ""}. ` +
                    `Then draw its architecture on ${board(shareId)} with draw_styled_diagram: one node per component, ` +
                    "edges for calls and data flow labelled with what passes, groups for layers. Pick the structure and look with list_diagram_styles. " +
                    "Finish by naming anything you left out.",
            ),
    );
    server.registerPrompt(
        "notes-to-story-map",
        {
            title: "Turn notes into a story map",
            description: "Turn meeting notes or a feature list into a user story map on a board.",
            argsSchema: { notes: z.string().describe("The notes, pasted"), shareId: z.string().optional() },
        },
        ({ notes, shareId }) =>
            userMessage(
                `Turn these notes into a user story map on ${board(shareId)}: activities across the top in the order a person does them, ` +
                    "the stories under each, and release slices as groups. Use draw_styled_diagram with the story-map structure.\n\n" +
                    notes,
            ),
    );
    server.registerPrompt(
        "explain-board",
        {
            title: "Explain a board",
            description: "Read a board and explain what it shows, what is unclear and what is missing.",
            argsSchema: { shareId: z.string() },
        },
        ({ shareId }) =>
            userMessage(
                `Read board ${shareId} with describe_board and get_board_state. Explain what it shows in a few sentences, ` +
                    "then list what is ambiguous or missing. Don't change the board unless asked.",
            ),
    );
    server.registerPrompt(
        "review-board",
        {
            title: "Review a board with comments",
            description: "Leave review comments on a board's diagrams, pinned to what each one is about.",
            argsSchema: { shareId: z.string(), focus: z.string().optional().describe("What the review should look at") },
        },
        ({ shareId, focus }) =>
            userMessage(
                `Review board ${shareId}${focus ? ` for ${focus}` : ""}. Read it with describe_board, then leave one add_comment per finding, ` +
                    "anchored to the element it is about, saying what is wrong and what to do. Don't edit the board itself.",
            ),
    );
};
