import { describe, it, expect } from "vitest";
import {
    registerSchema,
    loginSchema,
    oauthLoginSchema,
    oauthCompleteSchema,
    changePasswordSchema,
    createDrawingSchema,
    updateDrawingTitleSchema,
    addCollaboratorSchema,
    removeCollaboratorSchema,
    aiTurnSchema,
} from "../restSchemas.js";

describe("registerSchema", () => {
    it("accepts a valid payload", () => {
        const result = registerSchema.safeParse({ username: "ada_lovelace", password: "harbor-lights-42" });
        expect(result.success).toBe(true);
    });

    it("rejects a username with invalid characters", () => {
        expect(registerSchema.safeParse({ username: "ada lovelace!", password: "harbor-lights-42" }).success).toBe(false);
    });

    it.each([
        ["under 8 characters", "abc12"],
        ["a common password with a suffix", "password123!"],
        ["letters only", "correcthorse"],
    ])("rejects a password that is %s", (_label, password) => {
        expect(registerSchema.safeParse({ username: "ada", password }).success).toBe(false);
    });

    it("rejects a password containing the username, and points the error at the password", () => {
        const result = registerSchema.safeParse({ username: "ada_lovelace", password: "xADA_LOVELACE9" });
        expect(result.success).toBe(false);
        expect(result.error.issues[0].path).toEqual(["password"]);
    });

    it("rejects a missing username", () => {
        expect(registerSchema.safeParse({ password: "hunter2" }).success).toBe(false);
    });
});

describe("loginSchema", () => {
    it("accepts a valid payload", () => {
        expect(loginSchema.safeParse({ username: "ada", password: "x" }).success).toBe(true);
    });

    it("rejects an empty password", () => {
        expect(loginSchema.safeParse({ username: "ada", password: "" }).success).toBe(false);
    });
});

describe("oauthLoginSchema", () => {
    it("accepts a valid payload without the optional name", () => {
        const result = oauthLoginSchema.safeParse({
            provider: "google",
            providerAccountId: "12345",
            email: "ada@example.com",
        });
        expect(result.success).toBe(true);
    });

    it("rejects a missing provider", () => {
        expect(oauthLoginSchema.safeParse({ providerAccountId: "12345", email: "ada@example.com" }).success).toBe(false);
    });
});

describe("oauthCompleteSchema", () => {
    it("accepts a valid payload", () => {
        const result = oauthCompleteSchema.safeParse({
            provider: "google",
            providerAccountId: "12345",
            email: "ada@example.com",
            username: "ada_lovelace",
        });
        expect(result.success).toBe(true);
    });

    it("rejects an invalid username", () => {
        expect(
            oauthCompleteSchema.safeParse({
                provider: "google",
                providerAccountId: "12345",
                email: "ada@example.com",
                username: "a",
            }).success,
        ).toBe(false);
    });
});

describe("changePasswordSchema", () => {
    it("strips an unrelated field - the target user comes from the JWT, not the body", () => {
        const result = changePasswordSchema.safeParse({
            username: "attacker",
            oldpassword: "old",
            password: "newpass1",
        });
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ oldpassword: "old", password: "newpass1" });
    });

    it("rejects a new password under 6 characters", () => {
        expect(changePasswordSchema.safeParse({ oldpassword: "old", password: "abc" }).success).toBe(false);
    });
});

describe("createDrawingSchema", () => {
    it("strips a userId field - ownership comes from the JWT, not the body", () => {
        const result = createDrawingSchema.safeParse({ title: "Untitled", userId: "someone-elses-id" });
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ title: "Untitled" });
    });

    it("rejects an empty title", () => {
        expect(createDrawingSchema.safeParse({ title: "" }).success).toBe(false);
    });

    it("rejects a title over 200 characters", () => {
        expect(createDrawingSchema.safeParse({ title: "x".repeat(201) }).success).toBe(false);
    });
});

describe("updateDrawingTitleSchema", () => {
    it("rejects a missing newTitle", () => {
        expect(updateDrawingTitleSchema.safeParse({}).success).toBe(false);
    });
});

describe("addCollaboratorSchema", () => {
    it("accepts a valid username and role", () => {
        expect(addCollaboratorSchema.safeParse({ username: "ada", role: "editor" }).success).toBe(true);
    });

    it("rejects an owner role - owner is implicit, never assignable", () => {
        expect(addCollaboratorSchema.safeParse({ username: "ada", role: "owner" }).success).toBe(false);
    });

    it("rejects an unknown role", () => {
        expect(addCollaboratorSchema.safeParse({ username: "ada", role: "superadmin" }).success).toBe(false);
    });
});

describe("removeCollaboratorSchema", () => {
    it("rejects a missing username", () => {
        expect(removeCollaboratorSchema.safeParse({}).success).toBe(false);
    });
});

describe("aiTurnSchema", () => {
    it("accepts a short message and defaults to review", () => {
        expect(aiTurnSchema.parse({ message: "a login flow diagram" }).review).toBe("preview");
    });

    it("rejects an empty message", () => {
        expect(aiTurnSchema.safeParse({ message: "" }).success).toBe(false);
    });

    it("rejects a message over 2000 characters - bounds what reaches the model", () => {
        expect(aiTurnSchema.safeParse({ message: "x".repeat(2001) }).success).toBe(false);
    });

    it("rejects an unknown review mode", () => {
        expect(aiTurnSchema.safeParse({ message: "hi", review: "skip-everything" }).success).toBe(false);
    });
});
