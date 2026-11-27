// What people ask the assistant for most: architecture and flow diagrams, and freehand drawings.
// `expect` lists words a faithful diagram labels somewhere; drawings are judged by eye from the images.
export const TASKS = [
    {
        id: "url-shortener",
        kind: "diagram",
        prompt: "Draw the architecture of a URL shortener: a web client, an API gateway, a shortening service, a Redis cache, PostgreSQL, and an analytics worker that reads click events from a Kafka queue.",
        expect: ["client", "gateway", "shorten", "redis", "postgres", "analytics", "kafka"],
    },
    {
        id: "password-reset",
        kind: "diagram",
        prompt: "Flowchart of a password reset: the user requests a reset link, we email it, they click it, and if the token is invalid or expired they see an error, otherwise they set a new password and are signed in.",
        expect: ["request", "email", "click", "token", "error", "new password", "signed in"],
    },
    {
        id: "ride-hailing",
        kind: "diagram",
        prompt: "System architecture of a ride-hailing app: rider app, driver app, API gateway, matching service, pricing service, trip service, payments through Stripe, PostgreSQL, Redis for live driver locations, and push notifications.",
        expect: ["rider", "driver", "gateway", "matching", "pricing", "trip", "stripe", "postgres", "redis", "notification"],
    },
    {
        id: "org-chart",
        kind: "diagram",
        prompt: "An org chart: the CTO, CFO and COO report to the CEO, and two engineering managers, Asha and Ben, report to the CTO.",
        expect: ["ceo", "cto", "cfo", "coo", "asha", "ben"],
    },
    {
        id: "launch-timeline",
        kind: "diagram",
        prompt: "A product launch roadmap as a timeline: research in January, design in February, build from March to May, a beta in June and the launch in July.",
        expect: ["research", "design", "build", "beta", "launch"],
    },
    { id: "house", kind: "drawing", prompt: "Draw a house with a door, two windows and a chimney." },
    { id: "cat", kind: "drawing", prompt: "Draw a cat sitting down." },
    { id: "bicycle", kind: "drawing", prompt: "Draw a bicycle." },
    { id: "rocket", kind: "drawing", prompt: "Draw a rocket lifting off." },
    { id: "tree-and-lake", kind: "drawing", prompt: "Draw a tree beside a small lake." },
];
