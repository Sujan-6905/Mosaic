// Instructions graded by which elements change; `targetPhrase` is what the resolver gets. Duplicate and
// connect are left out (a new element has no id to expect), and align expects only what moves.

const namedCases = [
    { id: "named-01", instruction: "make the login box red", targetPhrase: "the login box", expected: { elementIds: ["login-box"] } },
    { id: "named-02", instruction: "make the session box blue", targetPhrase: "the session box", expected: { elementIds: ["session-box"] } },
    { id: "named-03", instruction: "delete the retry note", targetPhrase: "the retry note", expected: { elementIds: ["retry-note"] } },
    {
        id: "named-04",
        instruction: "change the oauth note's text to 'add Google OAuth'",
        targetPhrase: "the oauth note",
        expected: { elementIds: ["oauth-note"] },
    },
    { id: "named-05", instruction: "move the retry note above the oauth note", targetPhrase: "the retry note", expected: { elementIds: ["retry-note"] } },
    {
        id: "named-06",
        instruction: "resize the Auth Flow frame to fit its contents",
        targetPhrase: "the Auth Flow frame",
        expected: { elementIds: ["auth-frame"] },
    },
    { id: "named-07", instruction: "bring the login box to the front", targetPhrase: "the login box", expected: { elementIds: ["login-box"] } },
    { id: "named-08", instruction: "send the session box to the back", targetPhrase: "the session box", expected: { elementIds: ["session-box"] } },
    {
        id: "named-09",
        instruction: "increase the opacity of the oauth note to fully opaque",
        targetPhrase: "the oauth note",
        expected: { elementIds: ["oauth-note"] },
    },
    {
        id: "named-10",
        instruction: "align the login box and session box to the left",
        targetPhrase: "the login box and session box",
        expected: { elementIds: ["session-box"] },
    },
    {
        id: "named-11",
        instruction: "remove the connector between the login box and session box",
        targetPhrase: "the connector between the login box and session box",
        expected: { elementIds: ["login-to-session"] },
    },
    { id: "named-12", instruction: "take the login box out of the Auth Flow frame", targetPhrase: "the login box", expected: { elementIds: ["login-box"] } },
    { id: "named-13", instruction: "make the login label say 'Sign in'", targetPhrase: "the login label", expected: { elementIds: ["login-label"] } },
    {
        id: "named-14",
        instruction: "delete the oauth note and the retry note",
        targetPhrase: "the oauth note and the retry note",
        expected: { elementIds: ["oauth-note", "retry-note"] },
    },
];

const spatialCases = [
    { id: "spatial-01", instruction: "make the box on the left red", targetPhrase: "the box on the left", expected: { elementIds: ["left-box"] } },
    { id: "spatial-02", instruction: "make the box on the right blue", targetPhrase: "the box on the right", expected: { elementIds: ["right-box"] } },
    { id: "spatial-03", instruction: "delete the topmost box", targetPhrase: "the topmost box", expected: { elementIds: ["top-box"] } },
    { id: "spatial-04", instruction: "move the bottom box up next to the top box", targetPhrase: "the bottom box", expected: { elementIds: ["bottom-box"] } },
    {
        id: "spatial-05",
        instruction: "align the left box and the right box along the top edge",
        targetPhrase: "the left box and the right box",
        expected: { elementIds: ["right-box"] },
    },
    {
        id: "spatial-06",
        instruction: "distribute the top box, left box, and bottom box evenly along the vertical axis",
        targetPhrase: "the top box, left box, and bottom box",
        expected: { elementIds: ["left-box"] },
    },
    {
        id: "spatial-07",
        instruction: "make the box in the middle top smaller in opacity, set it to 50",
        targetPhrase: "the box in the middle top",
        expected: { elementIds: ["top-box"] },
    },
    { id: "spatial-08", instruction: "send the box on the left to the back", targetPhrase: "the box on the left", expected: { elementIds: ["left-box"] } },
    {
        id: "spatial-09",
        instruction: "move the box on the right to be left of the box on the left",
        targetPhrase: "the box on the right",
        expected: { elementIds: ["right-box"] },
    },
    { id: "spatial-10", instruction: "make the bottommost box green", targetPhrase: "the bottommost box", expected: { elementIds: ["bottom-box"] } },
];

const freehandCases = [
    { id: "freehand-01", instruction: "make the sketch on the left thicker", targetPhrase: "the sketch on the left", expected: { elementIds: ["sketch-a"] } },
    { id: "freehand-02", instruction: "make the sketch on the right red", targetPhrase: "the sketch on the right", expected: { elementIds: ["sketch-b"] } },
    {
        id: "freehand-03",
        instruction: "move the drawing on the right up next to the one on the left",
        targetPhrase: "the drawing on the right",
        expected: { elementIds: ["sketch-b"] },
    },
    { id: "freehand-04", instruction: "delete the left-hand sketch", targetPhrase: "the left-hand sketch", expected: { elementIds: ["sketch-a"] } },
    {
        id: "freehand-05",
        instruction: "reduce the opacity of the sketch on the right to 50",
        targetPhrase: "the sketch on the right",
        expected: { elementIds: ["sketch-b"] },
    },
    { id: "freehand-06", instruction: "bring the left sketch to the front", targetPhrase: "the left sketch", expected: { elementIds: ["sketch-a"] } },
    {
        id: "freehand-07",
        instruction: "align both freehand drawings along their top edges",
        targetPhrase: "both freehand drawings",
        expected: { elementIds: ["sketch-b"] },
    },
    {
        id: "freehand-08",
        instruction: "make the drawing on the right thinner",
        targetPhrase: "the drawing on the right",
        expected: { elementIds: ["sketch-b"] },
    },
];

const groupCases = [
    {
        id: "group-01",
        instruction: "make every sticky in the cluster green",
        targetPhrase: "every sticky in the cluster",
        expected: { elementIds: ["task-1", "task-2", "task-3", "task-4"] },
    },
    {
        id: "group-02",
        instruction: "tidy the task cluster into a top-down layout",
        targetPhrase: "the task cluster",
        expected: { elementIds: ["task-1", "task-2", "task-3", "task-4"] },
    },
    {
        id: "group-03",
        instruction: "ungroup the task cluster",
        targetPhrase: "the task cluster",
        expected: { elementIds: ["task-1", "task-2", "task-3", "task-4"] },
    },
    {
        id: "group-04",
        instruction: "move the unrelated idea note into the Q1 frame",
        targetPhrase: "the unrelated idea note",
        expected: { elementIds: ["standalone-note"] },
    },
    {
        id: "group-05",
        instruction: "align the task cluster to the left",
        targetPhrase: "the task cluster",
        expected: { elementIds: ["task-1", "task-2", "task-3", "task-4"] },
    },
    { id: "group-06", instruction: "delete the unrelated idea note", targetPhrase: "the unrelated idea note", expected: { elementIds: ["standalone-note"] } },
    { id: "group-07", instruction: "resize the Q1 frame to fit its contents", targetPhrase: "the Q1 frame", expected: { elementIds: ["q1-frame"] } },
    { id: "group-08", instruction: "make the design review sticky blue", targetPhrase: "the design review sticky", expected: { elementIds: ["task-1"] } },
];

// Graded on every element any step should touch: a multi-step edit counts only when all land.
const multiStepCases = [
    {
        id: "multistep-01",
        board: "diagram",
        instruction: "make the login box red and the session box blue",
        targetPhrase: "the login box and the session box",
        expected: { elementIds: ["login-box", "session-box"] },
    },
    {
        id: "multistep-02",
        board: "diagram",
        instruction: "delete the retry note and move the oauth note to be below the session box",
        targetPhrase: "the retry note and the oauth note",
        expected: { elementIds: ["retry-note", "oauth-note"] },
    },
    {
        id: "multistep-03",
        board: "diagram",
        instruction: "align the login box and session box to the left, then make them both red",
        targetPhrase: "the login box and session box",
        expected: { elementIds: ["login-box", "session-box"] },
    },
    {
        id: "multistep-04",
        board: "group",
        instruction: "make every sticky in the cluster green and then tidy them into a top-down layout",
        targetPhrase: "every sticky in the cluster",
        expected: { elementIds: ["task-1", "task-2", "task-3", "task-4"] },
    },
    {
        id: "multistep-05",
        board: "group",
        instruction: "delete the unrelated idea note and make the design review sticky blue",
        targetPhrase: "the unrelated idea note and the design review sticky",
        expected: { elementIds: ["standalone-note", "task-1"] },
    },
    {
        id: "multistep-06",
        board: "spatial",
        instruction: "make the box on the left red and the box on the right blue",
        targetPhrase: "the box on the left and the box on the right",
        expected: { elementIds: ["left-box", "right-box"] },
    },
];

// No matching object exists, so a pass is any outcome that changes nothing, never an edit
// to the nearest-sounding real object.
const refusalCases = [
    { id: "refusal-01", board: "diagram", instruction: "delete the payment form" },
    { id: "refusal-02", board: "diagram", instruction: "make the logout button red" },
    { id: "refusal-03", board: "spatial", instruction: "move the circle to the center" },
    { id: "refusal-04", board: "freehand", instruction: "change the text of the title to 'Overview'" },
    { id: "refusal-05", board: "group", instruction: "delete the sticky about pricing" },
    { id: "refusal-06", board: "diagram", instruction: "connect the login box to the database icon" },
    { id: "refusal-07", board: "group", instruction: "move the Q2 frame next to the Q1 frame" },
    { id: "refusal-08", board: "spatial", instruction: "make the triangle green" },
];

const withCategory = (category, cases, board) => cases.map((testCase) => ({ ...testCase, category, board: testCase.board ?? board }));

export const EDIT_BENCHMARK_CASES = [
    ...withCategory("named", namedCases, "diagram"),
    ...withCategory("spatial", spatialCases, "spatial"),
    ...withCategory("freehand", freehandCases, "freehand"),
    ...withCategory("group", groupCases, "group"),
    ...withCategory("multistep", multiStepCases),
    ...withCategory("refusal", refusalCases),
];
