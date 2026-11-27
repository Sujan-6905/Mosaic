// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildMermaidElements, mermaidSourceIn } from "../../../../../../shared/canvas/mermaid/buildMermaidElements.js";
import { parseMermaid } from "../parseMermaid";
import { estimatedTextMetrics } from "../layoutEngine";

let n = 0;
const build = async (code) => {
    const parsed = await parseMermaid(code);
    if (parsed.error) throw new Error(parsed.error);
    return { parsed, elements: buildMermaidElements(parsed, { metrics: estimatedTextMetrics, generateElementId: () => `id${n++}` }) };
};
const byType = (elements, type) => elements.filter(({ element }) => element.type === type).map(({ element }) => element);

describe("Mermaid to board", () => {
    it("recognises Mermaid code and nothing else", () => {
        expect(mermaidSourceIn("flowchart LR\n A --> B")).toBe("flowchart LR\n A --> B");
        expect(mermaidSourceIn("%% a note\ngraph TD\n A-->B")).toBe("%% a note\ngraph TD\n A-->B");
        expect(mermaidSourceIn("```mermaid\ngraph TD\n A-->B\n```")).toBe("graph TD\n A-->B");
        expect(mermaidSourceIn("Remember the graph meeting")).toBeNull();
    });

    // The first parse loads the whole Mermaid library, which a cold or busy machine can't do in five seconds.
    it("turns a flowchart's shapes, arrows, labels and subgraph into board elements", { timeout: 30_000 }, async () => {
        const { elements } = await build(
            "flowchart LR\n subgraph API[Backend API]\n A[Start] --> B{Is it?}\n end\n B -- Yes --> C((Done))\n B -.->|No| D[(DB)]\n D ==> E>Flag]\n style A fill:#ffd166",
        );
        const shapes = byType(elements, "shape");
        expect(shapes.map((shape) => shape.shapeType).sort()).toEqual(["BlockArrow", "Circle", "Cylinder", "Diamond", "Rectangle"]);
        expect(shapes.find((shape) => shape.text === "Start").fillColor).toBe("#ffd166");
        const frame = byType(elements, "frame")[0];
        expect(frame.name).toBe("Backend API");
        const frameId = elements.find(({ element }) => element === frame).elementId;
        expect(
            shapes
                .filter((shape) => shape.frameId === frameId)
                .map((shape) => shape.text)
                .sort(),
        ).toEqual(["Is it?", "Start"]);
        const arrows = byType(elements, "connector");
        expect(arrows).toHaveLength(4);
        expect(arrows.find((arrow) => arrow.text === "No").strokeStyle).toBe("dashed");
        expect(arrows.find((arrow) => arrow.size === 4)).toBeTruthy();
        arrows.forEach((arrow) => expect(arrow.startElementId && arrow.endElementId).toBeTruthy());
        shapes.forEach((shape) => {
            const startInside = shape.frameId ? shape.startX >= frame.startX && shape.endX <= frame.endX : true;
            expect(startInside).toBe(true);
        });
    });

    it("lays a left-right chart out across and a top-down one down", async () => {
        const across = byType((await build("flowchart LR\n A --> B")).elements, "shape");
        expect(Math.abs(across[0].startY - across[1].startY)).toBeLessThan(1);
        const down = byType((await build("flowchart TD\n A --> B")).elements, "shape");
        expect(Math.abs(down[0].startX - down[1].startX)).toBeLessThan(1);
    });

    it("lists a class's members and marks inheritance and composition", async () => {
        const { elements } = await build("classDiagram\n Animal <|-- Duck\n Animal : +int age\n Animal: +isMammal()\n Duck *-- Egg");
        const animal = byType(elements, "shape").find((shape) => shape.text === "Animal");
        expect(animal.subtext).toBe("+int age\n+isMammal()");
        const heads = byType(elements, "connector")
            .map((arrow) => arrow.startHead)
            .sort();
        expect(heads).toEqual(["diamond", "triangle_outline"]);
    });

    it("gives entity relationships crow's feet and their attributes", async () => {
        const { elements } = await build("erDiagram\n CUSTOMER ||--o{ ORDER : places\n ORDER { string id PK\n int total }");
        const arrow = byType(elements, "connector")[0];
        expect([arrow.startHead, arrow.endHead]).toEqual(["crowfoot_one", "crowfoot_many"]);
        expect(arrow.text).toBe("places");
        expect(byType(elements, "shape").find((shape) => shape.text === "ORDER").subtext).toBe("string id PK\nint total");
    });

    it("draws state diagrams with start and end markers", async () => {
        const shapes = byType((await build("stateDiagram-v2\n [*] --> Still\n Still --> Moving : push\n Moving --> [*]")).elements, "shape");
        expect(shapes.filter((shape) => shape.shapeType === "Circle" && !shape.text)).toHaveLength(2);
    });

    it("spreads a mind map around its root without arrowheads", async () => {
        const { elements } = await build("mindmap\n  root((Plan))\n    Research\n      Users\n    Build");
        expect(byType(elements, "shape")).toHaveLength(4);
        byType(elements, "connector").forEach((arrow) => expect(arrow.endHead).toBe("none"));
    });

    it("keeps an architecture's services inside their group", async () => {
        const { elements } = await build(
            "architecture-beta\n group api(cloud)[API]\n service db(database)[Database] in api\n service server(server)[Server] in api\n db:L -- R:server",
        );
        expect(byType(elements, "frame")[0].name).toBe("API");
        expect(byType(elements, "shape").find((shape) => shape.text === "Database").shapeType).toBe("Cylinder");
    });

    it("draws a sequence as lifelines with messages, notes and loops in order", async () => {
        const { elements } = await build(
            "sequenceDiagram\n participant A as Alice\n actor B as Bob\n A->>B: Hi\n loop Every minute\n B-->>A: Hello\n end\n Note right of B: thinks\n B->>B: self",
        );
        const messages = byType(elements, "connector").filter((arrow) => arrow.text);
        expect(messages.map((message) => message.text)).toEqual(["Hi", "Hello", "self"]);
        expect(messages[1].strokeStyle).toBe("dashed");
        expect(messages[0].startY).toBeLessThan(messages[1].startY);
        expect(byType(elements, "sticky")[0].text).toBe("thinks");
        expect(byType(elements, "frame")[0].name).toBe("loop Every minute");
        expect(byType(elements, "connector").filter((arrow) => !arrow.text && arrow.strokeStyle === "dashed")).toHaveLength(2);
    });

    it("says what's wrong instead of drawing broken code or an unsupported kind", async () => {
        expect((await parseMermaid("flowchart LR\n A --> ")).error).toBeTruthy();
        expect((await parseMermaid('pie title Pets\n "Dogs" : 3')).error).toMatch(/can't become board shapes yet/);
    });
});
