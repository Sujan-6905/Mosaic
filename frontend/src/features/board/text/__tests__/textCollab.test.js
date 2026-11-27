import { describe, expect, it } from "vitest";
import { caretAfterChange, createTextCollabSession } from "../textCollab";

// Two people's editors joined by a relay that delivers every update to the other, as the room does.
const room = () => {
    const people = {};
    return (name, initialText) => {
        const other = name === "maya" ? "leo" : "maya";
        people[name] = createTextCollabSession({
            initialText,
            emitUpdate: (update) => people[other]?.applyRemoteUpdate(update),
            onRemoteText: () => {},
        });
        return people[name];
    };
};

// Typing into an editor showing `shown`, which is the session's own text unless the screen lags behind it.
const type = (session, at, words, shown = session.getText()) => session.applyLocalChange(shown, shown.slice(0, at) + words + shown.slice(at));

describe("two people typing in one note", () => {
    it("gives someone who opens a note mid-edit what is already typed, without a second copy of it", () => {
        const open = room();
        const maya = open("maya", "Launch on");
        type(maya, 9, " Friday, together");
        // Leo's board holds the note as it was last flushed, part way through Maya's typing.
        const leo = open("leo", "Launch on Friday");
        maya.applyRemoteUpdate(leo.openingRequest());
        leo.applyRemoteState(maya.fullState());
        type(leo, 0, "We ");
        expect(maya.getText()).toBe("We Launch on Friday, together");
        expect(leo.getText()).toBe("We Launch on Friday, together");
    });

    it("keeps one copy when both open the same note at the same moment", () => {
        const open = room();
        const maya = open("maya", "Plan");
        const leo = open("leo", "Plan");
        type(maya, 4, " A");
        type(leo, 0, "Our ");
        expect(maya.getText()).toBe("Our Plan A");
        expect(leo.getText()).toBe("Our Plan A");
    });

    it("keeps words that merged in while this person's screen still showed the older text", () => {
        const open = room();
        const maya = open("maya", "Launch on");
        const leo = open("leo", "Launch on");
        type(maya, 9, " Friday");
        // Leo's screen still shows "Launch on" when he types at its start.
        expect(type(leo, 0, "We ", "Launch on")).toBe("We Launch on Friday");
        expect(maya.getText()).toBe("We Launch on Friday");
    });

    it("keeps the newcomer's words when they type before the others' text arrives", () => {
        const open = room();
        const maya = open("maya", "Notes");
        type(maya, 5, " from Maya");
        const leo = open("leo", "Notes");
        type(leo, 0, "Leo: ");
        leo.applyRemoteState(maya.fullState());
        expect(leo.getText()).toContain("Leo: ");
        expect(leo.getText()).toContain(" from Maya");
    });
});

describe("the caret while someone else types", () => {
    it("stays put when the change is after it", () => {
        expect(caretAfterChange("Launch on", "Launch on Friday", 3)).toBe(3);
    });

    it("moves along when the change is before it", () => {
        expect(caretAfterChange("Launch on", "We Launch on", 6)).toBe(9);
    });

    it("lands after the new words when the change replaces the words around it", () => {
        expect(caretAfterChange("plan Alpha today", "plan B today", 7)).toBe(6);
    });
});
