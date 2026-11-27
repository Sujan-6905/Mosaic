import { line, INK, SOFT, frame, linked, piece, set, shape, text } from "./builders.js";

// Formal notations people already read: BPMN for processes, UML for software
// design, and both ER styles for data models.

const bpmn = set("bpmn", "BPMN", "Events, tasks, gateways and pools for formal process maps.", [
    piece("Start event", [shape("Circle", 0, 0, 44, 44, { size: 1.5, fillColor: SOFT.green })]),
    piece("Intermediate event", [shape("Circle", 0, 0, 44, 44, { size: 1.5 }), shape("Circle", 5, 5, 34, 34, { size: 1.5 })]),
    piece("End event", [shape("Circle", 0, 0, 44, 44, { size: 4, fillColor: SOFT.rose })]),
    piece("Message event", [
        shape("Circle", 0, 0, 44, 44, { size: 1.5 }),
        shape("Rectangle", 11, 14, 22, 16, { size: 1.5 }),
        line(11, 14, 22, 23, { size: 1.5 }),
        line(33, 14, 22, 23, { size: 1.5 }),
    ]),
    piece("Timer event", [
        shape("Circle", 0, 0, 44, 44, { size: 1.5 }),
        shape("Circle", 8, 8, 28, 28, { size: 1.5 }),
        line(22, 22, 22, 12, { size: 1.5 }),
        line(22, 22, 30, 22, { size: 1.5 }),
    ]),
    piece("Task", [shape("Rectangle", 0, 0, 160, 80, { cornerRadius: 12, text: "Review order" })]),
    piece("Subprocess", [
        shape("Rectangle", 0, 0, 170, 90, { cornerRadius: 12, text: "Fulfil order" }),
        shape("Rectangle", 77, 70, 16, 16, { size: 1.5, text: "+", fontSize: 13 }),
    ]),
    piece("Exclusive gateway", [shape("Diamond", 0, 0, 56, 56, { text: "X", fontWeight: "bold", fillColor: SOFT.amber })]),
    piece("Parallel gateway", [shape("Diamond", 0, 0, 56, 56, { text: "+", fontWeight: "bold", fontSize: 22, fillColor: SOFT.amber })]),
    piece("Inclusive gateway", [shape("Diamond", 0, 0, 56, 56, { fillColor: SOFT.amber }), shape("Circle", 17, 17, 22, 22, { size: 2.5 })]),
    piece("Data object", [shape("Document", 0, 0, 60, 76, { text: "Invoice", fontSize: 11, verticalAlign: "bottom" })]),
    piece("Data store", [shape("Cylinder", 0, 0, 80, 70, { text: "CRM", fontSize: 12 })]),
    piece("Pool with lanes", [
        frame(0, 0, 640, 300, "Company"),
        shape("Rectangle", 0, 0, 40, 300, { size: 1.5, text: "Company", fontSize: 12, fontWeight: "bold" }),
        line(40, 150, 640, 150, { size: 1.5 }),
        text(50, 10, "Sales", 13, { fontWeight: "bold" }),
        text(50, 160, "Warehouse", 13, { fontWeight: "bold" }),
    ]),
    piece(
        "Sequence flow",
        linked(
            [
                shape("Circle", 0, 18, 44, 44, { size: 1.5, fillColor: SOFT.green }),
                shape("Rectangle", 120, 0, 160, 80, { cornerRadius: 12, text: "Receive order" }),
                shape("Circle", 356, 18, 44, 44, { size: 4, fillColor: SOFT.rose }),
            ],
            [
                [0, 1],
                [1, 2],
            ],
        ),
    ),
]);

const uml = set("uml", "UML", "Classes, actors, use cases, components and states for software design.", [
    piece("Class", [
        shape("Rectangle", 0, 0, 200, 34, { text: "Order", fontWeight: "bold" }),
        shape("Rectangle", 0, 34, 200, 60, { text: "- id: UUID\n- total: Money", align: "left", fontSize: 13 }),
        shape("Rectangle", 0, 94, 200, 54, { text: "+ place(): void\n+ cancel(): void", align: "left", fontSize: 13 }),
    ]),
    piece("Interface", [
        shape("Rectangle", 0, 0, 200, 50, { text: "Payable", subtext: "interface", fontStyle: "italic", fontWeight: "bold" }),
        shape("Rectangle", 0, 50, 200, 44, { text: "+ pay(amount): Receipt", align: "left", fontSize: 13 }),
    ]),
    piece("Actor", [shape("Person", 0, 0, 72, 100, { text: "Customer", fontSize: 13 })]),
    piece("Use case", [shape("Ellipse", 0, 0, 180, 70, { text: "Place an order" })]),
    piece("System boundary", [
        shape("Rectangle", 0, 0, 380, 300, { cornerRadius: 4, size: 1.5, text: "Shop", verticalAlign: "top", fontWeight: "bold" }),
        shape("Ellipse", 100, 70, 180, 64, { text: "Browse" }),
        shape("Ellipse", 100, 180, 180, 64, { text: "Check out" }),
    ]),
    piece("Component", [
        shape("Rectangle", 0, 0, 190, 90, { text: "Payments", subtext: "component" }),
        shape("Rectangle", 160, 10, 20, 14, { size: 1.2 }),
        shape("Rectangle", 154, 14, 10, 4, { size: 1, fillColor: INK }),
        shape("Rectangle", 154, 20, 10, 4, { size: 1, fillColor: INK }),
    ]),
    piece("Package", [shape("Folder", 0, 0, 220, 140, { text: "billing", fontWeight: "bold" })]),
    piece("Note", [shape("Document", 0, 0, 200, 90, { text: "Totals include tax", fillColor: SOFT.amber })]),
    piece("Lifeline", [
        shape("Rectangle", 0, 0, 140, 50, { text: "API" }),
        line(70, 50, 70, 320, { strokeStyle: "dashed", size: 1.5 }),
        shape("Rectangle", 62, 90, 16, 120, { size: 1.5, fillColor: SOFT.blue }),
    ]),
    piece("State", [shape("Rectangle", 0, 0, 150, 64, { cornerRadius: 22, text: "Paid" })]),
    piece("Initial and final", [
        shape("Circle", 0, 0, 26, 26, { fillColor: INK, size: 0 }),
        shape("Circle", 80, -4, 34, 34, { size: 2 }),
        shape("Circle", 87, 3, 20, 20, { fillColor: INK, size: 0 }),
    ]),
    piece("Fork bar", [shape("Rectangle", 0, 0, 200, 10, { fillColor: INK, size: 0 })]),
    piece(
        "Inheritance",
        linked(
            [
                shape("Rectangle", 70, 0, 160, 60, { text: "Payment", fontWeight: "bold" }),
                shape("Rectangle", 0, 150, 140, 60, { text: "Card" }),
                shape("Rectangle", 170, 150, 140, 60, { text: "Bank transfer" }),
            ],
            [
                [1, 0],
                [2, 0],
            ],
        ).map((element) => (element.type === "connector" ? { ...element, endHead: "triangle_outline", arrowEnd: true } : element)),
    ),
]);

const er = set("entity-relationship", "Entity relationship", "Tables, keys and crow's foot links, plus Chen notation.", [
    piece("Table", [
        shape("Rectangle", 0, 0, 220, 36, { text: "customers", fontWeight: "bold", fillColor: SOFT.blue }),
        shape("Rectangle", 0, 36, 220, 96, { text: "PK  id\n      name\n      email", align: "left", fontSize: 13 }),
    ]),
    piece("Table with key", [
        shape("Rectangle", 0, 0, 220, 36, { text: "orders", fontWeight: "bold", fillColor: SOFT.blue }),
        shape("Rectangle", 0, 36, 220, 96, { text: "PK  id\nFK  customer_id\n      total", align: "left", fontSize: 13 }),
    ]),
    piece(
        "One to many",
        linked(
            [
                shape("Rectangle", 0, 0, 160, 50, { text: "customers", fontWeight: "bold" }),
                shape("Rectangle", 300, 0, 160, 50, { text: "orders", fontWeight: "bold" }),
            ],
            [[0, 1]],
        ).map((element) => (element.type === "connector" ? { ...element, startHead: "crowfoot_one", endHead: "crowfoot_many", arrowStart: true } : element)),
    ),
    piece(
        "Many to many",
        linked(
            [
                shape("Rectangle", 0, 0, 150, 50, { text: "students", fontWeight: "bold" }),
                shape("Rectangle", 300, 0, 150, 50, { text: "courses", fontWeight: "bold" }),
            ],
            [[0, 1, "enrols in"]],
        ).map((element) => (element.type === "connector" ? { ...element, startHead: "crowfoot_many", endHead: "crowfoot_many", arrowStart: true } : element)),
    ),
    piece("Chen entity", [shape("Rectangle", 0, 0, 150, 60, { text: "Student" })]),
    piece("Chen attribute", [shape("Ellipse", 0, 0, 130, 54, { text: "name" })]),
    piece("Chen key attribute", [shape("Ellipse", 0, 0, 130, 54, { text: "student_id", fontStyle: "italic", fontWeight: "bold" })]),
    piece("Chen relationship", [shape("Diamond", 0, 0, 150, 90, { text: "enrols", fillColor: SOFT.amber })]),
    piece("Weak entity", [shape("Rectangle", 0, 0, 160, 66, {}), shape("Rectangle", 6, 6, 148, 54, { text: "Order line" })]),
]);

export const NOTATION_KITS = [bpmn, uml, er];
