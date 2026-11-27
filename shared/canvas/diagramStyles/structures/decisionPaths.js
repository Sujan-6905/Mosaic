// Decision paths (71): a gate or request read as one line of checks.
export default [
    {
        id: "decision-path",
        number: 71,
        name: "Decision path",
        group: "Flowcharts",
        family: "decision",
        options: { notation: "decision", tones: true },
        bestFor: "Access checks, request handling, gating",
        summary:
            "One main path left to right through yes/no checks; each other answer drops to its outcome right under the check, outcomes tinted red to stop or blue to go, side messages dashed.",
        details:
            "Use for how a request, page load or sign-in is let through: a short chain of steps and checks with an outcome for each refusal. Checks are kind decision; their edge labels are the answers, and an affirmative answer that leads further stays on the main path. Give outcomes a status (refused, blocked, failed for red; allowed, success, live for blue) and a detail line as their subtitle. Edges of kind message or async are side channels drawn dashed. Prefer the classic flowchart for long procedures and the decision tree when nothing rejoins.",
    },
];
