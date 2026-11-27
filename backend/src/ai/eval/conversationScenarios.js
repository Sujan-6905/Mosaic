// Real requests as whole conversations, each with checks on the outcome rather than the route.
// Sketch quality is judged by eye from the SVGs.
import { randomUUID } from "node:crypto";

const shape = (shapeType, x, y, extra = {}) => ({
    type: "shape",
    shapeType,
    startX: x,
    startY: y,
    endX: x + 180,
    endY: y + 90,
    color: "#111111",
    fillColor: null,
    size: 2,
    opacity: 100,
    zIndex: 1,
    rotation: 0,
    ...extra,
});
const sticky = (text, x, y, extra = {}) => ({
    type: "sticky",
    x,
    y,
    width: 200,
    height: 200,
    text,
    color: "#1f2937",
    fillColor: "#fef3c7",
    size: 16,
    opacity: 100,
    zIndex: 1,
    rotation: 0,
    ...extra,
});
const label = (text, x, y) => ({ type: "text", x, y, width: 140, text, color: "#111111", size: 16, opacity: 100, zIndex: 2, rotation: 0 });
const board =
    (...elements) =>
    () =>
        Object.fromEntries(elements.map((element) => [randomUUID(), { ...element }]));

const ROADMAP = board(
    sticky("Ship branching", 0, 0),
    sticky("Templates", 260, 0),
    shape("Rectangle", 0, 300, { fillColor: "#ffffff" }),
    label("Login", 40, 330),
    shape("Rectangle", 300, 300, { fillColor: "#ffffff" }),
    label("Dashboard", 340, 330),
);
const NOTES = board(sticky("Hire a designer", 0, 0), sticky("Fix onboarding bug", 240, 0), sticky("Plan offsite", 480, 0), sticky("Write launch post", 720, 0));

const isType =
    (...types) =>
    (outcome) =>
        types.includes(outcome.type);
const paths = (elements) => elements.filter((element) => element.type === "path");
const stickies = (elements) => elements.filter((element) => element.type === "sticky");
const shapes = (elements) => elements.filter((element) => element.type === "shape");
const hasOp = (outcome, op) => outcome.ops?.some((candidate) => candidate.op === op);
const drewOntoBoard = (outcome) => outcome.type === "edit" && hasOp(outcome, "drawParts");
const widthOf = (element) => Math.abs((element.endX ?? 0) - (element.startX ?? 0));
const noLabelledBlobs = (elements) =>
    !elements.some((element) => element.type === "text" && /human|leash|collar|sun|tree|bird|hat|cloud/i.test(element.text ?? "")) &&
    !elements.some((element) => element.type === "shape" && !element.text);

export const CONVERSATIONS = [
    {
        name: "dog, colours, then a human on a leash",
        steps: [
            { say: "create a cute dog", check: (o, els) => o.type === "sketch" && paths(els).length >= 4 },
            {
                say: "now add colors to this dog",
                check: (o, els) => o.type === "edit" && paths(els).some((el) => el.fillColor) && paths(els).every((el) => (el.opacity ?? 100) === 100),
            },
            {
                say: "add a human near the dog and a leash from the human's hand to the dog's collar",
                check: (o, els) =>
                    drewOntoBoard(o) &&
                    noLabelledBlobs(els) &&
                    paths(els).some((el) => /leash/i.test(el.label ?? "")) &&
                    paths(els).some((el) => /collar/i.test(el.label ?? "")),
            },
            { say: "make the human's shirt blue", check: (o) => o.type === "edit" && hasOp(o, "restyle") },
            { say: "what is on the board now?", check: (o) => o.type === "reply" && /dog/i.test(o.message) && /human|person|man|woman/i.test(o.message) },
        ],
    },
    {
        name: "house scene built up over turns",
        steps: [
            { say: "draw a house", check: isType("sketch") },
            {
                say: "add a tree to the right of the house",
                check: (o, els) => drewOntoBoard(o) && noLabelledBlobs(els) && paths(els).some((el) => /tree|trunk/i.test(el.label ?? "")),
            },
            {
                say: "put a sun in the sky above them",
                check: (o, els) => drewOntoBoard(o) && noLabelledBlobs(els) && paths(els).some((el) => /sun/i.test(el.label ?? "")),
            },
            {
                say: "colour the roof red and the door brown",
                check: (o, els) => o.type === "edit" && hasOp(o, "restyle") && paths(els).some((el) => el.fillColor || /#[0-9a-f]{6}/i.test(el.color ?? "")),
            },
            { say: "make the whole house bigger", check: (o) => o.type === "edit" && hasOp(o, "resize") },
            { say: "remove the sun", check: (o, els) => o.type === "edit" && hasOp(o, "delete") && !paths(els).some((el) => /sun/i.test(el.label ?? "")) },
        ],
    },
    {
        name: "sketch changed before it is placed",
        steps: [
            { say: "draw a cat", place: false, check: isType("sketch") },
            { say: "give it a party hat", place: false, check: (o) => o.type === "sketch" && o.parts.some((part) => /hat/i.test(part.name)) },
            { say: "now colour it in", place: false, check: (o) => o.type === "sketch" && o.parts.filter((part) => part.fill).length >= 3 },
            { say: "where is the hat?", check: (o) => o.type === "reply" && /hat/i.test(o.message) },
        ],
    },
    {
        name: "moving and sizing a placed sketch",
        steps: [
            { say: "sketch a rocket", check: isType("sketch") },
            { say: "make it twice as big", check: (o) => o.type === "edit" && hasOp(o, "resize") },
            { say: "move it to the right", check: (o) => o.type === "edit" && hasOp(o, "move") },
            { say: "rotate it 30 degrees", check: (o, els) => o.type === "edit" && hasOp(o, "rotate") },
            { say: "duplicate it", check: (o) => o.type === "edit" && hasOp(o, "duplicate") },
        ],
    },
    { name: "sketch subjects: car", steps: [{ say: "draw a car", check: isType("sketch") }] },
    { name: "sketch subjects: bicycle", steps: [{ say: "draw a bicycle", check: isType("sketch") }] },
    { name: "sketch subjects: person", steps: [{ say: "draw a person waving", check: isType("sketch") }] },
    { name: "sketch subjects: tree and bird", steps: [{ say: "draw a big tree with a bird on a branch", check: isType("sketch") }] },
    { name: "sketch subjects: coffee", steps: [{ say: "a coffee cup with steam", check: isType("sketch") }] },
    { name: "sketch subjects: laptop", steps: [{ say: "doodle a laptop", check: isType("sketch") }] },
    {
        name: "sketch subjects: coloured from the start",
        steps: [{ say: "draw a red apple with a green leaf", check: (o) => o.type === "sketch" && o.parts.some((part) => part.fill) }],
    },
    {
        name: "editing a roadmap board",
        board: ROADMAP,
        steps: [
            {
                say: "make all the sticky notes green",
                check: (o, els) => o.type === "edit" && stickies(els).every((el) => /^#/.test(el.fillColor) && el.fillColor !== "#fef3c7"),
            },
            {
                say: "change the Templates note to say Ship templates",
                check: (o, els) => o.type === "edit" && stickies(els).some((el) => el.text === "Ship templates"),
            },
            { say: "make the login box bigger", check: (o, els) => o.type === "edit" && hasOp(o, "resize") && shapes(els).some((el) => widthOf(el) > 180) },
            { say: "move the dashboard box to the right", check: (o) => o.type === "edit" && hasOp(o, "move") },
            { say: "connect login to dashboard", check: (o, els) => o.type === "edit" && els.some((el) => el.type === "connector") },
            { say: "rotate the login box by 45 degrees", check: (o, els) => o.type === "edit" && hasOp(o, "rotate") },
            { say: "put the Ship branching note below the Dashboard box", check: (o) => o.type === "edit" && hasOp(o, "place") },
            { say: "delete the login box", check: (o) => o.type === "edit" && hasOp(o, "delete") },
        ],
    },
    {
        name: "arranging a selection",
        board: NOTES,
        steps: [
            { say: "align these to the top", select: (el) => el.type === "sticky", check: (o) => o.type === "edit" && hasOp(o, "align") },
            { say: "space them out evenly", select: (el) => el.type === "sticky", check: (o) => o.type === "edit" && hasOp(o, "distribute") },
            { say: "group them", select: (el) => el.type === "sticky", check: (o) => o.type === "edit" && hasOp(o, "group") },
            {
                say: "make this one red",
                select: (el) => el.text === "Plan offsite",
                check: (o, els) => o.type === "edit" && stickies(els).filter((el) => el.fillColor !== "#fef3c7").length >= 1,
            },
            { say: "tidy the board up", check: isType("edit") },
        ],
    },
    {
        name: "writing content onto the board",
        board: ROADMAP,
        steps: [
            { say: "add 5 sticky notes with ideas for a team offsite", check: (o, els) => o.type === "edit" && stickies(els).length >= 7 },
            {
                say: "add a title above everything that says Q4 Planning",
                check: (o, els) => o.type === "edit" && els.some((el) => el.type === "text" && /Q4 Planning/i.test(el.text)),
            },
            { say: "summarise this board in a new sticky note", check: (o, els) => o.type === "edit" && hasOp(o, "add") },
            { say: "translate the Templates note into French", check: (o) => o.type === "edit" && hasOp(o, "setText") },
        ],
    },
    {
        name: "structured boards",
        steps: [
            {
                say: "create a kanban board with to do, doing and done columns",
                check: (o, els) => (o.type === "edit" || o.type === "diagram") && els.length >= 3,
            },
            { say: "make a pros and cons list for remote work on sticky notes", check: (o, els) => o.type === "edit" && stickies(els).length >= 2 },
        ],
    },
    {
        name: "diagram kinds",
        steps: [
            {
                say: "flowchart for a user login with a password check and a forgot password path",
                check: (o) => o.type === "diagram" && o.nodes.some((n) => n.shape === "diamond"),
            },
            { say: "an org chart for a small startup", check: (o) => o.type === "diagram" && o.nodes.length >= 4 },
            { say: "a mind map about healthy eating", check: (o) => o.type === "diagram" && o.nodes.length >= 5 },
            {
                say: "draw the architecture of a web app with a load balancer, two servers and a database",
                check: (o) => o.type === "diagram" && o.nodes.length >= 4,
            },
            { say: "a timeline of the software release process", check: (o) => o.type === "diagram" && o.nodes.length >= 3 },
            { say: "an ER diagram for a blog with users, posts and comments", check: (o) => o.type === "diagram" && o.nodes.length >= 3 },
            { say: "a sequence diagram of a client calling an API that calls a database", check: (o) => o.type === "diagram" && o.nodes.length >= 3 },
        ],
    },
    {
        name: "changing a diagram already on the board",
        steps: [
            { say: "flowchart of signup: enter email, verify email, create profile, done", check: isType("diagram") },
            {
                say: "add a step for accepting the terms before create profile",
                check: (o, els) =>
                    o.type === "diagram" &&
                    o.nodes.some((n) => /terms/i.test(n.label)) &&
                    o.replaceRefs.length > 0 &&
                    els.filter((el) => /verify email/i.test(el.text ?? "")).length === 1,
            },
            { say: "make the done node green", check: isType("edit", "diagram") },
            {
                say: "rename verify email to confirm email",
                check: (o, els) => els.some((el) => /confirm email/i.test(el.text ?? "")) && !els.some((el) => /verify email/i.test(el.text ?? "")),
            },
            { say: "remove the terms step", check: (o, els) => !els.some((el) => /terms/i.test(el.text ?? "")) },
        ],
    },
    {
        name: "talking to the assistant",
        board: ROADMAP,
        steps: [
            { say: "hi", check: isType("reply") },
            { say: "what can you do?", check: isType("reply") },
            { say: "thanks, that helps", check: isType("reply") },
            { say: "undo that", check: (o) => o.type === "reply" || o.type === "unresolved" },
            { say: "how many sticky notes are there?", check: (o) => o.type === "reply" && /2|two/i.test(o.message) },
            { say: "share this board with priya", check: (o) => o.type === "reply" || o.type === "unresolved" },
        ],
    },
    {
        name: "asking how to use the whiteboard",
        board: ROADMAP,
        steps: [
            { say: "how do I export this board as a png?", check: isType("help") },
            { say: "how do I invite someone to this board?", check: isType("help") },
            { say: "what does the frame tool do?", check: isType("help") },
            { say: "I need help using this whiteboard", check: isType("help") },
            { say: "what is on this board?", check: isType("reply") },
        ],
    },
    {
        name: "messy and vague input",
        board: ROADMAP,
        steps: [
            { say: "drw a flocart of user login", check: isType("diagram") },
            { say: "make the logn box blu", check: (o) => o.type === "edit" && hasOp(o, "restyle") },
            { say: "एक बिल्ली बनाओ", check: isType("sketch") },
            { say: "make it nicer", check: (o) => o.type !== "error" && o.type !== "invalid" },
            { say: "draw something", check: isType("sketch", "reply", "unresolved") },
        ],
    },
    {
        name: "out of scope stays out",
        board: ROADMAP,
        steps: [
            { say: "what is the capital of france?", check: isType("refuse") },
            { say: "write me a python script to sort a list", check: isType("refuse") },
        ],
    },
];
