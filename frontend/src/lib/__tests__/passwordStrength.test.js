import { describe, it, expect } from "vitest";
import { passwordProblem, passwordStrength } from "../passwordStrength";

describe("passwordStrength", () => {
    it("asks for the minimum length before scoring", () => {
        expect(passwordStrength("").score).toBe(0);
        expect(passwordStrength("abc")).toEqual({ score: 1, hint: "5 more to go" });
    });

    it("holds a password that breaks the policy to one bar and says why", () => {
        expect(passwordStrength("password12!")).toEqual({ score: 1, hint: "That's one of the first passwords attackers try. Pick something less common." });
        expect(passwordStrength("onlyletters").hint).toBe("Mix letters with a number or symbol.");
    });

    it("rewards length and variety once the policy is met", () => {
        expect(passwordStrength("harbor42").score).toBe(2);
        expect(passwordStrength("harbor-lights").score).toBe(3);
        expect(passwordStrength("harbor-42-lights").score).toBe(4);
    });
});

describe("passwordProblem", () => {
    it.each([
        ["short1!", "Use at least 8 characters."],
        ["12345678", "Mix letters with a number or symbol."],
        ["aaaaaaa1", "Avoid repeated characters and simple sequences."],
        ["qwerty123", "That's one of the first passwords attackers try. Pick something less common."],
        ["P@ssw0rd!", "That's one of the first passwords attackers try. Pick something less common."],
    ])("rejects %s", (password, reason) => {
        expect(passwordProblem(password)).toBe(reason);
    });

    it("rejects a password containing the username, whatever its case", () => {
        expect(passwordProblem("xSujanX99", { username: "sujan" })).toBe("Don't use your username in your password.");
    });

    it("rejects what bcrypt would silently truncate", () => {
        expect(passwordProblem(`a1${"x".repeat(80)}`)).toBe("Use at most 72 characters.");
    });

    it("accepts a reasonable password", () => {
        expect(passwordProblem("TestPass123!")).toBeNull();
        expect(passwordProblem("correct horse battery")).toBeNull();
    });
});
